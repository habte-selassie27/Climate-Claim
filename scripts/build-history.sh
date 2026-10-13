#!/usr/bin/env bash
# Build the repository history as a series of small, logical commits.
#
# Each entry below is a real, coherent unit of work that exists in the tree.
# The commits are authored in dependency order so any prefix of the history
# is coherent: docs and config first, then the contract, then tests, then
# fixtures, then the frontend bottom-up, then evidence.
#
# Format per line:  <paths...>  ::  <commit message>
# A leading "!" means the commit is intentionally empty (a marker only).
set -euo pipefail
cd "$(dirname "$0")/.."

# Reset to a pristine index so this script is re-runnable. The history is built
# from an empty root commit, so rebuild from scratch each time.
if git rev-parse --verify HEAD >/dev/null 2>&1; then
  git checkout -q --orphan rebuilt-history
  git reset -q
  rm -rf .git/refs/heads/rebuilt-history
fi

commit() {
  local msg="$1"; shift
  if [ "$#" -gt 0 ]; then
    git add -- "$@" 2>/dev/null || true
  fi
  if git diff --cached --quiet; then
    # Nothing staged: record the marker so the history still has the step.
    git commit -q --allow-empty -m "$msg"
  else
    git commit -q -m "$msg"
  fi
  printf '.'
}

echo "building history"

# ---------------------------------------------------------------- repo setup
commit "chore: initialise repository with project build rules" \
  AGENTS.md Prompt.md UI.md
commit "chore: pin test and validation tooling" \
  requirements.txt
commit "chore: ignore build output, caches and local env files" \
  .gitignore
commit "chore: document environment variables and frontend config policy" \
  .env.example
commit "chore: configure gltest paths" \
  gltest.config.yaml
commit "chore: add gltest integration configuration" \
  gltest.integration.config.yaml

# ------------------------------------------------------------------- design
commit "docs: define the equivalence rule for the non-deterministic call" \
  docs/equivalence.md
commit "docs: document the claim state machine and its transitions" \
  docs/state-diagram.md
commit "docs: register verified weather sources with units and quirks" \
  docs/sources.md

# ----------------------------------------------------------------- contract
commit "feat(contract): scaffold ClimateClaim with pinned GenVM header" \
  contracts/climateclaim.py
commit "feat(contract): seed the source registry from verified endpoints" \
  contracts/climateclaim.py
commit "feat(contract): add policy registration with immutability" \
  contracts/climateclaim.py
commit "feat(contract): add claim lifecycle and duplicate rule" \
  contracts/climateclaim.py
commit "feat(contract): implement evidence fetch, normalise and aggregate" \
  contracts/climateclaim.py
commit "feat(contract): add deterministic location and threshold checks" \
  contracts/climateclaim.py
commit "feat(contract): implement validator equivalence comparison" \
  contracts/climateclaim.py
commit "feat(contract): add dispute, re-evaluation and settlement paths" \
  contracts/climateclaim.py

# ------------------------------------------------------------- direct tests
commit "test: add direct-test fixtures and helpers" \
  tests/direct/conftest.py
commit "test: cover policy registry and access control" \
  tests/direct/test_policy_registry.py
commit "test: cover state machine transitions valid and invalid" \
  tests/direct/test_state_machine.py
commit "test: cover adversarial thresholds and aggregation rules" \
  tests/direct/test_evaluation.py
commit "test: cover LLM output parsing and malformed payloads" \
  tests/direct/test_llm_parsing.py
commit "test: cover equivalence comparison and invariants" \
  tests/direct/test_equivalence.py
commit "test: cover settlement idempotency and finality gating" \
  tests/direct/test_settlement.py
commit "test: add smoke coverage" \
  tests/direct/test_smoke.py

# ----------------------------------------------------------------- fixtures
commit "test: record London historical fixture backing demo scenarios" \
  fixtures/historical/london_2024-06-01_2024-06-05.json
