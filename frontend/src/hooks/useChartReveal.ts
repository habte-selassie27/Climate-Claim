/**
 * Reveals the evidence chart as it enters the viewport.
 *
 * WHY BOTH 2D AND 3D: the 3D view is the default -- it is the version people
 * actually watch, and the version demos run on. The 2D view stays one click
 * away because perspective genuinely distorts the comparison this panel
 * exists to make: heights read through a rotated camera, and a far column can
 * hide a near one. Where the exact relationship matters, the flat frame and
 * the table remain the honest forms. Neither view carries data the other
 * lacks, and the summary sentence and table are written for screen readers
 * regardless of which view is on screen.
 *
 * In both views the animation is confined to motion that does not change what
 * is measured: marks travel to the position the data already implies, so the
 * settled frame is identical to the static one.
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

import { useCallback, useEffect, useRef, useState } from "react";

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
  /** Applied to the chart shell to arm the 2D keyframe sequence. */
  className: string;
  /** Attached to the replay control. */
  replay: () => void;
  /** False when motion is reduced, so the control can be hidden. */
  animated: boolean;
  /** True once the observed element has entered the viewport. */
  inView: boolean;
  /** Replay counter; the 3D scene re-runs its growth when this changes. */
  run: number;
}

export function useChartReveal<T extends HTMLElement>(): Reveal & {
  /**
   * A CALLBACK ref, not the underlying RefObject.
   *
   * React 18's `ref` prop is typed `Ref<T>`, and `RefObject<T | null>` is not
   * assignable to it, so passing the object straight through is a type error.
   * The callback form is stable, so it never detaches and reattaches the
   * IntersectionObserver on a re-render.
   */
  ref: (node: T | null) => void;
} {
  const { ref: refObject, inView } = useInView<T>();
  const [run, setRun] = useState(0);
  const animated = !prefersReducedMotion();

  const ref = useCallback(
    (node: T | null) => {
      refObject.current = node;
    },
    [refObject],
  );

  // Re-arm the sequence by flipping the class off and on across a frame, so a
  // replay actually replays instead of being a no-op.
  const replay = () => {
    setRun((n) => n + 1);
  };

  useEffect(() => {
    if (!animated) setRun(1);
  }, [animated]);

  const className = animated && inView ? `chart-reveal run-${run}` : "";

  return { className, replay, animated, inView, run, ref };
}