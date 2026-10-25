# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
"""
ClimateClaim.py — claim lifecycle, disputes, settlement; consensus via ClimateEvaluator.
"""
from dataclasses import dataclass
import json
from genlayer import *

MAX_DISPUTE_ROUNDS = 3
MAX_PERIOD_DAYS = 366
MAX_PAYOUT = 10**30
DECISIONS = ("confirmed", "not_confirmed", "inconclusive")
STATES = ("created", "pending_evaluation", "evidence_collected",
          "decided_confirmed", "decided_not_confirmed", "inconclusive",
          "disputed", "settled")
SETTLEMENT_NOT = "not_settled"
SETTLEMENT_EMITTED = "payout_emitted"
SETTLEMENT_DONE = "settled"
SETTLEMENT_FAILED = "settlement_failed"
PAYOUT_EMITTED = "emitted"
PAYOUT_CONFIRMED = "confirmed"
PAYOUT_FAILED = "failed"
MAX_PAYOUT_LOG = 8
ADDRESS_SIZE = 20
ZERO_ADDRESS_BYTES = b"\x00" * ADDRESS_SIZE

def _as_address(value) -> Address:
    if isinstance(value, Address):
        return value
    if isinstance(value, int):
        if isinstance(value, bool) or not 0 <= value < 1 << 160:
            raise gl.vm.UserError("EXPECTED: invalid address")
        return Address(value.to_bytes(20, "big"))
    return Address(value)

@allow_storage
@dataclass
class Claim:
    id: str
    policy_id: str
    policy_snapshot_json: str
    claimant: Address
    period_start: str
    period_end: str
    state: str
    decision: str
    reason: str
    summary: str
    observed_scaled: i256
    evaluation_round: u256
    dispute_rounds: u256
    finalized: bool
    settlement_state: str
    payout_round: u256
    payouts_json: str
    evidence_json: str
    disputes_json: str
    pending_grounds: str
    pending_opener: Address

