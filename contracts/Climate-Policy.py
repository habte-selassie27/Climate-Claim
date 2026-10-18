# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
"""
ClimatePolicy.py — policy configuration contract.

Responsibilities:
- Owner-managed weather-source registry
- Policy creation, versioning, retirement, and read methods
- Immutable policy versions for new claims

Architecture:
ClimateClaim owns claims, evidence, disputes, and settlement state.
The claim contract should store a policy snapshot when a claim is opened.
Do not assume cross-contract calls are authenticated merely because a policy ID
is supplied; configure the trusted ClimatePolicy contract address in ClimateClaim.
"""
from dataclasses import dataclass
import json
from genlayer import *

MAX_SOURCES = 4
MAX_TEXT = 300
MAX_PAYOUT = 10**30
MAX_TOLERANCE_M = 200_000
MAX_PERIOD_DAYS = 366

METRICS = ("precipitation", "temperature")
SOURCE_KINDS = ("open_meteo_archive", "open_meteo_forecast", "nasa_power")
MODES = ("historical_simulation", "live")
AGGREGATIONS = ("max_single", "cumulative", "consecutive_days")
COMPARATORS = ("gt", "gte", "lt", "lte")
AGREEMENT = ("unanimous", "majority", "any")
CANONICAL_UNIT = {"precipitation": "mm", "temperature": "celsius"}
MODE_KINDS = {
    "historical_simulation": ("open_meteo_archive", "nasa_power"),
    "live": ("open_meteo_forecast",),
}

@allow_storage
@dataclass
class Source:
    id: str
    name: str
    kind: str
    metric: str
    param: str
    url_template: str
    unit: str
    attribution: str

@allow_storage
@dataclass
class Policy:
    id: str
    owner: Address
    version: u32
    location_name: str
    lat_scaled: i256
    lon_scaled: i256
    tolerance_m: u32
    source_ids_json: str
    sources_json: str
    agreement_rule: str
    min_sources: u8
    data_mode: str
    period_start: str
    period_end: str
    timezone: str
    metric: str
    unit: str
    comparator: str
    threshold_scaled: i256
    aggregation: str
    condition_text: str
    payout_amount: u256
    beneficiary: Address
    status: str

def _require_text(value: str, label: str, limit: int) -> str:
    if not isinstance(value, str) or not value.strip() or len(value.strip()) > limit:
        raise gl.vm.UserError("EXPECTED: invalid " + label)
    return value.strip()

