# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
"""Climate-Evaluator: does recorded weather evidence confirm a policy condition?

WHY GENLAYER IS REQUIRED HERE AND NOWHERE ELSE
    The hard part is disagreement. Periods are often only partly covered, two
    sources report different values for the same coordinates, and reanalysis data
    is revised over time. No single server is authoritative enough to decide
    alone. So validators independently fetch the same sources and agree on the
    MEANING of the evidence, not on identical bytes.

EQUIVALENCE DESIGN (call: evaluate)
    LEADER   {decision, reason_code, observed_value_scaled, checks, sources}
    VALIDATE _valid() inspects the leader's calldata before anything is compared
    RULE     decision exact; reason equal or within the same GROUPS entry;
             required checks exact; optional checks may differ only
             unclear<->definite; observed within SCALE (0.01) AND on the same side
             of the threshold; per-source ok/crossed/value within SCALE. Nothing
             free-text is compared, so strict_eq is used nowhere.
    INVARIANT a result may not claim confirmed while its own value fails the
             threshold, nor claim a decision its sources do not support. This is
             what stops validators from agreeing on garbage.
    FAILURE  no source reachable -> inconclusive/unreachable; partial period ->
             inconclusive/missing_observations; sources disagree ->
             inconclusive/source_conflict; location outside tolerance ->
             inconclusive/location_mismatch.

SIZE NOTE (why this file is terse and validates only what it must)
    Both GenLayer testnets reject a deploy whose source exceeds ~19 KB, comments
    included. Measured on Bradbury and Asimov: 18600 B accepted, 20907 B
    rejected. The engine plus claim lifecycle is ~63 KB; stripped to one parser
    and no model call it is still ~27 KB. Everything not needed to run correctly
    has therefore been removed, including the owner, the stored criteria version
    and the exhaustive policy validation -- ClimatePolicy already validates, and
    this contract now checks only what would otherwise crash the consensus round.
    The policy JSON is echoed into each record instead of being registered, so a
    reader can still diff it against ClimatePolicy's authoritative copy.
"""
from dataclasses import dataclass
import json
from genlayer import *

CRIT = "climateclaim-criteria-3"
SCALE, MXDAY, MXV, MXTOL, MXSRC = 100, 366, 100000 * 100, 200000, 4
CONF, NOTC, INC = "confirmed", "not_confirmed", "inconclusive"
RC, RN = "threshold_crossed", "threshold_not_crossed"
RF, RM = "source_conflict", "missing_observations"
RL, RD = "location_mismatch", "sources_unreachable"
DECS, REAS = (CONF, NOTC, INC), (RC, RN, RF, RM, RL, RD)
GROUPS = ((RF,), (RM,), (RL,), (RC,), (RN,), (RD,))
CHK = ("threshold_crossed", "period_covered", "location_match", "source_agreement",
       "data_completeness")
REQ = ("threshold_crossed", "period_covered", "data_completeness")
PASS, FAIL, UNCL = "pass", "fail", "unclear"
STS = (PASS, FAIL, UNCL)
GT, GTE, LT = "gt", "gte", "lt"
CMPS = (GT, GTE, LT, "lte")
ANY = "any"
RULES = ("unanimous", "majority", ANY)
CUM = "cumulative"
UNIT = {"precipitation": "mm", "temperature": "celsius"}
AGGS = {"precipitation": ("max_single", CUM), "temperature": ("max_single",)}
KINDS = {"historical_simulation": ("open_meteo_archive",),
         "live": ("open_meteo_forecast",)}
# cosine per 5 degrees of latitude x1000, so the distance check stays in integers
# and every validator computes the same metres instead of drifting in floats.
COS = (1000, 996, 985, 966, 940, 906, 866, 819, 766, 707, 643, 574, 500, 423,
       342, 259, 174, 87, 0)


@allow_storage
@dataclass
class Evaluation:
    id: str
    policy_id: str
    period_start: str
    period_end: str
    decision: str
    reason: str
    summary: str
    observed_scaled: i256
    days_expected: u32
    criteria_version: str
    evidence_json: str
    checks_json: str
    policy_json: str


