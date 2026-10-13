import { useEffect, useMemo, useState } from "react";
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
import { toMicroDegrees, toScaled, truncateAddress } from "../domain/format";
import { activeNetwork } from "../config/network";
import type { DataMode, SourceDef } from "../domain/types";

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
const AGGREGATIONS = ["max_single", "daily_total", "cumulative", "consecutive_days"];
const AGGREGATION_LABEL: Record<string, string> = {
  max_single: "highest single reading on any day",
  daily_total: "total for each day",
  cumulative: "total across the whole period",
  consecutive_days: "longest run of consecutive days over the threshold",
};
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

interface FormState {
  location_name: string;
  lat: string;
  lon: string;
  tolerance_m: string;
  metric: keyof typeof METRIC_UNITS;
  sourceIds: string[];
  agreement_rule: string;
  min_sources: string;
  data_mode: DataMode;
  period_start: string;
  period_end: string;
  timezone: string;
  comparator: string;
  threshold: string;
  aggregation: string;
  condition_text: string;
  payout_amount: string;
}

const INITIAL: FormState = {
  location_name: "",
  lat: "",
  lon: "",
  tolerance_m: "10000",
  metric: "precipitation",
  sourceIds: [],
  agreement_rule: "majority",
  min_sources: "1",
  data_mode: "historical_simulation",
  period_start: "",
  period_end: "",
  timezone: "UTC",
  comparator: "gt",
  threshold: "",
  aggregation: "daily_total",
  condition_text: "",
  payout_amount: "0",
};

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
    } else if (form.data_mode === "historical_simulation" && form.period_end > todayIso()) {
      errors.period =
        "A historical simulation must observe a period entirely in the past. Switch to Live for a future period.";
    }
  }
  if (form.timezone.trim().length === 0 || form.timezone.trim().length > 64) {
    errors.timezone = "Enter the timezone name (1 to 64 characters), e.g. UTC or Europe/Paris.";
  }
  const scaled = toScaled(form.threshold);
  if (scaled === null || Math.abs(scaled) > MAX_SCALED) {
    errors.threshold = "Enter a threshold number within ±100000.";
  }
  if (form.aggregation === "consecutive_days" && form.metric !== "precipitation") {
    errors.aggregation =
      "Consecutive days is only available for precipitation, per the contract's rule.";
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
  const navigate = useNavigate();
  const wallet = useWallet();
  const sourcesRead = useRead(() => listSources(), [], snapshotSources());
  const ownerRead = useRead(() => getOwner(), [], snapshotOwner());
  const [form, setForm] = useState<FormState>(INITIAL);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [tx, setTx] = useState<TxState>(IDLE);
  /**
   * Why submit cannot proceed, once the form itself is valid. Set after
   * validation passes so a wallet or ownership problem is explained rather than
   * leaving a disabled button with no feedback.
   */
  const [submitBlock, setSubmitBlock] = useState<{ title: string; body: string } | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [conditionTouched, setConditionTouched] = useState(false);

  const sources = (sourcesRead.data ?? []) as SourceDef[];
  const metricSources = sources.filter((s) => s.metric === form.metric);
  const unit = METRIC_UNITS[form.metric];

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

  const owner = ownerRead.data ?? "";
  const notOwner =
    Boolean(wallet.address) && Boolean(owner) && wallet.address?.toLowerCase() !== owner.toLowerCase();

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
      form.metric,
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
        <h1>Create a policy</h1>
        <p className="lede">
          A policy fixes the location, period, threshold, aggregation rule and eligible sources in
          advance. Once a claim references it, it can never be changed — that is what makes a later
          decision auditable.
        </p>
      </header>

      {wallet.wrongNetwork ? (
        <div className="alert alert-error" role="alert">
          <strong>Wrong network</strong>
          <p>
            Your wallet is on chain {wallet.chainId}. This app writes to {net.label} (chain{" "}
            {net.chainId}). Switch networks to send a transaction.
          </p>
        </div>
      ) : null}

      {notOwner ? (
        <div className="alert alert-warn" role="alert">
          <strong>This write is owner-only</strong>
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
          <h2>Terms</h2>
        </div>

        <div className="form-grid">
          <div className="field">
            <label htmlFor="location_name">Location name</label>
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
            <label htmlFor="timezone">Timezone</label>
            <input
              id="timezone"
              type="text"
              value={form.timezone}
              onChange={(e) => set("timezone", e.target.value)}
              aria-invalid={Boolean(errors.timezone)}
            />
            {errors.timezone ? <span className="field-error">{errors.timezone}</span> : null}
            <span className="field-hint">
              Shown with every date on the claim. The contract stores it verbatim.
            </span>
          </div>

          <div className="field">
            <label htmlFor="lat">Latitude (degrees)</label>
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
            <label htmlFor="lon">Longitude (degrees)</label>
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
            <label htmlFor="tolerance_m">Distance tolerance (metres)</label>
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
              How far an observation's station or grid cell may sit from the coordinates and still
              count as a match.
            </span>
          </div>

          <div className="field">
            <label htmlFor="metric">Metric</label>
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
              The unit follows the metric — the contract only accepts the canonical unit.
            </span>
          </div>

          <div className="field">
            <label htmlFor="period_start">Observation period start</label>
            <input
              id="period_start"
              type="date"
              value={form.period_start}
              onChange={(e) => set("period_start", e.target.value)}
              aria-invalid={Boolean(errors.period)}
            />
          </div>

          <div className="field">
            <label htmlFor="period_end">Observation period end</label>
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
            <label htmlFor="comparator">Threshold comparison</label>
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
              Stored as an integer ×100 — never a float.
            </span>
          </div>

          <div className="field">
            <label htmlFor="aggregation">Aggregation rule</label>
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
            <label htmlFor="agreement_rule">Source agreement rule</label>
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
            <label htmlFor="min_sources">Minimum agreeing sources</label>
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
            <label htmlFor="payout_amount">Payout (base units)</label>
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
                <span className="small muted">
                  No sources registered for {form.metric}. The registry is seeded on deployment.
                </span>
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
                  <strong>Historical simulation</strong>
                  <br />
                  <span className="small muted">
                    Recorded historical observations, not a live feed. The period must be entirely in
                    the past; re-running the claim cannot change the underlying data.
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
                  <strong>Live</strong>
                  <br />
                  <span className="small muted">
                    Values are fetched from the source at evaluation time. The result reflects the
                    world now and can differ between evaluations.
                  </span>
                </span>
              </label>
            </div>
          </fieldset>

          <div className="field field-wide">
            <label htmlFor="condition_text">Condition, in plain words</label>
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
              Filled from the summary below until you edit it. Stored on chain as the human-readable
              statement of the policy.
            </span>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>Confirm the sentence</h2>
        </div>
        <p className="sentence-preview" data-testid="policy-sentence-preview">
          {sentence}
        </p>
        <p className="small muted">
          This is what validators will read. Check it says what you mean — a typo here is a term of
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
          <Link className="btn btn-secondary" to="/policies">
            Cancel
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
                The new policy is on chain. <Link to="/policies">Open the policies list</Link> to
                find it.
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
