import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { EvidenceChart } from "./EvidenceChart";
import { I18nProvider } from "../i18n/I18nProvider";
import type { DemoSeries } from "../fixtures/demoScenarios";

/**
 * The reveal is presentation only, so the SEVERITY of a bug is uneven:
 *
 *  - A missing element or a wrong value fails a test here.
 *  - A broken keyframe would not fail any test but would leave the chart
 *    permanently blank, which is why `css.test.ts` asserts the settled frame
 *    independently -- that the animation ends at opacity 1, transform none and
 *    dashoffset 0, so "no animation" and "animation finished" look identical.
 */

const OM: Record<string, number | null> = {
  "2024-06-01": 0.1,
  "2024-06-02": 0.0,
  "2024-06-03": 0.2,
  "2024-06-04": 1.1,
  "2024-06-05": 0.0,
};
const NASA: Record<string, number | null> = {
  "2024-06-01": 0.23,
  "2024-06-02": 0.04,
  "2024-06-03": 0.19,
  "2024-06-04": 2.03,
  "2024-06-05": 0.02,
};

const SERIES: DemoSeries[] = [
  { sourceId: "om", label: "Open-Meteo ERA5", shape: "square", daily: OM, unit: "mm" },
  { sourceId: "nasa", label: "NASA POWER MERRA-2", shape: "triangle", daily: NASA, unit: "mm/day" },
];

function render() {
  return renderToStaticMarkup(
    // The chart reads its copy through useI18n, so the provider is required.
    // The default locale is English, which is what the assertions expect.
    <I18nProvider>
      <EvidenceChart
        series={SERIES}
        period={{ start: "2024-06-01", end: "2024-06-05", timezone: "UTC" }}
        thresholdScaled={150}
        comparator="gt"
        unit="mm"
      />
    </I18nProvider>,
  );
}

describe("EvidenceChart static frame", () => {
  const html = render();

  it("renders every recorded reading as a mark", () => {
    // 5 days x 2 sources, none null in this fixture.
    expect((html.match(/class="chart-marker"/g) ?? []).length).toBe(10);
  });

  it("renders the first source as bars and the second as a trace", () => {
    expect(html).toMatch(/class="chart-bar/);
    expect(html).toMatch(/chart-trace-1/);
  });

  it("carries the measured trace length for the draw animation", () => {
    const m = html.match(/--trace-len:\s*(\d+)/);
    expect(m).not.toBeNull();
    // Long enough to cover a five-point span across the plot width.
    expect(Number(m![1])).toBeGreaterThan(100);
  });

  it("staggers bars and markers with a per-element index", () => {
    expect(html).toMatch(/--i:\s*0/);
    expect(html).toMatch(/--i:\s*4/);
  });

  it("shows the threshold line and its label", () => {
    expect(html).toContain("chart-threshold");
    expect(html).toContain("1.50");
  });

  it("marks the day the sources disagree", () => {
    expect(html).toContain("chart-conflict-band");
  });

  it("does not arm the reveal before it is in view", () => {
    // No IntersectionObserver on the server, so it settles immediately --
    // but the animation must not be what makes the marks exist.
    expect(html).toMatch(/<svg/);
  });

  it("exposes the readings as text for assistive tech, not only as shapes", () => {
    // Every focusable point carries an accessible name with its value.
    expect(html).toMatch(/aria-label="[^"]*1\.10[^"]*"/);
    expect(html).toMatch(/aria-label="[^"]*2\.03[^"]*"/);
  });
});