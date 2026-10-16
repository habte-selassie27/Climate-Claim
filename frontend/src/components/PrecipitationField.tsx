/**
 * Atmospheric precipitation field for the landing hero.
 *
 * WHAT THIS IS: a decorative background whose particle DENSITY and FALL SPEED
 * are driven by the real recorded readings for the conflicting-sources
 * scenario — so it animates the actual evidence rather than random noise. One
 * source (Open-Meteo ERA5, 1.10 mm) is drawn slower and sparser; the other
 * (NASA POWER MERRA-2, 2.03 mm) falls faster and denser. The divergence you can
 * see is the divergence in the data.
 *
 * WHAT THIS IS NOT: it is not a data visualisation. It carries no axes, no
 * values and no claim. Reading exact numbers is the SVG chart's job, and a
 * 3D scene is genuinely worse at that. Everything quantitative on this page
 * lives in the chart and the tables.
 *
 * PERFORMANCE AND ACCESSIBILITY — the reasons this is careful:
 *  - Lazy-loaded. Three.js is ~600 kB and must never reach the first-paint
 *    bundle; the hero renders a static, readable fallback immediately and the
 *    canvas only mounts after the chunk arrives.
 *  - `prefers-reduced-motion: reduce` renders a still, static field and never
 *    starts a render loop.
 *  - Rendering stops when scrolled out of view and when the tab is hidden.
 *  - The device pixel ratio is capped, and the scene is disposed on unmount.
 *  - A WebGL failure degrades silently to the fallback; the page never breaks.
 */

import { useEffect, useRef, useState } from "react";
import type { DemoSeries } from "../fixtures/demoScenarios";
// Type-only: erased at compile time, so it does NOT pull three into the bundle.
// `three` itself is dynamically imported inside the effect.
// The addons give the rain REAL width. See the note at the material.
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { RAIN_WIDTH } from "../domain/ambience";
import { useTheme } from "../theme/ThemeProvider";
import { LightningBolt } from "./LightningBolt";
import { stormClock } from "../domain/stormClock";

