"""Regression suite for the contract audit: one section per finding.

Every test here exists because a specific audit item must never come back:

  1. claim period correctness (claims evaluate THEIR window, not the policy's)
  2. source immutability (registry writes are final; policies freeze a snapshot)
  3. data_mode actually selects the retrieval path (sources + window)
  4. dispute rounds are counted when OPENED and survive a failed re-evaluation
  5. finality is evaluation-round specific, not just a decision-string match
  6. settlement is two-phase: emitting a payout is not delivery
     (covered in full by tests/direct/test_settlement.py)
  7. aggregation rules: majority ties, result units, duplicate dates, metric pairs
  8. a location failure can never coexist with a definite decision
  9. the source listing is a listing, not five hardcoded ids
"""

import datetime
import json

from conftest import (
    checks_of,
    evaluate,
    final_snapshot,
    make_policy,
    mock_llm_ok,
    mock_web,
    nasa_body,
    nasa_map,
    om_body,
    om_days,
    other_address,
)

DATES = om_days(2024, 6, 1, 5)
CONFIRM = om_body("precipitation_sum", DATES, [0.1, 0, 0.2, 1.1, 0])

ONE = dict(source_ids=["om_archive_precip"])


def _today():
    return datetime.datetime.now(datetime.timezone.utc).date()


def _iso(d):
    return f"{d.year:04d}-{d.month:02d}-{d.day:02d}"


def _split(*, om_values, nasa_values):
    """Open-Meteo and NASA disagree on the threshold."""
    return dict(
        om=om_body("precipitation_sum", DATES, om_values),
        nasa=nasa_body("PRECTOTCORR", nasa_map(2024, 6, 1, nasa_values)),
    )


def _confirmed(cc, direct_vm, **over):
    over.setdefault("threshold_scaled", 100)
    over.setdefault("source_ids", ["om_archive_precip"])
    pid = make_policy(cc, **over)
    cid = cc.start_claim(pid, "2024-06-01", "2024-06-05")
    c = evaluate(cc, direct_vm, cid, om=CONFIRM)
    assert c["decision"] == "confirmed"
    return pid, cid


def _resolve(cc, direct_vm, cid, *, om=None, nasa=None, location_match="pass"):
    """Re-evaluate an open dispute with fresh mocks."""
    direct_vm.clear_mocks()
    mock_web(direct_vm, om=om, nasa=nasa)
    mock_llm_ok(direct_vm, location_match=location_match)
    cc.resolve_dispute(cid)
    return cc.get_claim(cid)


# --- 1. claim period correctness -------------------------------------------


def test_claim_window_is_evaluated_not_the_policy_window(cc, direct_vm):
    """A claim for a shorter window must be evaluated on ITS window."""
    pid = make_policy(cc, threshold_scaled=200, period_start="2024-06-01",
                      period_end="2024-06-05", **ONE)
    cid = cc.start_claim(pid, "2024-06-03", "2024-06-04")
    # The body spans the whole policy window with huge values outside the claim
    # window; only 2024-06-03 and 2024-06-04 may count.
    c = evaluate(cc, direct_vm, cid,
                 om=om_body("precipitation_sum", DATES, [9.9, 9.9, 0.1, 0.2, 9.9]))
    assert c["period_start"] == "2024-06-03"
    assert c["period_end"] == "2024-06-04"
    assert c["observed_value_scaled"] == 20
    assert c["decision"] == "not_confirmed"
    assert checks_of(cc, cid)["period_covered"] == "pass"
    ev = cc.get_evidence(cid)[0]
    assert ev["period_start"] == "2024-06-03"
    assert ev["period_end"] == "2024-06-04"
    assert ev["days_covered"] == 2


def test_claim_window_shorter_than_policy_still_has_full_coverage(cc, direct_vm):
    """Two days of evidence cover a two-day window: no missing_observations."""
    pid = make_policy(cc, threshold_scaled=100, period_start="2024-06-01",
                      period_end="2024-06-05", **ONE)
    cid = cc.start_claim(pid, "2024-06-04", "2024-06-05")
    c = evaluate(cc, direct_vm, cid, om=om_body("precipitation_sum", DATES, [0, 0, 0, 1.1, 0]))
    assert c["decision"] == "confirmed"
    assert c["observed_value_scaled"] == 110


