/**
 * Formatting helpers for the contract's scaled integers.
 *
 * The contract stores every numeric value as an integer scaled by 100
 * (SCALE_DECIMALS) to avoid floats. Values arriving from the RPC can be number,
 * bigint, or string depending on magnitude, so `toNumber` normalises first.
 */

import { SCALE_DECIMALS } from "../config/contracts";

export function toNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string") {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

/** 120 -> "1.20" */
export function fromScaled(value: unknown, decimals = SCALE_DECIMALS): string {
  const n = toNumber(value);
  return (n / 10 ** decimals).toFixed(decimals);
}

/** 120 -> "1.20 mm" */
export function scaledWithUnit(value: unknown, unit: string): string {
  return `${fromScaled(value)} ${unit}`;
}

/** Microdegrees -> "48.8928" (5 dp, matching the contract's _fmt_coord). */
export function microDegrees(value: unknown): string {
  return (toNumber(value) / 1_000_000).toFixed(4);
}

export function coordLabel(lat: unknown, lon: unknown): string {
  return `${microDegrees(lat)}, ${microDegrees(lon)}`;
}

/** 0x1234...abcd */
export function truncateHash(hash: string, lead = 6, tail = 4): string {
  if (!hash) return "";
  if (hash.length <= lead + tail + 1) return hash;
  return `${hash.slice(0, lead)}…${hash.slice(-tail)}`;
}

export function truncateAddress(address: string): string {
  if (!address) return "";
  if (address.length <= 12) return address;
  return `${address.slice(0, 8)}…${address.slice(-6)}`;
}

/** Days between two ISO dates, inclusive of both ends. */
export function inclusiveDays(start: string, end: string): number {
  const a = Date.parse(`${start}T00:00:00Z`);
  const b = Date.parse(`${end}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / 86_400_000) + 1;
}

/** "2024-06-01 → 2024-06-05 (5 days)" */
export function periodLabel(start: string, end: string): string {
  return `${start} → ${end} (${inclusiveDays(start, end)} days)`;
}

/** Every ISO date in an inclusive range. */
export function dateRange(start: string, end: string): string[] {
  const out: string[] = [];
  let cur = Date.parse(`${start}T00:00:00Z`);
  const endMs = Date.parse(`${end}T00:00:00Z`);
  if (Number.isNaN(cur) || Number.isNaN(endMs)) return out;
  for (; cur <= endMs; cur += 86_400_000) {
    out.push(new Date(cur).toISOString().slice(0, 10));
  }
  return out;
}