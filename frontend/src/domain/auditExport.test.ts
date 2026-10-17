import { describe, expect, it } from "vitest";
import {
  AUDIT_RECORD_VERSION,
  auditRecordFilename,
  buildAuditRecord,
  downloadAuditRecord,
  type AuditRecordContext,
} from "./auditExport";
import type { ClaimBundle } from "./types";

function sampleBundle(overrides: Partial<ClaimBundle> = {}): ClaimBundle {
  return {
    claim: {
      id: "claim-2",
      policy_id: "policy-3",
      claimant: "0x5B3661C576c7001e6d6279C67F3779705d334c89",
      period_start: "2024-06-01",
      period_end: "2024-06-05",
      state: "decided_not_confirmed",
      decision: "not_confirmed",
      reason_code: "threshold_not_crossed",
      observed_value_scaled: 90,
      summary: "Max single reading 0.90 mm did not exceed 1.00 mm.",
      criteria_version: "climateclaim-criteria-2",
      eval_round: 1,
      dispute_rounds: 1,
      finalized: false,
      settlement_state: "not_settled",
      payout_round: 0,
      eval_error: "",
      pending_grounds: "",
    },
    policy: {
      id: "policy-3",
      owner: "0x5B3661C576c7001e6d6279C67F3779705d334c89",
      beneficiary: "0x0000000000000000000000000000000000000000",
      location_name: "Paris",
      lat_scaled: 48892400,
      lon_scaled: 2343100,
      tolerance_m: 12000,
      source_ids: ["om_archive_precip"],
      agreement_rule: "unanimous",
      min_sources: 1,
      data_mode: "historical_simulation",
      period_start: "2024-06-01",
      period_end: "2024-06-05",
      timezone: "UTC",
      metric: "precipitation",
      unit: "mm",
      comparator: "gt",
      threshold_scaled: 100,
      aggregation: "max_single",
      condition_text: "More than 1.00 mm on any day.",
      payout_amount: 0,
      status: "active",
      claim_count: 2,
    },
    evidence: [
      {
        source_id: "om_archive_precip",
        ok: true,
        error: "",
        station: "grid 48.8924,2.3431",
        period_start: "2024-06-01",
        period_end: "2024-06-05",
        unit: "mm",
        value_scaled: 90,
        days_covered: 5,
        crossed: false,
      },
    ],
    checks: [{ name: "threshold_crossed", status: "fail", detail: "0.90 <= 1.00" }],
    disputes: [
      {
        round: 1,
        opener: "0x5B3661C576c7001e6d6279C67F3779705d334c89",
        grounds: "Check the station choice.",
        prev_decision: "not_confirmed",
        new_decision: "not_confirmed",
      },
    ],
    settlement: {
      claim_id: "claim-2",
      state: "not_settled",
      amount: 0,
      beneficiary: "0x0000000000000000000000000000000000000000",
      recipient: "0x5B3661C576c7001e6d6279C67F3779705d334c89",
      finalized: false,
      in_flight: false,
      payout_round: 0,
      payouts: [],
    },
    ...overrides,
  };
}

const CTX: AuditRecordContext = {
  origin: "live",
  contractAddress: "0x6e085313b65962e0Dd6930AFB9B548Ab23a50C6F",
  networkLabel: "StudioNet",
  chainId: 61999,
  generatedAt: "2026-10-16T14:00:00.000Z",
};

