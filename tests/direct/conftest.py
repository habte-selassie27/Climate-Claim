"""Shared helpers for ClimateClaim direct tests.

Direct tests run the contract in-process (no network) with mocked web + LLM.
Web responses are built from recorded historical values (see fixtures/historical).
"""

import json

import pytest
from gltest.direct import create_address

CONTRACT = "contracts/climateclaim.py"

# create_policy argument order (must match the contract signature).
POLICY_ORDER = [
    "location_name",
    "lat_scaled",
    "lon_scaled",
    "tolerance_m",
    "source_ids",
    "agreement_rule",
    "min_sources",
    "data_mode",
    "period_start",
    "period_end",
    "timezone",
    "metric",
    "unit",
    "comparator",
    "threshold_scaled",
    "aggregation",
    "condition_text",
    "payout_amount",
]

DEFAULT_POLICY = dict(
    location_name="London",
    lat_scaled=51505000,
    lon_scaled=-55000,
    tolerance_m=5000,
    source_ids=["om_archive_precip", "nasa_precip"],
    agreement_rule="unanimous",
    min_sources=1,
    data_mode="historical_simulation",
    period_start="2024-06-01",
    period_end="2024-06-05",
    timezone="UTC",
    metric="precipitation",
    unit="mm",
    comparator="gt",
    threshold_scaled=110,
    aggregation="max_single",
    condition_text="Any day with precipitation above 1.10 mm.",
    payout_amount=0,
)


def owner_address():
    return create_address("default_sender")


def other_address(name="alice"):
    return create_address(name)


@pytest.fixture
def owner():
    return owner_address()


@pytest.fixture
def deploy(direct_deploy):
    def _deploy(owner_addr=None):
        return direct_deploy(CONTRACT, owner_addr or owner_address())

    return _deploy


def _catalogue():
    """The source catalogue, read from docs/sources.json.

    The contract no longer hardcodes any source, so tests register them through
    the same public `register_source` path a deployer uses. Reading the same
    file the seed script reads keeps the two from drifting.
    """
    import json
    import pathlib

    root = pathlib.Path(__file__).resolve().parents[2]
    return json.loads((root / "docs" / "sources.json").read_text())["sources"]


def register_catalogue(cc):
    """Register every catalogued source on a freshly deployed contract."""
    for s in _catalogue():
        cc.register_source(
            s["id"],
            s["name"],
            s["kind"],
            s["metric"],
            s["param"],
            s["url_template"],
            s["unit"],
            s["attribution"],
        )
    return cc


@pytest.fixture
def cc_empty(deploy):
    """A deployment left exactly as the constructor leaves it: no sources.

    This is the honest default, and the one the registry tests use.
    """
    return deploy()


@pytest.fixture
def cc(deploy):
    """A deployment with the documented sources registered.

    Every test that creates a policy needs sources in the registry, and they
    are added here through the public API rather than baked into the
    constructor.
    """
    return register_catalogue(deploy())


@pytest.fixture
def cc_mod(cc):
    """The contract module, so tests can exercise module-level helpers."""
    import sys

    return sys.modules["_contract_climateclaim"]


# --- web body builders -----------------------------------------------------


def om_body(param, dates, values, lat=51.505, lon=-0.055, unit="mm"):
    """Open-Meteo archive/forecast JSON body."""
    return json.dumps(
        {
            "latitude": lat,
            "longitude": lon,
            "daily_units": {"time": "iso8601", param: unit},
            "daily": {"time": list(dates), param: list(values)},
        }
    )


def nasa_body(param, mapping, lat=51.505, lon=-0.055, unit="mm/day"):
    """NASA POWER JSON body. `mapping` is {'YYYYMMDD': value}."""
    return json.dumps(
        {
            "geometry": {"type": "Point", "coordinates": [lon, lat, 10.0]},
            "properties": {"parameter": {param: dict(mapping)}},
            "parameters": {param: {"units": unit}},
            "header": {"fill_value": -999.0},
        }
    )


def day(y, m, d):
    return f"{y:04d}-{m:02d}-{d:02d}"


def om_days(y, m, start, end):
    return [day(y, m, d) for d in range(start, end + 1)]


def nasa_days(y, m, start, end):
    return {f"{y:04d}{m:02d}{d:02d}": None for d in range(start, end + 1)}


def nasa_map(y, m, start, values):
    """{'YYYYMMDD': value} for a run of days starting at `start`."""
    return {f"{y:04d}{m:02d}{d:02d}": v for d, v in enumerate(values, start=start)}


def mock_web(direct_vm, om=None, nasa=None):
    """Register Open-Meteo and NASA web mocks. `om`/`nasa` are JSON strings."""
    if om is not None:
        direct_vm.mock_web(r"archive-api\.open-meteo\.com", {"method": "GET", "status": 200, "body": om})
        direct_vm.mock_web(r"api\.open-meteo\.com", {"method": "GET", "status": 200, "body": om})
    if nasa is not None:
        direct_vm.mock_web(r"power\.larc\.nasa\.gov", {"method": "GET", "status": 200, "body": nasa})


def mock_llm_ok(direct_vm, location_match="pass"):
    direct_vm.mock_llm(
        r"interpreting weather evidence",
        json.dumps({"summary": "The evidence was interpreted.", "location_match": location_match}),
    )


def make_policy(cc, **overrides):
    kwargs = dict(DEFAULT_POLICY)
    kwargs.update(overrides)
    return cc.create_policy(*[kwargs[k] for k in POLICY_ORDER])


def evaluate(cc, direct_vm, cid, *, om=None, nasa=None, location_match="pass"):
    """Mock sources + LLM then run evaluation. Returns the claim dict.

    Clears previously registered mocks first so multi-step tests always fetch
    the data they just supplied (the mock matcher returns the first match).
    """
    direct_vm.clear_mocks()
    mock_web(direct_vm, om=om, nasa=nasa)
    mock_llm_ok(direct_vm, location_match=location_match)
    cc.request_evaluation(cid)
    return cc.get_claim(cid)


def checks_of(cc, cid):
    return {c["name"]: c["status"] for c in cc.get_checks(cid)}
