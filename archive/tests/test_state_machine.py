"""Every valid and invalid claim-state transition (docs/state-diagram.md)."""

from conftest import (
    evaluate,
    make_policy,
    mock_llm_ok,
    mock_web,
    om_body,
    om_days,
    other_address,
)

DATES = om_days(2024, 6, 1, 5)
CONFIRM = om_body("precipitation_sum", DATES, [0.1, 0, 0.2, 1.1, 0])


def _confirmed_claim(cc, direct_vm):
    pid = make_policy(cc, threshold_scaled=100, source_ids=["om_archive_precip"])
    cid = cc.start_claim(pid, "2024-06-01", "2024-06-05")
    c = evaluate(cc, direct_vm, cid, om=CONFIRM)
    assert c["decision"] == "confirmed"
    return pid, cid


def test_created_to_decided(cc, direct_vm):
    pid = make_policy(cc, threshold_scaled=100, source_ids=["om_archive_precip"])
    cid = cc.start_claim(pid, "2024-06-01", "2024-06-05")
    assert cc.get_claim(cid)["state"] == "created"
    c = evaluate(cc, direct_vm, cid, om=CONFIRM)
    assert c["state"] == "decided_confirmed"
    assert c["eval_round"] == 0


def test_cannot_evaluate_decided_without_dispute(cc, direct_vm):
    _, cid = _confirmed_claim(cc, direct_vm)
    with direct_vm.expect_revert("EXPECTED: claim already decided"):
        cc.request_evaluation(cid)


def test_retry_after_inconclusive_allowed(cc, direct_vm):
    pid = make_policy(cc, threshold_scaled=100, source_ids=["om_archive_precip"])
    cid = cc.start_claim(pid, "2024-06-01", "2024-06-05")
    # gap -> inconclusive
    c = evaluate(cc, direct_vm, cid, om=om_body("precipitation_sum", DATES[:4], [0.1, 0, 0.2, 1.1]))
    assert c["state"] == "inconclusive"
    # retry with a complete period
    c2 = evaluate(cc, direct_vm, cid, om=CONFIRM)
    assert c2["state"] == "decided_confirmed"


def test_retry_after_external_failure_allowed(cc, direct_vm):
    pid = make_policy(cc, threshold_scaled=100, source_ids=["om_archive_precip"])
    cid = cc.start_claim(pid, "2024-06-01", "2024-06-05")
    mock_llm_ok(direct_vm)
    cc.request_evaluation(cid)  # no web mocks -> sources_unreachable
    assert cc.get_claim(cid)["state"] == "evidence_collected"
    c = evaluate(cc, direct_vm, cid, om=CONFIRM)
    assert c["state"] == "decided_confirmed"


def test_dispute_flow_records_history(cc, direct_vm):
    _, cid = _confirmed_claim(cc, direct_vm)
    cc.open_dispute(cid, "I believe the gauge under-read.")
    assert cc.get_claim(cid)["state"] == "disputed"
    # The open dispute's grounds are readable while it awaits re-evaluation.
    assert cc.get_claim(cid)["pending_grounds"] == "I believe the gauge under-read."
    cc.resolve_dispute(cid)
    c = cc.get_claim(cid)
    assert c["state"] == "decided_confirmed"
    assert c["eval_round"] == 1
    disputes = cc.get_disputes(cid)
    assert len(disputes) == 1
    assert disputes[0]["round"] == 1
    assert disputes[0]["prev_decision"] == "confirmed"
    assert disputes[0]["new_decision"] == "confirmed"
    # The disputant's own words are kept, not a placeholder.
    assert disputes[0]["grounds"] == "I believe the gauge under-read."
    # Consumed once recorded: the pending slot clears for the next round.
    assert c["pending_grounds"] == ""


def test_dispute_grounds_round_two(cc, direct_vm):
    """A second dispute round keeps each round's own grounds."""
    _, cid = _confirmed_claim(cc, direct_vm)
    cc.open_dispute(cid, "round one grounds")
    cc.resolve_dispute(cid)
    cc.open_dispute(cid, "round two grounds")
    cc.resolve_dispute(cid)
    disputes = cc.get_disputes(cid)
    assert [d["grounds"] for d in disputes] == ["round one grounds", "round two grounds"]


def test_dispute_limit_enforced(cc, direct_vm):
    _, cid = _confirmed_claim(cc, direct_vm)
    for _ in range(3):
        cc.open_dispute(cid, "again")
        cc.resolve_dispute(cid)
    assert len(cc.get_disputes(cid)) == 3
    with direct_vm.expect_revert("EXPECTED: dispute limit reached"):
        cc.open_dispute(cid, "one more")


def test_cannot_dispute_from_created(cc, direct_vm):
    pid = make_policy(cc, source_ids=["om_archive_precip"])
    cid = cc.start_claim(pid, "2024-06-01", "2024-06-05")
    with direct_vm.expect_revert("EXPECTED: cannot dispute"):
        cc.open_dispute(cid, "premature")


def test_cannot_resolve_non_disputed(cc, direct_vm):
    _, cid = _confirmed_claim(cc, direct_vm)
    with direct_vm.expect_revert("EXPECTED: not disputed"):
        cc.resolve_dispute(cid)


def test_unauthorized_evaluation(cc, direct_vm):
    pid = make_policy(cc, source_ids=["om_archive_precip"])
    cid = cc.start_claim(pid, "2024-06-01", "2024-06-05")
    direct_vm.sender = other_address()
    with direct_vm.expect_revert("EXPECTED: unauthorized"):
        cc.request_evaluation(cid)


def test_unknown_policy_and_claim(cc, direct_vm):
    with direct_vm.expect_revert("EXPECTED: unknown policy"):
        cc.start_claim("policy-999", "2024-06-01", "2024-06-05")
    with direct_vm.expect_revert("EXPECTED: unknown claim"):
        cc.request_evaluation("claim-999")


def test_period_outside_policy_window(cc, direct_vm):
    pid = make_policy(cc, period_start="2024-06-01", period_end="2024-06-05",
                      source_ids=["om_archive_precip"])
    with direct_vm.expect_revert("EXPECTED: period outside policy window"):
        cc.start_claim(pid, "2024-05-01", "2024-05-05")


def test_duplicate_claim_rejected(cc, direct_vm):
    pid = make_policy(cc, source_ids=["om_archive_precip"])
    cid = cc.start_claim(pid, "2024-06-01", "2024-06-05")
    with direct_vm.expect_revert("EXPECTED: duplicate claim"):
        cc.start_claim(pid, "2024-06-01", "2024-06-05")
    assert cc.find_claim(pid, "2024-06-01", "2024-06-05") == cid


def test_inconclusive_is_a_result_not_an_error(cc, direct_vm):
    pid = make_policy(cc, threshold_scaled=150, source_ids=["om_archive_precip", "nasa_precip"],
                      min_sources=2)
    cid = cc.start_claim(pid, "2024-06-01", "2024-06-05")
    from conftest import nasa_body, nasa_map
    c = evaluate(
        cc, direct_vm, cid,
        om=om_body("precipitation_sum", DATES, [0.1, 0, 0.2, 1.1, 0]),
        nasa=nasa_body("PRECTOTCORR", nasa_map(2024, 6, 1, [0.23, 0.04, 0.19, 2.03, 0.02])),
    )
    assert c["decision"] == "inconclusive"
    assert c["eval_error"] == ""
    assert c["summary"] != ""