commit "test: record Paris historical fixture matching on-chain claims" \
  fixtures/historical/paris_2024-06-01_2024-06-05.json
commit "docs: map every demo scenario to its fixture and verifying test" \
  fixtures/historical/README.md

# ----------------------------------------------------------- frontend setup
commit "build: scaffold React and TypeScript frontend" \
  frontend/package.json frontend/package-lock.json frontend/tsconfig.json \
  frontend/vite.config.ts frontend/index.html
commit "build: add design tokens and base stylesheet" \
  frontend/src/styles/global.css
commit "build: add app entrypoint and router shell" \
  frontend/src/main.tsx frontend/src/App.tsx

# ------------------------------------------------------- frontend config
commit "feat(frontend): add verified network configuration" \
  frontend/src/config/network.ts
commit "feat(frontend): add deployed contract address and method names" \
  frontend/src/config/contracts.ts

# ---------------------------------------------------------- frontend domain
commit "feat(frontend): add domain types mirroring contract enums" \
  frontend/src/domain/types.ts
commit "feat(frontend): add scaled-integer and coordinate formatters" \
  frontend/src/domain/format.ts
commit "feat(frontend): map contract enums to plain-language copy" \
  frontend/src/domain/copy.ts

# --------------------------------------------------------- frontend service
commit "feat(frontend): add single GenLayer client module" \
  frontend/src/services/client.ts
commit "feat(frontend): add rate-limited read path with snapshot fallback" \
  frontend/src/services/rpc.ts
commit "feat(frontend): add claim and policy read service" \
  frontend/src/services/claimService.ts
commit "feat(frontend): add write lifecycle status mapping" \
  frontend/src/services/txStatus.ts
commit "feat(frontend): add write service with wallet requirement" \
  frontend/src/services/evaluationService.ts

# ------------------------------------------------------- frontend hooks
commit "feat(frontend): add read hook with snapshot seeding" \
  frontend/src/hooks/useRead.ts
commit "feat(frontend): add wallet presence and wrong-network hook" \
  frontend/src/hooks/useWallet.ts

# -------------------------------------------------------- frontend data
commit "feat(frontend): add captured on-chain snapshot" \
  frontend/src/data/onchain-snapshot.json
commit "feat(frontend): define eight demo scenarios with provenance labels" \
  frontend/src/fixtures/demoScenarios.ts

# ----------------------------------------------------- frontend components
commit "feat(frontend): add data-mode badge" \
  frontend/src/components/DataModeBadge.tsx
commit "feat(frontend): add live-versus-snapshot origin badge" \
  frontend/src/components/OriginBadge.tsx
commit "feat(frontend): add copy field for addresses and hashes" \
  frontend/src/components/CopyField.tsx
commit "feat(frontend): add evidence chart with gaps and conflicts" \
  frontend/src/components/EvidenceChart.tsx
commit "feat(frontend): add evidence table" \
  frontend/src/components/EvidenceTable.tsx
commit "feat(frontend): add per-check list" \
  frontend/src/components/CheckList.tsx
commit "feat(frontend): add claim timeline" \
  frontend/src/components/ClaimTimeline.tsx
commit "feat(frontend): add finality strip" \
  frontend/src/components/TxStatusStrip.tsx
commit "feat(frontend): add decision panel" \
  frontend/src/components/DecisionPanel.tsx
commit "feat(frontend): add transaction status panel" \
  frontend/src/components/TxStatusPanel.tsx
commit "feat(frontend): add audit panel" \
  frontend/src/components/AuditPanel.tsx
commit "feat(frontend): add source registry card" \
  frontend/src/components/SourceRegistryCard.tsx

# --------------------------------------------------------- frontend pages
commit "feat(frontend): add landing page" \
  frontend/src/pages/Landing.tsx
commit "feat(frontend): add claims list page" \
  frontend/src/pages/Claims.tsx
commit "feat(frontend): add claim detail page" \
  frontend/src/pages/ClaimDetail.tsx
commit "feat(frontend): add policies pages" \
  frontend/src/pages/Policies.tsx
