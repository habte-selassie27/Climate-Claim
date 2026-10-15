"""Settlement Controller tests: a two-phase, verification-based lifecycle.

Emitting a payout message is NOT delivery on GenLayer: the value is deducted
from this contract when the message is emitted and credited to the recipient
only when the child transaction activates, and the child can fail. So:

    not_settled -settle_claim-> payout_emitted -confirm_settlement-> settled
                                            `-fail_settlement-----> settlement_failed
                                            `-__on_errored_message__-^

Direct mode has no cross-contract runtime, so tests install a `_gl_call_hook`
that stands in for the finalized self-read (`CallContract`) and for the payout
message (`EthSend`, the external message to a chain-layer address) and records
what was sent.
"""

import pytest

from conftest import (
    final_snapshot,
    make_policy,
    mock_llm_ok,
    mock_web,
    om_body,
    om_days,
    other_address,
    owner_address,
)

DATES = om_days(2024, 6, 1, 5)
CONFIRM = om_body("precipitation_sum", DATES, [0.1, 0, 0.2, 1.1, 0])


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


def _funded_confirmed(cc, direct_vm, payout=1000, threshold=100, source_ids=None):
    """A funded, confirmed, finalized claim ready to settle."""
    direct_vm.deal(direct_vm._contract_address, 5000)
    pid = make_policy(cc, threshold_scaled=threshold, payout_amount=payout,
                      source_ids=source_ids or ["om_archive_precip"])
    cid = cc.start_claim(pid, "2024-06-01", "2024-06-05")
    mock_web(direct_vm, om=CONFIRM)
    mock_llm_ok(direct_vm)
    cc.request_evaluation(cid)
    assert cc.get_claim(cid)["decision"] == "confirmed"
    _install_hook(direct_vm, final_snapshot(cc.get_claim(cid)))
    cc.finalize_decision(cid)
    assert cc.get_claim(cid)["finalized"] is True
    return pid, cid


# --- gates ---------------------------------------------------------------


def test_finalize_requires_available_finality(cc, direct_vm):
    direct_vm.deal(direct_vm._contract_address, 5000)
    pid = make_policy(cc, source_ids=["om_archive_precip"], payout_amount=1000)
    cid = cc.start_claim(pid, "2024-06-01", "2024-06-05")
    mock_web(direct_vm, om=CONFIRM)
    mock_llm_ok(direct_vm)
    cc.request_evaluation(cid)
    _install_hook(direct_vm, None)   # the finalized self-read is unavailable
    with direct_vm.expect_revert("EXTERNAL: finality check unavailable"):
        cc.finalize_decision(cid)
    assert cc.get_claim(cid)["finalized"] is False


def test_settle_requires_finalization(cc, direct_vm):
    direct_vm.deal(direct_vm._contract_address, 5000)
    pid = make_policy(cc, source_ids=["om_archive_precip"], payout_amount=1000,
                      threshold_scaled=100)
    cid = cc.start_claim(pid, "2024-06-01", "2024-06-05")
    mock_web(direct_vm, om=CONFIRM)
    mock_llm_ok(direct_vm)
    cc.request_evaluation(cid)
    with direct_vm.expect_revert("EXPECTED: decision not final"):
        cc.settle_claim(cid)


def test_settle_rejects_non_confirmed(cc, direct_vm):
    direct_vm.deal(direct_vm._contract_address, 5000)
    pid = make_policy(cc, threshold_scaled=5000, source_ids=["om_archive_precip"],
                      payout_amount=100)
    cid = cc.start_claim(pid, "2024-06-01", "2024-06-05")
    mock_web(direct_vm, om=CONFIRM)
    mock_llm_ok(direct_vm)
    cc.request_evaluation(cid)
    assert cc.get_claim(cid)["decision"] == "not_confirmed"
    with direct_vm.expect_revert("EXPECTED: claim not confirmed"):
        cc.settle_claim(cid)


