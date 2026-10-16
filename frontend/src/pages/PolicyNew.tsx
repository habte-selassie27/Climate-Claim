import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useRead } from "../hooks/useRead";
import { useWallet } from "../hooks/useWallet";
import {
  getOwner,
  getPolicyCount,
  listSources,
  snapshotOwner,
  snapshotSources,
} from "../services/claimService";
import { runWrite } from "../services/evaluationService";
import { IDLE, type TxState } from "../services/txStatus";
import { TxStatusPanel } from "../components/TxStatusPanel";
import { policySentence } from "../domain/copy";
import {
  clearDraft,
  INITIAL_FORM,
  isDirty,
  loadDraft,
  saveDraft,
  type PolicyFormState,
} from "../domain/draftStore";
import { toMicroDegrees, toScaled, truncateAddress } from "../domain/format";
import { activeNetwork } from "../config/network";
import type { SourceDef } from "../domain/types";
import { useI18n } from "../i18n/I18nProvider";

const net = activeNetwork();

/**
 * Create policy.
 *
 * Every default, option and validation rule here mirrors the contract's own
 * `create_policy` (contracts/climateclaim.py, verified against the saved schema
 * at docs/schema.genlayer-cli.txt). The contract is the authority; the form
 * exists to stop the user sending a transaction that must fail.
 *
 * Two contract rules shape this page:
 *  - the write is owner-only ("EXPECTED: not owner"), so the connected wallet
 *    is checked against `get_owner` before submit;
 *  - `unit` is not a free field: the contract requires the canonical unit for
 *    the metric (precipitation -> mm, temperature -> celsius), so the unit
 *    follows the metric instead of being typed.
 */

// Mirrors of contract constants (climateclaim.py lines 51-133). Values, not
// behaviour: the contract re-checks all of them at write time.
const METRIC_UNITS = { precipitation: "mm", temperature: "celsius" } as const;
const METRICS = Object.keys(METRIC_UNITS) as (keyof typeof METRIC_UNITS)[];
const COMPARATORS = ["gt", "gte", "lt", "lte"];
const AGREEMENT_RULES = ["unanimous", "majority", "any"];
// Only the aggregations the contract accepts, and only the ones that are
// meaningful for the chosen metric (temperature supports peaks only; summing
// daily maximum temperatures is not a weather threshold).
const AGGREGATIONS = ["max_single", "cumulative", "consecutive_days"] as const;
const AGGREGATION_LABEL: Record<string, string> = {
  max_single: "highest single reading on any day",
  cumulative: "total across the whole period (precipitation only)",
  consecutive_days: "longest run of consecutive wet days (threshold in days)",
};
/** The unit each aggregation's result is measured in, mirroring the contract. */
function resultUnit(aggregation: string, metric: keyof typeof METRIC_UNITS): string {
  return aggregation === "consecutive_days" ? "days" : METRIC_UNITS[metric];
}
const COMPARATOR_LABEL: Record<string, string> = {
  gt: "more than (>)",
  gte: "at least (≥)",
  lt: "less than (<)",
  lte: "at most (≤)",
};
const MAX_SOURCES = 4; // MAX_SOURCES_PER_POLICY
const MAX_PERIOD_DAYS = 366;
const MAX_TOLERANCE_M = 200000; // 200 km
const MAX_SCALED = 10_000_000; // _plausible: 100_000 * SCALE
const MAX_PAYOUT = 10n ** 30n; // MAX_PAYOUT
const MAX_CONDITION_CHARS = 300;

const NUM_RE = /^-?\d+(\.\d+)?$/;
const INT_RE = /^\d+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * The form shape lives in `domain/draftStore` so the persisted draft and the
 * live form cannot drift apart. This alias keeps the local name short.
 */
type FormState = PolicyFormState;

