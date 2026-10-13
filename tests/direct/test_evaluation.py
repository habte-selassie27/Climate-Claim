"""Adversarial evaluation suite: thresholds, aggregation, conflicts, gaps,
location, period boundaries, units, and source failures."""

from conftest import (
    checks_of,
    evaluate,
    make_policy,
    mock_llm_ok,
    mock_web,
    om_body,
    om_days,
    nasa_body,
    nasa_map,
)

DATES = om_days(2024, 6, 1, 5)


def _one_source(**over):
    over.setdefault("source_ids", ["om_archive_precip"])
    return over


# --- threshold crossing ----------------------------------------------------


def test_clearly_above_threshold(cc, direct_vm):
    pid = make_policy(cc, threshold_scaled=100)
    cid = cc.start_claim(pid, "2024-06-01", "2024-06-05")
    c = evaluate(cc, direct_vm, cid, om=om_body("precipitation_sum", DATES, [0.1, 0, 0.2, 1.1, 0]))
    assert c["decision"] == "confirmed"
    assert c["observed_value_scaled"] == 110


def test_clearly_below_threshold(cc, direct_vm):
    pid = make_policy(cc, threshold_scaled=100)
    cid = cc.start_claim(pid, "2024-06-01", "2024-06-05")
    c = evaluate(cc, direct_vm, cid, om=om_body("precipitation_sum", DATES, [0.1, 0, 0.2, 0.9, 0]))
    assert c["decision"] == "not_confirmed"
    assert c["observed_value_scaled"] == 90


def test_exactly_at_threshold_gt_is_not_crossed(cc, direct_vm):
    pid = make_policy(cc, comparator="gt", threshold_scaled=110)
    cid = cc.start_claim(pid, "2024-06-01", "2024-06-05")
    c = evaluate(cc, direct_vm, cid, om=om_body("precipitation_sum", DATES, [0.1, 0, 0.2, 1.1, 0]))
    assert c["decision"] == "not_confirmed"  # 1.10 is not > 1.10


def test_exactly_at_threshold_gte_is_crossed(cc, direct_vm):
    pid = make_policy(cc, comparator="gte", threshold_scaled=110)
    cid = cc.start_claim(pid, "2024-06-01", "2024-06-05")
    c = evaluate(cc, direct_vm, cid, om=om_body("precipitation_sum", DATES, [0.1, 0, 0.2, 1.1, 0]))
    assert c["decision"] == "confirmed"  # 1.10 >= 1.10


def test_crossing_only_on_last_day(cc, direct_vm):
    pid = make_policy(cc, threshold_scaled=200)
    cid = cc.start_claim(pid, "2024-06-01", "2024-06-05")
    c = evaluate(cc, direct_vm, cid, om=om_body("precipitation_sum", DATES, [0, 0, 0, 0, 5.0]))
    assert c["decision"] == "confirmed"


def test_crossing_only_on_first_day(cc, direct_vm):
    pid = make_policy(cc, threshold_scaled=200)
    cid = cc.start_claim(pid, "2024-06-01", "2024-06-05")
    c = evaluate(cc, direct_vm, cid, om=om_body("precipitation_sum", DATES, [5.0, 0, 0, 0, 0]))
    assert c["decision"] == "confirmed"


def test_lt_comparator(cc, direct_vm):
    pid = make_policy(cc, comparator="lt", threshold_scaled=500, source_ids=["om_archive_tmax"],
                      metric="temperature", unit="celsius")
    cid = cc.start_claim(pid, "2024-06-01", "2024-06-05")
    c = evaluate(cc, direct_vm, cid,
                 om=om_body("temperature_2m_max", DATES, [16.6, 21.3, 19.6, 19.8, 15.8], unit="°C"))
    # max temperature 21.3 < 5.00 -> false; but aggregation is max_single so 21.3 not < 5.0
    assert c["decision"] == "not_confirmed"


# --- aggregation -----------------------------------------------------------


