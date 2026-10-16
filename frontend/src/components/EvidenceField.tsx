/**
 * Evidence field: the Home hero scene from the supplied "Three.js UI" mock.
 *
 * WHAT IT DRAWS, AND WHY IT IS HONEST: the same recorded readings the chart
 * and comparison table below use. One bar per source per day (the first source
 * a box, the second a cone), the policy threshold as a translucent plane, and
 * an amber halo on the day the sources actually disagree. Values, scale, day
 * positions and the halo day all come from `src/domain/fieldLayout.ts` and
 * `src/domain/sourceCompare.ts` -- the same modules the table and the
 * deterministic-chain contrast use -- so the scene cannot drift from the
 * chart: it is not allowed to compute anything on its own. A day a source did
 * not return gets no bar; a missing reading is not a zero.
 *
 * WHAT IT IS NOT: a quantitative readout. There are no axes and no values on
 * the canvas; every number a visitor acts on lives in the chart and tables.
 * The legend names the sources and the threshold, the tip names the
 * disagreement day, and the whole component is aria-hidden because all of it
 * is repeated accessibly below.
 *
 * Only the first two sources are drawn -- more would be unreadable at hero
 * size, and the chart and tables carry the rest.
 *
 * PERFORMANCE AND ACCESSIBILITY (same discipline as PrecipitationField):
 *  - three.js is dynamically imported, so the ~600 kB never reaches the
 *    first-paint bundle; a static wash stands in until the first frame paints.
 *  - `prefers-reduced-motion: reduce` renders one still frame and starts no
 *    render loop. Dragging still redraws -- user-initiated motion is allowed.
 *  - The loop stops when the hero scrolls out of view or the tab is hidden.
 *  - Device pixel ratio is capped, and every geometry, material and texture is
 *    disposed on unmount. A WebGL failure degrades silently to the fallback.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import type * as ThreeNS from "three";
import { dateRange, fromScaled } from "../domain/format";
import {
  FIELD_SCALE,
  barHeight,
  dayLabel,
  dayX,
  disagreementIndex,
} from "../domain/fieldLayout";
import { compareSources } from "../domain/sourceCompare";
import type { DemoSeries } from "../fixtures/demoScenarios";
import { useI18n } from "../i18n/I18nProvider";

interface Props {
  /** The recorded source series, so the scene follows the real readings. */
  series: DemoSeries[];
  period: { start: string; end: string };
  thresholdScaled: number;
  comparator: string;
  unit: string;
}

// Scene colours. Literal because they are painted into WebGL rather than the
// DOM; they are the dark palette's --isobar / --lichen / --threshold-ink /
// --amber-flag, so the scene and the page agree as one design in both themes.
const BLUE = 0x6aa7e8;
const GREEN = 0x5fd3a8;
const RED = 0xe5675a;
const AMBER = 0xe8b04b;
const NET_LINE = 0x33435a;
const GRID_MAJOR = 0x33435a;
const GRID_MINOR = 0x1c2733;
const LABEL_INK = "#9aa5b1";