def test_claim_period_is_stored_and_returned(cc, direct_vm):
    pid = make_policy(cc, **ONE)
    cid = cc.start_claim(pid, "2024-06-02", "2024-06-04")
    c = cc.get_claim(cid)
    assert (c["period_start"], c["period_end"]) == ("2024-06-02", "2024-06-04")
    assert cc.list_claims()[0]["period_end"] == "2024-06-04"


# --- 2. source immutability -------------------------------------------------


def test_re_registering_a_source_is_rejected(cc, direct_vm):
    """A source definition can never be edited out from under a policy."""
    from conftest import _catalogue

    first = _catalogue()[0]
    with direct_vm.expect_revert("EXPECTED: source already registered"):
        cc.register_source(
            first["id"], "Renamed", first["kind"], first["metric"], first["param"],
            "https://evil.example/{lat}/{lon}/{start}/{end}/{param}/{days}",
            "inch", "attacker",
        )
    # the original registration is intact
    assert cc.get_source(first["id"])["name"] == first["name"]
    assert "evil.example" not in cc.get_source(first["id"])["url_template"]


def test_policy_freezes_the_source_configuration_it_evaluates(cc, direct_vm):
    pid = make_policy(cc, **ONE)
    p = cc.get_policy(pid)
    assert p["source_ids"] == ["om_archive_precip"]
    frozen = p["sources"]
    assert len(frozen) == 1
    live = cc.get_source("om_archive_precip")
    assert frozen[0]["url_template"] == live["url_template"]
    assert frozen[0]["param"] == live["param"]
    # A source registered afterwards is not part of the policy.
    cc.register_source("late_source", "Late", "nasa_power", "precipitation",
                       "PRECTOTCORR", "https://power.larc.nasa.gov/x", "mm/day", "test")
    assert cc.get_policy(pid)["source_ids"] == ["om_archive_precip"]
    assert [s["id"] for s in cc.get_policy(pid)["sources"]] == ["om_archive_precip"]


# --- 3. data_mode selects a retrieval path ---------------------------------


def test_simulation_rejects_a_live_source(cc, direct_vm):
    with direct_vm.expect_revert("EXPECTED: source not eligible for data mode"):
        make_policy(cc, data_mode="historical_simulation", source_ids=["om_forecast_precip"])


def test_live_rejects_an_archive_source(cc, direct_vm):
    today = _today()
    with direct_vm.expect_revert("EXPECTED: source not eligible for data mode"):
        make_policy(cc, data_mode="live", source_ids=["om_archive_precip"],
                    period_start=_iso(today - datetime.timedelta(days=3)),
                    period_end=_iso(today))


def test_live_requires_a_window_reaching_the_present(cc, direct_vm):
    today = _today()
    with direct_vm.expect_revert("EXPECTED: live window must reach the present"):
        make_policy(cc, data_mode="live", source_ids=["om_forecast_precip"],
                    period_start=_iso(today - datetime.timedelta(days=10)),
                    period_end=_iso(today - datetime.timedelta(days=5)))


def test_live_policy_with_a_live_source_is_accepted(cc, direct_vm):
    today = _today()
    pid = make_policy(cc, data_mode="live", source_ids=["om_forecast_precip"],
                      period_start=_iso(today - datetime.timedelta(days=3)),
                      period_end=_iso(today))
    p = cc.get_policy(pid)
    assert p["data_mode"] == "live"
    assert p["sources"][0]["kind"] == "open_meteo_forecast"


def test_archive_policy_must_be_in_the_past(cc, direct_vm):
    today = _today()
    with direct_vm.expect_revert("not in the past"):
        make_policy(cc, data_mode="historical_simulation", **ONE,
                    period_start=_iso(today - datetime.timedelta(days=5)),
                    period_end=_iso(today))


