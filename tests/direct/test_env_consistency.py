"""Drift checks between the root `.env`, the gltest yaml and the frontend config.

These are the only tests in `tests/direct/` that do not exercise the contract.
They exist because three files now independently record the same deployment
facts, and nothing forces them to agree:

    .env                            VITE_* names (gitignored, local)
    .env.example                    same names, same public values (COMMITTED)
    gltest.integration.config.yaml  rpc_url, chain_id
    frontend/src/config/*.ts        typed fallbacks for the same facts

A deployment update that touches one file but not the others would silently
point tests and the app at different networks. These assertions catch that.

Both `.env.example` and `.env` are checked. The example is always present and is
tracked by git, so its public values must stay correct or a fresh contributor
copies a stale deployment. `.env` is gitignored and absent on CI; when it is
missing, only the example is checked and nothing is skipped.
"""

import pathlib
import re

import pytest

from tools import envfile

REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]
ENV_EXAMPLE = REPO_ROOT / ".env.example"
REAL_ENV = REPO_ROOT / ".env"
GLTEST_YAML = REPO_ROOT / "gltest.integration.config.yaml"
NETWORK_TS = REPO_ROOT / "frontend" / "src" / "config" / "network.ts"
CONTRACTS_TS = REPO_ROOT / "frontend" / "src" / "config" / "contracts.ts"
ENV_TS = REPO_ROOT / "frontend" / "src" / "config" / "env.ts"
VITE_CONFIG = REPO_ROOT / "frontend" / "vite.config.ts"


def _env_files():
    """(label, path) for every env file present. `.env` only when it exists."""
    files = [(".env.example", ENV_EXAMPLE)]
    if REAL_ENV.is_file():
        files.append((".env", REAL_ENV))
    return files


@pytest.fixture(params=_env_files(), ids=lambda pair: pair[0])
def env(request):
    """Each env file, one parametrised case per file present."""
    label, path = request.param
    return label, envfile.parse(path.read_text(encoding="utf-8"))


@pytest.fixture
def example():
    return envfile.parse(ENV_EXAMPLE.read_text(encoding="utf-8"))


def _yaml_network():
    """Read the studionet rpc_url/chain_id without requiring PyYAML at test time."""
    text = GLTEST_YAML.read_text(encoding="utf-8")
    rpc = re.search(r"rpc_url:\s*(\S+)", text)
    chain = re.search(r"chain_id:\s*(\d+)", text)
    assert rpc and chain, "could not parse rpc_url/chain_id from gltest yaml"
    return rpc.group(1), int(chain.group(1))


# --- shape and format -------------------------------------------------------


def test_every_env_file_declares_exactly_the_canonical_keys(env):
    label, values = env
    declared = {k for k in values if k in envfile.KEYS}
    assert declared == set(envfile.KEYS), (
        f"{label} must declare exactly {sorted(envfile.KEYS)}; got {sorted(declared)}"
    )


def test_every_project_env_name_is_vite_prefixed(env):
    """Guards the convention itself, so a future unprefixed name is caught."""
    label, values = env
    unprefixed = [k for k in values if not k.startswith("VITE_")]
    assert unprefixed == [], f"{label} has unprefixed env names: {unprefixed}"


def test_env_address_and_key_are_well_formed(env):
    label, values = env
    assert envfile.is_address(values.get("VITE_CLIMATECLAIM_ADDRESS")), label
    # Asserted by format only. The value is never printed.
    if values.get("VITE_DEPLOYER_PRIVATE_KEY"):
        assert envfile.is_private_key(values["VITE_DEPLOYER_PRIVATE_KEY"]), label


# --- the committed example must never carry the key -------------------------


def test_env_example_carries_no_secret(example):
    """`.env.example` is COMMITTED, so it must never carry the deploy key.

    The public values are deliberately filled in -- address, rpc url, chain id,
    network -- because they are public and save a fresh contributor an edit. The
    private key is the one value that must stay empty: git history keeps it even
    after a later removal, and it would reach every clone and remote.
    """
    assert example["VITE_DEPLOYER_PRIVATE_KEY"] == "", (
        ".env.example is tracked by git; a real key here is published permanently"
    )
    assert not envfile.is_private_key(example["VITE_DEPLOYER_PRIVATE_KEY"])


def test_env_example_public_values_are_filled_in(example):
    """Copying this file should produce a working config with no editing."""
    assert envfile.is_address(example["VITE_CLIMATECLAIM_ADDRESS"])
    assert example["VITE_GENLAYER_RPC_URL"].startswith("https://")
    assert int(example["VITE_GENLAYER_CHAIN_ID"]) > 0
    assert example["VITE_GLTEST_NETWORK"]


# --- cross-file agreement ---------------------------------------------------


def test_rpc_url_and_chain_id_match_gltest_yaml(env):
    label, values = env
    rpc_url, chain_id = _yaml_network()
    assert values["VITE_GENLAYER_RPC_URL"] == rpc_url, label
    assert int(values["VITE_GENLAYER_CHAIN_ID"]) == chain_id, label


def test_address_matches_frontend_typed_fallback(env):
    label, values = env
    typed = CONTRACTS_TS.read_text(encoding="utf-8")
    match = re.search(r'"(0x[0-9a-fA-F]{40})"', typed)
    assert match, "no literal address found in frontend/src/config/contracts.ts"
    assert values["VITE_CLIMATECLAIM_ADDRESS"] == match.group(1), label


def test_chain_id_matches_frontend_typed_fallback(env):
    label, values = env
    network_ts = NETWORK_TS.read_text(encoding="utf-8")
    # The literal fallback survives as `ENV_CHAIN_ID ?? 61999`.
    match = re.search(r"ENV_CHAIN_ID \?\? (\d+)", network_ts)
    assert match, "typed chain-id fallback not found in network.ts"
    assert int(values["VITE_GENLAYER_CHAIN_ID"]) == int(match.group(1)), label


def test_network_key_matches_frontend_default(env):
    label, values = env
    network_ts = NETWORK_TS.read_text(encoding="utf-8")
    match = re.search(r'\? ENV_NETWORK_KEY : "(\w+)"', network_ts)
    assert match, "typed network fallback not found in network.ts"
    assert values["VITE_GLTEST_NETWORK"] == match.group(1), label


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


def test_deploy_key_is_not_in_the_public_allowlist():
    source = VITE_CONFIG.read_text(encoding="utf-8")
    block = re.search(r"PUBLIC_ENV_VARS\s*=\s*\[(.*?)\]", source, re.S)
    assert block, "PUBLIC_ENV_VARS allowlist not found in vite.config.ts"
    assert "DEPLOYER_PRIVATE_KEY" not in block.group(1)


def test_frontend_never_ships_the_deploy_key_name():
    """`src/config/env.ts` is bundled; its comments reach the browser sourcemap."""
    assert "VITE_DEPLOYER_PRIVATE_KEY" not in ENV_TS.read_text(encoding="utf-8")


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


def test_read_envfile_returns_empty_for_missing_file(tmp_path):
    assert envfile.read_envfile(tmp_path / "nope.env") == {}
    assert envfile.get("VITE_GLTEST_NETWORK", tmp_path / "nope.env") is None