def test_settle_requires_owner(cc, direct_vm):
    _, cid = _funded_confirmed(cc, direct_vm)
    direct_vm.sender = other_address()
    with direct_vm.expect_revert("EXPECTED: not owner"):
        cc.settle_claim(cid)


def test_confirm_requires_owner(cc, direct_vm):
    _, cid = _funded_confirmed(cc, direct_vm)
    _install_hook(direct_vm)
    cc.settle_claim(cid)
    direct_vm.sender = other_address()
    with direct_vm.expect_revert("EXPECTED: not owner"):
        cc.confirm_settlement(cid)


def test_settle_insufficient_balance(cc, direct_vm):
    direct_vm.deal(direct_vm._contract_address, 10)  # less than the payout
    pid = make_policy(cc, source_ids=["om_archive_precip"], payout_amount=1000,
                      threshold_scaled=100)
    cid = cc.start_claim(pid, "2024-06-01", "2024-06-05")
    mock_web(direct_vm, om=CONFIRM)
    mock_llm_ok(direct_vm)
    cc.request_evaluation(cid)
    _install_hook(direct_vm, final_snapshot(cc.get_claim(cid)))
    cc.finalize_decision(cid)
    with direct_vm.expect_revert("EXPECTED: insufficient contract balance"):
        cc.settle_claim(cid)


def test_settle_zero_payout_rejected(cc, direct_vm):
    _, cid = _funded_confirmed(cc, direct_vm, payout=0)
    with direct_vm.expect_revert("EXPECTED: payout amount is zero"):
        cc.settle_claim(cid)


# --- the two phases ------------------------------------------------------


def test_settle_emits_the_payout_without_claiming_delivery(cc, direct_vm):
    """Emission is not delivery: the claim stays unsettled and in flight."""
    _, cid = _funded_confirmed(cc, direct_vm)
    hook = _install_hook(direct_vm)
    cc.settle_claim(cid)

    c = cc.get_claim(cid)
    assert c["state"] == "decided_confirmed"
    assert c["settlement_state"] == "payout_emitted"
    assert c["payout_round"] == 1
    assert hook["payouts"] == 1
    assert hook["values"] == [1000]
    assert cc.get_in_flight() == [cid]

    s = cc.get_settlement(cid)
    assert s["state"] == "payout_emitted"
    assert s["in_flight"] is True
    assert s["amount"] == 1000
    assert s["recipient"] == cc.get_owner()
    assert s["finalized"] is True
    assert s["payouts"] == [{
        "round": 1,
        "recipient": cc.get_owner(),
        "amount": 1000,
        "outcome": "emitted",
    }]


def test_confirm_settlement_records_verified_delivery(cc, direct_vm):
    _, cid = _funded_confirmed(cc, direct_vm)
    _install_hook(direct_vm)
    cc.settle_claim(cid)
    cc.confirm_settlement(cid)

    c = cc.get_claim(cid)
    assert c["state"] == "settled"
    assert c["settlement_state"] == "settled"
    assert cc.get_in_flight() == []
    s = cc.get_settlement(cid)
    assert s["in_flight"] is False
    assert s["payouts"][-1]["outcome"] == "confirmed"


def test_double_settle_rejected(cc, direct_vm):
    _, cid = _funded_confirmed(cc, direct_vm)
    hook = _install_hook(direct_vm)
    cc.settle_claim(cid)
    cc.confirm_settlement(cid)
    with direct_vm.expect_revert("EXPECTED: already settled"):
        cc.settle_claim(cid)
    assert hook["payouts"] == 1


def test_second_payout_rejected_while_one_is_in_flight(cc, direct_vm):
    _, cid = _funded_confirmed(cc, direct_vm)
    hook = _install_hook(direct_vm)
    cc.settle_claim(cid)
    with direct_vm.expect_revert("EXPECTED: payout already in flight"):
        cc.settle_claim(cid)
    assert hook["payouts"] == 1
    assert cc.get_in_flight() == [cid]