def test_evaluation_refuses_an_ineligible_source_kind(cc_mod):
    """Defense in depth: even if a plan carried a mismatched kind it would not
    be fetched, because `_fetch_source` checks the mode first."""
    plan = {
        "id": "x", "kind": "open_meteo_forecast", "metric": "precipitation",
        "param": "precipitation_sum", "unit": "mm",
        "url_template": "https://example.invalid/{lat}", "lat": "0", "lon": "0",
        "aggregation": "max_single", "data_mode": "historical_simulation", "days": 1,
    }
    rec = cc_mod._fetch_source(plan, "2024-06-01", "2024-06-01")
    assert rec["ok"] is False
    assert rec["error"] == "EXTERNAL: source_mode_mismatch"


# --- 4. disputes -----------------------------------------------------------


def test_dispute_rounds_are_counted_when_opened(cc, direct_vm):
    """Every opened dispute counts, so the loop is bounded even when rounds are
    abandoned without recording an outcome."""
    _, cid = _confirmed(cc, direct_vm)
    for expected in (1, 2, 3):
        cc.open_dispute(cid, "again")
        assert cc.get_claim(cid)["dispute_rounds"] == expected
        assert cc.get_claim(cid)["state"] == "disputed"
        _resolve(cc, direct_vm, cid, om=CONFIRM)
    assert cc.get_claim(cid)["eval_round"] == 3
    with direct_vm.expect_revert("EXPECTED: dispute limit reached"):
        cc.open_dispute(cid, "one more")


def test_failed_reevaluation_keeps_the_dispute_open_and_counted(cc, direct_vm):
    """Unreachable sources during a dispute must not lose the grounds or the
    round, and must not record a false resolution."""
    _, cid = _confirmed(cc, direct_vm)
    cc.open_dispute(cid, "the gauge under-read")
    direct_vm.clear_mocks()
    mock_llm_ok(direct_vm)          # no web mocks: every source fails
    cc.resolve_dispute(cid)
    c = cc.get_claim(cid)
    assert c["state"] == "disputed"                 # still open, retryable
    assert c["eval_round"] == 0                     # no resolution recorded
    assert c["dispute_rounds"] == 1
    assert c["pending_grounds"] == "the gauge under-read"
    assert c["eval_error"] == "EXTERNAL: sources_unreachable"
    assert cc.get_disputes(cid) == []

    # Retry with working sources: the round completes with the original grounds.
    c = _resolve(cc, direct_vm, cid, om=CONFIRM)
    assert c["state"] == "decided_confirmed"
    assert c["eval_round"] == 1
    assert c["dispute_rounds"] == 1
    disputes = cc.get_disputes(cid)
    assert len(disputes) == 1
    assert disputes[0]["grounds"] == "the gauge under-read"
    assert disputes[0]["round"] == 1
    assert c["pending_grounds"] == ""


def test_repeated_failed_disputes_still_hit_the_limit(cc, direct_vm):
    """A round that cannot fetch evidence is still counted, and only one
    dispute can be open at a time."""
    _, cid = _confirmed(cc, direct_vm)
    # two completed rounds
    for _ in range(2):
        cc.open_dispute(cid, "again")
        _resolve(cc, direct_vm, cid, om=CONFIRM)
    assert cc.get_claim(cid)["dispute_rounds"] == 2

    # a third round that cannot fetch evidence: counted, still open
    cc.open_dispute(cid, "again")
    assert cc.get_claim(cid)["dispute_rounds"] == 3
    direct_vm.clear_mocks()
    mock_llm_ok(direct_vm)
    cc.resolve_dispute(cid)
    assert cc.get_claim(cid)["state"] == "disputed"
    # a second dispute cannot be opened on top of the open one
    with direct_vm.expect_revert("EXPECTED: cannot dispute"):
        cc.open_dispute(cid, "fourth")

    # once the open round resolves, the limit refuses any further round
    _resolve(cc, direct_vm, cid, om=CONFIRM)
    assert cc.get_claim(cid)["state"] == "decided_confirmed"
    with direct_vm.expect_revert("EXPECTED: dispute limit reached"):
        cc.open_dispute(cid, "fourth")


