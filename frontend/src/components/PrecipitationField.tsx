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
import type { BufferAttribute } from "three";

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

export function PrecipitationField({ series, unit }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  // The fallback is visible until the canvas has actually painted a frame, so
  // there is never a flash of empty background.
  const [live, setLive] = useState(false);

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
          for (let n = 0; n < count; n += 1) {
            const x = (Math.random() - 0.5) * 46;
            const y = (Math.random() - 0.5) * 26;
            const z = -6 + i * 5 + (Math.random() - 0.5) * 4;
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
          }
          const geo = new THREE.BufferGeometry();
          geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));

          const mat = new THREE.LineBasicMaterial({
            color: new THREE.Color(i === 0 ? "#7ba6c6" : "#b9cfdf"),
            transparent: true,
            opacity: 0.26 + share * 0.34,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
          });
          const lines = new THREE.LineSegments(geo, mat);
          scene.add(lines);
          return { points: lines, positions, speeds, lengths, count, geo, mat };
        });

        const resize = () => {
          const w = host.clientWidth || 1;
          const h = host.clientHeight || 1;
          renderer.setSize(w, h, false);
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
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
          for (const band of bands) {
            for (let n = 0; n < band.count; n += 1) {
              const y = band.positions[n * 6 + 1]! - band.speeds[n]! * dt;
              // Wrap around the bottom rather than respawning, so density stays
              // constant and the loop reads as continuous rain. The tail vertex
              // follows the head, which is what keeps the streak intact.
              const ny = y < -13 ? 13 : y;
              band.positions[n * 6 + 1] = ny;
              band.positions[n * 6 + 4] = ny + band.lengths[n]!;
            }
            const attr = band.geo.getAttribute("position") as BufferAttribute;
            attr.needsUpdate = true;
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
  }, [series]);

  return (
    <div
      className="precip"
      data-testid="precip-field"
      data-live={live ? "true" : "false"}
      aria-hidden="true"
    >
      <div className="precip-fallback" ref={hostRef} />
      <div className="precip-veil" />
      {/* A CSS-only drift stands in when motion is reduced or WebGL is
          unavailable, so the field still reads as weather rather than a void. */}
      <span className="precip-note">
        {series.map((s) => `${s.label} peak ${peakOf(s).toFixed(2)} ${unit}`).join(" · ")}
      </span>
    </div>
  );
}