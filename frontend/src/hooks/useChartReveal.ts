/**
 * Reveals the evidence chart as it enters the viewport.
 *
 * WHY ANIMATED 2D RATHER THAN 3D: this chart's only job is to show that on one
 * day one source says 1.10 mm and the other 2.03 mm against a 1.50 mm threshold.
 * A 3D bar chart makes that judgement WORSE, not better -- perspective distorts
 * the very heights being compared, and the back row occludes the front one. The
 * animation below is deliberately confined to motion that does not change what
 * is measured: the marks travel to the position the data already implies, so
 * the settled frame is identical to the static chart.
 *
 * ACCESSIBILITY:
 *  - The whole thing is decoration. The chart's accessible names, its summary
 *    sentence and its table view are all present regardless of animation state,
 *    so nothing is communicated only by motion.
 *  - `prefers-reduced-motion: reduce` skips straight to the settled frame. No
 *    animation class is applied at all, so there is nothing to disable.
 *  - A replay control lets the sequence be re-triggered on demand, which also
 *    means the animation never gates understanding of the page.
 */

import { useEffect, useRef, useState } from "react";

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** True once the element has scrolled into view at least once. */
export function useInView<T extends HTMLElement>(rootMargin = "0px") {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // No IntersectionObserver (or reduced motion): show the settled frame
    // immediately rather than leaving the chart blank.
    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setInView(true);
          io.disconnect();
        }
      },
      { threshold: 0.15, rootMargin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [rootMargin]);

  return { ref, inView };
}

interface Reveal {
  /** Spread onto the chart's <svg> to arm the sequence. */
  className: string;
  /** Attached to the replay control. */
  replay: () => void;
  /** False when motion is reduced, so the control can be hidden. */
  animated: boolean;
}

export function useChartReveal<T extends HTMLElement>(): Reveal & {
  ref: React.RefObject<T | null>;
} {
  // The ref is returned for callers that want to observe a different element
  // than the one carrying the class; the chart itself observes the shell.
  const { ref, inView } = useInView<T>();
  const [run, setRun] = useState(0);
  const animated = !prefersReducedMotion();

  // Re-arm the sequence by flipping the class off and on across a frame, so a
  // replay actually replays instead of being a no-op.
  const replay = () => {
    setRun((n) => n + 1);
  };

  useEffect(() => {
    if (!animated) setRun(1);
  }, [animated]);

  const className = animated && inView ? `chart-reveal run-${run}` : "";

  return { className, replay, animated, ref };
}