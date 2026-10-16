/**
 * EvidenceChart3D — the evidence readings as an animated 3D column chart.
 *
 * WHY 3D, AND WHAT PROTECTS CORRECTNESS: perspective genuinely makes exact
 * height comparison harder, which is why the 2D view and the table stay one
 * click away and why this scene adds reading aids the hero scene does not
 * need: a ladder of shelf outlines at every axis tick, day labels along the
 * front edge, axis values on the back-left corner, and the threshold as both
 * a plane and a labelled edge. Every number is still decided by the same pure
 * modules as the 2D chart — `niceScale` picks the axis, `meetsThreshold`
 * decides which columns cross, `compareSources` decides which days are splits
 * — the canvas computes nothing on its own.
 *
 * HONESTY RULES (identical to the rest of the app):
 *  - a recorded 0 draws a hairline column, never nothing;
 *  - a missing reading draws NO column and a ground cross, never a fake zero;
 *  - the amber halo may only sit on a day `compareSources()` calls a split.
 *
 * MOTION: columns grow in with a staggered ease when the section scrolls into
 * view, a slow turntable keeps the scene alive, and hovering a day raises a
 * selection frame and pauses the spin so values can be read. A replay control
 * (in the parent) re-runs the growth without rebuilding the scene.
 * `prefers-reduced-motion: reduce` settles instantly and never starts a
 * render loop; dragging still redraws, because user-initiated motion is not
 * the motion the preference guards against.
 *
 * ACCESSIBILITY: the root is aria-hidden. The accessible carriers of this
 * data are the summary sentence, the legend, the 2D view and the table view —
 * none of them depend on this canvas or on motion.
 *
 * PERFORMANCE: three.js is dynamically imported (shared with the hero field);
 * the loop stops when the section scrolls out of view or the tab is hidden;
 * device pixel ratio is capped; every geometry, material and texture is
 * disposed on unmount; a WebGL failure degrades to the static wash.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import type * as ThreeNS from "three";
import { comparatorSymbol } from "../domain/copy";
import { formatTick, niceScale } from "../domain/chartScale";
import { columnHeight, revealDelayMs, sourceOffsetX, spacingFor } from "../domain/chart3d";
import { dayLabel, dayX } from "../domain/fieldLayout";
import { dateRange, fromScaled } from "../domain/format";
import { compareSources, meetsThreshold } from "../domain/sourceCompare";
import type { DemoSeries } from "../fixtures/demoScenarios";
import { useI18n } from "../i18n/I18nProvider";

interface Props {
  series: DemoSeries[];
  period: { start: string; end: string };
  thresholdScaled: number;
  comparator: string;
  unit: string;
  /** True once the section has scrolled into view; gates the growth. */
  armed: boolean;
  /** Increments on replay: re-runs the growth without rebuilding the scene. */
  run: number;
  /** False under prefers-reduced-motion: settle instantly, never loop. */
  animated: boolean;
}

// Scene colours. Literal because they are painted into WebGL rather than the
// DOM; they are the dark palette's --isobar / --lichen / --threshold-ink /
// --amber-flag, matching the hero field so the two canvases are one design.
const BLUE = 0x6aa7e8;
const GREEN = 0x5fd3a8;
const RED = 0xe5675a;
const AMBER = 0xe8b04b;
const GRID_MAJOR = 0x33435a;
const GRID_MINOR = 0x1c2733;
const LABEL_INK = "#9aa5b1";

/** World height the axis top maps to. */
const CHART_H = 3;
/** Turntable speed, rad/s. Slower than the hero: this scene has labels to read. */
const SPIN_SPEED = 0.09;
/** Grow duration per column, ms. */
const GROW_MS = 650;
/** After a drag or a hover the turntable holds still this long, ms. */
const HOLD_MS = 1500;
/** Fade duration for the small pieces (labels, shelves, edge), ms. */
const FADE_MS = 350;

interface Fade {
  mat: { opacity: number };
  base: number;
  delayMs: number;
}

interface Growable {
  mesh: ThreeNS.Mesh;
  height: number;
  delayMs: number;
}