def test_daily_total_aggregation(cc, direct_vm):
    pid = make_policy(cc, aggregation="daily_total", threshold_scaled=100)
    cid = cc.start_claim(pid, "2024-06-01", "2024-06-05")
    c = evaluate(cc, direct_vm, cid, om=om_body("precipitation_sum", DATES, [0.1, 0, 0.2, 1.1, 0]))
    assert c["observed_value_scaled"] == 140  # sum
    assert c["decision"] == "confirmed"


def test_cumulative_aggregation(cc, direct_vm):
    pid = make_policy(cc, aggregation="cumulative", threshold_scaled=100)
    cid = cc.start_claim(pid, "2024-06-01", "2024-06-05")
    c = evaluate(cc, direct_vm, cid, om=om_body("precipitation_sum", DATES, [0.1, 0, 0.2, 1.1, 0]))
    assert c["observed_value_scaled"] == 140
    assert c["decision"] == "confirmed"


def test_consecutive_days_pass(cc, direct_vm):
    pid = make_policy(cc, aggregation="consecutive_days", threshold_scaled=200)
    cid = cc.start_claim(pid, "2024-06-01", "2024-06-05")
    c = evaluate(cc, direct_vm, cid, om=om_body("precipitation_sum", DATES, [0.1, 0.2, 0.3, 0, 0.5]))
    assert c["observed_value_scaled"] == 300  # 3 consecutive wet days
    assert c["decision"] == "confirmed"


def test_consecutive_days_fail(cc, direct_vm):
    pid = make_policy(cc, aggregation="consecutive_days", threshold_scaled=200)
    cid = cc.start_claim(pid, "2024-06-01", "2024-06-05")
    c = evaluate(cc, direct_vm, cid, om=om_body("precipitation_sum", DATES, [0.1, 0, 0.2, 0.9, 0]))
    # days 3 and 4 (06-03, 06-04) are consecutive -> run of 2
    assert c["observed_value_scaled"] == 200
    assert c["decision"] == "not_confirmed"


# --- conflicts -------------------------------------------------------------


def test_unanimous_conflict_is_inconclusive(cc, direct_vm):
    pid = make_policy(cc, threshold_scaled=150, source_ids=["om_archive_precip", "nasa_precip"],
                      agreement_rule="unanimous", min_sources=2)
    cid = cc.start_claim(pid, "2024-06-01", "2024-06-05")
    c = evaluate(
        cc, direct_vm, cid,
        om=om_body("precipitation_sum", DATES, [0.1, 0, 0.2, 1.1, 0]),
        nasa=nasa_body("PRECTOTCORR", nasa_map(2024, 6, 1, [0.23, 0.04, 0.19, 2.03, 0.02])),
    )
    assert c["decision"] == "inconclusive"
    assert c["reason_code"] == "source_conflict"
    assert checks_of(cc, cid)["source_agreement"] == "fail"


def test_any_rule_resolves_conflict(cc, direct_vm):
    pid = make_policy(cc, threshold_scaled=150, source_ids=["om_archive_precip", "nasa_precip"],
                      agreement_rule="any", min_sources=2)
    cid = cc.start_claim(pid, "2024-06-01", "2024-06-05")
    c = evaluate(
        cc, direct_vm, cid,
        om=om_body("precipitation_sum", DATES, [0.1, 0, 0.2, 1.1, 0]),
        nasa=nasa_body("PRECTOTCORR", nasa_map(2024, 6, 1, [0.23, 0.04, 0.19, 2.03, 0.02])),
    )
    assert c["decision"] == "confirmed"  # NASA crosses -> any


def test_sources_agree_confirmed(cc, direct_vm):
    pid = make_policy(cc, threshold_scaled=50, source_ids=["om_archive_precip", "nasa_precip"],
                      agreement_rule="unanimous", min_sources=2)
    cid = cc.start_claim(pid, "2024-06-01", "2024-06-05")
    c = evaluate(
        cc, direct_vm, cid,
        om=om_body("precipitation_sum", DATES, [0.1, 0, 0.2, 1.1, 0]),
        nasa=nasa_body("PRECTOTCORR", nasa_map(2024, 6, 1, [0.23, 0.04, 0.19, 2.03, 0.02])),
    )
    assert c["decision"] == "confirmed"
    assert checks_of(cc, cid)["source_agreement"] == "pass"