def test_confirm_requires_a_payout_in_flight(cc, direct_vm):
    _, cid = _funded_confirmed(cc, direct_vm)
    _install_hook(direct_vm)
    with direct_vm.expect_revert("EXPECTED: no payout in flight"):
        cc.confirm_settlement(cid)


def test_fail_settlement_requires_a_payout_in_flight(cc, direct_vm):
    _, cid = _funded_confirmed(cc, direct_vm)
    with direct_vm.expect_revert("EXPECTED: no payout in flight"):
        cc.fail_settlement(cid, "nothing was sent")


def test_settle_transfer_failure_marks_nothing_settled(cc, direct_vm):
    """An emit that fails never produces a settled claim.

    On the deployed runtime the revert also rolls the bookkeeping back to
    `not_settled`, so the exact state string is environment-dependent; the
    invariant that matters is that nothing is reported paid, nothing stays in
    flight, and the payout can be issued later.
    """
    _, cid = _funded_confirmed(cc, direct_vm)
    _install_hook(direct_vm, fail_payout=True)
    with direct_vm.expect_revert("EXTERNAL: transfer failed"):
        cc.settle_claim(cid)
    c = cc.get_claim(cid)
    assert c["state"] != "settled"
    assert c["settlement_state"] != "settled"
    assert cc.get_in_flight() == []

    # the claim can still be paid once the recipient accepts delivery
    hook = _install_hook(direct_vm)
    cc.settle_claim(cid)
    assert hook["payouts"] == 1
    assert cc.get_claim(cid)["settlement_state"] == "payout_emitted"


# --- failures are recorded, never guessed --------------------------------


def test_failed_settlement_is_retryable(cc, direct_vm):
    _, cid = _funded_confirmed(cc, direct_vm)
    hook = _install_hook(direct_vm)
    cc.settle_claim(cid)
    cc.fail_settlement(cid, "EXTERNAL: child transaction reverted")
    c = cc.get_claim(cid)
    assert c["settlement_state"] == "settlement_failed"
    assert c["state"] != "settled"
    assert cc.get_in_flight() == []
    row = cc.get_settlement(cid)["payouts"][-1]
    assert row["outcome"] == "failed"
    assert row["reason"] == "EXTERNAL: child transaction reverted"

    cc.settle_claim(cid)
    assert hook["payouts"] == 2
    c = cc.get_claim(cid)
    assert c["payout_round"] == 2
    assert c["settlement_state"] == "payout_emitted"


def test_errored_payout_message_marks_the_claim_failed(cc, direct_vm):
    """GenVM refunds a failed message through `__on_errored_message__`; the
    claim must not stay reported as paid."""
    _, cid = _funded_confirmed(cc, direct_vm)
    _install_hook(direct_vm)
    cc.settle_claim(cid)
    try:
        direct_vm.value = 1000
        cc.__on_errored_message__()
    finally:
        direct_vm.value = 0

    c = cc.get_claim(cid)
    assert c["settlement_state"] == "settlement_failed"
    assert c["state"] != "settled"
    assert cc.get_in_flight() == []
    assert cc.get_refunds() == {"count": 1, "total": 1000}
    assert cc.get_settlement(cid)["payouts"][-1]["outcome"] == "failed"
    assert cc.get_settlement(cid)["payouts"][-1]["reason"] == "EXTERNAL: payout message errored"

    # the refund restored the balance, so a retry is possible
    cc.settle_claim(cid)
    assert cc.get_claim(cid)["settlement_state"] == "payout_emitted"


def test_errored_message_without_a_payout_in_flight_only_records_the_refund(cc, direct_vm):
    """Ambiguous refunds are recorded, never attributed to an arbitrary claim."""
    try:
        direct_vm.deal(direct_vm._contract_address, 5000)
        direct_vm.value = 250
        cc.__on_errored_message__()
    finally:
        direct_vm.value = 0
    assert cc.get_refunds() == {"count": 1, "total": 250}
    assert cc.get_in_flight() == []


