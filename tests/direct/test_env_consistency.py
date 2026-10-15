"""Drift checks between the root `.env`, the gltest yaml and the frontend config.

These are the only tests in `tests/direct/` that do not exercise the contract.
They exist because three files now independently record the same deployment
facts, and nothing forces them to agree:

    .env                         VITE_* names
    gltest.integration.config.yaml   rpc_url, chain_id
    frontend/src/config/*.ts     typed fallbacks for the same facts

A deployment update that touches one file but not the others would silently
point tests and the app at different networks. These assertions catch that.

`.env` is gitignored, so on CI only `.env.example` exists. The `.env`-specific
tests skip in that case rather than failing; the `.env.example` shape test always
runs, because it is what a fresh contributor copies from.
"""

import json
import pathlib
import re

import pytest

from tools import envfile

REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]
ENV_EXAMPLE = REPO_ROOT / ".env.example"
GLTEST_YAML = REPO_ROOT / "gltest.integration.config.yaml"
NETWORK_TS = REPO_ROOT / "frontend" / "src" / "config" / "network.ts"
CONTRACTS_TS = REPO_ROOT / "frontend" / "src" / "config" / "contracts.ts"
VITE_CONFIG = REPO_ROOT / "frontend" / "vite.config.ts"

real_env = pytest.mark.skipif(
    not (REPO_ROOT / ".env").is_file(),
    reason=".env is gitignored and absent in CI; only .env.example is available",
)


def _yaml_network():
    """Read the studionet rpc_url/chain_id without requiring PyYAML at test time."""
    text = GLTEST_YAML.read_text(encoding="utf-8")
    rpc = re.search(r"rpc_url:\s*(\S+)", text)
    chain = re.search(r"chain_id:\s*(\d+)", text)
    assert rpc and chain, "could not parse rpc_url/chain_id from gltest yaml"
    return rpc.group(1), int(chain.group(1))


# --- .env.example shape -----------------------------------------------------


def test_env_example_declares_exactly_the_canonical_keys():
    parsed = envfile.parse(ENV_EXAMPLE.read_text(encoding="utf-8"))
    declared = {k for k in parsed if k in envfile.KEYS}
    assert declared == set(envfile.KEYS), (
        f".env.example must declare exactly {sorted(envfile.KEYS)}; "
        f"got {sorted(declared)}"
    )


def test_env_example_values_are_placeholders_not_secrets():
    """The example must never carry a real key or address."""
    parsed = envfile.parse(ENV_EXAMPLE.read_text(encoding="utf-8"))
    assert parsed["VITE_DEPLOYER_PRIVATE_KEY"] == ""
    assert parsed["VITE_CLIMATECLAIM_ADDRESS"] == ""


def test_every_project_env_name_is_vite_prefixed():
    """Guards the convention itself, so a future unprefixed name is caught."""
    parsed = envfile.parse(ENV_EXAMPLE.read_text(encoding="utf-8"))
    unprefixed = [k for k in parsed if not k.startswith("VITE_")]
    assert unprefixed == [], f"unprefixed env names: {unprefixed}"


# --- cross-file agreement ---------------------------------------------------


@real_env
def test_env_rpc_url_and_chain_id_match_gltest_yaml():
    values = envfile.read_envfile()
    rpc_url, chain_id = _yaml_network()
    assert values["VITE_GENLAYER_RPC_URL"] == rpc_url
    assert int(values["VITE_GENLAYER_CHAIN_ID"]) == chain_id


@real_env
def test_env_address_matches_frontend_typed_fallback():
    values = envfile.read_envfile()
    typed = CONTRACTS_TS.read_text(encoding="utf-8")
    match = re.search(r'"(0x[0-9a-fA-F]{40})"', typed)
    assert match, "no literal address found in frontend/src/config/contracts.ts"
    assert values["VITE_CLIMATECLAIM_ADDRESS"] == match.group(1)


@real_env
def test_env_chain_id_matches_frontend_typed_fallback():
    values = envfile.read_envfile()
    network_ts = NETWORK_TS.read_text(encoding="utf-8")
    # The literal fallback survives as `ENV_CHAIN_ID ?? 61999`.
    match = re.search(r"ENV_CHAIN_ID \?\? (\d+)", network_ts)
    assert match, "typed chain-id fallback not found in network.ts"
    assert int(values["VITE_GENLAYER_CHAIN_ID"]) == int(match.group(1))


@real_env
def test_env_network_key_matches_frontend_default():
    values = envfile.read_envfile()
    network_ts = NETWORK_TS.read_text(encoding="utf-8")
    match = re.search(r'\? ENV_NETWORK_KEY : "(\w+)"', network_ts)
    assert match, "typed network fallback not found in network.ts"
    assert values["VITE_GLTEST_NETWORK"] == match.group(1)


# --- format validation ------------------------------------------------------


@real_env
def test_env_address_and_key_are_well_formed():
    values = envfile.read_envfile()
    assert envfile.is_address(values.get("VITE_CLIMATECLAIM_ADDRESS"))
    # Asserted by format only. The value must never be printed.
    assert envfile.is_private_key(values.get("VITE_DEPLOYER_PRIVATE_KEY"))


# --- the no-leak guarantee ---------------------------------------------------


def test_vite_config_does_not_inject_the_deploy_key():
    """The deploy key must never appear in a `define` entry or the env prefix.

    `vite.config.ts` is the single place that decides what reaches the browser,
    so this is where a future edit could reintroduce the leak.
    """
    source = VITE_CONFIG.read_text(encoding="utf-8")
    key_name = "VITE_DEPLOYER_PRIVATE_KEY"
    for line in source.splitlines():
        if key_name in line:
            # Allowed only as a comment explaining that it is NOT injected.
            assert line.lstrip().startswith(("*", "//")), (
                f"{key_name} must not appear in live config code: {line.strip()}"
            )
    # The public prefix must stay narrow; "VITE_" would inline the key.
    assert re.search(r'envPrefix:\s*"VITE_PUBLIC_"', source)


def test_frontend_never_ships_the_deploy_key_name():
    """`src/config/env.ts` is bundled; its comments reach the browser sourcemap."""
    env_ts = REPO_ROOT / "frontend" / "src" / "config" / "env.ts"
    assert "VITE_DEPLOYER_PRIVATE_KEY" not in env_ts.read_text(encoding="utf-8")


# --- parser unit tests ------------------------------------------------------


@pytest.mark.parametrize(
    "text,expected",
    [
        ("A=1\nB=2", {"A": "1", "B": "2"}),
        ("# comment\n\nA=1", {"A": "1"}),
        ("export A=1", {"A": "1"}),
        ('A="quoted # not a comment"', {"A": "quoted # not a comment"}),
        ("A='single'", {"A": "single"}),
        ("A=value # trailing", {"A": "value"}),
        ("A=0xdeadBEEF", {"A": "0xdeadBEEF"}),
        ("not a valid line", {}),
        ("A=1\nA=2", {"A": "2"}),
        ("  A = 1  ", {"A": "1"}),
    ],
)
def test_parser_handles_the_subsets_this_project_uses(text, expected):
    assert envfile.parse(text) == expected