def test_cannot_dispute_after_settlement_started(cc, direct_vm):
    _, cid = _confirmed(cc, direct_vm, payout_amount=1000)
    _fund_and_finalize(cc, direct_vm, cid)
    _install_hook(direct_vm)
    cc.settle_claim(cid)
    with direct_vm.expect_revert("EXPECTED: settlement already started"):
        cc.open_dispute(cid, "too late")


# --- 5. finality is round-specific ----------------------------------------


def _install_hook(direct_vm, snapshot=None, fail_payout=False):
    """Stand in for CallContract (the LATEST_FINAL self-read) and the payout."""
    calls = {"payouts": 0, "recipients": [], "values": []}

    def hook(vm, request):
        if not isinstance(request, dict):
            return None
        if "CallContract" in request:
            if snapshot is None:
                return None
            from genlayer.py import calldata
            return bytes([0]) + calldata.encode(dict(snapshot))
        if "EthSend" in request:
            if fail_payout:
                raise RuntimeError("payout message failed")
            send = request["EthSend"]
            calls["payouts"] += 1
            calls["recipients"].append(send.get("address"))
            calls["values"].append(send.get("value"))
            return {"ok": None}
        return None

    direct_vm._gl_call_hook = hook
    return calls


def _fund_and_finalize(cc, direct_vm, cid, *, finality=None):
    """Give the contract funds, then finalize using the claim's CURRENT record
    (what a real `LATEST_FINAL` self-read of a finalized tx would return)."""
    direct_vm.deal(direct_vm._contract_address, 5000)
    snap = final_snapshot(cc.get_claim(cid)) if finality is None else finality
    _install_hook(direct_vm, snap)
    cc.finalize_decision(cid)
    assert cc.get_claim(cid)["finalized"] is True
    return snap


def test_finality_requires_matching_eval_round(cc, direct_vm):
    """A new, unfinalized evaluation that repeats the old decision must not be
    finalized on the strength of the previous round's snapshot."""
    _, cid = _confirmed(cc, direct_vm, payout_amount=0)
    direct_vm.deal(direct_vm._contract_address, 5000)

    # The finalized snapshot of round 0.
    stale = {"decision": "confirmed", "reason_code": "threshold_crossed", "eval_round": 0}
    _install_hook(direct_vm, stale)
    cc.finalize_decision(cid)
    assert cc.get_claim(cid)["finalized"] is True

    # A dispute re-evaluation reaches the SAME decision, now at round 1.
    cc.open_dispute(cid, "recheck")
    c = _resolve(cc, direct_vm, cid, om=CONFIRM)
    assert c["decision"] == "confirmed"
    assert c["eval_round"] == 1
    assert c["finalized"] is False              # a new evaluation clears finality

    # The round-0 snapshot still matches the decision string, but not the round.
    _install_hook(direct_vm, stale)
    with direct_vm.expect_revert("EXPECTED: decision not final"):
        cc.finalize_decision(cid)

    # Once the round-1 snapshot is final, finalization succeeds.
    _install_hook(direct_vm, final_snapshot(cc.get_claim(cid)))
    cc.finalize_decision(cid)
    assert cc.get_claim(cid)["finalized"] is True


def test_finality_rejects_a_different_reason_code(cc, direct_vm):
    _, cid = _confirmed(cc, direct_vm, payout_amount=0)
    direct_vm.deal(direct_vm._contract_address, 5000)
    _install_hook(direct_vm, {"decision": "confirmed", "reason_code": "none",
                              "eval_round": 0})
    with direct_vm.expect_revert("EXPECTED: decision not final"):
        cc.finalize_decision(cid)


def test_finalize_requires_available_finality(cc, direct_vm):
    _, cid = _confirmed(cc, direct_vm, payout_amount=0)
    _install_hook(direct_vm, None)
    with direct_vm.expect_revert("EXTERNAL: finality check unavailable"):
        cc.finalize_decision(cid)
    assert cc.get_claim(cid)["finalized"] is False


