from conftest import (
    make_policy,
    mock_llm_ok,
    mock_web,
    om_body,
    nasa_body,
    om_days,
    nasa_days,
)


def test_deploy_initial_state(cc):
    assert cc.get_owner().startswith("0x")
    sources = cc.list_sources()
    assert len(sources) == 5
    assert cc.list_policies() == []
    assert cc.get_criteria_version().startswith("climateclaim-criteria")


def test_create_policy_and_claim(cc, direct_vm):
    pid = make_policy(cc)
    p = cc.get_policy(pid)
    assert p["data_mode"] == "historical_simulation"
    assert p["metric"] == "precipitation"
    assert p["threshold_scaled"] == 110

    cid = cc.start_claim(pid, "2024-06-01", "2024-06-05")
    c = cc.get_claim(cid)
    assert c["state"] == "created"
    assert c["decision"] == ""


def test_evaluation_confirmed(cc, direct_vm):
    pid = make_policy(cc, threshold_scaled=100, source_ids=["om_archive_precip"])
    cid = cc.start_claim(pid, "2024-06-01", "2024-06-05")
    dates = om_days(2024, 6, 1, 5)
    # 2024-06-04 = 1.10 mm > 1.00 mm
    mock_web(direct_vm, om=om_body("precipitation_sum", dates, [0.1, 0.0, 0.2, 1.1, 0.0]))
    mock_llm_ok(direct_vm)
    cc.request_evaluation(cid)
    c = cc.get_claim(cid)
    assert c["decision"] == "confirmed", c
    assert c["state"] == "decided_confirmed"
    assert c["observed_value_scaled"] == 110

    ev = cc.get_evidence(cid)
    assert len(ev) == 1 and ev[0]["ok"] is True
    checks = {c["name"]: c["status"] for c in cc.get_checks(cid)}
    assert checks["threshold_crossed"] == "pass"
    assert checks["period_covered"] == "pass"


def test_evaluation_not_confirmed(cc, direct_vm):
    pid = make_policy(cc, threshold_scaled=500, source_ids=["om_archive_precip"])
    cid = cc.start_claim(pid, "2024-06-01", "2024-06-05")
    dates = om_days(2024, 6, 1, 5)
    mock_web(direct_vm, om=om_body("precipitation_sum", dates, [0.1, 0.0, 0.2, 1.1, 0.0]))
    mock_llm_ok(direct_vm)
    cc.request_evaluation(cid)
    c = cc.get_claim(cid)
    assert c["decision"] == "not_confirmed", c
    assert c["observed_value_scaled"] == 110


def test_conflicting_sources_inconclusive(cc, direct_vm):
    pid = make_policy(
        cc, threshold_scaled=150, source_ids=["om_archive_precip", "nasa_precip"],
        agreement_rule="unanimous", min_sources=2,
    )
    cid = cc.start_claim(pid, "2024-06-01", "2024-06-05")
    dates = om_days(2024, 6, 1, 5)
    nasa = nasa_days(2024, 6, 1, 5)
    nasa.update({f"2024060{i}": v for i, v in zip(range(1, 6), [0.23, 0.04, 0.19, 2.03, 0.02])})
    mock_web(
        direct_vm,
        om=om_body("precipitation_sum", dates, [0.1, 0.0, 0.2, 1.1, 0.0]),
        nasa=nasa_body("PRECTOTCORR", nasa),
    )
    mock_llm_ok(direct_vm)
    cc.request_evaluation(cid)
    c = cc.get_claim(cid)
    # Open-Meteo max 1.10 (<1.50) but NASA max 2.03 (>1.50) -> conflict
    assert c["decision"] == "inconclusive", c
    assert c["reason_code"] == "source_conflict"
