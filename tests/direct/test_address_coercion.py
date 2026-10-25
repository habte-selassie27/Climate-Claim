"""Address inputs from GenLayer Studio.

Studio encodes an `address` constructor/call argument as a decimal uint160, not
as an `Address` or a 0x string. Assigning that int to a storage field fails:

    AttributeError: 'int' object has no attribute 'as_bytes'

These tests pin every entry point that accepts an address, using the exact
integer Studio sent in the failed deploy:

    tx 0xfd4528cb301a735a11629bc8b583a5247ce8ffc790d16dcff564644ba2729e73
    {"args":[520730917470933887511827341466861109641848507529]}

The value is 0x5B3661C576c7001e6d6279C67F3779705d334c89.
"""

import pytest

STUDIO_INT = 520730917470933887511827341466861109641848507529
WALLET_HEX = "0x5B3661C576c7001e6d6279C67F3779705d334c89"
POLICY = "contracts/Climate-Policy.py"
CLAIM = "contracts/Climate-Claim.py"


def _register_source(cc):
    cc.register_source(
        "om_archive_precip",
        "Open-Meteo ERA5",
        "open_meteo_archive",
        "precipitation",
        "precipitation_sum",
        "https://archive-api.open-meteo.com/v1/archive",
        "mm",
        "Open-Meteo / ERA5 (CC BY 4.0)",
    )


def _create_policy(cc):
    return cc.create_policy(
        "Paris",
        48850000,
        2350000,
        25000,
        ["om_archive_precip"],
        "unanimous",
        1,
        "historical_simulation",
        "2024-06-01",
        "2024-06-05",
        "UTC",
        "precipitation",
        "mm",
        "gt",
        100,
        "max_single",
        "Any day with precipitation above 1.00 mm.",
        0,
    )


def test_policy_constructs_with_studio_integer(direct_deploy):
    cc = direct_deploy(POLICY, STUDIO_INT)
    assert cc is not None


def test_policy_constructs_with_hex_string(direct_deploy):
    cc = direct_deploy(POLICY, WALLET_HEX)
    assert cc is not None


def test_policy_rejects_out_of_range_integer(direct_deploy):
    with pytest.raises(Exception) as info:
        direct_deploy(POLICY, 1 << 160)
    assert "invalid address" in str(info.value)


def test_set_beneficiary_accepts_studio_integer(direct_owner, direct_deploy):
    cc = direct_deploy(POLICY, direct_owner)
    _register_source(cc)
    pid = _create_policy(cc)
    cc.set_beneficiary(pid, STUDIO_INT)
    assert cc.get_policy(pid)["beneficiary"].lower() == WALLET_HEX.lower()


def test_set_beneficiary_accepts_hex_string(direct_owner, direct_deploy):
    cc = direct_deploy(POLICY, direct_owner)
    _register_source(cc)
    pid = _create_policy(cc)
    cc.set_beneficiary(pid, WALLET_HEX)
    assert cc.get_policy(pid)["beneficiary"].lower() == WALLET_HEX.lower()


def test_claim_contract_constructs_with_two_studio_integers(direct_deploy):
    cc = direct_deploy(CLAIM, STUDIO_INT, STUDIO_INT)
    assert cc is not None