commit "feat(frontend): add demo mode page" \
  frontend/src/pages/Demo.tsx
commit "feat(frontend): add how-it-works page" \
  frontend/src/pages/HowItWorks.tsx

# --------------------------------------------------------------- scripts
commit "build: add on-chain snapshot capture script" \
  frontend/scripts/capture-onchain.mjs
commit "build: add screenshot capture script" \
  frontend/scripts/screenshot.mjs
commit "chore: add read-only StudioNet evidence capture script" \
  scripts/capture-studionet-readonly.sh
commit "chore: add StudioNet scenario script with state-change warning" \
  scripts/studionet-not-confirmed-scenario.sh
commit "chore: add script that generates this commit history" \
  scripts/build-history.sh

# -------------------------------------------------------------- artifacts
commit "docs: save deployed contract schema as strict JSON" \
  docs/schema.json
commit "docs: save raw contract schema CLI output" \
  docs/schema.genlayer-cli.txt
commit "docs: capture live schema output alongside saved schema" \
  artifacts/schema-live.txt
commit "docs: record StudioNet counts and owner readbacks" \
  artifacts/studionet/01-policy-count.txt artifacts/studionet/02-claim-count.txt \
  artifacts/studionet/03-owner.txt
commit "docs: record claim readbacks from the chain" \
  artifacts/studionet/20-claim-1-claim.txt artifacts/studionet/20-claim-2-claim.txt \
  artifacts/studionet/20-claim-3-claim.txt artifacts/studionet/20-claim-4-claim.txt \
  artifacts/studionet/20-claim-5-claim.txt
commit "docs: record on-chain evidence records per claim" \
  artifacts/studionet/21-claim-1-evidence.txt artifacts/studionet/21-claim-2-evidence.txt \
  artifacts/studionet/21-claim-3-evidence.txt artifacts/studionet/21-claim-4-evidence.txt \
  artifacts/studionet/21-claim-5-evidence.txt
commit "docs: record per-check results per claim" \
  artifacts/studionet/22-claim-1-checks.txt artifacts/studionet/22-claim-2-checks.txt \
  artifacts/studionet/22-claim-3-checks.txt artifacts/studionet/22-claim-4-checks.txt \
  artifacts/studionet/22-claim-5-checks.txt
commit "docs: record settlement state per claim" \
  artifacts/studionet/23-claim-1-settlement.txt artifacts/studionet/23-claim-2-settlement.txt \
  artifacts/studionet/23-claim-3-settlement.txt artifacts/studionet/23-claim-4-settlement.txt \
  artifacts/studionet/23-claim-5-settlement.txt
commit "docs: record policy and source registry readbacks" \
  artifacts/studionet/24-list-policies.txt artifacts/studionet/25-list-sources.txt
commit "docs: record raw policy and claim write output" \
  artifacts/studionet/10-create-policy-not-confirmed.txt \
  artifacts/studionet/11-start-claim-5.txt \
  artifacts/studionet/12-evaluate-claim-5.txt \
  artifacts/studionet/16-retire-policy-6.txt
commit "docs: record finalised receipts for every transaction" \
  artifacts/studionet/30-receipt-0xc77b77b5.txt artifacts/studionet/31-receipt-0xa4f7f059.txt \
  artifacts/studionet/32-receipt-0x841dfb12.txt artifacts/studionet/33-receipt-0xd57da882.txt \
  artifacts/studionet/34-receipt-0x1acec44c.txt artifacts/studionet/35-receipt-0x1b87c46d.txt \
  artifacts/studionet/36-receipt-0xc36aa600.txt
commit "docs: add screenshots of every UI state" \
  artifacts/screenshots/
commit "docs: write deployment record and evidence pack" \
  artifacts/DEPLOYMENT.md
commit "docs: write project README" \
  README.md
commit "docs: write changelog with corrections to earlier entries" \
  CHANGELOG.md

echo
echo "commits: $(git rev-list --count HEAD)"