/** Today's date in UTC, as the contract computes it in `_today_iso`. */
function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function isIsoDate(value: string): boolean {
  return DATE_RE.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

function inclusiveDays(start: string, end: string): number {
  const a = Date.parse(`${start}T00:00:00Z`);
  const b = Date.parse(`${end}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / 86_400_000) + 1;
}

/** Client-side mirror of the contract's create_policy validation. */
function validate(form: FormState): Record<string, string> {
  const errors: Record<string, string> = {};

  if (form.location_name.trim().length === 0 || form.location_name.trim().length > 200) {
    errors.location_name = "Enter a location name of 1 to 200 characters.";
  }
  if (!NUM_RE.test(form.lat) || Math.abs(Number(form.lat)) > 90) {
    errors.lat = "Latitude must be a number between -90 and 90 degrees.";
  }
  if (!NUM_RE.test(form.lon) || Math.abs(Number(form.lon)) > 180) {
    errors.lon = "Longitude must be a number between -180 and 180 degrees.";
  }
  if (!INT_RE.test(form.tolerance_m) || Number(form.tolerance_m) > MAX_TOLERANCE_M) {
    errors.tolerance_m = `Distance tolerance must be a whole number of metres, 0 to ${MAX_TOLERANCE_M}.`;
  }
  if (form.sourceIds.length === 0) {
    errors.sources = "Choose at least one source.";
  } else if (form.sourceIds.length > MAX_SOURCES) {
    errors.sources = `At most ${MAX_SOURCES} sources per policy.`;
  }
  const minSources = Number(form.min_sources);
  if (
    !INT_RE.test(form.min_sources) ||
    minSources < 1 ||
    minSources > form.sourceIds.length
  ) {
    errors.min_sources = `Minimum agreeing sources must be between 1 and the number chosen (${form.sourceIds.length}).`;
  }
  if (!isIsoDate(form.period_start) || !isIsoDate(form.period_end)) {
    errors.period = "Both dates must be valid calendar dates (YYYY-MM-DD).";
  } else {
    if (form.period_start > form.period_end) {
      errors.period = "The start date is after the end date.";
    } else if (inclusiveDays(form.period_start, form.period_end) > MAX_PERIOD_DAYS) {
      errors.period = `The period may not exceed ${MAX_PERIOD_DAYS} days.`;
    } else if (form.data_mode === "historical_simulation" && form.period_end >= todayIso()) {
      errors.period =
        "A historical simulation must observe a period entirely in the past. Switch to Live for a window that reaches today.";
    } else if (form.data_mode === "live" && form.period_end < todayIso()) {
      errors.period =
        "A live policy's window must reach the present day, because it reads a live source.";
    }
  }
  if (!["UTC", "GMT"].includes(form.timezone.trim().toUpperCase())) {
    errors.timezone =
      "The contract only evaluates UTC observation windows: every date is a UTC calendar day.";
  }
  const scaled = toScaled(form.threshold);
  if (scaled === null || Math.abs(scaled) > MAX_SCALED) {
    errors.threshold = "Enter a threshold number within ±100000.";
  }
  if (form.aggregation === "consecutive_days" && form.metric !== "precipitation") {
    errors.aggregation =
      "Consecutive days is only available for precipitation, per the contract's rule.";
  }
  if (form.aggregation === "cumulative" && form.metric !== "precipitation") {
    errors.aggregation =
      "Cumulative totals are only defined for precipitation; temperature policies use a peak reading.";
  }
  if (form.condition_text.trim().length === 0 || form.condition_text.length > MAX_CONDITION_CHARS) {
    errors.condition_text = `Enter the condition in 1 to ${MAX_CONDITION_CHARS} characters.`;
  }
  if (!INT_RE.test(form.payout_amount) || BigInt(form.payout_amount || "0") > MAX_PAYOUT) {
    errors.payout_amount = "Enter a whole number of base units, 0 or more (0 means no payout).";
  }
  return errors;
}

export function PolicyNew() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const wallet = useWallet();
  const sourcesRead = useRead(() => listSources(), [], snapshotSources());
  const ownerRead = useRead(() => getOwner(), [], snapshotOwner());
  // The draft is read exactly once, in a lazy initialiser, and shared by the
  // state that needs it (see domain/draftStore). `restored` is frozen at mount
  // so the notice does not flicker as the form is edited.
  const [draftAtMount] = useState(() => loadDraft());
  const [restored] = useState(() => (draftAtMount ? isDirty(draftAtMount.form) : false));
  const [form, setForm] = useState<FormState>(() => draftAtMount?.form ?? { ...INITIAL_FORM });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [tx, setTx] = useState<TxState>(IDLE);
  /**
   * Why submit cannot proceed, once the form itself is valid. Set after
   * validation passes so a wallet or ownership problem is explained rather than
   * leaving a disabled button with no feedback.
   */
  const [submitBlock, setSubmitBlock] = useState<{ title: string; body: string } | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [conditionTouched, setConditionTouched] = useState(
    () => draftAtMount?.conditionTouched ?? false,
  );

  const sources = (sourcesRead.data ?? []) as SourceDef[];
  const metricSources = sources.filter((s) => s.metric === form.metric);
  // form.metric is a plain string because it comes from storage; narrow it once
  // here rather than casting at every use.
  const metric = (METRICS as string[]).includes(form.metric)
    ? (form.metric as keyof typeof METRIC_UNITS)
    : "precipitation";
  const unit = resultUnit(form.aggregation, metric);

  // The summary sentence updates with every field (UI.md 4.2); the user
  // confirms the sentence, not just the individual fields.
  const sentence = useMemo(
    () =>
      policySentence({
        location_name: form.location_name.trim() || "the location",
        comparator: form.comparator,
        threshold_scaled: toScaled(form.threshold) ?? 0,
        unit,
        aggregation: form.aggregation,
        period_start: form.period_start || "…",
        period_end: form.period_end || "…",
        source_ids: form.sourceIds,
      }),
    [form, unit],
  );

  // condition_text follows the sentence until the user edits it themselves.
  useEffect(() => {
    if (!conditionTouched) setForm((f) => ({ ...f, condition_text: sentence }));
  }, [sentence, conditionTouched]);

  /**
   * Persist the draft so it survives a refresh, a hard reload, a failed
   * validation/wallet/ownership gate, and a successful creation.
   *
   * Debounced so a long paste in one field does not serialise the whole form on
   * every keystroke. Writing nothing while the form is pristine keeps a
   * half-filled form from outliving a user who abandoned it deliberately.
   */
  useEffect(() => {
    if (!isDirty(form)) return;
    const id = window.setTimeout(() => saveDraft(form, conditionTouched), 400);
    return () => window.clearTimeout(id);
  }, [form, conditionTouched]);

  const resetForm = useCallback(() => {
    setForm({ ...INITIAL_FORM });
    setConditionTouched(false);
    setErrors({});
    setSubmitBlock(null);
    setTx(IDLE);
    setCreatedId(null);
    clearDraft();
  }, []);

  const owner = ownerRead.data ?? "";
  const notOwner =
    Boolean(wallet.address) && Boolean(owner) && wallet.address?.toLowerCase() !== owner.toLowerCase();

  /**
   * A gate banner must not outlive the condition it describes. It is set when
   * Create policy is pressed, so connecting a wallet, switching to the right
   * network or connecting as the owner afterwards would otherwise leave a dead
   * message ("Connect a wallet first") on screen and the form looks broken.
   * Clearing is always safe: the banner disables nothing, and submit() re-checks
   * every gate when it runs, so the next click re-explains any blocker that is
   * still present.
   */
  useEffect(() => {
    setSubmitBlock(null);
  }, [wallet.connected, wallet.wrongNetwork, notOwner]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => {
      const next = { ...f, [key]: value };
      // Metric and its sources are coupled: the contract requires every chosen
      // source to share the policy metric, so switching drops the others.
      if (key === "metric") {
        const allowed = new Set(
          sources.filter((s) => s.metric === value).map((s) => s.id),
        );
        next.sourceIds = f.sourceIds.filter((id) => allowed.has(id));
      }
      return next;
    });
  };

  const toggleSource = (id: string) => {
    setForm((f) => ({
      ...f,
      sourceIds: f.sourceIds.includes(id)
        ? f.sourceIds.filter((s) => s !== id)
        : [...f.sourceIds, id],
    }));
  };

  const submit = async () => {
    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    // Validation first, then the environment gates. Doing it in this order
    // means a user always learns what is wrong with the form itself, instead of
    // meeting a disabled button that explains nothing.
    if (!wallet.connected) {
      setSubmitBlock({
        title: "Connect a wallet first",
        body: wallet.available
          ? `Creating a policy sends a transaction to ${net.label}. Connect an account, then submit again.`
          : "No browser wallet was detected, so a transaction cannot be sent. Reading the contract still works without one.",
      });
      return;
    }
    if (wallet.wrongNetwork) {
      setSubmitBlock({
        title: "Wrong network",
        body: `Your wallet is on chain ${wallet.chainId}. This contract is on ${net.label} (chain ${net.chainId}). Switch networks and submit again.`,
      });
      return;
    }
    if (notOwner) {
      setSubmitBlock({
        title: "Only the contract owner can create a policy",
        body: `create_policy is owner-only and reverts with "EXPECTED: not owner". The deployed owner is ${truncateAddress(owner)}. Connect with that account, or use one of the existing policies.`,
      });
      return;
    }
    setSubmitBlock(null);

    // Args in the exact positional order of the saved schema.
    const args = [
      form.location_name.trim(),
      toMicroDegrees(form.lat),
      toMicroDegrees(form.lon),
      Number(form.tolerance_m),
      form.sourceIds,
      form.agreement_rule,
      Number(form.min_sources),
      form.data_mode,
      form.period_start,
      form.period_end,
      form.timezone.trim(),
      metric,
      unit,
      form.comparator,
      toScaled(form.threshold),
      form.aggregation,
      form.condition_text.trim(),
      Number(form.payout_amount),
    ];

    const result = await runWrite("create_policy", args, {
      onPhase: setTx,
      onHash: () => setTx((t) => ({ ...t })),
    });
    if (result.phase === "accepted" || result.phase === "finalized") {
      // Policy ids are sequential (policy-{count}); resolve the real id from a
      // live read and only link directly when that read is genuinely live, so
      // a snapshot fallback can never point at the wrong policy.
      try {
        const count = await getPolicyCount();
        if (count.origin === "live" && count.data !== undefined) {
          setCreatedId(`policy-${count.data}`);
        }
      } catch {
        // Stay on the generic link below.
      }
    }
  };

  const busy = tx.phase === "submitted" || tx.phase === "pending";

  return (
    <div className="stack">
      <header>
        <h1>{t("policyNew.h1")}</h1>
        <p className="lede">
          {t("policyNew.lede")}
        </p>
      </header>

      {restored ? (
        <p className="small muted" data-testid="draft-restored" style={{ marginTop: "var(--space-3)" }}>
          {t("policyNew.draftRestored")}
        </p>
      ) : null}

      {wallet.wrongNetwork ? (
        <div className="alert alert-error" role="alert">
          <strong>{t("policyNew.wrongNetwork")}</strong>
          <p>
            Your wallet is on chain {wallet.chainId}. This app writes to {net.label} (chain{" "}
            {net.chainId}). Switch networks to send a transaction.
          </p>
        </div>
      ) : null}

      {notOwner ? (
        <div className="alert alert-warn" role="alert">
          <strong>{t("policyNew.ownerOnly")}</strong>
          <p>
            The contract registers policies from its owner alone. Connected wallet{" "}
            <span className="mono">{truncateAddress(wallet.address ?? "")}</span> is not the owner (
            <span className="mono">{truncateAddress(owner)}</span>), so a transaction from this
            account will be rejected with <code>EXPECTED: not owner</code>. Switch accounts in your
            wallet to continue.
          </p>
        </div>
      ) : null}

      <div className="panel">
        <div className="panel-head">
          <h2>{t("policyNew.terms.h")}</h2>
        </div>

        <div className="form-grid">
          <div className="field">
            <label htmlFor="location_name">{t("policyNew.f.location")}</label>
            <input
              id="location_name"
              type="text"
              value={form.location_name}
              onChange={(e) => set("location_name", e.target.value)}
              aria-invalid={Boolean(errors.location_name)}
            />
            {errors.location_name ? <span className="field-error">{errors.location_name}</span> : null}
          </div>

          <div className="field">
            <label htmlFor="timezone">{t("policyNew.f.timezone")}</label>
            <input
              id="timezone"
              type="text"
              value={form.timezone}
              readOnly
              aria-invalid={Boolean(errors.timezone)}
            />
            {errors.timezone ? <span className="field-error">{errors.timezone}</span> : null}
            <span className="field-hint">
              {t("policyNew.f.timezoneHelp")}
            </span>
          </div>

          <div className="field">
            <label htmlFor="lat">{t("policyNew.f.lat")}</label>
            <input
              id="lat"
              type="text"
              inputMode="decimal"
              placeholder="48.85"
              value={form.lat}
              onChange={(e) => set("lat", e.target.value)}
              aria-invalid={Boolean(errors.lat)}
            />
            {errors.lat ? <span className="field-error">{errors.lat}</span> : null}
          </div>

          <div className="field">
            <label htmlFor="lon">{t("policyNew.f.lon")}</label>
            <input
              id="lon"
              type="text"
              inputMode="decimal"
              placeholder="2.35"
              value={form.lon}
              onChange={(e) => set("lon", e.target.value)}
              aria-invalid={Boolean(errors.lon)}
            />
            {errors.lon ? <span className="field-error">{errors.lon}</span> : null}
          </div>

          <div className="field">
            <label htmlFor="tolerance_m">{t("policyNew.f.tolerance")}</label>
            <input
              id="tolerance_m"
              type="text"
              inputMode="numeric"
              value={form.tolerance_m}
              onChange={(e) => set("tolerance_m", e.target.value)}
              aria-invalid={Boolean(errors.tolerance_m)}
            />
            {errors.tolerance_m ? (
              <span className="field-error">{errors.tolerance_m}</span>
            ) : null}
            <span className="field-hint">
              {t("policyNew.f.toleranceHelp")}
            </span>
          </div>

          <div className="field">
            <label htmlFor="metric">{t("policyNew.f.metric")}</label>
            <select
              id="metric"
              value={form.metric}
              onChange={(e) => set("metric", e.target.value as FormState["metric"])}
            >
              {METRICS.map((m) => (
                <option key={m} value={m}>
                  {m} ({METRIC_UNITS[m]})
                </option>
              ))}
            </select>
            <span className="field-hint">
              {t("policyNew.f.metricHelp")}
            </span>
          </div>

          <div className="field">
            <label htmlFor="period_start">{t("policyNew.f.periodStart")}</label>
            <input
              id="period_start"
              type="date"
              value={form.period_start}
              onChange={(e) => set("period_start", e.target.value)}
              aria-invalid={Boolean(errors.period)}
            />
          </div>

          <div className="field">
            <label htmlFor="period_end">{t("policyNew.f.periodEnd")}</label>
            <input
              id="period_end"
              type="date"
              value={form.period_end}
              onChange={(e) => set("period_end", e.target.value)}
              aria-invalid={Boolean(errors.period)}
            />
            {errors.period ? <span className="field-error">{errors.period}</span> : null}
          </div>

          <div className="field">
            <label htmlFor="comparator">{t("policyNew.f.comparator")}</label>
            <select
              id="comparator"
              value={form.comparator}
              onChange={(e) => set("comparator", e.target.value)}
            >
              {COMPARATORS.map((c) => (
                <option key={c} value={c}>
                  {COMPARATOR_LABEL[c]}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="threshold">Threshold value ({unit})</label>
            <input
              id="threshold"
              type="text"
              inputMode="decimal"
              placeholder="5.00"
              value={form.threshold}
              onChange={(e) => set("threshold", e.target.value)}
              aria-invalid={Boolean(errors.threshold)}
            />
            {errors.threshold ? <span className="field-error">{errors.threshold}</span> : null}
            <span className="field-hint">
              {t("policyNew.f.thresholdHelp")}
            </span>
          </div>

          <div className="field">
            <label htmlFor="aggregation">{t("policyNew.f.aggregation")}</label>
            <select
              id="aggregation"
              value={form.aggregation}
              onChange={(e) => set("aggregation", e.target.value)}
            >
              {AGGREGATIONS.map((a) => (
                <option key={a} value={a}>
                  {AGGREGATION_LABEL[a]}
                </option>
              ))}
            </select>
            {errors.aggregation ? (
              <span className="field-error">{errors.aggregation}</span>
            ) : null}
          </div>

          <div className="field">
            <label htmlFor="agreement_rule">{t("policyNew.f.agreement")}</label>
            <select
              id="agreement_rule"
              value={form.agreement_rule}
              onChange={(e) => set("agreement_rule", e.target.value)}
            >
              {AGREEMENT_RULES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="min_sources">{t("policyNew.f.minSources")}</label>
            <input
              id="min_sources"
              type="text"
              inputMode="numeric"
              value={form.min_sources}
              onChange={(e) => set("min_sources", e.target.value)}
              aria-invalid={Boolean(errors.min_sources)}
            />
            {errors.min_sources ? (
              <span className="field-error">{errors.min_sources}</span>
            ) : null}
          </div>

          <div className="field">
            <label htmlFor="payout_amount">{t("policyNew.f.payout")}</label>
            <input
              id="payout_amount"
              type="text"
              inputMode="numeric"
              value={form.payout_amount}
              onChange={(e) => set("payout_amount", e.target.value)}
              aria-invalid={Boolean(errors.payout_amount)}
            />
            {errors.payout_amount ? (
              <span className="field-error">{errors.payout_amount}</span>
            ) : null}
            <span className="field-hint">
              0 means no payout. The beneficiary is you; use{" "}
              <code>set_beneficiary</code> to change it before a claim starts.
            </span>
          </div>

          <fieldset className="field field-wide" style={{ border: 0, padding: 0, margin: 0 }}>
            <legend style={{ fontWeight: 700, fontSize: "var(--step--1)", padding: 0 }}>
              Eligible sources
            </legend>
            <div className="field-set">
              {metricSources.length === 0 ? (
                <div className="alert alert-warn" role="status">
                  <strong>No sources registered for {form.metric}</strong>
                  <p className="small" style={{ margin: 0 }}>
                    {t("policyNew.f.dataModeHelp")}
                    owner registers. This deployment has none for {form.metric} yet, so a policy
                    cannot be created until one is added with <code>register_source</code> (or{" "}
                    <code>./scripts/seed-sources.sh &lt;address&gt;</code>).
                  </p>
                </div>
              ) : (
                metricSources.map((s) => (
                  <label key={s.id}>
                    <input
                      type="checkbox"
                      checked={form.sourceIds.includes(s.id)}
                      onChange={() => toggleSource(s.id)}
                    />
                    <span>
                      <strong>{s.name}</strong> — {s.param} ({s.unit})
                      <br />
                      <span className="small muted">{s.attribution}</span>
                    </span>
                  </label>
                ))
              )}
            </div>
            {errors.sources ? <span className="field-error">{errors.sources}</span> : null}
            <span className="field-hint">
              Only sources measuring {form.metric} are listed: the contract rejects a mixed-metric
              policy. Choose 1 to {MAX_SOURCES}.
            </span>
          </fieldset>

          <fieldset className="field field-wide" style={{ border: 0, padding: 0, margin: 0 }}>
            <legend style={{ fontWeight: 700, fontSize: "var(--step--1)", padding: 0 }}>
              Data mode
            </legend>
            <div className="field-set">
              <label>
                <input
                  type="radio"
                  name="data_mode"
                  checked={form.data_mode === "historical_simulation"}
                  onChange={() => set("data_mode", "historical_simulation")}
                />
                <span>
                  <strong>{t("policyNew.mode.historical")}</strong>
                  <br />
                  <span className="small muted">
                    {t("policyNew.mode.historicalHelp")}
                  </span>
                </span>
              </label>
              <label>
                <input
                  type="radio"
                  name="data_mode"
                  checked={form.data_mode === "live"}
                  onChange={() => set("data_mode", "live")}
                />
                <span>
                  <strong>{t("policyNew.mode.live")}</strong>
                  <br />
                  <span className="small muted">
                    {t("policyNew.mode.liveHelp")}
                  </span>
                </span>
              </label>
            </div>
          </fieldset>

          <div className="field field-wide">
            <label htmlFor="condition_text">{t("policyNew.f.condition")}</label>
            <textarea
              id="condition_text"
              value={form.condition_text}
              onChange={(e) => {
                setConditionTouched(true);
                set("condition_text", e.target.value);
              }}
              aria-invalid={Boolean(errors.condition_text)}
            />
            {errors.condition_text ? (
              <span className="field-error">{errors.condition_text}</span>
            ) : null}
            <span className="field-hint">
              {t("policyNew.f.conditionHelp")}
              statement of the policy.
            </span>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>{t("policyNew.confirm.h")}</h2>
        </div>
        <p className="sentence-preview" data-testid="policy-sentence-preview">
          {sentence}
        </p>
        <p className="small muted">
          {t("policyNew.confirm.help")}
          the policy, not a label.
        </p>

        <div className="btn-row" style={{ marginTop: "var(--space-4)" }}>
          <button
            type="button"
            className="btn"
            /* Only a transaction already in flight disables this. The wallet and
               ownership gates run inside submit(), AFTER validation, so a user
               with an incomplete form still gets told exactly which fields are
               wrong instead of facing a permanently dead button. */
            disabled={busy}
            onClick={() => void submit()}
          >
            Create policy
          </button>
          {/* "Cancel" only leaves the page; the draft stays saved on purpose.
              This is the explicit way to throw it away, so a restored draft is
              never a trap the user cannot escape. */}
          <button
            type="button"
            className="btn btn-secondary"
            onClick={resetForm}
            disabled={busy || !isDirty(form)}
            data-testid="clear-draft"
          >
            {t("policyNew.clearDraft")}
          </button>
          <Link className="btn btn-secondary" to="/policies">
            {t("policyNew.cancel")}
          </Link>
        </div>

        {submitBlock ? (
          <div className="alert alert-warn" role="alert" style={{ marginTop: "var(--space-3)" }}>
            <strong>{submitBlock.title}</strong>
            <p>{submitBlock.body}</p>
          </div>
        ) : null}

        {!wallet.connected && !submitBlock ? (
          <p className="small muted" style={{ marginTop: "var(--space-3)" }}>
            {wallet.available
              ? "Connect your wallet to send this transaction."
              : "No browser wallet was detected. Reading works; creating a policy needs a wallet."}
          </p>
        ) : null}

        {tx.phase !== "idle" ? (
          <div style={{ marginTop: "var(--space-4)" }}>
            <TxStatusPanel
              state={tx}
              actionLabel="Create policy"
              onRetry={() => void submit()}
              onRefresh={() => sourcesRead.refresh()}
            />
            {createdId ? (
              <p style={{ marginTop: "var(--space-3)" }}>
                <button
                  type="button"
                  className="btn"
                  onClick={() => navigate(`/policies/${createdId}`)}
                >
                  Open {createdId}
                </button>
              </p>
            ) : tx.phase === "accepted" || tx.phase === "finalized" ? (
              <p className="small muted" style={{ marginTop: "var(--space-3)" }}>
                The new policy is on chain. <Link to="/policies">{t("policyNew.confirm.h") === "" ? "" : t("policies.openList")}</Link> to
                find it.
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