def test_errored_message_with_two_payouts_in_flight_attributes_nothing(cc, direct_vm):
    direct_vm.deal(direct_vm._contract_address, 5000)
    ids = []
    for name, threshold in (("a", 100), ("b", 100)):
        pid = make_policy(cc, threshold_scaled=threshold, payout_amount=1000,
                          source_ids=["om_archive_precip"], location_name=name)
        cid = cc.start_claim(pid, "2024-06-01", "2024-06-05")
        mock_web(direct_vm, om=CONFIRM)
        mock_llm_ok(direct_vm)
        cc.request_evaluation(cid)
        _install_hook(direct_vm, final_snapshot(cc.get_claim(cid)))
        cc.finalize_decision(cid)
        ids.append(cid)
    _install_hook(direct_vm)
    cc.settle_claim(ids[0])
    cc.settle_claim(ids[1])
    assert len(cc.get_in_flight()) == 2

    try:
        direct_vm.value = 1000
        cc.__on_errored_message__()
    finally:
        direct_vm.value = 0
    # no arbitrary attribution: both claims are still in flight for a human
    assert len(cc.get_in_flight()) == 2
    assert cc.get_refunds() == {"count": 1, "total": 1000}
    for cid in ids:
        assert cc.get_claim(cid)["settlement_state"] == "payout_emitted"


# --- who gets paid ------------------------------------------------------


def test_default_beneficiary_is_the_policy_owner(cc, direct_vm):
    _, cid = _funded_confirmed(cc, direct_vm)
    hook = _install_hook(direct_vm)
    cc.settle_claim(cid)
    assert cc.get_settlement(cid)["recipient"] == cc.get_owner()
    assert hook["recipients"][0].as_hex == cc.get_owner()


def test_beneficiary_override_is_honoured(cc, direct_vm):
    direct_vm.deal(direct_vm._contract_address, 5000)
    other = other_address()
    pid = make_policy(cc, source_ids=["om_archive_precip"], payout_amount=1000,
                      threshold_scaled=100)
    cc.set_beneficiary(pid, other)
    cid = cc.start_claim(pid, "2024-06-01", "2024-06-05")
    mock_web(direct_vm, om=CONFIRM)
    mock_llm_ok(direct_vm)
    cc.request_evaluation(cid)
    _install_hook(direct_vm, final_snapshot(cc.get_claim(cid)))
    cc.finalize_decision(cid)
    hook = _install_hook(direct_vm)
    cc.settle_claim(cid)
    assert cc.get_settlement(cid)["recipient"] == other.as_hex
    assert hook["recipients"][0].as_hex == other.as_hex


def test_zero_beneficiary_pays_the_claimant(cc, direct_vm):
    """The claimant payout is an explicit opt-in, never a silent default."""
    pid = make_policy(cc, source_ids=["om_archive_precip"], payout_amount=1000,
                      threshold_scaled=100)
    cc.set_beneficiary(pid, "0x" + "0" * 40)
    direct_vm.sender = other_address()
    cid = cc.start_claim(pid, "2024-06-01", "2024-06-05")
    claimant = cc.get_claim(cid)["claimant"]
    mock_web(direct_vm, om=CONFIRM)
    mock_llm_ok(direct_vm)
    cc.request_evaluation(cid)
    assert cc.get_claim(cid)["decision"] == "confirmed"

    direct_vm.sender = owner_address()
    direct_vm.deal(direct_vm._contract_address, 5000)
    assert cc.get_settlement(cid)["recipient"] == claimant
    _install_hook(direct_vm, final_snapshot(cc.get_claim(cid)))
    cc.finalize_decision(cid)
    hook = _install_hook(direct_vm)
    cc.settle_claim(cid)
    assert hook["recipients"][0].as_hex == claimant
