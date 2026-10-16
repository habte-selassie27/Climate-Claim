import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Guards the chart's CSS animation contract.
 *
 * WHY THIS EXISTS: a broken keyframe fails SILENTLY. Nothing throws, every
 * component test still passes -- because the DOM is correct -- but the chart
 * renders permanently blank, which for this project means the evidence is
 * invisible. So the settled frame is asserted directly:
 *
 *   - every animated property ends at its static value
 *   - every animation is `forwards`, so the end state persists
 *   - reduced motion disables all of them and forces the static frame
 *
 * This is a source-text check, not a rendering check, because there is no DOM
 * layout or animation engine under vitest here. It is deliberately blunt: it
 * would not catch a syntactically valid animation that lands on the wrong
 * value, but it does catch the realistic failure (a missing keyframe, a missing
 * `forwards`, or a property that never returns to normal).
 */

const css = readFileSync(
  fileURLToPath(new URL("../styles/global.css", import.meta.url)),
  "utf8",
);

/** Just the chart-reveal block, so unrelated CSS cannot satisfy an assertion. */
function revealBlock(): string {
  const start = css.indexOf(".chart-reveal");
  expect(start).toBeGreaterThan(-1);
  const end = css.indexOf("@media (prefers-reduced-motion", start);
  return css.slice(start, end === -1 ? undefined : end);
}

/** Every `.chart-reveal X { ... }` selector, with its body. */
function revealRules(): { selector: string; body: string }[] {
  const out: { selector: string; body: string }[] = [];
  const re = /\.chart-reveal\s+([^{]+)\{([^}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(revealBlock())) !== null) {
    out.push({ selector: m[1]!.trim(), body: m[2]! });
  }
  return out;
}

describe("chart reveal animation", () => {
  const rules = revealRules();

  it("declares the reveal rules", () => {
    expect(rules.length).toBeGreaterThan(5);
  });

  it("every animation runs forwards so the end state persists", () => {
    // Without `forwards` the element snaps back to its pre-animation state,
    // which for `opacity: 0` and `scaleY(0)` means a permanently blank chart.
    const animated = rules.filter((r) => /animation:/.test(r.body));
    expect(animated.length).toBeGreaterThan(5);
    for (const r of animated) {
      expect(`${r.selector} ${r.body}`).toMatch(/forwards/);
    }
  });

  it("bars rise from nothing to full height", () => {
    const rise = /\@keyframes chart-rise\s*\{([\s\S]*?)\n\}/.exec(css)?.[1] ?? "";
    expect(rise).toMatch(/from\s*\{[^}]*scaleY\(0\)/);
    expect(rise).toMatch(/to\s*\{[^}]*scaleY\(1\)/);
  });

  it("the trace finishes fully drawn", () => {
    const draw = /\@keyframes chart-draw\s*\{([\s\S]*?)\n\}/.exec(css)?.[1] ?? "";
    expect(draw).toMatch(/stroke-dashoffset:\s*0/);
  });

  it("fading elements end at full opacity", () => {
    const fade = /\@keyframes chart-fade\s*\{([\s\S]*?)\n\}/.exec(css)?.[1] ?? "";
    expect(fade).toMatch(/from\s*\{[^}]*opacity:\s*0/);
    expect(fade).toMatch(/to\s*\{[^}]*opacity:\s*1/);
  });

  it("the disagreement band ends at its resting opacity", () => {
    const band = /\@keyframes chart-band\s*\{([\s\S]*?)\n\}/.exec(css)?.[1] ?? "";
    expect(band).toMatch(/to\s*\{[^}]*opacity:\s*0\.75/);
  });

  it("every keyframe referenced by a rule is defined", () => {
    const defined = new Set(
      [...css.matchAll(/\@keyframes\s+([a-z-]+)\s*\{/g)].map((m) => m[1]!),
    );
    for (const r of rules) {
      for (const m of r.body.matchAll(/animation:\s*([a-z-]+)/g)) {
        expect(defined).toContain(m[1]!);
      }
    }
  });

  it("stagger delays reference an index that the chart actually sets", () => {
    // `--i` is written inline per bar/marker; if it were missing the delay
    // would collapse to 0 and the staircase effect would be lost.
    expect(revealBlock()).toMatch(/--i/);
  });

  it("reduced motion disables every chart animation and forces the static frame", () => {
    const start = css.indexOf("@media (prefers-reduced-motion: reduce) {\n  .chart-reveal");
    expect(start).toBeGreaterThan(-1);
    const block = css.slice(start, css.indexOf("}", css.indexOf("animation: none !important", start)));
    expect(block).toMatch(/animation:\s*none\s*!important/);
    expect(block).toMatch(/opacity:\s*1/);
    expect(block).toMatch(/transform:\s*none/);
    expect(block).toMatch(/stroke-dashoffset:\s*0/);
  });
});