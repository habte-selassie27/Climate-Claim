"""Minimal `.env` reader for the repository root.

WHY THIS EXISTS: the project standardises on `VITE_`-prefixed names in the root
`.env`, but nothing in the Python/gltest stack reads them (gltest generates its
own throwaway accounts and takes rpc_url/chain_id from
`gltest.integration.config.yaml`). That leaves two independent sources of truth
for the same deployment facts, free to drift apart.

This module reads those names so `tests/direct/test_env_consistency.py` can
assert they still agree with the yaml and the frontend's typed fallbacks.

NO DEPENDENCY ON PURPOSE: `requirements.txt` pins only the contract tooling and
has no `python-dotenv`, so this is a small hand-rolled parser rather than a new
install. It handles the subset of `.env` syntax this project actually uses:
blank lines, `#` comments, optional `export`, optional single/double quotes,
and trailing inline comments on unquoted values.

NOTHING HERE IS A SECRET HANDLER beyond the deploy key, which is read only so it
can be asserted *present and well-formed*, never printed or logged.
"""

from __future__ import annotations

import pathlib
import re
from typing import Dict, Optional

#: Repository root (the directory holding `.env`).
REPO_ROOT = pathlib.Path(__file__).resolve().parents[1]

#: Canonical names, all `VITE_`-prefixed per project convention.
KEYS = (
    "VITE_DEPLOYER_PRIVATE_KEY",
    "VITE_CLIMATECLAIM_ADDRESS",
    "VITE_GLTEST_NETWORK",
    "VITE_GENLAYER_RPC_URL",
    "VITE_GENLAYER_CHAIN_ID",
)

_LINE = re.compile(
    r"""^\s*(?:export\s+)?            # optional `export `
        (?P<key>[A-Za-z_][A-Za-z0-9_]*)   # key
        \s*=\s*                        # =
        (?P<value>.*?)\s*$             # value, possibly quoted
    """,
    re.VERBOSE,
)


def parse(text: str) -> Dict[str, str]:
    """Parse `.env` content into a dict. Later duplicates win, as dotenv does."""
    out: Dict[str, str] = {}
    for raw in text.splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        m = _LINE.match(line)
        if not m:
            continue
        value = m.group("value")
        if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
            # Quoted: keep verbatim, strip only the outer quotes.
            value = value[1:-1]
        else:
            # Unquoted: an inline `#` starts a comment (dotenv convention).
            hash_at = value.find(" #")
            if hash_at != -1:
                value = value[:hash_at].strip()
        out[m.group("key")] = value
    return out


def read_envfile(path: Optional[pathlib.Path] = None) -> Dict[str, str]:
    """Read and parse a `.env` file. Missing file -> empty dict, never raises.

    Callers must decide whether an absent `.env` is an error; usually it is not,
    because `.env` is gitignored and CI only has `.env.example`.
    """
    target = pathlib.Path(path) if path is not None else REPO_ROOT / ".env"
    if not target.is_file():
        return {}
    return parse(target.read_text(encoding="utf-8"))


def get(key: str, path: Optional[pathlib.Path] = None) -> Optional[str]:
    """Return one value, or None when unset or empty."""
    value = read_envfile(path).get(key)
    if value is None:
        return None
    return value or None


def is_address(value: Optional[str]) -> bool:
    """True for a 0x-prefixed 20-byte hex address. Mirrors frontend/src/config/env.ts."""
    return bool(value) and re.fullmatch(r"0x[0-9a-fA-F]{40}", value) is not None


def is_private_key(value: Optional[str]) -> bool:
    """True for a 0x-prefixed 32-byte hex key. Presence/format only, never the value."""
    return bool(value) and re.fullmatch(r"0x[0-9a-fA-F]{64}", value) is not None