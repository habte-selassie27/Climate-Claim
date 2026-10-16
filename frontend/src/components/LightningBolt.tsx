/**
 * A visible lightning strike, drawn alongside the rain.
 *
 * WHY A BOLT AND NOT JUST A FLASH: a screen-brightness pulse reads as a rendering
 * artefact, not as weather. What makes lightning legible as lightning is the
 * shape -- a jagged channel that forks on its way down. That is what this draws.
 *
 * STACKING, which is the part that was previously wrong: the strike layer sits
 * ABOVE the rain canvas (`.precip`, z 0) and the 3D evidence scene
 * (`.evidence-field`, z 1), and BELOW the hero copy (`.hero-inner`, z 2). An
 * earlier flash lived inside `.precip` at z 0, so it rendered behind the 3D scene
 * as a faint gradient and was effectively invisible.
 *
 * ACCESSIBILITY: decorative and aria-hidden. Nothing is communicated only by it.
 * Under `prefers-reduced-motion` it never draws -- a full-screen luminance
 * change is exactly what that setting exists to suppress, and rapid flicker is a
 * seizure risk.
 */

import { useEffect, useMemo, useState } from "react";
import { lightningStrike } from "../domain/ambience";

interface Props {
  /**
   * Monotonic strike counter from the storm clock; doubles as the generator
   * seed, so consecutive strikes never draw the same shape.
   *
   * Zero means idle and renders nothing. The clock counts from 0, so callers
   * pass `index + 1` to reserve 0 for "not yet struck".
   */
  strike: number;
}

export function LightningBolt({ strike }: Props) {
  const [armed, setArmed] = useState(false);

  // Two strikes per event, because a single bolt reads as a scratch rather than
  // as the double-strike of a real discharge.
  const first = useMemo(() => lightningStrike(strike * 2 + 1), [strike]);
  const second = useMemo(() => lightningStrike(strike * 2 + 2), [strike]);

  // Re-arm across a frame so the animation genuinely restarts on each strike.
  useEffect(() => {
    if (strike === 0) return;
    setArmed(false);
    const id = requestAnimationFrame(() => setArmed(true));
    return () => cancelAnimationFrame(id);
  }, [strike]);

  if (strike === 0) return null;

  return (
    <svg
      className={`lightning ${armed ? "lightning-armed" : ""}`}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
      data-testid="lightning-bolt"
    >
      <defs>
        {/* The hot core, plus a wide soft bloom around it. Two strokes of the
            same path is far cheaper than a real blur filter and reads better
            against a busy scene. */}
        <filter id="bolt-glow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="1.4" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Branches first, so the core draws over them. */}
      <g className="lightning-branches">
        {first.branches.map((d, i) => (
          <path key={`b1-${i}`} d={d} />
        ))}
        {second.branches.map((d, i) => (
          <path key={`b2-${i}`} d={d} />
        ))}
      </g>

      {/* Hot cores. `vector-effect: non-scaling-stroke` in CSS keeps the width
          even though the viewBox is stretched to the hero. */}
      <g className="lightning-core" filter="url(#bolt-glow)">
        <path d={first.main} />
        <path d={second.main} />
      </g>
    </svg>
  );
}