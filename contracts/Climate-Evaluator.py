# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
"""ClimateEvaluator: evidence retrieval + consensus evaluation.

`evaluate_for_claim` reads a claim's frozen policy from ClimateClaim (deterministic
cross-contract view), fetches every eligible source inside `gl.vm.run_nondet`, and
stores the result keyed by claim + dispute round. `ClimateClaim.sync_evaluation`
accepts nothing else: a decision is the output of a consensus round over source
data, never a caller's assertion.

EQUIVALENCE: leader and validators run `_once`; `_equivalent` requires the
decision, the reason group, the required checks, each source's ok/crossed flag and
values within 0.01, and re-derives the agreement rule, so a confirmed result the
arithmetic does not support is rejected. Policy reads stay outside the block:
cross-contract calls must use deterministic state. Full design: docs/equivalence.md.
"""
import json
from genlayer import *

CRIT = "climateclaim-criteria-4"
SCALE, MXDAY, MXV, MXTOL, MXSRC = 100, 366, 100000 * 100, 200000, 4
MXREC = 16000
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
CUM, CONS = "cumulative", "consecutive_days"
UNIT = {"precipitation": "mm", "temperature": "celsius"}
AGGS = {"precipitation": ("max_single", CUM, CONS), "temperature": ("max_single",)}
KINDS = {"historical_simulation": ("open_meteo_archive", "nasa_power"),
         "live": ("open_meteo_forecast",)}
NASA = "nasa_power"
COS = (1000, 996, 985, 966, 940, 906, 866, 819, 766, 707, 643, 574, 500, 423,
       342, 259, 174, 87, 0)

def _pd(s: str):
    if not isinstance(s, str) or len(s) != 10 or s[4] != "-" or s[7] != "-":
        raise ValueError("date")
    return (int(s[0:4]), int(s[5:7]), int(s[8:10]))

def _ord(s: str) -> int:
    y, m, d = _pd(s)
    a = (14 - m) // 12
    yy, mm = y + 4800 - a, m + 12 * a - 3
    return d + (153 * mm + 2) // 5 + 365 * yy + yy // 4 - yy // 100 + yy // 400 - 32045

def _span(a: str, b: str) -> int:
    return _ord(b) - _ord(a) + 1

def _cmp(c: str, v: int, t: int) -> bool:
    return v > t if c == GT else (v >= t if c == GTE else (v < t if c == LT else v <= t))

def _native(v: float, metric: str, unit: str) -> float:
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
    return isinstance(v, int) and not isinstance(v, bool) and -MXV <= v <= MXV

def _coord(s: int) -> str:
    a = -s if s < 0 else s
    return ("-" if s < 0 else "") + f"{a // 1000000}.{a % 1000000:06d}"

def _enum(v, ok, fb):
    return v.strip().lower() if isinstance(v, str) and v.strip().lower() in ok else fb