/** The mock's vy = 0.002 rad/frame at 60 Hz, made time-based. */
const ROTATE_SPEED = 0.12;
/** The mock's net drift, t * 0.02. */
const NET_SPEED = 0.02;
/** Above this host width the scene sits beside the copy, as in the mock. */
const WIDE_AT = 860;
/** Notch ring radius in world units (the mock's 0.5-0.6 ring). */
const HALO_INNER = 0.5;

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function EvidenceField({ series, period, thresholdScaled, comparator, unit }: Props) {
  const { t, locale } = useI18n();
  const hostRef = useRef<HTMLDivElement | null>(null);
  // The fallback stays visible until the canvas has actually painted a frame.
  const [live, setLive] = useState(false);

  const dates = useMemo(
    () => dateRange(period.start, period.end),
    [period.start, period.end],
  );
  const splitDays = useMemo(
    () => compareSources(series, dates, thresholdScaled, comparator).splitDays,
    [series, dates, thresholdScaled, comparator],
  );
  const tipDay = splitDays[0];

  useEffect(() => {
    const host = hostRef.current;
    if (!host || series.length === 0 || dates.length === 0) return;

    let disposed = false;
    let cleanup: (() => void) | undefined;
    const reduce = prefersReducedMotion();

    // Dynamic import keeps three out of the initial bundle.
    void import("three")
      .then((THREE) => {
        if (disposed) return;

        // ---- data -> geometry ------------------------------------------
        const count = dates.length;
        const shown = series.slice(0, 2);
        const heights = shown.map((s) => dates.map((d) => barHeight(s.daily[d])));
        const splitIndex = disagreementIndex(splitDays, dates);
        const planeY = (thresholdScaled / 100) * FIELD_SCALE;

        // ---- renderer, camera ------------------------------------------
        const renderer = new THREE.WebGLRenderer({
          alpha: true,
          antialias: true,
          powerPreference: "low-power",
        });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        const canvas = renderer.domElement;
        canvas.className = "evidence-field-canvas";
        canvas.setAttribute("aria-hidden", "true");
        host.appendChild(canvas);

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
        camera.position.set(0, 3.4, 10);
        camera.lookAt(0, 1.4, 0);

        // ---- the particle net behind the chart (the mock's backdrop) ---
        const NET_COUNT = 150;
        const netPoints: ThreeNS.Vector3[] = [];
        for (let i = 0; i < NET_COUNT; i += 1) {
          netPoints.push(
            new THREE.Vector3(
              (Math.random() - 0.5) * 26,
              (Math.random() - 0.5) * 14,
              (Math.random() - 0.5) * 14 - 4,
            ),
          );
        }
        const dotPositions = new Float32Array(NET_COUNT * 3);
        netPoints.forEach((p, i) => {
          dotPositions.set([p.x, p.y, p.z], i * 3);
        });
        const dotGeo = new THREE.BufferGeometry();
        dotGeo.setAttribute("position", new THREE.BufferAttribute(dotPositions, 3));
        const dots = new THREE.Points(
          dotGeo,
          new THREE.PointsMaterial({ color: BLUE, size: 0.07, transparent: true, opacity: 0.7 }),
        );

        const links: number[] = [];
        for (let a = 0; a < NET_COUNT; a += 1) {
          for (let b = a + 1; b < NET_COUNT; b += 1) {
            if (netPoints[a]!.distanceTo(netPoints[b]!) < 3) {
              links.push(
                netPoints[a]!.x, netPoints[a]!.y, netPoints[a]!.z,
                netPoints[b]!.x, netPoints[b]!.y, netPoints[b]!.z,
              );
            }
          }
        }
        const linkGeo = new THREE.BufferGeometry();
        linkGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(links), 3));
        const net = new THREE.Group();
        net.add(
          dots,
          new THREE.LineSegments(
            linkGeo,
            new THREE.LineBasicMaterial({ color: NET_LINE, transparent: true, opacity: 0.35 }),
          ),
        );
        scene.add(net);

        // ---- the chart group -------------------------------------------
        const group = new THREE.Group();
        scene.add(group);
        group.add(new THREE.GridHelper(8, 16, GRID_MAJOR, GRID_MINOR));

        // Geometry is shared between meshes of the same kind -- scale is per
        // mesh, so one unit box and one unit cone are enough.
        const boxGeo = new THREE.BoxGeometry(0.4, 1, 0.4);
        const coneGeo = new THREE.ConeGeometry(0.24, 1, 24);
        const boxMat = new THREE.MeshStandardMaterial({ color: BLUE, roughness: 0.4, metalness: 0.2 });
        const coneMat = new THREE.MeshStandardMaterial({ color: GREEN, roughness: 0.4, metalness: 0.2 });

        interface Bar {
          mesh: ThreeNS.Mesh;
          height: number;
          day: number;
        }
        const bars: Bar[] = [];
        dates.forEach((_date, i) => {
          const x = dayX(i, count);
          shown.forEach((_series, s) => {
            const h = heights[s]![i]!;
            if (h === null) return; // no reading, no bar -- never a fake zero
            const mesh = new THREE.Mesh(s === 0 ? boxGeo : coneGeo, s === 0 ? boxMat : coneMat);
            mesh.position.x = x + (s === 0 ? -0.3 : 0.3);
            group.add(mesh);
            bars.push({ mesh, height: h, day: i });
          });
        });

        // Day labels: canvas sprites, "06-01", the mock's exact type treatment.
        dates.forEach((d, i) => {
          const label = document.createElement("canvas");
          label.width = 128;
          label.height = 48;
          const g = label.getContext("2d");
          if (g) {
            g.fillStyle = LABEL_INK;
            g.font = "26px monospace";
            g.textAlign = "center";
            g.fillText(d.slice(5), 64, 32);
          }
          const sprite = new THREE.Sprite(
            new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(label), transparent: true }),
          );
          sprite.scale.set(1, 0.375, 1);
          sprite.position.set(dayX(i, count), 0.05, 1.1);
          group.add(sprite);
        });

        // Threshold plane at its true height relative to the bars.
        const plane = new THREE.Mesh(
          new THREE.PlaneGeometry(8, 2.4),
          new THREE.MeshBasicMaterial({ color: RED, transparent: true, opacity: 0.14, side: THREE.DoubleSide }),
        );
        plane.rotation.x = -Math.PI / 2;
        plane.position.y = planeY;
        group.add(plane);
        group.add(
          new THREE.LineLoop(
            new THREE.BufferGeometry().setFromPoints([
              new THREE.Vector3(-4, planeY, -1.2),
              new THREE.Vector3(4, planeY, -1.2),
              new THREE.Vector3(4, planeY, 1.2),
              new THREE.Vector3(-4, planeY, 1.2),
            ]),
            new THREE.LineBasicMaterial({ color: RED }),
          ),
        );

        // Halo: only on a day the comparison module calls a split. No split
        // day, no halo -- the scene does not invent a disagreement.
        let halo: ThreeNS.Mesh | null = null;
        let haloMat: ThreeNS.MeshBasicMaterial | null = null;
        if (splitIndex >= 0) {
          haloMat = new THREE.MeshBasicMaterial({ color: AMBER, transparent: true, side: THREE.DoubleSide });
          halo = new THREE.Mesh(new THREE.RingGeometry(HALO_INNER, 0.6, 48), haloMat);
          halo.rotation.x = -Math.PI / 2;
          halo.position.set(dayX(splitIndex, count), 0.02, 0);
          group.add(halo);
        }

        scene.add(new THREE.AmbientLight(0xffffff, 0.55));
        const sun = new THREE.DirectionalLight(0xffffff, 0.9);
        sun.position.set(4, 8, 6);
        scene.add(sun);

        // ---- state, painting, layout -----------------------------------
        let dragging = false;
        let lastX = 0;
        let ry = -0.5; // the mock's opening angle
        let painted = false;

        const ease = (x: number) => 1 - Math.pow(1 - x, 3);

        const paintBars = (t: number) => {
          for (const b of bars) {
            const k = reduce
              ? 1
              : ease(Math.min(Math.max((t - 0.2 - b.day * 0.15) / 0.9, 0), 1));
            const h = Math.max(b.height * k, 0.001);
            b.mesh.scale.y = h;
            b.mesh.position.y = h / 2;
          }
        };

        const renderFrame = (t: number) => {
          paintBars(t);
          group.rotation.y = ry;
          net.rotation.y = t * NET_SPEED;
          if (halo) {
            const pulse = reduce ? 1 : 1 + 0.12 * Math.sin(t * 3);
            halo.scale.set(pulse, pulse, pulse);
            if (haloMat) haloMat.opacity = reduce ? 0.5 : 0.5 + 0.4 * Math.sin(t * 3);
          }
          renderer.render(scene, camera);
          if (!painted) {
            painted = true;
            setLive(true);
          }
        };

        const resize = () => {
          const w = host.clientWidth || 1;
          const h = host.clientHeight || 1;
          renderer.setSize(w, h, false);
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
          // Wide: beside the copy. Narrow: dropped below it, as in the mock.
          const wide = w > WIDE_AT;
          group.position.x = wide ? 3 : 0;
          group.position.y = wide ? 0 : -1.5;
          group.scale.setScalar(wide ? 1 : 0.8);
          if (reduce) renderFrame(0); // keep the still frame in step with the size
        };
        resize();
        const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null;
        ro?.observe(host);

        // ---- the render loop (skipped entirely under reduced motion) ---
        let raf = 0;
        let visible = true;
        let last = performance.now();
        const t0 = performance.now();

        const frame = (now: number) => {
          raf = requestAnimationFrame(frame);
          const t = (now - t0) / 1000;
          const dt = Math.min((now - last) / 1000, 0.05);
          last = now;
          if (!dragging) ry += ROTATE_SPEED * dt;
          renderFrame(t);
        };

        const start = () => {
          if (reduce || !visible || raf) return;
          last = performance.now();
          raf = requestAnimationFrame(frame);
        };
        const stop = () => {
          if (raf) cancelAnimationFrame(raf);
          raf = 0;
        };

        let io: IntersectionObserver | null = null;
        const onVisibility = () => {
          if (document.hidden) stop();
          else start();
        };
        if (!reduce) {
          io =
            typeof IntersectionObserver !== "undefined"
              ? new IntersectionObserver(
                  ([entry]) => {
                    visible = entry?.isIntersecting ?? true;
                    if (visible) start();
                    else stop();
                  },
                  { threshold: 0 },
                )
              : null;
          io?.observe(host);
          document.addEventListener("visibilitychange", onVisibility);
          start();
        }

        // ---- drag to rotate (the mock's sensitivity) -------------------
        const onDown = (e: PointerEvent) => {
          dragging = true;
          lastX = e.clientX;
          canvas.style.cursor = "grabbing";
          e.preventDefault(); // stops a text selection starting under the drag
        };
        const onMove = (e: PointerEvent) => {
          if (!dragging) return;
          ry += (e.clientX - lastX) * 0.008;
          lastX = e.clientX;
          if (reduce) renderFrame(0); // no loop is running; redraw the still frame
        };
        const onUp = () => {
          if (!dragging) return;
          dragging = false;
          canvas.style.cursor = "grab";
        };
        canvas.addEventListener("pointerdown", onDown);
        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onUp);
        window.addEventListener("pointercancel", onUp);

        cleanup = () => {
          stop();
          io?.disconnect();
          ro?.disconnect();
          document.removeEventListener("visibilitychange", onVisibility);
          canvas.removeEventListener("pointerdown", onDown);
          window.removeEventListener("pointermove", onMove);
          window.removeEventListener("pointerup", onUp);
          window.removeEventListener("pointercancel", onUp);
          scene.traverse((obj) => {
            const node = obj as unknown as {
              geometry?: { dispose: () => void };
              material?: unknown;
            };
            node.geometry?.dispose();
            const mats = Array.isArray(node.material)
              ? node.material
              : node.material
                ? [node.material]
                : [];
            for (const m of mats) {
              const mat = m as { dispose?: () => void; map?: { dispose?: () => void } | null };
              mat.map?.dispose?.();
              mat.dispose?.();
            }
          });
          renderer.dispose();
          canvas.remove();
        };
      })
      .catch(() => {
        // No WebGL, a blocked chunk, or an old browser: the fallback wash is
        // already a complete, readable backdrop. Swallow it.
      });

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [series, dates, thresholdScaled, comparator, splitDays]);

  return (
    <div
      className="evidence-field"
      data-testid="evidence-field"
      data-live={live ? "true" : "false"}
      aria-hidden="true"
    >
      <div className="evidence-field-fallback" ref={hostRef} />
      <div className="evidence-field-veil" />
      <div className="evidence-field-hud">
        <div className="evidence-field-legend" data-testid="evidence-field-legend">
          {series.slice(0, 2).map((s, i) => (
            <span className="evidence-field-swatch" key={s.sourceId}>
              <i data-shape={i === 0 ? "box" : "cone"} />
              {s.label}
            </span>
          ))}
          <span className="evidence-field-swatch">
            <i data-shape="plane" />
            {t("hero.threshold", { value: fromScaled(thresholdScaled), unit })}
          </span>
        </div>
        <p className="evidence-field-tip" data-testid="evidence-field-tip">
          {tipDay ? t("hero.split", { day: dayLabel(tipDay, locale) }) : t("hero.drag")}
        </p>
      </div>
    </div>
  );
}