def _date_ok(s: str) -> bool:
    if not isinstance(s, str) or len(s) != 10 or s[4] != "-" or s[7] != "-":
        return False
    try:
        y, m, d = int(s[:4]), int(s[5:7]), int(s[8:10])
        mdays = [31, 29 if y % 4 == 0 and (y % 100 != 0 or y % 400 == 0) else 28,
                 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
        return y >= 1900 and 1 <= m <= 12 and 1 <= d <= mdays[m - 1]
    except Exception:
        return False

def _ordinal(s: str) -> int:
    y, m, d = int(s[:4]), int(s[5:7]), int(s[8:10])
    a = (14 - m) // 12
    yy, mm = y + 4800 - a, m + 12 * a - 3
    return d + (153 * mm + 2) // 5 + 365 * yy + yy // 4 - yy // 100 + yy // 400 - 32045

def _require_text(value: str, label: str, limit: int) -> str:
    if not isinstance(value, str) or not value.strip() or len(value.strip()) > limit:
        raise gl.vm.UserError("EXPECTED: invalid " + label)
    return value.strip()

def _json_list(s: str) -> list:
    try:
        v = json.loads(s)
        if isinstance(v, list):
            return v
    except Exception:
        pass
    return []

@gl.evm.contract_interface
class _NativeRecipient:
    class View: pass
    class Write: pass

class ClimateClaim(gl.Contract):
    owner: Address
    policy_contract: Address
    evaluator_contract: Address
    claims: TreeMap[str, Claim]
    claim_ids: DynArray[str]
    claim_index: TreeMap[str, str]
    policy_snapshots: TreeMap[str, str]
    claim_counter: u256
    escrow_balance: u256
    in_flight: DynArray[str]
    refund_count: u256
    refund_total: u256

    def __init__(self, owner: Address, policy_contract: Address,
                 evaluator_contract: Address):
        self.owner = _as_address(owner)
        self.policy_contract = _as_address(policy_contract)
        self.evaluator_contract = _as_address(evaluator_contract)
        self.claim_counter = u256(0)
        self.escrow_balance = u256(0)
        self.refund_count = u256(0)
        self.refund_total = u256(0)

    def _only_owner(self):
        if gl.message.sender_address != self.owner:
            raise gl.vm.UserError("EXPECTED: owner only")

    def _claim(self, claim_id: str) -> Claim:
        if claim_id not in self.claims:
            raise gl.vm.UserError("EXPECTED: unknown claim")
        return self.claims[claim_id]

    def _only_claimant_or_owner(self, c: Claim):
        if gl.message.sender_address != c.claimant and gl.message.sender_address != self.owner:
            raise gl.vm.UserError("EXPECTED: claimant or owner only")

    # The policy is read from ClimatePolicy at claim time, so a caller cannot
    # substitute terms. `gl.get_contract_at` requires an Address; the constructor
    # coerces `policy_contract` to one.
    def _authoritative_policy(self, policy_id: str) -> dict:
        if not isinstance(policy_id, str) or not policy_id or len(policy_id) > 64:
            raise gl.vm.UserError("EXPECTED: invalid policy id")
        try:
            proxy = gl.get_contract_at(self.policy_contract)
        except Exception:
            raise gl.vm.UserError("EXTERNAL: policy address rejected")
        try:
            p = proxy.view().get_policy(policy_id)
        except Exception:
            raise gl.vm.UserError("EXTERNAL: policy contract unreachable")
        if not isinstance(p, dict) or not p or not p.get("id"):
            raise gl.vm.UserError("EXPECTED: unknown policy")
        if p.get("status") != "active":
            raise gl.vm.UserError("EXPECTED: policy is not active")
        if not isinstance(p.get("sources"), list) or not p["sources"]:
            raise gl.vm.UserError("EXPECTED: policy has no frozen sources")
        if not _date_ok(str(p.get("period_start", ""))) or not _date_ok(str(p.get("period_end", ""))):
            raise gl.vm.UserError("EXPECTED: policy has an invalid period")
        return p

    # `start_claim` re-reads the authoritative policy; this snapshot is only a cache.
    @gl.public.write
    def register_policy_snapshot(self, policy_json: str) -> str:
        if len(policy_json) > 12000:
            raise gl.vm.UserError("EXPECTED: policy snapshot too large")
        try:
            p = json.loads(policy_json)
        except Exception:
            raise gl.vm.UserError("EXPECTED: invalid policy JSON")
        if not isinstance(p, dict) or not isinstance(p.get("id"), str) or not p["id"]:
            raise gl.vm.UserError("EXPECTED: invalid policy snapshot")
        if len(p["id"]) > 64:
            raise gl.vm.UserError("EXPECTED: invalid policy id")
        self.policy_snapshots[p["id"]] = json.dumps(p, separators=(",", ":"))
        return p["id"]

    @gl.public.write
    def start_claim(self, policy_id: str, period_start: str, period_end: str) -> str:
        p = self._authoritative_policy(policy_id)
        if not _date_ok(period_start) or not _date_ok(period_end) or period_start > period_end:
            raise gl.vm.UserError("EXPECTED: invalid claim period")
        if period_start < p.get("period_start", "") or period_end > p.get("period_end", ""):
            raise gl.vm.UserError("EXPECTED: claim period outside policy")
        if _ordinal(period_end) - _ordinal(period_start) + 1 > MAX_PERIOD_DAYS:
            raise gl.vm.UserError("EXPECTED: claim period too long")
        pid = _require_text(str(p.get("id", "")), "policy id", 64)
        key = pid + "|" + period_start + "|" + period_end
        if self.claim_index.get(key, ""):
            raise gl.vm.UserError("EXPECTED: claim already exists for this period")
        cid = "claim-" + str(int(self.claim_counter) + 1)
        c = Claim(cid, pid, json.dumps(p, separators=(",", ":")),
                  gl.message.sender_address, period_start, period_end, "created",
                  "inconclusive", "none", "", i256(0), u256(0), u256(0),
                  False, SETTLEMENT_NOT, u256(0), "[]", "[]", "[]", "",
                  gl.message.sender_address)
        self.claims[cid] = c
        self.claim_ids.append(cid)
        self.claim_index[key] = cid
        self.claim_counter = u256(int(self.claim_counter) + 1)
        return cid

    @gl.public.write
    def open_dispute(self, claim_id: str, grounds: str) -> None:
        c = self._claim(claim_id)
        self._only_claimant_or_owner(c)
        if c.finalized or c.dispute_rounds >= MAX_DISPUTE_ROUNDS:
            raise gl.vm.UserError("EXPECTED: dispute unavailable")
        if c.state not in ("decided_confirmed", "decided_not_confirmed", "inconclusive", "disputed"):
            raise gl.vm.UserError("EXPECTED: claim has no decision to dispute")
        c.pending_grounds = _require_text(grounds, "grounds", 500)
        c.pending_opener = gl.message.sender_address
        c.dispute_rounds = u256(int(c.dispute_rounds) + 1)
        c.state = "disputed"
        self.claims[claim_id] = c

    @gl.public.write
    def sync_evaluation(self, claim_id: str) -> None:
        """Record a consensus result stored by ClimateEvaluator against this claim."""
        c = self._claim(claim_id)
        if c.state not in ("created", "pending_evaluation", "evidence_collected", "disputed"):
            raise gl.vm.UserError("EXPECTED: claim is not open for evaluation")
        try:
            proxy = gl.get_contract_at(self.evaluator_contract)
        except Exception:
            raise gl.vm.UserError("EXTERNAL: evaluator contract unreachable")
        try:
            res = proxy.view().get_result(claim_id, int(c.dispute_rounds))
        except Exception:
            raise gl.vm.UserError("EXTERNAL: evaluator contract unreachable")
        if not isinstance(res, dict) or not res.get("decision"):
            raise gl.vm.UserError("EXTERNAL: no evaluation result")
        if res.get("policy_id") != c.policy_id:
            raise gl.vm.UserError("EXTERNAL: evaluation policy mismatch")
        if res.get("period_start") != c.period_start or res.get("period_end") != c.period_end:
            raise gl.vm.UserError("EXTERNAL: evaluation period mismatch")
        p = json.loads(c.policy_snapshot_json)
        if not isinstance(p, dict) or res.get("policy_version") != p.get("version"):
            raise gl.vm.UserError("EXTERNAL: evaluation version mismatch")
        srcs = res.get("sources")
        if not isinstance(srcs, list):
            raise gl.vm.UserError("EXTERNAL: evaluation evidence missing")
        rows = []
        for r in srcs:
            if not isinstance(r, dict) or not isinstance(r.get("source_id"), str):
                continue
            rows.append({"source_id": r["source_id"],
                         "ok": bool(r.get("ok")),
                         "days_covered": r.get("days_covered") if isinstance(r.get("days_covered"), int) else 0,
                         "value_scaled": r.get("value_scaled") if isinstance(r.get("value_scaled"), int) else 0})
        days = _ordinal(c.period_end) - _ordinal(c.period_start) + 1
        try:
            pp = gl.get_contract_at(self.policy_contract)
            computed = pp.view().compute_evaluation(c.policy_snapshot_json,
                                                   json.dumps(rows, separators=(",", ":")), days)
        except Exception:
            raise gl.vm.UserError("EXTERNAL: policy contract unreachable")
        if not isinstance(computed, dict) or computed.get("decision") != res.get("decision"):
            raise gl.vm.UserError("EXTERNAL: evaluation mismatch")
        if computed.get("reason_code") != res.get("reason_code"):
            raise gl.vm.UserError("EXTERNAL: evaluation mismatch")
        c.decision = str(res["decision"])
        c.reason = _require_text(str(res.get("reason_code", "none")), "reason", 80)
        c.summary = _require_text(str(res.get("summary", "")) or "Consensus evaluation.", "summary", 280)
        c.observed_scaled = i256(int(res.get("observed_value_scaled", 0)))
        c.evidence_json = json.dumps(srcs, separators=(",", ":"))
        c.state = {"confirmed": "decided_confirmed",
                   "not_confirmed": "decided_not_confirmed",
                   "inconclusive": "inconclusive"}.get(c.decision, "inconclusive")
        c.finalized = False
        c.settlement_state = SETTLEMENT_NOT
        c.evaluation_round = u256(int(c.evaluation_round) + 1)
        self.claims[claim_id] = c

    @gl.public.write
    def finalize_decision(self, claim_id: str) -> None:
        self._only_owner()
        c = self._claim(claim_id)
        if c.state not in ("decided_confirmed", "decided_not_confirmed", "inconclusive"):
            raise gl.vm.UserError("EXPECTED: claim has no finalizable decision")
        if c.decision == "inconclusive":
            raise gl.vm.UserError("EXPECTED: inconclusive decision cannot settle")
        c.finalized = True
        self.claims[claim_id] = c

    @gl.public.write.payable
    def fund(self) -> None:
        self.escrow_balance = u256(int(self.escrow_balance) + int(gl.message.value))

    @gl.public.write
    def settle_claim(self, claim_id: str) -> None:
        self._only_owner()
        c = self._claim(claim_id)
        if c.settlement_state in (SETTLEMENT_EMITTED, SETTLEMENT_DONE):
            raise gl.vm.UserError("EXPECTED: payout already in flight")
        if not c.finalized or c.decision != "confirmed":
            raise gl.vm.UserError("EXPECTED: confirmed finalized claim required")
        p = json.loads(c.policy_snapshot_json)
        amount = int(p.get("payout_amount", 0))
        if amount <= 0:
            raise gl.vm.UserError("EXPECTED: payout amount is zero")
        if amount > int(self.balance):
            raise gl.vm.UserError("EXPECTED: insufficient contract balance")
        recipient = self._recipient_for(p, c)
        c.settlement_state = SETTLEMENT_EMITTED
        c.payout_round = u256(int(c.payout_round) + 1)
        c.payouts_json = json.dumps(
            self._append_payout(c, recipient, amount), separators=(",", ":"))
        self.claims[claim_id] = c
        self.in_flight.append(claim_id)
        try:
            _NativeRecipient(recipient).emit_transfer(value=u256(amount))
        except Exception:
            failed = self._claim(claim_id)
            failed.settlement_state = SETTLEMENT_NOT
            self.claims[claim_id] = failed
            self._clear_in_flight(claim_id)
            raise gl.vm.UserError("EXTERNAL: transfer failed")

    @gl.public.write
    def confirm_settlement(self, claim_id: str, proof_reference: str) -> None:
        self._only_owner()
        c = self._claim(claim_id)
        if c.settlement_state != SETTLEMENT_EMITTED:
            raise gl.vm.UserError("EXPECTED: payout was not emitted")
        _require_text(proof_reference, "settlement proof", 160)
        c.settlement_state = SETTLEMENT_DONE
        c.state = "settled"
        c.payouts_json = json.dumps(
            self._set_last_payout(c, PAYOUT_CONFIRMED, ""), separators=(",", ":"))
        self.claims[claim_id] = c
        self._clear_in_flight(claim_id)

    @gl.public.write
    def fail_settlement(self, claim_id: str, reason: str) -> None:
        self._only_owner()
        c = self._claim(claim_id)
        if c.settlement_state != SETTLEMENT_EMITTED:
            raise gl.vm.UserError("EXPECTED: no payout in flight")
        note = _require_text(reason, "reason", 180)
        c.settlement_state = SETTLEMENT_FAILED
        c.payouts_json = json.dumps(
            self._set_last_payout(c, PAYOUT_FAILED, note), separators=(",", ":"))
        c.summary = (c.summary + " | settlement failure: " + note)[:280]
        self.claims[claim_id] = c
        self._clear_in_flight(claim_id)

    @gl.public.write.payable
    def __on_errored_message__(self) -> None:
        value = int(gl.message.value)
        self.refund_count = u256(int(self.refund_count) + 1)
        self.refund_total = u256(int(self.refund_total) + value)
        if len(self.in_flight) == 1:
            cid = self.in_flight[0]
            claim = self.claims.get(cid, None)
            if claim is not None:
                claim.settlement_state = SETTLEMENT_FAILED
                claim.payouts_json = json.dumps(
                    self._set_last_payout(claim, PAYOUT_FAILED,
                                          "EXTERNAL: payout message errored"),
                    separators=(",", ":"))
                self.claims[cid] = claim
            del self.in_flight[0]

    @gl.public.view
    def get_evaluator(self) -> str:
        return self.evaluator_contract.as_hex

    @gl.public.view
    def get_claim(self, claim_id: str) -> dict:
        c = self._claim(claim_id)
        return {"id": c.id, "policy_id": c.policy_id,
                "policy_snapshot": json.loads(c.policy_snapshot_json),
                "claimant": c.claimant.as_hex, "period_start": c.period_start,
                "period_end": c.period_end, "state": c.state, "decision": c.decision,
                "reason": c.reason, "summary": c.summary,
                "observed_scaled": int(c.observed_scaled),
                "evaluation_round": int(c.evaluation_round),
                "dispute_rounds": int(c.dispute_rounds), "finalized": c.finalized,
                "settlement_state": c.settlement_state,
                "payout_round": int(c.payout_round),
                "payouts": json.loads(c.payouts_json),
                "evidence": json.loads(c.evidence_json),
                "disputes": json.loads(c.disputes_json),
                "pending_grounds": c.pending_grounds}

    @gl.public.view
    def list_claims(self) -> list:
        return [self.get_claim(cid) for cid in self.claim_ids]

    @gl.public.view
    def get_claim_count(self) -> int:
        return len(self.claim_ids)

    @gl.public.view
    def get_escrow_balance(self) -> int:
        return int(self.escrow_balance)

    @gl.public.view
    def get_refunds(self) -> dict:
        return {"count": int(self.refund_count), "total": int(self.refund_total)}

    @gl.public.view
    def get_in_flight(self) -> list:
        return [cid for cid in self.in_flight]

    def _recipient_for(self, p: dict, c: Claim) -> Address:
        ben = str(p.get("beneficiary", "") or "")
        if ben:
            addr = Address(ben)
            if addr.as_bytes != ZERO_ADDRESS_BYTES:
                return addr
        return c.claimant

    def _append_payout(self, c: Claim, recipient: Address, amount: int) -> list:
        rows = _json_list(c.payouts_json)
        rows.append({"round": int(c.payout_round), "recipient": recipient.as_hex,
                     "amount": int(amount), "outcome": PAYOUT_EMITTED})
        return rows[-MAX_PAYOUT_LOG:]

    def _set_last_payout(self, c: Claim, outcome: str, reason: str) -> list:
        rows = _json_list(c.payouts_json)
        if rows and isinstance(rows[-1], dict):
            rows[-1]["outcome"] = outcome
            if reason:
                rows[-1]["reason"] = reason
        return rows[-MAX_PAYOUT_LOG:]

    def _clear_in_flight(self, claim_id: str) -> None:
        for i in range(len(self.in_flight)):
            if self.in_flight[i] == claim_id:
                del self.in_flight[i]
                return
