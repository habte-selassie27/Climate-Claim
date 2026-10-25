# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
"""
Climate-Policy-Evaluator.py — Policy registry, decision engine, and evidence evaluator.
Merged contract file containing both ClimatePolicy and ClimateEvaluator.
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
        leap = y % 4 == 0 and (y % 100 != 0 or y % 400 == 0)
        return 1 <= d <= [31, 29 if leap else 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1]
    except Exception:
        return False

def _period_ok(start: str, end: str) -> bool:
    if not _valid_date(start) or not _valid_date(end) or start > end:
        return False
    def ordinal(s):
        y, m, d = int(s[:4]), int(s[5:7]), int(s[8:10])
        a = (14-m)//12
        yy, mm = y+4800-a, m+12*a-3
        return d+(153*mm+2)//5+365*yy+yy//4-yy//100+yy//400-32045
    return ordinal(end) - ordinal(start) + 1 <= MAX_PERIOD_DAYS

CRITERIA_VERSION = "climateclaim-criteria-3"
SCALE = 100
MAX_EVIDENCE_JSON = 12000
CONF, NOTC, INC = "confirmed", "not_confirmed", "inconclusive"
R_CROSS, R_NOCROSS = "threshold_crossed", "threshold_not_crossed"
R_CONFLICT, R_MISSING = "source_conflict", "missing_observations"
R_LOC, R_DOWN = "location_mismatch", "sources_unreachable"
DECS = (CONF, NOTC, INC)
CHK = ("threshold_crossed", "period_covered", "data_completeness", "source_agreement")
REQ = ("threshold_crossed", "period_covered", "data_completeness")
PASS, FAIL, UNCL = "pass", "fail", "unclear"
STS = (PASS, FAIL, UNCL)

def _cmp(c: str, v: int, t: int) -> bool:
    return v > t if c == "gt" else (v >= t if c == "gte" else (v < t if c == "lt" else v <= t))

def _int(v) -> bool:
    return isinstance(v, int) and not isinstance(v, bool)

def _enum(v, ok, fb):
    return v.strip().lower() if isinstance(v, str) and v.strip().lower() in ok else fb

def _median(vals: list) -> int:
    s, n = sorted(vals), len(vals)
    if n == 0:
        return 0
    return s[n // 2] if n % 2 else (s[n // 2 - 1] + s[n // 2]) // 2

def _frozen(policy_json: str) -> dict:
    """Parse a frozen policy snapshot; {} when anything about it is unusable."""
    try:
        p = json.loads(policy_json) if isinstance(policy_json, str) else None
    except Exception:
        return {}
    ids = p.get("source_ids") if isinstance(p, dict) else None
    if not isinstance(ids, list) or not 1 <= len(ids) <= MAX_SOURCES or len(set(ids)) != len(ids):
        return {}
    if p.get("comparator") not in COMPARATORS or p.get("agreement_rule") not in AGREEMENT:
        return {}
    if not _int(p.get("threshold_scaled")) or abs(p["threshold_scaled"]) > 10_000_000:
        return {}
    if not _int(p.get("min_sources")) or not 1 <= p["min_sources"] <= len(ids):
        return {}
    return p

def _rows(evidence_json: str) -> list:
    """Bound evidence rows; a malformed shape is rejected, never guessed at."""
    if not isinstance(evidence_json, str) or len(evidence_json) > MAX_EVIDENCE_JSON:
        return []
    try:
        raw = json.loads(evidence_json)
    except Exception:
        return []
    if not isinstance(raw, list) or not 1 <= len(raw) <= MAX_SOURCES:
        return []
    out = []
    for r in raw:
        sid = r.get("source_id") if isinstance(r, dict) else None
        if not isinstance(sid, str) or not sid or len(sid) > 64:
            return []
        if not _int(r.get("value_scaled")) or not _int(r.get("days_covered")):
            return []
        if r["days_covered"] < 0:
            return []
        out.append({"source_id": sid, "ok": bool(r.get("ok")),
                    "days_covered": r["days_covered"],
                    "value_scaled": r["value_scaled"], "crossed": False})
    return out

def _evaluate(policy: dict, rows: list, days_expected: int) -> dict:
    """Derive the decision: no storage, no clock, no web, no model. A row's crossed
    flag is recomputed from the raw value and the frozen threshold, never trusted,
    and a missing observation forces inconclusive rather than being interpolated."""
    wanted = set(policy["source_ids"])
    ck = {n: UNCL for n in CHK}
    res = {"decision": INC, "reason_code": R_MISSING, "observed_value_scaled": 0,
           "checks": ck, "sources_used": [], "sources_missing": sorted(wanted),
           "criteria_version": CRITERIA_VERSION}
    if set(r["source_id"] for r in rows) != wanted:
        return res
    used = []
    for r in rows:
        r["crossed"] = r["ok"] and _cmp(policy["comparator"], r["value_scaled"],
                                        policy["threshold_scaled"])
        if r["ok"]:
            used.append(r)
    res["sources_used"] = [r["source_id"] for r in used]
    if not used:
        res["reason_code"] = R_DOWN
        return res
    n, nt = len(used), sum(1 for r in used if r["crossed"])
    full = all(r["days_covered"] == days_expected for r in used)
    ck["period_covered"] = PASS if full else FAIL
    ck["data_completeness"] = PASS if (n >= policy["min_sources"] and full) else FAIL
    res["observed_value_scaled"] = _median([r["value_scaled"] for r in used])
    if n < policy["min_sources"] or not full:
        return res
    rule = policy["agreement_rule"]
    if rule == "any":
        agree, crossed, tie = True, nt > 0, False
    elif rule == "majority":
        agree, crossed, tie = nt * 2 != n, nt * 2 > n, nt * 2 == n
    else:
        agree, crossed, tie = (nt == 0 or nt == n), (nt == n and n > 0), False
    ck["source_agreement"] = PASS if agree else FAIL
    if tie or not agree:
        res["reason_code"] = R_CONFLICT
        ck["threshold_crossed"] = UNCL
        return res
    ck["threshold_crossed"] = PASS if crossed else FAIL
    res["decision"] = CONF if crossed else NOTC
    res["reason_code"] = R_CROSS if crossed else R_NOCROSS
    return res

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

    @gl.public.write
    def set_policy_status(self, policy_id: str, status: str) -> None:
        self._only_owner()
        if status not in ("active", "retired"):
            raise gl.vm.UserError("EXPECTED: unsupported status")
        p = self._get_policy(policy_id)
        p.status = status
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

    @gl.public.view
    def compute_evaluation(self, policy_json: str, evidence_json: str,
                           days_expected: int) -> dict:
        """Derive the decision for a frozen policy from evidence rows {source_id,
        ok, days_covered, value_scaled}. Reverts EXPECTED when unusable."""
        p = _frozen(policy_json)
        rows = _rows(evidence_json)
        if not p or not rows:
            raise gl.vm.UserError("EXPECTED: unusable snapshot or evidence")
        if not _int(days_expected) or not 1 <= days_expected <= MAX_PERIOD_DAYS:
            raise gl.vm.UserError("EXPECTED: invalid days_expected")
        r = _evaluate(p, rows, days_expected)
        out = {k: r[k] for k in ("decision", "reason_code", "observed_value_scaled",
                                 "sources_used", "sources_missing", "criteria_version")}
        out["checks"] = [{"name": n, "status": _enum(r["checks"].get(n), STS, UNCL)}
                         for n in CHK]
        out["sources"] = [{"source_id": x["source_id"], "ok": x["ok"],
                           "days_covered": x["days_covered"],
                           "value_scaled": x["value_scaled"], "crossed": x["crossed"]}
                          for x in rows]
        return out


# ClimateEvaluator code
CRIT_EVAL = "climateclaim-criteria-4"
MXREC = 16000
CONF_E, NOTC_E, INC_E = "confirmed", "not_confirmed", "inconclusive"
RC_E, RN_E = "threshold_crossed", "threshold_not_crossed"
RF_E, RM_E = "source_conflict", "missing_observations"
RL_E, RD_E = "location_mismatch", "sources_unreachable"
DECS_E, REAS_E = (CONF_E, NOTC_E, INC_E), (RC_E, RN_E, RF_E, RM_E, RL_E, RD_E)
GROUPS_E = ((RF_E,), (RM_E,), (RL_E,), (RC_E,), (RN_E,), (RD_E,))
CHK_E = ("threshold_crossed", "period_covered", "location_match", "source_agreement",
       "data_completeness")
REQ_E = ("threshold_crossed", "period_covered", "data_completeness")
PASS_E, FAIL_E, UNCL_E = "pass", "fail", "unclear"
STS_E = (PASS_E, FAIL_E, UNCL_E)
GT_E, GTE_E, LT_E = "gt", "gte", "lt"
CMPS_E = (GT_E, GTE_E, LT_E, "lte")
ANY_E = "any"
RULES_E = ("unanimous", "majority", ANY_E)
CUM_E, CONS_E = "cumulative", "consecutive_days"
UNIT_E = {"precipitation": "mm", "temperature": "celsius"}
AGGS_E = {"precipitation": ("max_single", CUM_E, CONS_E), "temperature": ("max_single",)}
KINDS_E = {"historical_simulation": ("open_meteo_archive", "nasa_power"),
         "live": ("open_meteo_forecast",)}
NASA_E = "nasa_power"
COS_E = (1000, 996, 985, 966, 940, 906, 866, 819, 766, 707, 643, 574, 500, 423,
       342, 259, 174, 87, 0)

def _pd_e(s: str):
    if not isinstance(s, str) or len(s) != 10 or s[4] != "-" or s[7] != "-":
        raise ValueError("date")
    return (int(s[0:4]), int(s[5:7]), int(s[8:10]))

def _ord_e(s: str) -> int:
    y, m, d = _pd_e(s)
    a = (14 - m) // 12
    yy, mm = y + 4800 - a, m + 12 * a - 3
    return d + (153 * mm + 2) // 5 + 365 * yy + yy // 4 - yy // 100 + yy // 400 - 32045

def _span_e(a: str, b: str) -> int:
    return _ord_e(b) - _ord_e(a) + 1

def _cmp_e(c: str, v: int, t: int) -> bool:
    return v > t if c == GT_E else (v >= t if c == GTE_E else (v < t if c == LT_E else v <= t))

def _native_e(v: float, metric: str, unit: str) -> float:
    if metric == "precipitation":
        if unit in ("mm", "mm/day", "mmd"):
            return v
        if unit in ("inch", "in", "inches", "inch/day"):
            return v * 25.4
    elif metric == "temperature":
        if unit in ("celsius", "C"):
            return v
        if unit in ("fahrenheit", "F"):
            return (v - 32.0) * 5.0 / 9.0
    raise ValueError("unit")

def _scl_e(v: float) -> int:
    return int(v * SCALE + 0.5) if v >= 0 else -int(-v * SCALE + 0.5)

def _fit_e(v) -> bool:
    return isinstance(v, int) and not isinstance(v, bool) and -10000000 <= v <= 10000000

def _coord_e(s: int) -> str:
    a = -s if s < 0 else s
    return ("-" if s < 0 else "") + f"{a // 1000000}.{a % 1000000:06d}"

def _enum_e(v, ok, fb):
    return v.strip().lower() if isinstance(v, str) and v.strip().lower() in ok else fb

def _extract_e(obj, param: str):
    daily = obj.get("daily")
    if isinstance(daily, dict):
        times, vals = daily.get("time"), daily.get(param)
        if not isinstance(times, list) or not isinstance(vals, list) or len(times) != len(vals):
            return None
        la, lo = obj.get("latitude"), obj.get("longitude")
        return ([(t, float(v)) for t, v in zip(times, vals)
                 if isinstance(t, str) and len(t) == 10 and isinstance(v, (int, float))],
                int(round(la * 1e6)) if isinstance(la, (int, float)) else None,
                int(round(lo * 1e6)) if isinstance(lo, (int, float)) else None,
                obj.get("daily_units", {}).get(param, ""))
    props = obj.get("properties")
    par = props.get("parameter") if isinstance(props, dict) else None
    series = par.get(param) if isinstance(par, dict) else None
    if not isinstance(series, dict):
        return None
    unit = ""
    meta = obj.get("parameters")
    if isinstance(meta, dict) and isinstance(meta.get(param), dict):
        unit = meta[param].get("units", "") or ""
    geo = obj.get("geometry")
    cor = geo.get("coordinates") if isinstance(geo, dict) else None
    la = lo = None
    if isinstance(cor, list) and len(cor) > 1 and isinstance(cor[0], (int, float)) \
            and isinstance(cor[1], (int, float)):
        lo, la = int(round(cor[0] * 1e6)), int(round(cor[1] * 1e6))
    fill = obj.get("header", {}).get("fill_value") if isinstance(obj.get("header"), dict) else None
    rows = [(f"{k[0:4]}-{k[4:6]}-{k[6:8]}", float(v)) for k, v in series.items()
            if isinstance(k, str) and len(k) == 8 and k.isdigit()
            and isinstance(v, (int, float)) and (fill is None or v != fill) and v > -900]
    return (rows, la, lo, unit)

def _median_e(vals: list) -> int:
    s, n = sorted(vals), len(vals)
    if n == 0:
        return 0
    return s[n // 2] if n % 2 else (s[n // 2 - 1] + s[n // 2]) // 2

def _near_e(la, lo, pla, plo, tol: int) -> bool:
    if la is None or lo is None:
        return False
    ny = abs(la - pla) * 111320 // 1000000
    dl = abs(lo - plo)
    dl = min(dl, 360000000 - dl)
    b = abs(pla) // 5000000
    nx = dl * 111320 * COS_E[b if b < 19 else 18] // 1000000000
    return ny * ny + nx * nx <= tol * tol

def _fetch_e(src: dict, start: str, end: str) -> dict:
    unit = UNIT_E[src["metric"]]
    r = {"source_id": src["id"], "station": "", "period_start": start,
         "period_end": end, "unit": unit, "days_covered": 0, "value_scaled": 0,
         "crossed": False, "ok": False, "error": "", "lm": None, "om": None}
    if src["kind"] not in KINDS_E[src["data_mode"]]:
        r["error"] = "EXTERNAL: source_mode_mismatch"
        return r
    try:
        url = src["url_template"].format(
            lat=src["lat"], lon=src["lon"], start=start, end=end,
            param=src["param"], days=src["days"])
        if src["kind"] == NASA_E:
            url = url.replace("-", "")
        resp = gl.nondet.web.get(url)
        if int(resp.status) != 200:
            r["error"] = "EXTERNAL: fetch_failed"
            return r
        parsed = _extract_e(json.loads(bytes(resp.body or b"").decode(
            "utf-8", errors="replace")), src["param"])
    except Exception:
        r["error"] = "EXTERNAL: fetch_failed"
        return r
    if parsed is None:
        r["error"] = "EXTERNAL: parse_failed"
        return r
    rows, r["lm"], r["om"], rep = parsed
    if r["lm"] is not None and r["om"] is not None:
        r["station"] = f"{r['lm'] / 1000000:.4f},{r['om'] / 1000000:.4f}"
    seen, series = set(), []
    for d, raw in rows:
        if not start <= d <= end:
            continue
        if d in seen:
            r["error"] = "EXTERNAL: duplicate_dates"
            return r
        seen.add(d)
        try:
            sv = _scl_e(_native_e(raw, src["metric"], rep or unit))
        except Exception:
            r["error"] = "EXTERNAL: unit_mismatch"
            return r
        if not _fit_e(sv):
            r["error"] = "EXTERNAL: implausible_value"
            return r
        series.append((d, sv))
    series.sort(key=lambda p: p[0])
    vals = [v for _, v in series]
    if vals:
        if src["aggregation"] == CUM_E:
            r["value_scaled"] = sum(vals)
        elif src["aggregation"] == CONS_E:
            best = run = 0
            prev = None
            for d, v in series:
                o = _ord_e(d)
                if v != 0:
                    run = run + 1 if prev is not None and o == prev + 1 else 1
                    if run > best:
                        best = run
                else:
                    run = 0
                prev = o
            r["value_scaled"] = best * SCALE
        else:
            r["value_scaled"] = max(vals)
        r["days_covered"] = len(vals)
    r["ok"] = True
    return r

def _force_e(res: dict, ck: dict, reason: str, keep: bool = False) -> None:
    res["decision"], res["reason_code"] = INC_E, reason
    ck["threshold_crossed"] = UNCL_E
    if not keep:
        ck["source_agreement"] = UNCL_E

def _once_e(pol: dict, plan: list, start: str, end: str) -> dict:
    want = _span_e(start, end)
    recs = [_fetch_e(s, start, end) for s in plan]
    for r in recs:
        if r["ok"]:
            r["crossed"] = _cmp_e(pol["cmp"], r["value_scaled"], pol["threshold"])
    used = [r["source_id"] for r in recs if r["ok"]]
    ck = {n: UNCL_E for n in CHK_E}
    res = {"decision": INC_E, "reason_code": RM_E, "observed_value_scaled": 0,
           "checks": ck, "sources": recs,
           "summary": "" if used else "No eligible data source could be reached."}
    if not used:
        res["reason_code"] = RD_E
        return res
    loc = None
    for r in recs:
        if r["ok"]:
            close = _near_e(r["lm"], r["om"], pol["lat"], pol["lon"], pol["tol"])
            loc = close if loc is None else (loc and close)
    ck["location_match"] = UNCL_E if loc is None else (PASS_E if loc else FAIL_E)
    full = all(r["days_covered"] == want for r in recs if r["ok"])
    ck["period_covered"] = PASS_E if full else FAIL_E
    ck["data_completeness"] = PASS_E if len(used) >= pol["min_src"] and full else FAIL_E
    crs = [r["crossed"] for r in recs if r["ok"]]
    res["observed_value_scaled"] = _median_e([r["value_scaled"] for r in recs if r["ok"]])
    if ck["location_match"] == FAIL_E:
        _force_e(res, ck, RL_E)
    elif len(used) < pol["min_src"] or not full:
        _force_e(res, ck, RM_E)
    else:
        n, nt = len(crs), sum(1 for c in crs if c)
        if pol["rule"] == ANY_E:
            dec, agree, tie = nt > 0, True, False
        elif pol["rule"] == "majority":
            dec, agree, tie = nt * 2 > n, nt * 2 != n, nt * 2 == n
        else:
            dec, agree, tie = (nt == n and n > 0), (nt == 0 or nt == n), False
        ck["source_agreement"] = PASS_E if agree else FAIL_E
        if tie or not agree:
            _force_e(res, ck, RF_E, keep=True)
        else:
            ck["threshold_crossed"] = PASS_E if dec else FAIL_E
            res["decision"], res["reason_code"] = (CONF_E, RC_E) if dec else (NOTC_E, RN_E)
    res["summary"] = res["summary"] or _fallback_e(res)
    return res

def _fallback_e(res: dict) -> str:
    return {RC_E: "The evidence met the policy condition.",
            RN_E: "The evidence did not meet the policy condition.",
            RF_E: "Eligible sources disagreed on whether the condition was met.",
            RM_E: "The observation period was not fully covered by the evidence.",
            RL_E: "The reported location did not match the policy location.",
            RD_E: "No eligible data source could be reached."
            }.get(res["reason_code"], "The evidence was not sufficient to decide.")

def _smap_e(raw) -> dict:
    out = {}
    if not isinstance(raw, list):
        return out
    for it in raw:
        if not isinstance(it, dict) or not isinstance(it.get("source_id"), str):
            continue
        vs, cr = it.get("value_scaled"), it.get("crossed")
        out[it["source_id"]] = {"ok": bool(it.get("ok")),
                               "crossed": cr if isinstance(cr, bool) else False,
                               "value_scaled": vs if isinstance(vs, int) else 0}
    return out

def _agree_e(pol: dict, src: dict):
    ok = [v["crossed"] for v in src.values() if v["ok"]]
    if len(ok) < pol["min_src"]:
        return (False, False)
    n, nt = len(ok), sum(1 for c in ok if c)
    if pol["rule"] == ANY_E:
        return (True, nt > 0)
    if pol["rule"] == "majority":
        return (False, False) if nt * 2 == n else (True, nt * 2 > n)
    return (nt == 0 or nt == n, nt == n)

def _valid_e(res, pol: dict) -> bool:
    if not isinstance(res, dict) or res.get("decision") not in DECS_E:
        return False
    if res.get("reason_code") not in REAS_E:
        return False
    ck = res.get("checks")
    if not isinstance(ck, dict) or any(ck.get(n) not in STS_E for n in CHK_E):
        return False
    src = _smap_e(res.get("sources"))
    if set(src) != set(pol["source_ids"]):
        return False
    used = set(s for s, v in src.items() if v["ok"])
    if res["reason_code"] == RD_E and used:
        return False
    if res["decision"] in (CONF_E, NOTC_E):
        if any(ck.get(n) != PASS_E for n in REQ_E):
            return False
        ok, crossed = _agree_e(pol, src)
        if not ok or (res["decision"] == CONF_E) != crossed:
            return False
    return _fit_e(res.get("observed_value_scaled"))

def _equivalent_e(leader, mine, pol: dict) -> bool:
    if not isinstance(leader, dict) or not _valid_e(leader, pol) or not _valid_e(mine, pol):
        return False
    if leader.get("decision") != mine.get("decision"):
        return False
    if not (leader.get("reason_code") == mine.get("reason_code")
            or any(leader.get("reason_code") in g and mine.get("reason_code") in g
                   for g in GROUPS_E)):
        return False
    lc, mc = leader["checks"], mine["checks"]
    if any(lc.get(n) != mc.get(n) for n in REQ_E):
        return False
    for n in CHK_E:
        if n not in REQ_E and lc.get(n) != mc.get(n) and \
                not (lc.get(n) == UNCL_E and mc.get(n) in (PASS_E, FAIL_E)):
            return False
    if FAIL_E in (lc.get("location_match"), mc.get("location_match")):
        if leader.get("decision") != INC_E or leader.get("reason_code") != RL_E:
            return False
        if lc.get("location_match") != FAIL_E or mc.get("location_match") != FAIL_E:
            return False
    lo, mo = leader["observed_value_scaled"], mine["observed_value_scaled"]
    if abs(lo - mo) > SCALE:
        return False
    if _cmp_e(pol["cmp"], lo, pol["threshold"]) != _cmp_e(pol["cmp"], mo, pol["threshold"]):
        return False
    ls, ms = _smap_e(leader["sources"]), _smap_e(mine["sources"])
    if set(ls) != set(ms):
        return False
    for sid, lv in ls.items():
        mv = ms[sid]
        if lv["ok"] != mv["ok"] or lv["crossed"] != mv["crossed"]:
            return False
        if lv["ok"] and abs(lv["value_scaled"] - mv["value_scaled"]) > SCALE:
            return False
    ok, crossed = _agree_e(pol, ls)
    if (leader["decision"] == CONF_E) != (ok and crossed):
        return False
    return leader["decision"] != NOTC_E or (ok and not crossed)
