import pytest

from conftest import (
    DEFAULT_POLICY,
    POLICY_ORDER,
    make_policy,
    other_address,
    om_body,
    om_days,
    mock_web,
    mock_llm_ok,
)


def test_deploy_starts_with_empty_source_registry(cc_empty):
    """The constructor seeds nothing.

    The contract carries no hardcoded knowledge of any weather provider: the
    registry only ever holds what an owner registers through `register_source`.
    """
    assert cc_empty.list_sources() == []
    assert cc_empty.get_source("om_archive_precip") == {}
    assert cc_empty.get_source("nasa_precip") == {}
    assert cc_empty.get_source("does_not_exist") == {}


def test_deploy_defaults_are_sane(cc_empty):
    assert cc_empty.get_criteria_version().startswith("climateclaim-criteria")
    assert cc_empty.get_policy_count() == 0
    assert cc_empty.get_claim_count() == 0


def test_policy_rejected_while_registry_is_empty(cc_empty):
    """The honest consequence of an unseeded deployment.

    create_policy validates its sources against the registry, so with nothing
    registered it must reject rather than silently accept an unknown provider.
    """
    with pytest.raises(Exception) as err:
        make_policy(cc_empty)
    assert "unknown source" in str(err.value)


def test_registering_sources_is_what_populates_the_registry(cc_empty):
    """The seeded fixture proves the production path works."""
    from conftest import register_catalogue

    register_catalogue(cc_empty)
    assert len(cc_empty.list_sources()) == 5
    s = cc_empty.get_source("om_archive_precip")
    assert s["metric"] == "precipitation"
    assert "archive-api.open-meteo.com" in s["url_template"]


def test_create_policy_persists(cc):
    pid = make_policy(cc)
    assert pid == "policy-1"
    p = cc.get_policy(pid)
    assert p["id"] == pid
    assert p["location_name"] == "London"
    assert p["source_ids"] == ["om_archive_precip", "nasa_precip"]
    assert p["data_mode"] == "historical_simulation"
    assert p["status"] == "active"
    assert p["beneficiary"].startswith("0x")
    assert cc.get_policy_count() == 1
    assert cc.get_policy("nope") == {}


def test_multiple_policies_ids_increment(cc):
    a = make_policy(cc)
    b = make_policy(cc, location_name="Paris")
    assert a == "policy-1" and b == "policy-2"
    assert len(cc.list_policies()) == 2


@pytest.mark.parametrize(
    "field,value,needle",
    [
        ("location_name", "", "bad location_name"),
        ("lat_scaled", 90 * 1000000 + 1, "bad latitude"),
        ("lon_scaled", 180 * 1000000 + 1, "bad longitude"),
        ("tolerance_m", -1, "bad tolerance"),
        ("agreement_rule", "sometimes", "bad agreement rule"),
        ("min_sources", 0, "bad min_sources"),
        ("data_mode", "maybe", "bad data mode"),
        ("period_start", "2024/06/01", "bad period format"),
        ("period_end", "2024-13-01", "bad period format"),
        ("timezone", "", "bad timezone"),
        ("metric", "wind", "bad metric"),
        ("unit", "inch", "canonical"),
        ("comparator", "approximately", "bad comparator"),
        ("threshold_scaled", 10**12, "threshold out of range"),
        ("aggregation", "average", "bad aggregation"),
        ("condition_text", "", "bad condition_text"),
        ("payout_amount", -1, "payout out of range"),
    ],
)
def test_create_policy_rejects_bad_field(cc, direct_vm, field, value, needle):
    kwargs = dict(DEFAULT_POLICY)
    kwargs[field] = value
    with direct_vm.expect_revert(needle):
        cc.create_policy(*[kwargs[k] for k in POLICY_ORDER])


def test_period_start_after_end_rejected(cc, direct_vm):
    with direct_vm.expect_revert("EXPECTED: period start after end"):
        make_policy(cc, period_start="2024-06-05", period_end="2024-06-01")


def test_period_too_long_rejected(cc, direct_vm):
    with direct_vm.expect_revert("EXPECTED: period too long"):
        make_policy(cc, period_start="2024-01-01", period_end="2025-12-31")


def test_future_archive_period_rejected(cc, direct_vm):
    # Archive (historical_simulation) policies must be fully in the past.
    with direct_vm.expect_revert("not in the past"):
        make_policy(cc, period_start="2999-01-01", period_end="2999-01-05")


