"""Settlement Controller tests.

Finality is verified by reading this contract's own state at LATEST_FINAL. In
direct mode there is no cross-contract runtime, so tests install a
`_gl_call_hook` that stands in for that read (and for the payout message).
"""

import pytest

from conftest import make_policy, mock_llm_ok, mock_web, om_body, om_days, other_address

DATES = om_days(2024, 6, 1, 5)
CONFIRM = om_body("precipitation_sum", DATES, [0.1, 0, 0.2, 1.1, 0])


def _funded(cc, direct_vm, amount=1000, payout=1000, threshold=100):
    direct_vm.deal(direct_vm._contract_address, 5000)
    pid = make_policy(cc, threshold_scaled=threshold, source_ids=["om_archive_precip"],
                      payout_amount=payout)
    cid = cc.start_claim(pid, "2024-06-01", "2024-06-05")
    mock_web(direct_vm, om=CONFIRM)
    mock_llm_ok(direct_vm)
    cc.request_evaluation(cid)
    return pid, cid


def _install_hook(direct_vm, decision, fail_payout=False):
    """Stand in for CallContract (finality read) and PostMessage (payout)."""
    calls = {"payouts": 0}

    def hook(vm, request):
        if not isinstance(request, dict):
            return None
        if "CallContract" in request:
            from genlayer.py import calldata
            return bytes([0]) + calldata.encode({"decision": decision[0], "id": "x"})
        if "PostMessage" in request:
            if fail_payout:
                raise RuntimeError("payout message failed")
            calls["payouts"] += 1
            return {"ok": None}
        return None

    direct_vm._gl_call_hook = hook
    return calls


def test_finalize_requires_available_finality(cc, direct_vm):
    _, cid = _funded(cc, direct_vm)
    # no hook -> the finalized self-read is unavailable -> refuse to finalize
    with direct_vm.expect_revert("EXTERNAL: finality check unavailable"):
        cc.finalize_decision(cid)
    assert cc.get_claim(cid)["finalized"] is False


def test_finalize_rejects_mismatched_final_state(cc, direct_vm):
    _, cid = _funded(cc, direct_vm)
    _install_hook(direct_vm, ["not_confirmed"])
    with direct_vm.expect_revert("EXPECTED: decision not final"):
        cc.finalize_decision(cid)


def test_settle_requires_finalization(cc, direct_vm):
    _, cid = _funded(cc, direct_vm)
    with direct_vm.expect_revert("EXPECTED: decision not final"):
        cc.settle_claim(cid)


def test_settle_happy_path(cc, direct_vm):
    _, cid = _funded(cc, direct_vm)
    hook = _install_hook(direct_vm, ["confirmed"])
    cc.finalize_decision(cid)
    assert cc.get_claim(cid)["finalized"] is True
    cc.settle_claim(cid)
    c = cc.get_claim(cid)
    assert c["state"] == "settled"
    assert c["settlement_state"] == "settled"
    assert hook["payouts"] == 1
    s = cc.get_settlement(cid)
    assert s["state"] == "settled"
    assert s["amount"] == 1000


def test_double_settle_rejected(cc, direct_vm):
    _, cid = _funded(cc, direct_vm)
    _install_hook(direct_vm, ["confirmed"])
    cc.finalize_decision(cid)
    cc.settle_claim(cid)
    with direct_vm.expect_revert("EXPECTED: already settled"):
        cc.settle_claim(cid)


def test_settle_rejects_non_confirmed(cc, direct_vm):
    direct_vm.deal(direct_vm._contract_address, 5000)
    pid = make_policy(cc, threshold_scaled=5000, source_ids=["om_archive_precip"], payout_amount=100)
    cid = cc.start_claim(pid, "2024-06-01", "2024-06-05")
    mock_web(direct_vm, om=CONFIRM)
    mock_llm_ok(direct_vm)
    cc.request_evaluation(cid)
    assert cc.get_claim(cid)["decision"] == "not_confirmed"
    with direct_vm.expect_revert("EXPECTED: claim not confirmed"):
        cc.settle_claim(cid)


def test_settle_requires_owner(cc, direct_vm):
    _, cid = _funded(cc, direct_vm)
    _install_hook(direct_vm, ["confirmed"])
    cc.finalize_decision(cid)
    direct_vm.sender = other_address()
    with direct_vm.expect_revert("EXPECTED: not owner"):
        cc.settle_claim(cid)


def test_finalize_requires_owner(cc, direct_vm):
    _, cid = _funded(cc, direct_vm)
    direct_vm.sender = other_address()
    with direct_vm.expect_revert("EXPECTED: not owner"):
        cc.finalize_decision(cid)


def test_settle_insufficient_balance(cc, direct_vm):
    direct_vm.deal(direct_vm._contract_address, 10)  # less than payout
    pid = make_policy(cc, threshold_scaled=100, source_ids=["om_archive_precip"],
                      payout_amount=1000)
    cid = cc.start_claim(pid, "2024-06-01", "2024-06-05")
    mock_web(direct_vm, om=CONFIRM)
    mock_llm_ok(direct_vm)
    cc.request_evaluation(cid)
    _install_hook(direct_vm, ["confirmed"])
    cc.finalize_decision(cid)
    with direct_vm.expect_revert("EXPECTED: insufficient contract balance"):
        cc.settle_claim(cid)


def test_settle_zero_payout_rejected(cc, direct_vm):
    _, cid = _funded(cc, direct_vm, payout=0)
    _install_hook(direct_vm, ["confirmed"])
    cc.finalize_decision(cid)
    with direct_vm.expect_revert("EXPECTED: payout amount is zero"):
        cc.settle_claim(cid)


def test_settle_transfer_failure_marks_failed(cc, direct_vm):
    _, cid = _funded(cc, direct_vm)
    _install_hook(direct_vm, ["confirmed"], fail_payout=True)
    cc.finalize_decision(cid)
    with direct_vm.expect_revert("EXTERNAL: transfer failed"):
        cc.settle_claim(cid)
    c = cc.get_claim(cid)
    assert c["settlement_state"] == "settlement_failed"
    assert c["state"] != "settled"


def test_finalize_requires_decided_state(cc, direct_vm):
    pid = make_policy(cc, source_ids=["om_archive_precip"])
    cid = cc.start_claim(pid, "2024-06-01", "2024-06-05")
    with direct_vm.expect_revert("EXPECTED: not decided"):
        cc.finalize_decision(cid)
