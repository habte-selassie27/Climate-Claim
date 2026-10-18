"""Address coercion.

GenLayer Studio encodes an `address` constructor input as a decimal uint160,
not as a hex string. The SDK's `Address(...)` falls through to `bytes(val)`
for anything it does not recognise, so an integer raised OverflowError and the
deploy failed on chain. These tests pin the accepted input forms so that cannot
regress.

Reference failure (StudioNet tx 0x58371cad...697a):
    OverflowError: cannot fit 'int' into an index-sized integer
"""

import pytest


# `genlayer` only exists inside GenVM, so Address is taken from the loaded
# contract module (which did `from genlayer import *`) rather than imported.

# 0x5B3661C576c7001e6d6279C67F3779705d334c89 as a decimal uint160 - the exact
# value Studio sent in the failing deploy.
STUDIO_INT = 520730917470933887511827341466861109641848507529
WALLET_HEX = "0x5B3661C576c7001e6d6279C67F3779705d334c89"


def _coerce(cc_mod):
    return cc_mod._coerce_address


def test_accepts_uint160_integer(cc_mod):
    """The form Studio actually sends."""
    got = _coerce(cc_mod)(STUDIO_INT)
    assert got.as_hex.lower() == WALLET_HEX.lower()


def test_integer_and_hex_agree(cc_mod):
    """The integer form must mean the same address as the hex form."""
    assert _coerce(cc_mod)(STUDIO_INT).as_bytes == _coerce(cc_mod)(WALLET_HEX).as_bytes


def test_accepts_hex_string(cc_mod):
    assert _coerce(cc_mod)(WALLET_HEX).as_hex.lower() == WALLET_HEX.lower()


def test_accepts_address_object(cc_mod):
    a = cc_mod.Address(WALLET_HEX)
    assert _coerce(cc_mod)(a) is a


def test_accepts_raw_20_byte_buffer(cc_mod):
    raw = cc_mod.Address(WALLET_HEX).as_bytes
    assert _coerce(cc_mod)(raw).as_bytes == raw


def test_accepts_zero_address(cc_mod):
    assert _coerce(cc_mod)(0).as_bytes == bytes(20)


def test_accepts_max_address(cc_mod):
    assert _coerce(cc_mod)((1 << 160) - 1).as_bytes == bytes([0xFF] * 20)


def test_rejects_above_160_bits(cc_mod):
    with pytest.raises(Exception):
        _coerce(cc_mod)(1 << 160)


def test_rejects_negative(cc_mod):
    with pytest.raises(Exception):
        _coerce(cc_mod)(-1)


def test_rejects_bool(cc_mod):
    """bool subclasses int but is never a valid address."""
    with pytest.raises(Exception):
        _coerce(cc_mod)(True)


def test_set_beneficiary_accepts_integer(cc, cc_mod):
    """The same fix covers set_beneficiary, which had the identical pattern.

    This exercises the real contract, not just the helper. A second in-process
    deploy is impossible (GenVM allows one contract per module), so the
    constructor path is covered by the `_coerce_address` cases above, which is
    exactly what `__init__` calls.
    """
    from conftest import make_policy

    pid = make_policy(cc, payout_amount=1000)
    cc.set_beneficiary(pid, STUDIO_INT)
    assert cc.get_policy(pid)["beneficiary"].lower() == WALLET_HEX.lower()


def test_set_beneficiary_accepts_hex(cc):
    """Hex still works; the fix is additive, not a replacement."""
    from conftest import make_policy

    pid = make_policy(cc, payout_amount=1000)
    cc.set_beneficiary(pid, WALLET_HEX)
    assert cc.get_policy(pid)["beneficiary"].lower() == WALLET_HEX.lower()


def test_deployed_owner_is_wellformed(cc):
    """The view returns the checksummed hex form across the ABI boundary."""
    owner = cc.get_owner()
    assert isinstance(owner, str)
    assert owner.startswith("0x") and len(owner) == 42