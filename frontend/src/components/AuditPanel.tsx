import { CONTRACT_ADDRESS } from "../config/contracts";
import { activeNetwork } from "../config/network";
import type { Claim, Policy } from "../domain/types";
import { CopyField } from "./CopyField";

interface Props {
  claim: Claim;
  policy: Policy;
  /** Tx hash when a write in this session produced one. */
  txHash?: string;
}

/**
 * Audit block: criteria version, evaluation round, reason code, contract
 * address, and the transaction hash with an explorer link built only from
 * verified config.
 */
export function AuditPanel({ claim, policy, txHash }: Props) {
  const net = activeNetwork();

  return (
    <div className="stack" data-testid="audit-panel">
      <dl className="terms">
        <dt>Criteria version</dt>
        <dd className="mono">{claim.criteria_version}</dd>
        <dt>Evaluation round</dt>
        <dd className="num">{claim.eval_round}</dd>
        <dt>Reason code</dt>
        <dd className="mono">{claim.reason_code || "—"}</dd>
        <dt>Finalized</dt>
        <dd>{claim.finalized ? "yes" : "no — an accepted decision can still be appealed"}</dd>
        <dt>Claim ID</dt>
        <dd className="mono">{claim.id}</dd>
        <dt>Policy ID</dt>
        <dd className="mono">{policy.id}</dd>
        <dt>Contract</dt>
        <dd>
          <CopyField
            value={CONTRACT_ADDRESS}
            kind="address"
            label="Contract address"
            explorerUrl={net.explorerUrl}
            explorerAvailable={net.explorerAvailable}
            explorerNote={net.explorerNote}
          />
        </dd>
        <dt>Network</dt>
        <dd>
          {net.label} (chain {net.chainId})
        </dd>
        {txHash ? (
          <>
            <dt>Transaction</dt>
            <dd>
              <CopyField
                value={txHash}
                kind="hash"
                label="Transaction hash"
                explorerUrl={net.explorerUrl}
                explorerAvailable={net.explorerAvailable}
                explorerNote={net.explorerNote}
              />
            </dd>
          </>
        ) : null}
      </dl>

      {net.explorerAvailable ? null : (
        <div className="alert alert-warn">
          <strong>Explorer links are unavailable right now</strong>
          <p>{net.explorerNote}</p>
        </div>
      )}

      <details className="disclosure">
        <summary>What “confirmed” does and does not mean</summary>
        <p className="small muted">
          “Confirmed” means the evidence the validators retrieved met the terms this policy
          defined. It is not a legal determination and it is not a statement that anyone is
          contractually obliged to pay. A payout only happens once the decision is final, and only
          through the settlement path.
        </p>
      </details>
    </div>
  );
}