def test_finalize_requires_owner(cc, direct_vm):
    _, cid = _confirmed(cc, direct_vm, payout_amount=0)
    direct_vm.sender = other_address()
    with direct_vm.expect_revert("EXPECTED: not owner"):
        cc.finalize_decision(cid)


def test_finalize_requires_a_decided_claim(cc, direct_vm):
    pid = make_policy(cc, **ONE)
    cid = cc.start_claim(pid, "2024-06-01", "2024-06-05")
    with direct_vm.expect_revert("EXPECTED: not decided"):
        cc.finalize_decision(cid)


# --- 7. aggregation and coverage rules ------------------------------------


def test_majority_tie_is_inconclusive_not_a_negative(cc, direct_vm):
    """An equal split is ambiguity, not `not_confirmed`."""
    pid = make_policy(cc, threshold_scaled=150, agreement_rule="majority",
                      source_ids=["om_archive_precip", "nasa_precip"], min_sources=2)
    cid = cc.start_claim(pid, "2024-06-01", "2024-06-05")
    c = evaluate(cc, direct_vm, cid, **_split(
        om_values=[0.1, 0, 0.2, 1.1, 0], nasa_values=[0.23, 0.04, 0.19, 2.03, 0.02]))
    assert c["decision"] == "inconclusive"
    assert c["reason_code"] == "source_conflict"
    assert checks_of(cc, cid)["source_agreement"] == "fail"


def test_majority_clear_win_still_decides(cc, direct_vm):
    cc.register_source("om_archive_precip_b", "Open-Meteo (second station)",
                       "open_meteo_archive", "precipitation", "precipitation_sum",
                       cc.get_source("om_archive_precip")["url_template"], "mm", "test")
    pid = make_policy(cc, threshold_scaled=50, agreement_rule="majority", min_sources=3,
                      source_ids=["om_archive_precip", "om_archive_precip_b", "nasa_precip"])
    cid = cc.start_claim(pid, "2024-06-01", "2024-06-05")
    c = evaluate(cc, direct_vm, cid, **_split(
        om_values=[0.6, 0, 0.6, 0, 0], nasa_values=[0.1, 0.05, 0.1, 0.1, 0.05]))
    assert c["decision"] == "confirmed"     # 2 of 3 cross the 0.50 mm threshold
    assert checks_of(cc, cid)["source_agreement"] == "pass"


def test_duplicate_dates_never_inflate_coverage(cc, direct_vm):
    """A repeated date fails the source instead of passing coverage."""
    pid = make_policy(cc, threshold_scaled=100, agreement_rule="unanimous",
                      min_sources=2, source_ids=["om_archive_precip", "nasa_precip"])
    cid = cc.start_claim(pid, "2024-06-01", "2024-06-05")
    duplicated = ["2024-06-01", "2024-06-01", "2024-06-02", "2024-06-03", "2024-06-04"]
    c = evaluate(
        cc, direct_vm, cid,
        om=om_body("precipitation_sum", duplicated, [9.9, 0.1, 0, 0, 0]),
        nasa=nasa_body("PRECTOTCORR", nasa_map(2024, 6, 1, [0.1, 0.1, 0.1, 0.1, 0.1])),
    )
    ev = {e["source_id"]: e for e in cc.get_evidence(cid)}
    assert ev["om_archive_precip"]["ok"] is False
    assert ev["om_archive_precip"]["error"] == "EXTERNAL: duplicate_dates"
    assert ev["om_archive_precip"]["days_covered"] == 0
    # the duplicated 9.9 mm can neither cross the threshold nor cover the period
    assert c["decision"] == "inconclusive"
    assert c["reason_code"] == "missing_observations"


def test_consecutive_days_requires_the_days_unit(cc, direct_vm):
    with direct_vm.expect_revert("canonical unit"):
        make_policy(cc, aggregation="consecutive_days", threshold_scaled=200)


def test_cumulative_temperature_is_rejected(cc, direct_vm):
    with direct_vm.expect_revert("EXPECTED: aggregation not valid for metric"):
        make_policy(cc, aggregation="cumulative", metric="temperature", unit="celsius",
                    source_ids=["om_archive_tmax"], threshold_scaled=100)