def test_bad_source_count(cc, direct_vm):
    with direct_vm.expect_revert("bad source count"):
        make_policy(cc, source_ids=[])
    with direct_vm.expect_revert("bad source count"):
        make_policy(cc, source_ids=["om_archive_precip"] * 6)


def test_unknown_and_duplicate_source(cc, direct_vm):
    with direct_vm.expect_revert("unknown source"):
        make_policy(cc, source_ids=["nope"])
    with direct_vm.expect_revert("duplicate source"):
        make_policy(cc, source_ids=["om_archive_precip", "om_archive_precip"])


def test_source_metric_mismatch(cc, direct_vm):
    with direct_vm.expect_revert("source metric mismatch"):
        make_policy(
            cc,
            metric="temperature",
            unit="celsius",
            source_ids=["om_archive_precip"],
        )


def test_min_sources_exceeds_sources(cc, direct_vm):
    with direct_vm.expect_revert("min_sources exceeds sources"):
        make_policy(cc, source_ids=["om_archive_precip"], min_sources=2)


def test_consecutive_days_requires_precipitation(cc, direct_vm):
    with direct_vm.expect_revert("consecutive_days requires precipitation"):
        make_policy(
            cc, metric="temperature", unit="celsius",
            aggregation="consecutive_days", source_ids=["om_archive_tmax"],
        )


# --- access control --------------------------------------------------------


def test_non_owner_cannot_create_policy(cc, direct_vm):
    direct_vm.sender = other_address()
    with direct_vm.expect_revert("EXPECTED: not owner"):
        make_policy(cc)


def test_non_owner_cannot_register_source(cc, direct_vm):
    direct_vm.sender = other_address()
    with direct_vm.expect_revert("EXPECTED: not owner"):
        cc.register_source("x", "X", "open_meteo_archive", "precipitation",
                           "p", "https://e/{lat}/{lon}/{start}/{end}/{param}/{days}", "mm", "none")


def test_non_owner_cannot_retire(cc, direct_vm):
    pid = make_policy(cc)
    direct_vm.sender = other_address()
    with direct_vm.expect_revert("EXPECTED: not owner"):
        cc.retire_policy(pid)


def test_register_source_validates_kind_and_metric(cc, direct_vm):
    with direct_vm.expect_revert("bad source kind"):
        cc.register_source("x", "X", "carrier_pigeon", "precipitation",
                           "p", "https://e", "mm", "none")
    with direct_vm.expect_revert("bad source metric"):
        cc.register_source("x", "X", "nasa_power", "wind",
                           "p", "https://e", "mm", "none")


def test_registered_source_is_usable(cc, direct_vm):
    cc.register_source("custom", "Custom", "open_meteo_archive", "precipitation",
                       "precipitation_sum",
                       "https://archive-api.open-meteo.com/v1/archive?latitude={lat}&longitude={lon}"
                       "&start_date={start}&end_date={end}&daily={param}&timezone=UTC",
                       "mm", "test")
    assert cc.get_source("custom")["name"] == "Custom"
    pid = make_policy(cc, source_ids=["custom"], threshold_scaled=100)
    cid = cc.start_claim(pid, "2024-06-01", "2024-06-05")
    dates = om_days(2024, 6, 1, 5)
    mock_web(direct_vm, om=om_body("precipitation_sum", dates, [0.1, 0.0, 0.2, 1.1, 0.0]))
    mock_llm_ok(direct_vm)
    cc.request_evaluation(cid)
    assert cc.get_claim(cid)["decision"] == "confirmed"


def test_retire_blocks_new_claims(cc, direct_vm):
    pid = make_policy(cc)
    cc.retire_policy(pid)
    assert cc.get_policy(pid)["status"] == "retired"
    with direct_vm.expect_revert("EXPECTED: policy retired"):
        cc.start_claim(pid, "2024-06-01", "2024-06-05")


def test_beneficiary_locked_after_claim(cc, direct_vm):
    pid = make_policy(cc)
    cc.start_claim(pid, "2024-06-01", "2024-06-05")
    with direct_vm.expect_revert("EXPECTED: policy locked"):
        cc.set_beneficiary(pid, other_address())


def test_beneficiary_can_be_set_before_claims(cc, direct_vm):
    pid = make_policy(cc)
    before = cc.get_policy(pid)["beneficiary"]
    cc.set_beneficiary(pid, other_address())
    after = cc.get_policy(pid)["beneficiary"]
    assert after != before
    assert after.startswith("0x")
