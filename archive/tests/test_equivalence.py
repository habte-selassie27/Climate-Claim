"""The equivalence rule (docs/equivalence.md) and leader/validator behaviour."""

import sys

from conftest import make_policy, mock_llm_ok, mock_web, om_body, om_days

DATES = om_days(2024, 6, 1, 5)
POLICY = {"comparator": "gt", "threshold_scaled": 100}


def checks(**over):
    base = {
        "threshold_crossed": "pass",
        "period_covered": "pass",
        "location_match": "pass",
        "source_agreement": "pass",
        "data_completeness": "pass",
    }
    base.update(over)
    return base


def res(decision="confirmed", reason="threshold_crossed", observed=110, ch=None,
        used=("a",), missing=(), sources=None):
    return {
        "decision": decision,
        "reason_code": reason,
        "observed_value_scaled": observed,
        "checks": ch or checks(),
        "sources_used": list(used),
        "sources_missing": list(missing),
        "sources": sources if sources is not None else [{"source_id": "a", "ok": True, "value_scaled": 110}],
    }


def test_near_equal_is_equivalent(cc_mod):
    eq = cc_mod._equivalent
    assert eq(res(observed=110), res(observed=110), POLICY) is True
    # within tolerance
    assert eq(res(observed=110), res(observed=111), POLICY) is True


def test_clearly_different_observed_not_equivalent(cc_mod):
    eq = cc_mod._equivalent
    assert eq(res(observed=110), res(observed=500), POLICY) is False


def test_decision_mismatch_not_equivalent(cc_mod):
    eq = cc_mod._equivalent
    mine = res(decision="not_confirmed", reason="threshold_not_crossed", observed=90)
    assert eq(res(), mine, POLICY) is False


def test_invariant_confirmed_below_threshold_rejected(cc_mod):
    eq = cc_mod._equivalent
    bad = res(decision="confirmed", reason="threshold_crossed", observed=90)
    # identical leader and validator -> still rejected by the threshold invariant
    assert eq(bad, bad, POLICY) is False


def test_invariant_not_confirmed_above_threshold_rejected(cc_mod):
    eq = cc_mod._equivalent
    bad = res(decision="not_confirmed", reason="threshold_not_crossed", observed=500)
    assert eq(bad, bad, POLICY) is False


def test_reason_code_mismatch_not_equivalent(cc_mod):
    eq = cc_mod._equivalent
    mine = res(reason="source_conflict", decision="inconclusive", observed=110,
               ch=checks(source_agreement="fail"))
    assert eq(res(), mine, POLICY) is False


def test_required_check_mismatch_not_equivalent(cc_mod):
    eq = cc_mod._equivalent
    mine = res(ch=checks(period_covered="fail"))
    assert eq(res(), mine, POLICY) is False


def test_optional_check_unclear_tolerated(cc_mod):
    eq = cc_mod._equivalent
    leader = res(ch=checks(location_match="unclear"))
    mine = res(ch=checks(location_match="pass"))
    assert eq(leader, mine, POLICY) is True


def test_source_difference_not_equivalent(cc_mod):
    eq = cc_mod._equivalent
    leader = res(used=("a", "b"), missing=(), sources=[
        {"source_id": "a", "ok": True, "value_scaled": 110},
        {"source_id": "b", "ok": True, "value_scaled": 200},
    ])
    mine = res(used=("a",), missing=("b",), sources=[
        {"source_id": "a", "ok": True, "value_scaled": 110},
        {"source_id": "b", "ok": False, "value_scaled": 0},
    ])
    assert eq(leader, mine, POLICY) is False


# --- validator execution ---------------------------------------------------


def test_validator_agrees_on_same_data(cc, direct_vm):
    pid = make_policy(cc, threshold_scaled=100, source_ids=["om_archive_precip"])
    cid = cc.start_claim(pid, "2024-06-01", "2024-06-05")
    mock_web(direct_vm, om=om_body("precipitation_sum", DATES, [0.1, 0, 0.2, 1.1, 0]))
    mock_llm_ok(direct_vm)
    cc.request_evaluation(cid)
    assert direct_vm.run_validator() is True


def test_validator_rejects_divergent_data(cc, direct_vm):
    pid = make_policy(cc, threshold_scaled=100, source_ids=["om_archive_precip"])
    cid = cc.start_claim(pid, "2024-06-01", "2024-06-05")
    mock_web(direct_vm, om=om_body("precipitation_sum", DATES, [0.1, 0, 0.2, 1.1, 0]))
    mock_llm_ok(direct_vm)
    cc.request_evaluation(cid)
    # Swap the source data to something clearly different, then re-run the
    # captured validator. It re-fetches and compares against the leader's result.
    direct_vm._web_mocks.clear()
    direct_vm._web_mocks_hit.clear()
    mock_web(direct_vm, om=om_body("precipitation_sum", DATES, [9.9, 9.9, 9.9, 9.9, 9.9]))
    assert direct_vm.run_validator() is False