# --- missing observations --------------------------------------------------


def test_gap_in_period_is_inconclusive(cc, direct_vm):
    pid = make_policy(cc, threshold_scaled=100)
    cid = cc.start_claim(pid, "2024-06-01", "2024-06-05")
    # only 4 of 5 days returned
    c = evaluate(cc, direct_vm, cid,
                 om=om_body("precipitation_sum", DATES[:4], [0.1, 0, 0.2, 1.1]))
    assert c["decision"] == "inconclusive"
    assert c["reason_code"] == "missing_observations"
    assert checks_of(cc, cid)["period_covered"] == "fail"


def test_empty_body_source_missing(cc, direct_vm):
    pid = make_policy(cc, threshold_scaled=100, source_ids=["om_archive_precip", "nasa_precip"],
                      min_sources=2)
    cid = cc.start_claim(pid, "2024-06-01", "2024-06-05")
    c = evaluate(
        cc, direct_vm, cid,
        om=om_body("precipitation_sum", DATES, [0.1, 0, 0.2, 1.1, 0]),
        nasa=nasa_body("PRECTOTCORR", {}),  # reachable but no readings
    )
    assert c["decision"] == "inconclusive"
    assert c["reason_code"] == "missing_observations"
    ev = {e["source_id"]: e for e in cc.get_evidence(cid)}
    assert ev["nasa_precip"]["ok"] is True
    assert ev["nasa_precip"]["days_covered"] == 0


def test_no_interpolation(cc, direct_vm):
    """A gap must never be filled with a fabricated average."""
    pid = make_policy(cc, aggregation="daily_total", threshold_scaled=10)
    cid = cc.start_claim(pid, "2024-06-01", "2024-06-05")
    c = evaluate(cc, direct_vm, cid,
                 om=om_body("precipitation_sum", DATES[:4], [0.1, 0, 0.2, 1.1]))
    # sum of the 4 present days, not 4/5-scaled or interpolated
    assert c["observed_value_scaled"] == 140


# --- location --------------------------------------------------------------


def test_location_mismatch(cc, direct_vm):
    pid = make_policy(cc, threshold_scaled=100, tolerance_m=5000)
    cid = cc.start_claim(pid, "2024-06-01", "2024-06-05")
    # source reports a location ~5 degrees away
    c = evaluate(cc, direct_vm, cid,
                 om=om_body("precipitation_sum", DATES, [0.1, 0, 0.2, 1.1, 0], lat=56.5, lon=-4.2),
                 location_match="unclear")
    assert c["decision"] == "inconclusive"
    assert c["reason_code"] == "location_mismatch"
    assert checks_of(cc, cid)["location_match"] == "fail"


def test_location_within_tolerance(cc, direct_vm):
    pid = make_policy(cc, threshold_scaled=100, tolerance_m=10000)
    cid = cc.start_claim(pid, "2024-06-01", "2024-06-05")
    c = evaluate(cc, direct_vm, cid,
                 om=om_body("precipitation_sum", DATES, [0.1, 0, 0.2, 1.1, 0], lat=51.494, lon=0.0))
    assert c["decision"] == "confirmed"
    assert checks_of(cc, cid)["location_match"] == "pass"


# --- period boundaries -----------------------------------------------------


def test_out_of_period_readings_ignored(cc, direct_vm):
    pid = make_policy(cc, threshold_scaled=200, period_start="2024-06-02", period_end="2024-06-04")
    cid = cc.start_claim(pid, "2024-06-02", "2024-06-04")
    # body spans 06-01..06-05 with a huge value outside the period
    all_dates = om_days(2024, 6, 1, 5)
    c = evaluate(cc, direct_vm, cid,
                 om=om_body("precipitation_sum", all_dates, [9.9, 0.1, 0.2, 1.1, 9.9]))
    # only 0.2 is inside; the 9.9s must be ignored
    assert c["observed_value_scaled"] == 110
    assert c["decision"] == "not_confirmed"


# --- units -----------------------------------------------------------------