def test_removed_daily_total_aggregation_is_rejected(cc, direct_vm):
    with direct_vm.expect_revert("EXPECTED: bad aggregation"):
        make_policy(cc, aggregation="daily_total")


def test_temperature_peak_still_works(cc, direct_vm):
    pid = make_policy(cc, metric="temperature", unit="celsius", comparator="gt",
                      threshold_scaled=2000, source_ids=["om_archive_tmax"],
                      aggregation="max_single")
    cid = cc.start_claim(pid, "2024-06-01", "2024-06-05")
    c = evaluate(cc, direct_vm, cid,
                 om=om_body("temperature_2m_max", DATES, [16.6, 21.3, 19.6, 19.8, 15.8],
                            unit="°C"))
    assert c["observed_value_scaled"] == 2130
    assert c["decision"] == "confirmed"


def test_non_utc_observation_windows_are_rejected(cc, direct_vm):
    with direct_vm.expect_revert("only UTC observation windows are supported"):
        make_policy(cc, timezone="Europe/Paris")


# --- 8. location authority -------------------------------------------------


def test_llm_cannot_flip_a_clean_location_into_a_failure(cc, direct_vm):
    """The coordinate check is authoritative when coordinates are reported."""
    pid = make_policy(cc, threshold_scaled=100, tolerance_m=10000, **ONE)
    cid = cc.start_claim(pid, "2024-06-01", "2024-06-05")
    c = evaluate(cc, direct_vm, cid,
                 om=om_body("precipitation_sum", DATES, [0.1, 0, 0.2, 1.1, 0],
                            lat=51.494, lon=0.0),
                 location_match="fail")
    assert checks_of(cc, cid)["location_match"] == "pass"
    assert c["decision"] == "confirmed"


def test_model_location_failure_forces_inconclusive(cc, direct_vm):
    """If the model is the only location signal and it fails, the decision must
    not stay `confirmed` with a failing location check."""
    pid = make_policy(cc, threshold_scaled=100, **ONE)
    cid = cc.start_claim(pid, "2024-06-01", "2024-06-05")
    raw = json.loads(om_body("precipitation_sum", DATES, [0.1, 0, 0.2, 1.1, 0]))
    raw.pop("latitude")
    raw.pop("longitude")            # providers reported no coordinates
    c = evaluate(cc, direct_vm, cid, om=json.dumps(raw), location_match="fail")
    assert checks_of(cc, cid)["location_match"] == "fail"
    assert c["decision"] == "inconclusive"
    assert c["reason_code"] == "location_mismatch"


def test_equivalence_rejects_location_failure_with_a_definite_decision(cc_mod):
    def res(decision, reason, loc):
        return {
            "decision": decision, "reason_code": reason, "observed_value_scaled": 110,
            "checks": {"threshold_crossed": "pass", "period_covered": "pass",
                       "location_match": loc, "source_agreement": "pass",
                       "data_completeness": "pass"},
            "sources_used": ["a"], "sources_missing": [],
            "sources": [{"source_id": "a", "ok": True, "value_scaled": 110}],
        }

    policy = {"comparator": "gt", "threshold_scaled": 100}
    leader = res("confirmed", "threshold_crossed", "fail")
    assert cc_mod._equivalent(leader, leader, policy) is False
    mismatch = res("inconclusive", "location_mismatch", "unclear")
    assert cc_mod._equivalent(mismatch, mismatch, policy) is False


# --- 9. source listing -----------------------------------------------------


def test_list_sources_includes_every_registered_source(cc, direct_vm):
    assert len(cc.list_sources()) == 5
    cc.register_source("custom_x", "Custom X", "nasa_power", "precipitation",
                       "PRECTOTCORR", "https://power.larc.nasa.gov/x", "mm/day", "test")
    ids = [s["id"] for s in cc.list_sources()]
    assert "custom_x" in ids
    assert len(ids) == 6
    assert cc.get_source_count() == 6