export function EvidenceChart3D({
  series,
  period,
  thresholdScaled,
  comparator,
  unit,
  armed,
  run,
  animated,
}: Props) {
  const { t, locale } = useI18n();
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [live, setLive] = useState(false);
  const [hoverDay, setHoverDay] = useState<number | null>(null);
  // The frame loop reads these through refs, so arming or replaying never
  // rebuilds the scene: only the data props do.
  const hoverRef = useRef<number | null>(null);
  const armedRef = useRef(armed);
  const restartRef = useRef(true);

  const dates = useMemo(
    () => dateRange(period.start, period.end),
    [period.start, period.end],
  );
  const thresholdNum = thresholdScaled / 100;

  useEffect(() => {
    armedRef.current = armed;
  }, [armed]);
  useEffect(() => {
    restartRef.current = true;
  }, [run]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || series.length === 0 || dates.length === 0) return;

    let disposed = false;
    let cleanup: (() => void) | undefined;

    // Dynamic import keeps three out of the initial bundle.
    void import("three")
      .then((THREE) => {
        if (disposed) return;

        // ---- data -> geometry ------------------------------------------
        const n = dates.length;
        const m = series.length;
        const spacing = spacingFor(n);
        const colW = Math.min(0.5, spacing * 0.62);
        const groupStep = colW + 0.14;
        const groupHalf = Math.abs(sourceOffsetX(0, m, groupStep)) + colW / 2;

        let max = thresholdNum;
        for (const s of series) {
          for (const d of dates) {
            const v = s.daily[d];
            if (typeof v === "number" && v > max) max = v;
          }
        }
        const scale = niceScale(max * 1.15);
        const splitIndices = compareSources(series, dates, thresholdScaled, comparator)
          .splitDays.map((d) => dates.indexOf(d))
          .filter((i) => i >= 0);

        const span = n > 1 ? (n - 1) * spacing : 0;
        const halfW = Math.max(3, span / 2 + 1.6);
        const halfD = 1.6;

        // ---- renderer, scene, camera ------------------------------------
        const renderer = new THREE.WebGLRenderer({
          alpha: true,
          antialias: true,
          powerPreference: "low-power",
        });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        const canvas = renderer.domElement;
        canvas.className = "chart3d-canvas";
        canvas.setAttribute("aria-hidden", "true");
        host.appendChild(canvas);

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 120);

        const group = new THREE.Group();
        scene.add(group);

        /** Canvas-texture sprite; `worldH` is its height in world units. */
        const textSprite = (text: string, worldH: number, color: string, bold = false) => {
          const font = `${bold ? "bold " : ""}26px ui-monospace, SFMono-Regular, Menlo, monospace`;
          const probe = document.createElement("canvas").getContext("2d");
          let width = 96;
          if (probe) {
            probe.font = font;
            width = Math.ceil(probe.measureText(text).width) + 24;
          }
          const cv = document.createElement("canvas");
          cv.width = Math.max(32, width);
          cv.height = 48;
          const g = cv.getContext("2d");
          if (g) {
            g.font = font;
            g.fillStyle = color;
            g.textAlign = "center";
            g.textBaseline = "middle";
            g.fillText(text, cv.width / 2, 26);
          }
          const mat = new THREE.SpriteMaterial({
            map: new THREE.CanvasTexture(cv),
            transparent: true,
            opacity: 0,
            depthWrite: false,
          });
          const sprite = new THREE.Sprite(mat);
          sprite.scale.set(worldH * (cv.width / cv.height), worldH, 1);
          return { sprite, mat };
        };

        const fades: Fade[] = [];
        const columns: Growable[] = [];
        const halos: { mesh: ThreeNS.Mesh; mat: ThreeNS.MeshBasicMaterial; delayMs: number }[] = [];
        const dayBoxes: { box: ThreeNS.Box3; day: number }[] = [];

        // ---- ground: grid + shadow catcher ------------------------------
        const grid = new THREE.GridHelper(
          halfW * 2,
          Math.max(8, Math.min(40, n * 4)),
          GRID_MAJOR,
          GRID_MINOR,
        );
        const gridMat = grid.material as unknown as { opacity: number; transparent: boolean };
        gridMat.transparent = true;
        gridMat.opacity = 0;
        grid.position.y = 0.002;
        group.add(grid);
        fades.push({ mat: gridMat, base: 0.32, delayMs: 0 });

        const floor = new THREE.Mesh(
          new THREE.PlaneGeometry(halfW * 2, halfD * 2),
          new THREE.ShadowMaterial({ opacity: 0.22 }),
        );
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        const floorMat = floor.material as unknown as { opacity: number; transparent: boolean };
        floorMat.transparent = true;
        floorMat.opacity = 0;
        group.add(floor);
        fades.push({ mat: floorMat, base: 0.22, delayMs: 200 });

        // ---- shelf outlines + axis labels at every tick -----------------
        const shelfAt = (y: number) => {
          const pts = [
            new THREE.Vector3(-halfW, y, -halfD),
            new THREE.Vector3(halfW, y, -halfD),
            new THREE.Vector3(halfW, y, halfD),
            new THREE.Vector3(-halfW, y, halfD),
          ];
          const mat = new THREE.LineBasicMaterial({
            color: GRID_MAJOR,
            transparent: true,
            opacity: 0,
          });
          const loop = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), mat);
          return { loop, mat };
        };
        for (const tick of scale.ticks) {
          const y = (tick / scale.top) * CHART_H;
          if (tick > 0) {
            const shelf = shelfAt(y);
            group.add(shelf.loop);
            fades.push({ mat: shelf.mat, base: 0.16, delayMs: 60 });
          }
          const label = textSprite(formatTick(tick, scale.decimals), 0.26, LABEL_INK);
          label.sprite.position.set(-halfW - 0.55, y + 0.02, -halfD - 0.15);
          group.add(label.sprite);
          fades.push({ mat: label.mat, base: 0.9, delayMs: 140 });
        }
        const unitLabel = textSprite(unit, 0.28, LABEL_INK);
        unitLabel.sprite.position.set(-halfW - 0.55, CHART_H + 0.38, -halfD - 0.15);
        group.add(unitLabel.sprite);
        fades.push({ mat: unitLabel.mat, base: 0.9, delayMs: 140 });

        // ---- threshold: plane + labelled edge ----------------------------
        const planeY = (thresholdNum / scale.top) * CHART_H;
        const planeMat = new THREE.MeshBasicMaterial({
          color: RED,
          transparent: true,
          opacity: 0,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        const plane = new THREE.Mesh(new THREE.PlaneGeometry(halfW * 2, halfD * 2), planeMat);
        plane.rotation.x = -Math.PI / 2;
        plane.position.y = planeY;
        group.add(plane);

        const { loop: edge, mat: edgeMat } = shelfAt(planeY);
        edgeMat.color.set(RED);
        group.add(edge);
        fades.push({ mat: edgeMat, base: 0.85, delayMs: 500 });

        const thresholdLabel = textSprite(
          `${comparatorSymbol(comparator)} ${fromScaled(thresholdScaled)} ${unit}`,
          0.32,
          "#e5675a",
          true,
        );
        thresholdLabel.sprite.position.set(0, planeY + 0.2, halfD + 0.42);
        group.add(thresholdLabel.sprite);
        fades.push({ mat: thresholdLabel.mat, base: 0.95, delayMs: 550 });

        // ---- columns, day labels, missing-day crosses, halos -------------
        const boxGeo = new THREE.BoxGeometry(1, 1, 1);
        const cylGeo = new THREE.CylinderGeometry(1, 1, 1, 22);
        const matSolid = [
          new THREE.MeshStandardMaterial({ color: BLUE, roughness: 0.42, metalness: 0.15 }),
          new THREE.MeshStandardMaterial({ color: GREEN, roughness: 0.42, metalness: 0.15 }),
        ];
        const matCrossing = [
          new THREE.MeshStandardMaterial({
            color: BLUE,
            roughness: 0.35,
            metalness: 0.15,
            emissive: RED,
            emissiveIntensity: 0.32,
          }),
          new THREE.MeshStandardMaterial({
            color: GREEN,
            roughness: 0.35,
            metalness: 0.15,
            emissive: RED,
            emissiveIntensity: 0.32,
          }),
        ];
        const matMissing = new THREE.MeshStandardMaterial({
          color: AMBER,
          roughness: 0.6,
          transparent: true,
          opacity: 0.55,
        });

        const labelStride = Math.max(1, Math.ceil(n / 9));
        dates.forEach((d, i) => {
          const x = dayX(i, n, spacing);
          series.forEach((s, j) => {
            const raw = s.daily[d];
            const value = typeof raw === "number" ? raw : null;
            const cx = x + sourceOffsetX(j, m, groupStep);
            const h = columnHeight(value, scale.top, CHART_H);

            if (h === null) {
              // A missing reading gets NO column -- a ground cross instead,
              // so "no data" can never be mistaken for "measured zero".
              for (const rot of [Math.PI / 4, -Math.PI / 4]) {
                const bar = new THREE.Mesh(boxGeo, matMissing);
                bar.scale.set(0.46, 0.03, 0.075);
                bar.position.set(cx, 0.02, 0);
                bar.rotation.y = rot;
                group.add(bar);
              }
              return;
            }

            const crosses = meetsThreshold(value as number, thresholdNum, comparator);
            const mesh = new THREE.Mesh(j % 2 === 0 ? boxGeo : cylGeo, crosses ? matCrossing[j % 2]! : matSolid[j % 2]!);
            if (j % 2 === 0) mesh.scale.set(colW, 0.001, Math.min(0.42, colW * 0.9));
            else {
              const r = colW * 0.55;
              mesh.scale.set(r, 0.001, r);
            }
            mesh.position.set(cx, 0, 0);
            mesh.castShadow = true;
            group.add(mesh);
            const delayMs = revealDelayMs(i, j, n);
            columns.push({ mesh, height: h, delayMs });

            // Value label only where the decision turns on it: a crossing,
            // or a day the sources disagree about.
            if (crosses || splitIndices.includes(i)) {
              const vl = textSprite(
                fromScaled(Math.round((value as number) * 100)),
                0.28,
                crosses ? "#e5675a" : LABEL_INK,
              );
              vl.sprite.position.set(cx, h + 0.32, 0);
              group.add(vl.sprite);
              fades.push({ mat: vl.mat, base: 0.95, delayMs: delayMs + GROW_MS + 150 });
            }
          });

          if (i % labelStride === 0) {
            const daySprite = textSprite(d.slice(5), 0.3, LABEL_INK);
            daySprite.sprite.position.set(x, 0.06, halfD + 0.55);
            group.add(daySprite.sprite);
            fades.push({ mat: daySprite.mat, base: 0.9, delayMs: revealDelayMs(i, 0, n) + 250 });
          }

          dayBoxes.push({
            box: new THREE.Box3(
              new THREE.Vector3(x - groupHalf - 0.3, 0, -0.65),
              new THREE.Vector3(x + groupHalf + 0.3, CHART_H + 0.4, 0.65),
            ),
            day: i,
          });
        });

        // Halo: only on days `compareSources()` calls a split.
        const haloInner = Math.abs(sourceOffsetX(0, m, groupStep)) + colW / 2 + 0.16;
        for (const i of splitIndices) {
          const haloMat = new THREE.MeshBasicMaterial({
            color: AMBER,
            transparent: true,
            opacity: 0,
            side: THREE.DoubleSide,
            depthWrite: false,
          });
          const halo = new THREE.Mesh(
            new THREE.RingGeometry(haloInner, haloInner + 0.14, 48),
            haloMat,
          );
          halo.rotation.x = -Math.PI / 2;
          halo.position.set(dayX(i, n, spacing), 0.015, 0);
          group.add(halo);
          halos.push({ mesh: halo, mat: haloMat, delayMs: revealDelayMs(i, 0, n) + 350 });
        }

        // ---- hover selection frame ---------------------------------------
        const hlMat = new THREE.LineBasicMaterial({ color: AMBER, transparent: true, opacity: 0 });
        const highlight = new THREE.LineSegments(new THREE.EdgesGeometry(boxGeo), hlMat);
        highlight.scale.set(Math.abs(groupHalf) * 2 + 0.7, CHART_H * 1.06, 1.1);
        highlight.position.y = CHART_H * 0.53;
        group.add(highlight);

        // ---- lights -------------------------------------------------------
        scene.add(new THREE.AmbientLight(0xffffff, 0.55));
        const key = new THREE.DirectionalLight(0xffffff, 1.05);
        key.position.set(5, 9, 5);
        key.castShadow = true;
        key.shadow.mapSize.set(1024, 1024);
        key.shadow.bias = -0.0004;
        key.shadow.normalBias = 0.02;
        const sc = key.shadow.camera;
        sc.left = -(halfW + 2);
        sc.right = halfW + 2;
        sc.top = 8;
        sc.bottom = -8;
        sc.near = 1;
        sc.far = 40;
        sc.updateProjectionMatrix();
        scene.add(key);
        const fill = new THREE.DirectionalLight(0xffffff, 0.3);
        fill.position.set(-6, 5, -4);
        scene.add(fill);

        // ---- camera orbit --------------------------------------------------
        const radius = Math.min(30, Math.max(9, halfW * 1.15 + 3.2));
        const lookAt = new THREE.Vector3(0, CHART_H * 0.42, 0);
        let az = -0.5;
        let el = 0.42;
        const placeCamera = () => {
          const ce = Math.cos(el);
          camera.position.set(
            Math.sin(az) * ce * radius,
            Math.sin(el) * radius + 0.35,
            Math.cos(az) * ce * radius,
          );
          camera.lookAt(lookAt);
        };

        // ---- painting -------------------------------------------------------
        const settled = !animated;
        let dragging = false;
        let lastX = 0;
        let lastY = 0;
        let pauseUntil = 0;
        let visible = true;
        let raf = 0;
        let last = performance.now();
        let animStart: number | null = null;
        let painted = false;

        const easeOut = (x: number) => 1 - Math.pow(1 - x, 3);
        const clamp01 = (x: number) => Math.min(Math.max(x, 0), 1);

        const paint = (relMs: number) => {
          const rel = relMs / 1000;
          for (const f of fades) {
            f.mat.opacity = f.base * clamp01((relMs - f.delayMs) / FADE_MS);
          }
          // Threshold: sweeps outward from the centre, then breathes.
          const sweep = Math.max(easeOut(clamp01((relMs - 100) / 500)), 0.001);
          plane.scale.x = sweep;
          edge.scale.x = sweep;
          planeMat.opacity =
            0.12 * sweep + (settled ? 0 : 0.035 * sweep * (1 + Math.sin(rel * 1.7)));
          for (const c of columns) {
            const k = settled ? 1 : easeOut(clamp01((relMs - c.delayMs) / GROW_MS));
            const h = Math.max(c.height * k, 0.001);
            c.mesh.scale.y = h;
            c.mesh.position.y = h / 2 + 0.002;
          }
          for (const halo of halos) {
            const k = clamp01((relMs - halo.delayMs) / FADE_MS);
            const pulse = settled ? 1 : 1 + 0.1 * Math.sin(rel * 2.6);
            halo.mesh.scale.set(pulse, pulse, 1);
            halo.mat.opacity = 0.42 * k;
          }
          const hovered = hoverRef.current;
          hlMat.opacity = hovered === null ? 0 : 0.45 + (settled ? 0 : 0.12 * Math.sin(rel * 3));
          if (hovered !== null) highlight.position.x = dayX(hovered, n, spacing);
          placeCamera();
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
          if (settled) paint(1e6); // keep the still frame in step with the size
        };
        resize();
        const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null;
        ro?.observe(host);

        // ---- render loop (skipped entirely under reduced motion) ----------
        const frame = (now: number) => {
          raf = requestAnimationFrame(frame);
          const dt = Math.min((now - last) / 1000, 0.05);
          last = now;
          if (restartRef.current) {
            restartRef.current = false;
            animStart = null; // replay: re-arm the growth from zero
          }
          if (animStart === null && armedRef.current) animStart = now;
          if (!dragging && now > pauseUntil) az += SPIN_SPEED * dt;
          paint(animStart === null ? 0 : now - animStart);
        };

        const start = () => {
          if (settled || !visible || raf) return;
          last = performance.now();
          raf = requestAnimationFrame(frame);
        };
        const stop = () => {
          if (raf) cancelAnimationFrame(raf);
          raf = 0;
        };

        let cleanupExtra: (() => void) | undefined;
        if (settled) {
          paint(1e6); // one still frame; dragging will redraw on demand
        } else {
          const io =
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
          const onVisibility = () => {
            if (document.hidden) stop();
            else start();
          };
          document.addEventListener("visibilitychange", onVisibility);
          start();
          cleanupExtra = () => {
            io?.disconnect();
            document.removeEventListener("visibilitychange", onVisibility);
          };
        }

        // ---- pointer: drag to spin, hover to select -----------------------
        const fine =
          typeof window.matchMedia === "function" &&
          window.matchMedia("(hover: hover) and (pointer: fine)").matches;

        const onDown = (e: PointerEvent) => {
          dragging = true;
          lastX = e.clientX;
          lastY = e.clientY;
          canvas.style.cursor = "grabbing";
          e.preventDefault(); // stops a text selection starting under the drag
        };
        const onMoveWindow = (e: PointerEvent) => {
          if (!dragging) return;
          az += (e.clientX - lastX) * 0.008;
          el = Math.min(Math.max(el + (e.clientY - lastY) * 0.005, 0.16), 0.85);
          lastX = e.clientX;
          lastY = e.clientY;
          pauseUntil = performance.now() + HOLD_MS;
          if (settled) paint(1e6); // no loop is running; redraw the still frame
        };
        const onUp = () => {
          if (!dragging) return;
          dragging = false;
          canvas.style.cursor = "grab";
          pauseUntil = performance.now() + HOLD_MS;
        };

        const raycaster = new THREE.Raycaster();
        const ndc = new THREE.Vector2();
        const hoverPoint = new THREE.Vector3();
        const onHoverMove = (e: PointerEvent) => {
          if (dragging || !fine) return;
          const rect = canvas.getBoundingClientRect();
          ndc.set(
            ((e.clientX - rect.left) / rect.width) * 2 - 1,
            -((e.clientY - rect.top) / rect.height) * 2 + 1,
          );
          raycaster.setFromCamera(ndc, camera);
          let day: number | null = null;
          let best = Infinity;
          for (const b of dayBoxes) {
            const hit = raycaster.ray.intersectBox(b.box, hoverPoint);
            if (hit) {
              const d = camera.position.distanceTo(hit);
              if (d < best) {
                best = d;
                day = b.day;
              }
            }
          }
          pauseUntil = performance.now() + HOLD_MS;
          if (day !== hoverRef.current) {
            hoverRef.current = day;
            setHoverDay(day);
            if (settled) paint(1e6);
          }
        };
        const onHoverLeave = () => {
          if (hoverRef.current === null) return;
          hoverRef.current = null;
          setHoverDay(null);
          pauseUntil = performance.now() + HOLD_MS;
          if (settled) paint(1e6);
        };

        canvas.addEventListener("pointerdown", onDown);
        canvas.addEventListener("pointermove", onHoverMove);
        canvas.addEventListener("pointerleave", onHoverLeave);
        window.addEventListener("pointermove", onMoveWindow);
        window.addEventListener("pointerup", onUp);
        window.addEventListener("pointercancel", onUp);

        cleanup = () => {
          stop();
          cleanupExtra?.();
          ro?.disconnect();
          canvas.removeEventListener("pointerdown", onDown);
          canvas.removeEventListener("pointermove", onHoverMove);
          canvas.removeEventListener("pointerleave", onHoverLeave);
          window.removeEventListener("pointermove", onMoveWindow);
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
        // No WebGL, a blocked chunk, or an old browser: the static wash is
        // already a complete, quiet backdrop. Swallow it.
      });

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [series, dates, thresholdScaled, comparator, unit, animated]);

  const hovered = hoverDay !== null ? dates[hoverDay] ?? null : null;

  return (
    <div
      className="chart3d"
      data-testid="chart-3d"
      data-live={live ? "true" : "false"}
      aria-hidden="true"
    >
      <div className="chart3d-fallback" ref={hostRef} />
      <p className="chart3d-hud" data-testid="chart3d-hud">
        {hovered
          ? `${dayLabel(hovered, locale)} · ${series
              .map((s) => {
                const v = s.daily[hovered];
                return `${s.label} ${typeof v === "number" ? `${v} ${unit}` : "—"}`;
              })
              .join(" · ")}`
          : t("hero.drag")}
      </p>
    </div>
  );
}