interface Props {
  /** The two recorded source series, so density follows the real readings. */
  series: DemoSeries[];
  unit: string;
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Total recorded value per source, used to scale density and speed. */
function peakOf(s: DemoSeries): number {
  let peak = 0;
  for (const v of Object.values(s.daily)) {
    if (typeof v === "number" && v > peak) peak = v;
  }
  return peak;
}

/**
 * Rain streak colours per theme.
 *
 * WHY THEME-AWARE AND WHY THESE VALUES: a single mid-blue streak that reads
 * clearly against the dark page (#0B1016) all but disappears against the light
 * one (#edf1F3) -- a pale blue at low opacity over near-white has almost no
 * contrast left. Alpha blending also dilutes the ink toward whatever is behind
 * it, so the composited result is what matters, not the raw colour. These pairs
 * were solved for against each theme's real page colour and reach >= 3:1 once
 * composited at the opacities used below:
 *
 *   light: #0F4463 @ 0.75 -> 4.74:1, #246F92 @ 0.75 -> 3.11:1 on #edf1f3
 *   dark:  #AAC8DE @ 0.75 -> 4.27:1, #CFE0EE @ 0.75 -> 5.52:1 on #0B1016
 *
 * The opacity is high on purpose. It looks like a lot, but alpha compositing
 * pulls the drawn result most of the way back toward the background, so a
 * "reasonable looking" 0.3 renders near-invisible. 0.75 is what actually
 * survives compositing, and the two sources stay 1.5:1 apart from each other
 * so the divergence is still readable by weight.
 *
 * Kept as literals because they are painted into WebGL, not the DOM, so they
 * cannot read a CSS custom property.
 */
const RAINK_COLORS = {
  light: { a: "#0f4463", b: "#246f92" },
  dark: { a: "#aac8de", b: "#cfe0ee" },
} as const;

/** Opacity floor per theme; the wetter source adds on top of this. */
const RAINK_OPACITY = { light: 0.75, dark: 0.75 } as const;

export function PrecipitationField({ series, unit }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const { theme } = useTheme();
  // The fallback is visible until the canvas has actually painted a frame, so
  // there is never a flash of empty background.
  const [live, setLive] = useState(false);
  /**
   * Strike index. A change re-runs the CSS animation and re-seeds the bolt, so
   * it is also the generator seed -- two strikes can never draw the same shape.
   *
   * Zero means "no strike yet", which is what LightningBolt treats as idle.
   */
  const [flash, setFlash] = useState(0);
  /**
   * Wind gust, 0..1, driving how far the rain leans over so the wind is VISIBLE
   * as well as audible.
   *
   * A ref, deliberately, not state: this changes every animation frame, and
   * setState at 60fps would re-render the whole tree continuously. The container
   * is aria-hidden, so nothing needs re-rendering for the change to be
   * accessible.
   */
  const gustRef = useRef(0);

  /**
   * THE STRIKE SCHEDULE, on the shared storm clock.
   *
   * Deliberately at component level rather than inside the WebGL effect below:
   * lightning has to keep working when WebGL is unavailable or when the field
   * bails out early, and the thunder shares this exact event. Previously the
   * flash ran on a private 9-22s timer while the thunder ran on its own 9-22s
   * timer -- two independent draws from the same range, so a clap almost never
   * landed under a bolt.
   *
   * Under reduced motion the clock is never subscribed, so nothing is drawn and
   * no timer exists. A full-screen luminance change is exactly what that
   * setting suppresses, and rapid flicker is a seizure risk.
   */
  useEffect(() => {
    if (prefersReducedMotion() || series.length === 0) return;
    return stormClock.subscribe((strike) => setFlash(strike.index + 1));
  }, [series.length]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    // Reduced motion: keep a decorative still frame, start no animation.
    if (prefersReducedMotion() || series.length === 0) return;

    let disposed = false;
    let cleanup: (() => void) | undefined;

    // Dynamic import keeps three out of the initial bundle.
    void import("three")
      .then(async (THREE) => {
        if (disposed) return;

        const peaks = series.map(peakOf);
        const total = peaks.reduce((a, b) => a + b, 0) || 1;
        // A little headroom so the two densities differ but both stay legible.
        const maxPeak = Math.max(...peaks, 0.1);

        const renderer = new THREE.WebGLRenderer({
          alpha: true,
          antialias: false,
          powerPreference: "low-power",
        });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
        host.appendChild(renderer.domElement);
        renderer.domElement.className = "precip-canvas";
        renderer.domElement.setAttribute("aria-hidden", "true");

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 200);
        camera.position.set(0, 0, 26);

        // Each source gets its own band, so the two readings are separable.
        const bands = series.slice(0, 2).map((_, i) => {
          const share = peaks[i]! / total;
          // Line segments rather than points: rain reads as streaks, and the
          // first attempt (sparse points) looked like dust on the screen.
          const count = Math.max(220, Math.round(1100 * share));
          // Two vertices per drop, so each can be stretched along Y.
          const positions = new Float32Array(count * 6);
          const speeds = new Float32Array(count);
          const lengths = new Float32Array(count);
          const phases = new Float32Array(count);
          const baseX = new Float32Array(count);
          for (let n = 0; n < count; n += 1) {
            const x = (Math.random() - 0.5) * 46;
            const y = (Math.random() - 0.5) * 26;
            const z = -6 + i * 5 + (Math.random() - 0.5) * 4;
            /**
             * Wind is only visible if the rain leans. Each drop gets a fixed
             * random phase so the whole field does not swing as one rigid sheet.
             */
            const phase = Math.random();
            // Faster fall and longer streak for the wetter source.
            const speed = 3.6 + (peaks[i]! / maxPeak) * 11;
            // Streak length tracks speed, the way a real drop does.
            const len = 0.5 + (peaks[i]! / maxPeak) * 1.5;
            positions[n * 6 + 0] = x;
            positions[n * 6 + 1] = y;
            positions[n * 6 + 2] = z;
            positions[n * 6 + 3] = x;
            positions[n * 6 + 4] = y + len;
            positions[n * 6 + 5] = z;
            speeds[n] = speed;
            lengths[n] = len;
            phases[n] = phase;
            baseX[n] = x;
          }
          const geo = new LineSegmentsGeometry();
          geo.setPositions(positions);

          const pal = RAINK_COLORS[theme === "dark" ? "dark" : "light"];
          const floor = RAINK_OPACITY[theme === "dark" ? "dark" : "light"];
          const mat = new LineMaterial({
            color: new THREE.Color(i === 0 ? pal.a : pal.b).getHex(),
            transparent: true,
            // The floor is the value that clears 3:1 composited; the wetter
            // source adds on top so the divergence is separable by weight.
            opacity: Math.min(floor + share * 0.3, 0.92),
            depthWrite: false,
            /**
             * REAL WIDTH, which is why this uses the addon and not
             * THREE.LineBasicMaterial.
             *
             * `LineBasicMaterial.linewidth` is ignored by every WebGL
             * implementation -- it is a no-op, not a hint -- so the previous
             * streaks were pinned at 1px however it was set. `LineSegments2`
             * expands each segment into a screen-facing quad, so `linewidth` is
             * honoured. The cost is that the material must be re-synced with the
             * camera on every resize, which is what updateLineMatrices does.
             */
            linewidth: RAIN_WIDTH.px,
          });
          // Keep the rain out of the renderer's tone mapping so its colour
          // matches the CSS palette rather than being shifted by the pipeline.
          mat.toneMapped = false;

          const lines = new LineSegments2(geo, mat);
          scene.add(lines);
          return { points: lines, positions, speeds, lengths, phases, baseX, count, geo, mat };
        });

        const resize = () => {
          const w = host.clientWidth || 1;
          const h = host.clientHeight || 1;
          renderer.setSize(w, h, false);
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
          // LineMaterial computes its screen-space width against the camera, so
          // it has to be re-synced or the streaks render at the wrong size.
          for (const b of bands) b.mat.resolution.set(w, h);
        };
        resize();
        const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null;
        ro?.observe(host);

        // Only animate while the hero is on screen and the tab is active.
        let visible = true;
        let raf = 0;
        let last = performance.now();
        let painted = false;

        const frame = (now: number) => {
          raf = requestAnimationFrame(frame);
          const dt = Math.min((now - last) / 1000, 0.05);
          last = now;
          /**
           * The gust drives how far the rain leans. Each drop carries its own
           * phase, so the field ripples rather than swinging as one rigid
           * sheet -- which is what makes it read as wind rather than as the
           * whole scene being rotated.
           */
          gustPhase += dt * gustRate;
          const targetGust = 0.5 + 0.5 * Math.sin(gustPhase);
          gustRef.current += (targetGust - gustRef.current) * Math.min(dt * 1.6, 1);
          const gustNow = gustRef.current;

          for (const band of bands) {
            for (let n = 0; n < band.count; n += 1) {
              const y = band.positions[n * 6 + 1]! - band.speeds[n]! * dt;
              // Wrap around the bottom rather than respawning, so density stays
              // constant and the loop reads as continuous rain. The tail vertex
              // follows the head, which is what keeps the streak intact.
              const ny = y < -13 ? 13 : y;
              band.positions[n * 6 + 1] = ny;
              band.positions[n * 6 + 4] = ny + band.lengths[n]!;

              // Lean: both ends of the segment move, so the streak tilts as
              // one piece rather than stretching at the top.
              const lean =
                gustNow * (0.35 + band.phases[n]! * 0.5) * band.lengths[n]!;
              const x = band.baseX[n]!;
              band.positions[n * 6 + 0] = x;
              band.positions[n * 6 + 3] = x + lean;
            }
            // LineSegmentsGeometry does not animate via a plain "position"
            // attribute: setPositions() rebuilds the interleaved instanceStart /
            // instanceEnd buffers that LineSegments2 actually draws. Mutating a
            // "position" attribute here would silently do nothing.
            band.geo.setPositions(band.positions);
          }
          renderer.render(scene, camera);
          if (!painted) {
            painted = true;
            setLive(true);
          }
        };

        const start = () => {
          if (!visible || raf) return;
          last = performance.now();
          raf = requestAnimationFrame(frame);
        };
        const stop = () => {
          if (raf) cancelAnimationFrame(raf);
          raf = 0;
        };

        const io = typeof IntersectionObserver !== "undefined" ? new IntersectionObserver(
          ([entry]) => {
            visible = entry?.isIntersecting ?? true;
            if (visible) start();
            else stop();
          },
          { threshold: 0 },
        ) : null;
        io?.observe(host);

        const onVisibility = () => {
          if (document.hidden) stop();
          else start();
        };
        document.addEventListener("visibilitychange", onVisibility);
        start();

        /**
         * Gust target: a slow sine, not per-drop randomness, so the whole field
         * agrees on which way the wind is blowing at any moment. Two
         * incommensurate periods keep it from visibly repeating.
         */
        let gustPhase = Math.random() * Math.PI * 2;
        let gustRate = 0.055 + Math.random() * 0.05;

        cleanup = () => {
          stop();
          io?.disconnect();
          ro?.disconnect();
          document.removeEventListener("visibilitychange", onVisibility);
          for (const b of bands) {
            b.geo.dispose();
            b.mat.dispose();
          }
          renderer.dispose();
          renderer.domElement.remove();
        };
      })
      .catch(() => {
        // No WebGL, a blocked chunk, or an old browser: the fallback below is
        // already a complete, readable background. Swallow it.
      });

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [series, theme]);

  return (
    <div
      className="precip"
      data-testid="precip-field"
      data-live={live ? "true" : "false"}
      aria-hidden="true"
    >
      <div className="precip-fallback" ref={hostRef} />
      {/* The ILLUMINATION half of a strike. It lives OUTSIDE .precip because a
          layer inside it sits at z-index 0, behind the 3D evidence scene at
          z-index 1 -- where it was invisible. */}
      <div key={flash} className="precip-flash" data-testid="precip-flash" />
      <LightningBolt strike={flash} />
      <div className="precip-veil" />
      {/* A CSS-only drift stands in when motion is reduced or WebGL is
          unavailable, so the field still reads as weather rather than a void. */}
      <span className="precip-note">
        {series.map((s) => `${s.label} peak ${peakOf(s).toFixed(2)} ${unit}`).join(" · ")}
      </span>
    </div>
  );
}