def _valid_date(value: str) -> bool:
    if not isinstance(value, str) or len(value) != 10:
        return False
    try:
        y, m, d = int(value[:4]), int(value[5:7]), int(value[8:10])
        if value[4] != "-" or value[7] != "-" or y < 1900 or m < 1 or m > 12:
            return False
        mdays = [31, 29 if y % 4 == 0 and (y % 100 != 0 or y % 400 == 0) else 28,
                 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
        return 1 <= d <= mdays[m - 1]
    except Exception:
        return False

def _period_ok(start: str, end: str) -> bool:
    if not _valid_date(start) or not _valid_date(end) or start > end:
        return False
    # Safe conservative upper bound; detailed day counting is unnecessary for
    # the lexical check, so use datetime-independent ordinal calculation.
    def ordinal(s):
        y, m, d = int(s[:4]), int(s[5:7]), int(s[8:10])
        a = (14-m)//12
        yy, mm = y+4800-a, m+12*((14-m)//12)-3
        return d+(153*mm+2)//5+365*yy+yy//4-yy//100+yy//400-32045
    return ordinal(end) - ordinal(start) + 1 <= MAX_PERIOD_DAYS

class ClimatePolicy(gl.Contract):
    owner: Address
    source_registry: TreeMap[str, Source]
    source_ids: DynArray[str]
    policies: TreeMap[str, Policy]
    policy_ids: DynArray[str]
    policy_counter: u256

    def __init__(self, owner: Address):
        self.owner = owner
        self.policy_counter = u256(0)

    def _only_owner(self):
        if gl.message.sender_address != self.owner:
            raise gl.vm.UserError("EXPECTED: owner only")

    @gl.public.write
    def register_source(self, source_id: str, name: str, kind: str, metric: str,
                        param: str, url_template: str, unit: str,
                        attribution: str) -> None:
        self._only_owner()
        sid = _require_text(source_id, "source_id", 64)
        if sid in self.source_registry:
            raise gl.vm.UserError("EXPECTED: source already registered")
        if kind not in SOURCE_KINDS or metric not in METRICS:
            raise gl.vm.UserError("EXPECTED: unsupported source kind or metric")
        src = Source(sid, _require_text(name, "name", 200), kind, metric,
                     _require_text(param, "param", 64),
                     _require_text(url_template, "url_template", 500),
                     _require_text(unit, "unit", 32),
                     _require_text(attribution, "attribution", 200))
        self.source_registry[sid] = src
        self.source_ids.append(sid)

    @gl.public.write
    def create_policy(self, location_name: str, lat_scaled: int, lon_scaled: int,
                      tolerance_m: int, source_ids: list, agreement_rule: str,
                      min_sources: int, data_mode: str, period_start: str,
                      period_end: str, timezone: str, metric: str, unit: str,
                      comparator: str, threshold_scaled: int, aggregation: str,
                      condition_text: str, payout_amount: int) -> str:
        self._only_owner()
        if metric not in METRICS or data_mode not in MODES:
            raise gl.vm.UserError("EXPECTED: unsupported metric or mode")
        if not isinstance(source_ids, list) or not 1 <= len(source_ids) <= MAX_SOURCES:
            raise gl.vm.UserError("EXPECTED: invalid source count")
        if len(set(source_ids)) != len(source_ids):
            raise gl.vm.UserError("EXPECTED: duplicate source")
        if agreement_rule not in AGREEMENT or not 1 <= min_sources <= len(source_ids):
            raise gl.vm.UserError("EXPECTED: invalid source agreement")
        if aggregation not in AGGREGATIONS or comparator not in COMPARATORS:
            raise gl.vm.UserError("EXPECTED: invalid aggregation or comparator")
        if metric == "temperature" and aggregation != "max_single":
            raise gl.vm.UserError("EXPECTED: unsupported temperature aggregation")
        expected_unit = "days" if aggregation == "consecutive_days" else CANONICAL_UNIT[metric]
        if unit != expected_unit:
            raise gl.vm.UserError("EXPECTED: incorrect canonical unit")
        if not _period_ok(period_start, period_end):
            raise gl.vm.UserError("EXPECTED: invalid or overlong period")
        if timezone.upper() not in ("UTC", "GMT"):
            raise gl.vm.UserError("EXPECTED: only UTC is supported")
        if not (-90_000_000 <= lat_scaled <= 90_000_000 and
                -180_000_000 <= lon_scaled <= 180_000_000):
            raise gl.vm.UserError("EXPECTED: invalid coordinates")
        if not isinstance(tolerance_m, int) or not 0 <= tolerance_m <= MAX_TOLERANCE_M:
            raise gl.vm.UserError("EXPECTED: invalid tolerance")
        if not isinstance(threshold_scaled, int) or abs(threshold_scaled) > 10_000_000:
            raise gl.vm.UserError("EXPECTED: threshold out of range")
        if not isinstance(payout_amount, int) or not 0 <= payout_amount <= MAX_PAYOUT:
            raise gl.vm.UserError("EXPECTED: payout out of range")
        _require_text(location_name, "location", 200)
        _require_text(condition_text, "condition", MAX_TEXT)
        frozen_sources = []
        for sid in source_ids:
            if sid not in self.source_registry:
                raise gl.vm.UserError("EXPECTED: unknown source")
            src = self.source_registry[sid]
            if src.metric != metric or src.kind not in MODE_KINDS[data_mode]:
                raise gl.vm.UserError("EXPECTED: source incompatible with policy")
            frozen_sources.append({
                "id": src.id, "name": src.name, "kind": src.kind,
                "metric": src.metric, "param": src.param,
                "url_template": src.url_template, "unit": src.unit,
                "attribution": src.attribution,
            })
        pid = "policy-" + str(int(self.policy_counter) + 1)
        p = Policy(pid, gl.message.sender_address, u32(1), location_name.strip(),
                   i256(lat_scaled), i256(lon_scaled), u32(tolerance_m),
                   json.dumps(source_ids), json.dumps(frozen_sources),
                   agreement_rule, u8(min_sources), data_mode, period_start,
                   period_end, "UTC", metric, unit, comparator,
                   i256(threshold_scaled), aggregation, condition_text.strip(),
                   u256(payout_amount), gl.message.sender_address, "active")
        self.policies[pid] = p
        self.policy_ids.append(pid)
        self.policy_counter = u256(int(self.policy_counter) + 1)
        return pid

    @gl.public.write
    def set_beneficiary(self, policy_id: str, beneficiary: Address) -> None:
        self._only_owner()
        p = self._get_policy(policy_id)
        p.beneficiary = beneficiary
        p.version = u32(int(p.version) + 1)
        self.policies[policy_id] = p

    @gl.public.write
    def retire_policy(self, policy_id: str) -> None:
        self._only_owner()
        p = self._get_policy(policy_id)
        p.status = "retired"
        p.version = u32(int(p.version) + 1)
        self.policies[policy_id] = p

    def _get_policy(self, policy_id: str) -> Policy:
        if policy_id not in self.policies:
            raise gl.vm.UserError("EXPECTED: unknown policy")
        return self.policies[policy_id]

    def _policy_dict(self, p: Policy) -> dict:
        return {
            "id": p.id, "owner": p.owner.as_hex, "version": int(p.version),
            "location_name": p.location_name, "lat_scaled": int(p.lat_scaled),
            "lon_scaled": int(p.lon_scaled), "tolerance_m": int(p.tolerance_m),
            "source_ids": json.loads(p.source_ids_json), "sources": json.loads(p.sources_json),
            "agreement_rule": p.agreement_rule, "min_sources": int(p.min_sources),
            "data_mode": p.data_mode, "period_start": p.period_start,
            "period_end": p.period_end, "timezone": p.timezone, "metric": p.metric,
            "unit": p.unit, "comparator": p.comparator,
            "threshold_scaled": int(p.threshold_scaled), "aggregation": p.aggregation,
            "condition_text": p.condition_text, "payout_amount": int(p.payout_amount),
            "beneficiary": p.beneficiary.as_hex, "status": p.status,
        }

    @gl.public.view
    def get_policy(self, policy_id: str) -> dict:
        return self._policy_dict(self._get_policy(policy_id))

    @gl.public.view
    def list_policies(self) -> list:
        return [self._policy_dict(self.policies[pid]) for pid in self.policy_ids]

    @gl.public.view
    def list_sources(self) -> list:
        return [{
            "id": sid, "name": self.source_registry[sid].name,
            "kind": self.source_registry[sid].kind,
            "metric": self.source_registry[sid].metric,
            "param": self.source_registry[sid].param,
            "url_template": self.source_registry[sid].url_template,
            "unit": self.source_registry[sid].unit,
            "attribution": self.source_registry[sid].attribution,
        } for sid in self.source_ids]