def _extract(obj, param: str):
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
    unit = UNIT[src["metric"]]
    r = {"source_id": src["id"], "station": "", "period_start": start,
         "period_end": end, "unit": unit, "days_covered": 0, "value_scaled": 0,
         "crossed": False, "ok": False, "error": "", "lm": None, "om": None}
    if src["kind"] not in KINDS[src["data_mode"]]:
        r["error"] = "EXTERNAL: source_mode_mismatch"
        return r
    try:
        url = src["url_template"].format(
            lat=src["lat"], lon=src["lon"], start=start, end=end,
            param=src["param"], days=src["days"])
        if src["kind"] == NASA:
            url = url.replace("-", "")
        resp = gl.nondet.web.get(url)
        if int(resp.status) != 200:
            r["error"] = "EXTERNAL: fetch_failed"
            return r
        parsed = _extract(json.loads(bytes(resp.body or b"").decode(
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
        if src["aggregation"] == CUM:
            r["value_scaled"] = sum(vals)
        elif src["aggregation"] == CONS:
            best = run = 0
            prev = None
            for d, v in series:
                o = _ord(d)
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

def _force(res: dict, ck: dict, reason: str, keep: bool = False) -> None:
    res["decision"], res["reason_code"] = INC, reason
    ck["threshold_crossed"] = UNCL
    if not keep:
        ck["source_agreement"] = UNCL

def _once(pol: dict, plan: list, start: str, end: str) -> dict:
    want = _span(start, end)
    recs = [_fetch(s, start, end) for s in plan]
    for r in recs:
        if r["ok"]:
            r["crossed"] = _cmp(pol["cmp"], r["value_scaled"], pol["threshold"])
    used = [r["source_id"] for r in recs if r["ok"]]
    ck = {n: UNCL for n in CHK}
    res = {"decision": INC, "reason_code": RM, "observed_value_scaled": 0,
           "checks": ck, "sources": recs,
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
    if not isinstance(res, dict) or res.get("decision") not in DECS:
        return False
    if res.get("reason_code") not in REAS:
        return False
    ck = res.get("checks")
    if not isinstance(ck, dict) or any(ck.get(n) not in STS for n in CHK):
        return False
    src = _smap(res.get("sources"))
    if set(src) != set(pol["source_ids"]):
        return False
    used = set(s for s, v in src.items() if v["ok"])
    if res["reason_code"] == RD and used:
        return False
    if res["decision"] in (CONF, NOTC):
        if any(ck.get(n) != PASS for n in REQ):
            return False
        ok, crossed = _agree(pol, src)
        if not ok or (res["decision"] == CONF) != crossed:
            return False
    return _fit(res.get("observed_value_scaled"))

def _equivalent(leader, mine, pol: dict) -> bool:
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
        if n not in REQ and lc.get(n) != mc.get(n) and \
                not (lc.get(n) == UNCL and mc.get(n) in (PASS, FAIL)):
            return False
    if FAIL in (lc.get("location_match"), mc.get("location_match")):
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
    return leader["decision"] != NOTC or (ok and not crossed)

class ClimateEvaluator(gl.Contract):
    results: TreeMap[str, str]

    def __init__(self) -> None:
        pass

    @gl.public.write
    def evaluate_for_claim(self, claim_address: Address, claim_id: str) -> dict:
        """Consensus round over the claim's frozen policy; stores the result."""
        if not isinstance(claim_id, str) or not claim_id or len(claim_id) > 64:
            raise gl.vm.UserError("EXPECTED: invalid claim id")
        try:
            claim = gl.get_contract_at(claim_address).view().get_claim(claim_id)
        except Exception:
            raise gl.vm.UserError("EXTERNAL: claim contract unreachable")
        if not isinstance(claim, dict) or not claim.get("id"):
            raise gl.vm.UserError("EXPECTED: unknown claim")
        if claim.get("state") not in ("created", "pending_evaluation",
                                      "evidence_collected", "disputed"):
            raise gl.vm.UserError("EXPECTED: claim is not open for evaluation")
        p, start, end = claim.get("policy_snapshot"), claim.get("period_start"), claim.get("period_end")
        if not isinstance(p, dict) or not isinstance(start, str) or not isinstance(end, str):
            raise gl.vm.UserError("EXPECTED: claim has no frozen policy")
        rnd = claim.get("dispute_rounds")
        if not isinstance(rnd, int) or not 0 <= rnd <= 3:
            raise gl.vm.UserError("EXPECTED: invalid dispute round")
        try:
            if not p["period_start"] <= start <= end <= p["period_end"]:
                raise gl.vm.UserError("EXPECTED: period outside policy window")
            days = _span(start, end)
            pol = {"policy_id": str(p["id"]), "cmp": p["comparator"],
                   "threshold": p["threshold_scaled"], "rule": p["agreement_rule"],
                   "min_src": p["min_sources"], "lat": p["lat_scaled"],
                   "lon": p["lon_scaled"], "tol": p["tolerance_m"],
                   "source_ids": [str(s["id"]) for s in p["sources"]]}
            plan = [{"id": str(s["id"]), "kind": str(s["kind"]),
                     "metric": str(s["metric"]), "param": str(s["param"]),
                     "url_template": str(s["url_template"]),
                     "lat": _coord(pol["lat"]), "lon": _coord(pol["lon"]),
                     "aggregation": p["aggregation"], "data_mode": p["data_mode"],
                     "days": days} for s in p["sources"]]
        except gl.vm.UserError:
            raise
        except Exception:
            raise gl.vm.UserError("EXPECTED: unusable policy snapshot")

        def lead() -> dict:
            return _once(pol, plan, start, end)

        def check(leaders_res) -> bool:
            return isinstance(leaders_res, gl.vm.Return) and _equivalent(
                leaders_res.calldata, _once(pol, plan, start, end), pol)

        out = gl.vm.run_nondet(lead, check)
        if not isinstance(out, dict):
            raise gl.vm.UserError("LLM_ERROR: malformed evaluation result")
        out.update({"policy_id": pol["policy_id"],
                    "policy_version": p.get("version", 0),
                    "period_start": start, "period_end": end,
                    "round": rnd, "criteria_version": CRIT})
        payload = json.dumps(out, separators=(",", ":"))
        if len(payload) > MXREC:
            raise gl.vm.UserError("LLM_ERROR: evaluation record too large")
        self.results[claim_id + "#" + str(rnd)] = payload
        return out

    @gl.public.view
    def get_result(self, claim_id: str, round_no: int) -> dict:
        """The stored consensus result for a claim and dispute round, or {}."""
        if not isinstance(claim_id, str) or not isinstance(round_no, int):
            return {}
        raw = self.results.get(claim_id + "#" + str(round_no), "")
        if not raw:
            return {}
        try:
            v = json.loads(raw)
        except Exception:
            return {}
        return v if isinstance(v, dict) else {}