def test_inch_units_normalized(cc, direct_vm):
    pid = make_policy(cc, threshold_scaled=100)
    cid = cc.start_claim(pid, "2024-06-01", "2024-06-05")
    # 0.05 inch = 1.27 mm > 1.00 mm
    c = evaluate(cc, direct_vm, cid,
                 om=om_body("precipitation_sum", DATES, [0.0, 0.0, 0.0, 0.05, 0.0], unit="inch"))
    assert c["observed_value_scaled"] == 127
    assert c["decision"] == "confirmed"


def test_unsupported_unit_rejected(cc, direct_vm):
    pid = make_policy(cc, threshold_scaled=10, source_ids=["om_archive_precip"])
    cid = cc.start_claim(pid, "2024-06-01", "2024-06-05")
    c = evaluate(cc, direct_vm, cid,
                 om=om_body("precipitation_sum", DATES, [0.0, 0.0, 0.0, 0.05, 0.0], unit="furlongs"))
    ev = {e["source_id"]: e for e in cc.get_evidence(cid)}
    assert ev["om_archive_precip"]["ok"] is False
    assert ev["om_archive_precip"]["error"] == "EXTERNAL: unit_mismatch"


# --- failures --------------------------------------------------------------


def test_source_down_partial(cc, direct_vm):
    pid = make_policy(cc, threshold_scaled=100, source_ids=["om_archive_precip", "nasa_precip"],
                      min_sources=1, agreement_rule="any")
    cid = cc.start_claim(pid, "2024-06-01", "2024-06-05")
    # NASA returns 500
    direct_vm.mock_web(r"archive-api\.open-meteo\.com",
                       {"method": "GET", "status": 200,
                        "body": om_body("precipitation_sum", DATES, [0.1, 0, 0.2, 1.1, 0])})
    direct_vm.mock_web(r"power\.larc\.nasa\.gov", {"method": "GET", "status": 500, "body": ""})
    mock_llm_ok(direct_vm)
    cc.request_evaluation(cid)
    c = cc.get_claim(cid)
    assert c["decision"] == "confirmed"  # one source is enough
    ev = {e["source_id"]: e for e in cc.get_evidence(cid)}
    assert ev["nasa_precip"]["ok"] is False
    assert ev["nasa_precip"]["error"] == "EXTERNAL: fetch_failed"


def test_all_sources_unreachable_is_retryable(cc, direct_vm):
    pid = make_policy(cc, source_ids=["om_archive_precip"])

    def exploding():
        from _genlayer_wasi import MockNotFoundError
        raise MockNotFoundError("down")

    cid = cc.start_claim(pid, "2024-06-01", "2024-06-05")
    # no web mocks registered at all -> fetch raises -> EXTERNAL
    mock_llm_ok(direct_vm)
    cc.request_evaluation(cid)
    c = cc.get_claim(cid)
    assert c["state"] == "evidence_collected"
    assert c["eval_error"] == "EXTERNAL: sources_unreachable"
    assert c["decision"] == ""


def test_malformed_payload(cc, direct_vm):
    pid = make_policy(cc, source_ids=["om_archive_precip"])
    cid = cc.start_claim(pid, "2024-06-01", "2024-06-05")
    c = evaluate(cc, direct_vm, cid, om="<html>not json</html>")
    ev = {e["source_id"]: e for e in cc.get_evidence(cid)}
    assert ev["om_archive_precip"]["ok"] is False
    assert ev["om_archive_precip"]["error"] == "EXTERNAL: fetch_failed"


def test_changed_layout_parse_failed(cc, direct_vm):
    import json as _json
    pid = make_policy(cc, source_ids=["om_archive_precip"])
    cid = cc.start_claim(pid, "2024-06-01", "2024-06-05")
    c = evaluate(cc, direct_vm, cid, om=_json.dumps({"unexpected": {"shape": []}}))
    ev = {e["source_id"]: e for e in cc.get_evidence(cid)}
    assert ev["om_archive_precip"]["ok"] is False
    assert ev["om_archive_precip"]["error"] == "EXTERNAL: parse_failed"