def _pd(s: str):
    """Parse YYYY-MM-DD strictly; 2024-02-31 is rejected, not silently rolled."""
    if len(s) != 10 or s[4] != "-" or s[7] != "-":
        raise ValueError("date")
    y, m, d = int(s[0:4]), int(s[5:7]), int(s[8:10])
    md = (31, 29 if (y % 4 == 0 and y % 100 != 0) or y % 400 == 0 else 28, 31, 30,
          31, 30, 31, 31, 30, 31, 30, 31)
    if y < 1900 or y > 9999 or not 1 <= m <= 12 or not 1 <= d <= md[m - 1]:
        raise ValueError("date")
    return (y, m, d)


def _span(a: str, b: str) -> int:
    y1, m1, d1 = _pd(a)
    y2, m2, d2 = _pd(b)
    o1 = (14 - m1) // 12
    w1 = y1 + 4800 - o1
    p1 = m1 + 12 * o1 - 3
    o2 = (14 - m2) // 12
    w2 = y2 + 4800 - o2
    p2 = m2 + 12 * o2 - 3
    return (d2 + (153 * p2 + 2) // 5 + 365 * w2 + w2 // 4 - w2 // 100 + w2 // 400) \
        - (d1 + (153 * p1 + 2) // 5 + 365 * w1 + w1 // 4 - w1 // 100 + w1 // 400) + 1


def _cmp(c: str, v: int, t: int) -> bool:
    return v > t if c == GT else (v >= t if c == GTE else (v < t if c == LT else v <= t))


def _native(v: float, metric: str, unit: str) -> float:
    """Normalise the units the documented sources actually use. Done in code, so
    no model is ever asked to do arithmetic."""
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


def _scl(v: float) -> int:
    return int(v * SCALE + 0.5) if v >= 0 else -int(-v * SCALE + 0.5)


def _fit(v) -> bool:
    return isinstance(v, int) and -MXV <= v <= MXV


def _coord(s: int) -> str:
    a = -s if s < 0 else s
    return ("-" if s < 0 else "") + f"{a // 1000000}.{a % 1000000:06d}"


def _jl(s: str) -> list:
    try:
        v = json.loads(s)
        return v if isinstance(v, list) else []
    except Exception:
        return []


def _enum(v, ok, fb):
    return v.strip().lower() if isinstance(v, str) and v.strip().lower() in ok else fb


def _extract(obj, param: str):
    """Pull (date, raw) rows from an Open-Meteo daily payload. Returns None on an
    unexpected shape, which the caller records as a fetch failure rather than
    guessing at the data."""
    daily = obj.get("daily")
    if not isinstance(daily, dict):
        return None
    times, vals = daily.get("time"), daily.get(param)
    if not isinstance(times, list) or not isinstance(vals, list):
        return None
    if len(times) != len(vals):
        return None
    la, lo = obj.get("latitude"), obj.get("longitude")
    return ([(t, float(v)) for t, v in zip(times, vals)
             if isinstance(t, str) and len(t) == 10 and isinstance(v, (int, float))],
            int(round(la * 1e6)) if isinstance(la, (int, float)) else None,
            int(round(lo * 1e6)) if isinstance(lo, (int, float)) else None,
            obj.get("daily_units", {}).get(param, ""))


def _median(vals: list) -> int:
    s, n = sorted(vals), len(vals)
    if n == 0:
        return 0
    return s[n // 2] if n % 2 else (s[n // 2 - 1] + s[n // 2]) // 2


def _near(la, lo, pla, plo, tol: int) -> bool:
    if la is None or lo is None:
        return False
    ny = abs(la - pla) * 111320 // 1000000
    dl = abs(lo - plo)
    dl = min(dl, 360000000 - dl)
    b = abs(pla) // 5000000
    nx = dl * 111320 * COS[b if b < 19 else 18] // 1000000000
    return ny * ny + nx * nx <= tol * tol


def _fetch(src: dict, start: str, end: str) -> dict:
    """Retrieve one source and reduce it to a single comparable number.

    Never fills a gap. Days the source did not report stay absent, which later
    makes the evaluation inconclusive instead of quietly interpolated.
    """
    unit = UNIT[src["metric"]]
    r = {"source_id": src["id"], "station": "", "period_start": start,
         "period_end": end, "unit": unit, "days_covered": 0, "value_scaled": 0,
         "crossed": False, "ok": False, "error": "", "lm": None, "om": None}
    if src["kind"] not in KINDS[src["data_mode"]]:
        r["error"] = "EXTERNAL: source_mode_mismatch"
        return r
    try:
        resp = gl.nondet.web.get(src["url_template"].format(
            lat=src["lat"], lon=src["lon"], start=start, end=end,
            param=src["param"], days=src["days"]))
        if int(resp.status) != 200:
            r["error"] = "EXTERNAL: fetch_failed"
            return r
        pr = _extract(json.loads(bytes(resp.body or b"").decode(
            "utf-8", errors="replace")), src["param"])
    except Exception:
        r["error"] = "EXTERNAL: fetch_failed"
        return r
    if pr is None:
        r["error"] = "EXTERNAL: parse_failed"
        return r
    rows, r["lm"], r["om"], rep = pr
    if r["lm"] is not None and r["om"] is not None:
        r["station"] = f"{r['lm'] / 1000000:.4f},{r['om'] / 1000000:.4f}"
    seen, series = set(), []
    for d, raw in rows:
        # ISO dates compare lexicographically, so this bounds the window without
        # materialising every day inside it.
        if not start <= d <= end:
            continue
        if d in seen:
            r["error"] = "EXTERNAL: duplicate_dates"
            return r
        seen.add(d)
        try:
            sv = _scl(_native(raw, src["metric"], rep or unit))
        except Exception:
            r["error"] = "EXTERNAL: unit_mismatch"
            return r
        if not _fit(sv):
            r["error"] = "EXTERNAL: implausible_value"
            return r
        series.append((d, sv))
    series.sort(key=lambda p: p[0])
    vals = [v for _, v in series]
    if vals:
        r["value_scaled"] = sum(vals) if src["aggregation"] == CUM else max(vals)
        r["days_covered"] = len(vals)
    r["ok"] = True
    return r


def _force(res: dict, ck: dict, reason: str, keep: bool = False) -> None:
    res["decision"], res["reason_code"] = INC, reason
    ck["threshold_crossed"] = UNCL
    if not keep:
        ck["source_agreement"] = UNCL


def _once(pol: dict, plan: list, start: str, end: str) -> dict:
    """One complete evaluation. Deterministic apart from the web fetches."""
    want = _span(start, end)
    recs = [_fetch(s, start, end) for s in plan]
    for r in recs:
        if r["ok"]:
            r["crossed"] = _cmp(pol["cmp"], r["value_scaled"], pol["threshold"])
    used = [r["source_id"] for r in recs if r["ok"]]
    ck = {n: UNCL for n in CHK}
    res = {"decision": INC, "reason_code": RM, "observed_value_scaled": 0,
           "checks": ck, "sources_used": used,
           "sources_missing": [r["source_id"] for r in recs if not r["ok"]],
           "sources": recs,
           "summary": "" if used else "No eligible data source could be reached."}
    if not used:
        res["reason_code"] = RD
        return res
    loc = None
    for r in recs:
        if r["ok"]:
            close = _near(r["lm"], r["om"], pol["lat"], pol["lon"], pol["tol"])
            loc = close if loc is None else (loc and close)
    ck["location_match"] = UNCL if loc is None else (PASS if loc else FAIL)
    full = all(r["days_covered"] == want for r in recs if r["ok"])
    ck["period_covered"] = PASS if full else FAIL
    ck["data_completeness"] = PASS if len(used) >= pol["min_src"] and full else FAIL
    crs = [r["crossed"] for r in recs if r["ok"]]
    res["observed_value_scaled"] = _median([r["value_scaled"] for r in recs if r["ok"]])
    if ck["location_match"] == FAIL:
        _force(res, ck, RL)
    elif len(used) < pol["min_src"] or not full:
        _force(res, ck, RM)
    else:
        n, nt = len(crs), sum(1 for c in crs if c)
        if pol["rule"] == ANY:
            dec, agree, tie = nt > 0, True, False
        elif pol["rule"] == "majority":
            dec, agree, tie = nt * 2 > n, nt * 2 != n, nt * 2 == n
        else:
            dec, agree, tie = (nt == n and n > 0), (nt == 0 or nt == n), False
        ck["source_agreement"] = PASS if agree else FAIL
        if tie or not agree:
            _force(res, ck, RF, keep=True)
        else:
            ck["threshold_crossed"] = PASS if dec else FAIL
            res["decision"], res["reason_code"] = (CONF, RC) if dec else (NOTC, RN)
    res["summary"] = res["summary"] or _fallback(res)
    return res


def _fallback(res: dict) -> str:
    return {RC: "The evidence met the policy condition.",
            RN: "The evidence did not meet the policy condition.",
            RF: "Eligible sources disagreed on whether the condition was met.",
            RM: "The observation period was not fully covered by the evidence.",
            RL: "The reported location did not match the policy location.",
            RD: "No eligible data source could be reached."
            }.get(res["reason_code"], "The evidence was not sufficient to decide.")


def _smap(raw) -> dict:
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


def _agree(pol: dict, src: dict):
    ok = [v["crossed"] for v in src.values() if v["ok"]]
    if len(ok) < pol["min_src"]:
        return (False, False)
    n, nt = len(ok), sum(1 for c in ok if c)
    if pol["rule"] == ANY:
        return (True, nt > 0)
    if pol["rule"] == "majority":
        return (False, False) if nt * 2 == n else (True, nt * 2 > n)
    return (nt == 0 or nt == n, nt == n)


def _valid(res, pol: dict) -> bool:
    """Structure and semantics of ONE result, checked before any comparison."""
    if not isinstance(res, dict) or res.get("decision") not in DECS:
        return False
    if res.get("reason_code") not in REAS:
        return False
    ck = res.get("checks")
    if not isinstance(ck, dict) or any(ck.get(n) not in STS for n in CHK):
        return False
    src = _smap(res.get("sources"))
    want = set(pol["source_ids"])
    if set(src) != want:
        return False
    used = set(s for s, v in src.items() if v["ok"])
    if set(res.get("sources_used", [])) != used:
        return False
    if set(res.get("sources_missing", [])) != set(src) - used:
        return False
    if res["reason_code"] == RD and used:
        return False
    if res["decision"] in (CONF, NOTC):
        if any(ck.get(n) != PASS for n in REQ):
            return False
        ok, crossed = _agree(pol, src)
        # The invariant: a decision may never contradict the value it reports.
        if not ok or (res["decision"] == CONF) != crossed:
            return False
    return _fit(res.get("observed_value_scaled"))


def _equivalent(leader, mine, pol: dict) -> bool:
    """The equivalence rule, applied by the validator to the leader's calldata."""
    if not isinstance(leader, dict) or not _valid(leader, pol) or not _valid(mine, pol):
        return False
    if leader.get("decision") != mine.get("decision"):
        return False
    if not (leader.get("reason_code") == mine.get("reason_code")
            or any(leader.get("reason_code") in g and mine.get("reason_code") in g
                   for g in GROUPS)):
        return False
    lc, mc = leader["checks"], mine["checks"]
    if any(lc.get(n) != mc.get(n) for n in REQ):
        return False
    for n in CHK:
        # only unclear<->definite may differ, and only off the required set
        if n not in REQ and lc.get(n) != mc.get(n) and \
                not (lc.get(n) == UNCL and mc.get(n) in (PASS, FAIL)):
            return False
    if FAIL in (lc.get("location_match"), mc.get("location_match")):
        # a location failure may only ever be reported as inconclusive
        if leader.get("decision") != INC or leader.get("reason_code") != RL:
            return False
        if lc.get("location_match") != FAIL or mc.get("location_match") != FAIL:
            return False
    lo, mo = leader["observed_value_scaled"], mine["observed_value_scaled"]
    if abs(lo - mo) > SCALE:
        return False
    if _cmp(pol["cmp"], lo, pol["threshold"]) != _cmp(pol["cmp"], mo, pol["threshold"]):
        return False
    ls, ms = _smap(leader["sources"]), _smap(mine["sources"])
    if set(ls) != set(ms):
        return False
    for sid, lv in ls.items():
        mv = ms[sid]
        if lv["ok"] != mv["ok"] or lv["crossed"] != mv["crossed"]:
            return False
        if lv["ok"] and abs(lv["value_scaled"] - mv["value_scaled"]) > SCALE:
            return False
    ok, crossed = _agree(pol, ls)
    if (leader["decision"] == CONF) != (ok and crossed):
        return False
    if leader["decision"] == NOTC and (not ok or crossed):
        return False
    if set(leader.get("sources_used", [])) != set(mine.get("sources_used", [])):
        return False
    return set(leader.get("sources_missing", [])) == set(mine.get("sources_missing", []))


def _policy(raw: str) -> dict:
    """Check only what would otherwise break the consensus round: ClimatePolicy
    already validated the policy in full, and the JSON is echoed into the record
    so the two can be compared."""
    try:
        p = json.loads(raw)
    except Exception:
        raise gl.vm.UserError("EXPECTED: invalid policy JSON")
    if not isinstance(p, dict) or p.get("metric") not in AGGS:
        raise gl.vm.UserError("EXPECTED: invalid policy JSON")
    if p.get("data_mode") not in KINDS or p.get("comparator") not in CMPS:
        raise gl.vm.UserError("EXPECTED: invalid data mode or comparator")
    if p.get("aggregation") not in AGGS[p["metric"]]:
        raise gl.vm.UserError("EXPECTED: invalid aggregation for metric")
    if p.get("agreement_rule") not in RULES or not _fit(p.get("threshold_scaled")):
        raise gl.vm.UserError("EXPECTED: invalid agreement rule or threshold")
    if not isinstance(p.get("min_sources"), int) or not 1 <= p["min_sources"] <= MXSRC:
        raise gl.vm.UserError("EXPECTED: invalid min_sources")
    if not isinstance(p.get("tolerance_m"), int) or not 0 <= p["tolerance_m"] <= MXTOL:
        raise gl.vm.UserError("EXPECTED: invalid tolerance")
    for k, lo, hi in (("lat_scaled", -90000000, 90000000),
                      ("lon_scaled", -180000000, 180000000)):
        if not isinstance(p.get(k), int) or not lo <= p[k] <= hi:
            raise gl.vm.UserError("EXPECTED: invalid coordinates")
    try:
        days = _span(p["period_start"], p["period_end"])
    except Exception:
        raise gl.vm.UserError("EXPECTED: invalid policy period")
    if not 1 <= days <= MXDAY:
        raise gl.vm.UserError("EXPECTED: invalid policy period")
    srcs = p.get("sources")
    if not isinstance(srcs, list) or not 1 <= len(srcs) <= MXSRC:
        raise gl.vm.UserError("EXPECTED: invalid policy sources")
    if p["min_sources"] > len(srcs):
        raise gl.vm.UserError("EXPECTED: min_sources exceeds sources")
    for s in srcs:
        if not isinstance(s, dict) or any(k not in s for k in (
                "id", "kind", "metric", "param", "url_template", "unit")):
            raise gl.vm.UserError("EXPECTED: incomplete source")
        if s["kind"] not in KINDS[p["data_mode"]] or s["metric"] != p["metric"]:
            raise gl.vm.UserError("EXPECTED: source not eligible for data mode")
    return p


class ClimateEvaluator(gl.Contract):
    """Decides whether recorded evidence confirms a policy condition.

    Evaluation is permissionless. It mutates nothing the caller owns and costs
    the caller gas, so letting anyone trigger one removes every privileged party
    from the trust path: an inconvenient evaluation cannot be suppressed, because
    anyone else can run it. There is deliberatey no owner, no pause and no
    registration step. The policy is supplied per call and echoed into the stored
    record, so a reader can diff it against ClimatePolicy to confirm that the
    real policy was the one judged.
    """

    evaluations: TreeMap[str, Evaluation]
    evaluation_ids: DynArray[str]
    counter: u256

    def __init__(self) -> None:
        self.counter = u256(0)

    @gl.public.write
    def evaluate(self, policy_json: str, period_start: str, period_end: str) -> str:
        """Run a consensus evaluation and store it. Anyone may call.

        Returns the evaluation id. Reverts with EXPECTED on a malformed policy or
        period, and LLM_ERROR if consensus returns something that is not a result
        object.
        """
        if not isinstance(policy_json, str) or len(policy_json) > 6000:
            raise gl.vm.UserError("EXPECTED: invalid policy JSON")
        p = _policy(policy_json)
        try:
            days = _span(period_start, period_end)
        except Exception:
            raise gl.vm.UserError("EXPECTED: invalid period format")
        if not 1 <= days <= MXDAY:
            raise gl.vm.UserError("EXPECTED: invalid period")
        if period_start < p["period_start"] or period_end > p["period_end"]:
            raise gl.vm.UserError("EXPECTED: period outside policy window")
        pol = {"policy_id": str(p["id"]), "cmp": p["comparator"],
               "threshold": int(p["threshold_scaled"]), "rule": p["agreement_rule"],
               "min_src": int(p["min_sources"]), "lat": int(p["lat_scaled"]),
               "lon": int(p["lon_scaled"]), "tol": int(p["tolerance_m"]),
               "unit": p["unit"],
               "source_ids": [str(s["id"]) for s in p["sources"]]}
        plan = [{"id": str(s["id"]), "kind": str(s["kind"]), "metric": str(s["metric"]),
                 "param": str(s["param"]), "unit": str(s["unit"]),
                 "url_template": str(s["url_template"]),
                 "lat": _coord(pol["lat"]), "lon": _coord(pol["lon"]),
                 "aggregation": p["aggregation"], "data_mode": p["data_mode"],
                 "days": days} for s in p["sources"]]

        def lead() -> dict:
            return _once(pol, plan, period_start, period_end)

        def check(leaders_res) -> bool:
            if not isinstance(leaders_res, gl.vm.Return):
                return False
            return _equivalent(leaders_res.calldata,
                               _once(pol, plan, period_start, period_end), pol)

        out = gl.vm.run_nondet(lead, check)
        if not isinstance(out, dict):
            raise gl.vm.UserError("LLM_ERROR: malformed evaluation result")
        return self._record(out, p, pol, period_start, period_end, days)

    def _record(self, res: dict, p: dict, pol: dict, start: str, end: str,
                days: int) -> str:
        """Write the consensus result to storage. Every field is re-checked and
        defaulted, so nothing here trusts the model's account of its own output."""
        obs = res.get("observed_value_scaled")
        if not _fit(obs):
            obs = 0
        ci = res.get("checks") if isinstance(res.get("checks"), dict) else {}
        ev = []
        for it in (res.get("sources") if isinstance(res.get("sources"), list) else []):
            if not isinstance(it, dict) or not isinstance(it.get("source_id"), str):
                continue
            dc, vs = it.get("days_covered"), it.get("value_scaled")
            ok = bool(it.get("ok"))
            ev.append({"source_id": it["source_id"],
                       "station": str(it.get("station", "")) or p.get("location_name", ""),
                       "period_start": start, "period_end": end,
                       "unit": str(it.get("unit", pol["unit"])),
                       "days_covered": dc if isinstance(dc, int) and dc >= 0 else 0,
                       "value_scaled": vs if isinstance(vs, int) else 0,
                       "crossed": bool(it.get("crossed")), "ok": ok,
                       "error": "" if ok else str(it.get("error", ""))})
        sm = res.get("summary")
        eid = "eval-" + str(int(self.counter) + 1)
        self.evaluations[eid] = Evaluation(
            id=eid, policy_id=pol["policy_id"], period_start=start, period_end=end,
            decision=_enum(res.get("decision"), DECS, INC),
            reason=_enum(res.get("reason_code"), REAS, RM),
            summary=(sm.strip()[:280] if isinstance(sm, str) else "") or _fallback(res),
            observed_scaled=i256(obs), days_expected=u32(days), criteria_version=CRIT,
            evidence_json=json.dumps(ev, separators=(",", ":")),
            checks_json=json.dumps([{"name": n, "status": _enum(ci.get(n), STS, UNCL)}
                                    for n in CHK], separators=(",", ":")),
            policy_json=json.dumps(p, separators=(",", ":")))
        self.evaluation_ids.append(eid)
        self.counter = u256(int(self.counter) + 1)
        return eid

    @gl.public.view
    def get_evaluation(self, evaluation_id: str) -> dict:
        """The whole record: decision, reason, observed value, checks, evidence,
        and the policy JSON that was judged."""
        if evaluation_id not in self.evaluations:
            return {}
        e = self.evaluations[evaluation_id]
        return {"id": e.id, "policy_id": e.policy_id, "period_start": e.period_start,
                "period_end": e.period_end, "decision": e.decision,
                "reason_code": e.reason, "summary": e.summary,
                "observed_value_scaled": int(e.observed_scaled),
                "days_expected": int(e.days_expected),
                "criteria_version": e.criteria_version,
                "policy": json.loads(e.policy_json),
                "evidence": _jl(e.evidence_json), "checks": _jl(e.checks_json)}

    @gl.public.view
    def get_evaluation_ids(self) -> list:
        return [eid for eid in self.evaluation_ids]

    @gl.public.view
    def get_criteria_version(self) -> str:
        return CRIT