describe("buildAuditRecord", () => {
  it("versions the record and uses the injected clock", () => {
    const record = buildAuditRecord(sampleBundle(), CTX);
    expect(record.record_version).toBe(AUDIT_RECORD_VERSION);
    expect(record.generated_at).toBe("2026-10-16T14:00:00.000Z");
  });

  it("keeps scaled integers raw and adds the stated-unit value", () => {
    const record = buildAuditRecord(sampleBundle(), CTX);
    expect(record.claim.observed_value_scaled).toBe(90);
    expect(record.claim.observed_value).toBe("0.90");
    expect(record.policy.threshold_scaled).toBe(100);
    expect(record.policy.threshold).toBe("1.00");
    expect(record.evidence[0].value_scaled).toBe(90);
    expect(record.evidence[0].value).toBe("0.90");
    expect(record.provenance.scale_decimals).toBe(2);
  });

  it("humanises coordinates without losing the stored microdegrees", () => {
    const record = buildAuditRecord(sampleBundle(), CTX);
    expect(record.policy.latitude).toBe("48.8924");
    expect(record.policy.longitude).toBe("2.3431");
    expect(record.policy.lat_scaled).toBe(48892400);
  });

  it("carries evidence, checks, disputes and settlement through unchanged", () => {
    const record = buildAuditRecord(sampleBundle(), CTX);
    expect(record.evidence).toHaveLength(1);
    expect(record.checks).toEqual([{ name: "threshold_crossed", status: "fail", detail: "0.90 <= 1.00" }]);
    expect(record.disputes[0].grounds).toBe("Check the station choice.");
    expect(record.disputes[0].new_decision).toBe("not_confirmed");
    expect(record.settlement.state).toBe("not_settled");
    expect(record.settlement.payouts).toEqual([]);
  });

  it("labels a snapshot-backed record honestly", () => {
    const record = buildAuditRecord(sampleBundle(), {
      ...CTX,
      origin: "snapshot",
      capturedAt: "2026-10-13T14:52:53.429Z",
      liveError: "TypeError: Failed to fetch",
    });
    expect(record.provenance.record_origin).toBe("recorded_snapshot");
    expect(record.provenance.snapshot_captured_at).toBe("2026-10-13T14:52:53.429Z");
    expect(record.provenance.live_error).toBe("TypeError: Failed to fetch");
  });

  it("keeps a mixed origin as mixed rather than rounding to live", () => {
    const record = buildAuditRecord(sampleBundle(), { ...CTX, origin: "mixed" });
    expect(record.provenance.record_origin).toBe("mixed");
  });

  it("includes the session transaction and explorer link only when present", () => {
    const bare = buildAuditRecord(sampleBundle(), CTX);
    expect(bare.provenance.session_transaction_hash).toBeNull();
    expect(bare.provenance.explorer_url).toBeNull();

    const withTx = buildAuditRecord(sampleBundle(), {
      ...CTX,
      sessionTxHash: "0x85748a90fe90c0b4c92ef7810be643935cd1fadce04dc7f9a425f8c66cc8809f",
      explorerUrl:
        "https://explorer-studio.genlayer.com/tx/0x85748a90fe90c0b4c92ef7810be643935cd1fadce04dc7f9a425f8c66cc8809f",
    });
    expect(withTx.provenance.session_transaction_hash).toBe(
      "0x85748a90fe90c0b4c92ef7810be643935cd1fadce04dc7f9a425f8c66cc8809f",
    );
    expect(withTx.provenance.explorer_url).toContain("explorer-studio.genlayer.com/tx/");
  });

  it("is JSON round-trippable (nothing unserialisable leaks in)", () => {
    const record = buildAuditRecord(sampleBundle(), CTX);
    expect(JSON.parse(JSON.stringify(record))).toEqual(record);
  });
});

describe("auditRecordFilename", () => {
  it("names the file after the claim id", () => {
    expect(auditRecordFilename("claim-2")).toBe("climateclaim-audit-claim-2.json");
  });

  it("sanitises ids that contain path characters", () => {
    expect(auditRecordFilename("a/b c")).toBe("climateclaim-audit-a_b_c.json");
  });

  it("never returns an empty name", () => {
    expect(auditRecordFilename("///")).toBe("climateclaim-audit-_.json");
  });
});

describe("downloadAuditRecord", () => {
  it("returns false instead of throwing when browser APIs are absent (node)", () => {
    const record = buildAuditRecord(sampleBundle(), CTX);
    expect(downloadAuditRecord(record)).toBe(false);
  });
});
