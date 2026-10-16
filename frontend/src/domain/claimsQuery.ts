/**
 * Claims table query: text search, decision/state filters and pagination.
 *
 * Pure functions with no React dependency, so the table's behaviour is unit
 * tested in the node test environment and the page component stays a thin
 * renderer. Filtering is intentionally simple (case-insensitive substring,
 * exact enum match) — the point is to stay usable when the table has hundreds
 * of rows, not to be a search engine.
 */

import type { Claim } from "./types";

/** Decision facet shown in the filter bar. "pending" means no decision yet. */
export type DecisionFilter = "all" | "confirmed" | "not_confirmed" | "inconclusive" | "pending";

export const CLAIMS_PAGE_SIZE = 8;

export interface ClaimsFilter {
  /** Matched case-insensitively against claim id, policy id and claimant. */
  text: string;
  decision: DecisionFilter;
  /** Exact claim state, or "" for all states. */
  state: string;
}

export const EMPTY_CLAIMS_FILTER: ClaimsFilter = { text: "", decision: "all", state: "" };

function matchesDecision(claim: Claim, filter: DecisionFilter): boolean {
  if (filter === "all") return true;
  if (filter === "pending") return claim.decision === "";
  return claim.decision === filter;
}

export function filterClaims(claims: Claim[], filter: ClaimsFilter): Claim[] {
  const needle = filter.text.trim().toLowerCase();
  return claims.filter((claim) => {
    if (!matchesDecision(claim, filter.decision)) return false;
    if (filter.state && claim.state !== filter.state) return false;
    if (!needle) return true;
    return (
      claim.id.toLowerCase().includes(needle) ||
      claim.policy_id.toLowerCase().includes(needle) ||
      claim.claimant.toLowerCase().includes(needle)
    );
  });
}

export interface Page<T> {
  rows: T[];
  /** The effective page after clamping into [1, pages]. */
  page: number;
  pages: number;
  total: number;
}

/**
 * Slice `rows` into a page. `page` is clamped, so a filter change that shrinks
 * the result set can never leave the viewer on an empty page; the returned
 * `page` is the one that was actually used.
 */
export function paginate<T>(rows: T[], page: number, pageSize: number = CLAIMS_PAGE_SIZE): Page<T> {
  const total = rows.length;
  const size = Math.max(1, Math.floor(pageSize));
  const pages = Math.max(1, Math.ceil(total / size));
  const wanted = Number.isFinite(page) ? Math.floor(page) : 1;
  const effective = Math.min(Math.max(1, wanted), pages);
  const start = (effective - 1) * size;
  return { rows: rows.slice(start, start + size), page: effective, pages, total };
}

/**
 * The states actually present in `claims`, in the canonical state-machine
 * order, so the dropdown never offers a state no claim can match and its
 * order does not drift with the data.
 */
const STATE_ORDER = [
  "created",
  "pending_evaluation",
  "evidence_collected",
  "decided_confirmed",
  "decided_not_confirmed",
  "inconclusive",
  "disputed",
  "settled",
] as const;

export function claimStates(claims: Claim[]): string[] {
  const present = new Set(claims.map((c) => c.state));
  const known = STATE_ORDER.filter((s) => present.has(s));
  const extra = [...present]
    .filter((s) => !(STATE_ORDER as readonly string[]).includes(s))
    .sort();
  return [...known, ...extra];
}
