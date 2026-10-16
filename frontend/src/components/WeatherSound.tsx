/**
 * Rain and thunder ambience for the hero, played only on request.
 *
 * WHY SYNTHESISED, NOT RECORDED: shipping a rain recording means shipping an
 * audio asset with its own licensing and a few hundred kB to download. The
 * Web Audio API makes a convincing ambience from filtered noise in a few
 * lines: rain is looped white noise through a high-pass/low-pass pair, and
 * thunder is a darkening noise burst over a sub-bass sine. Nothing to fetch,
 * nothing to attribute.
 *
 * WHY OPT-IN: no browser will let a page autoplay audio before a user
 * gesture, and doing it even if it could would be hostile. The toggle IS the
 * gesture: nothing is created until it is pressed, and switching it off
 * closes the AudioContext rather than leaving it muted in the background.
 * While the tab is hidden the context is suspended, because ambience for a
 * page nobody is looking at is just battery.
 *
 * WHY TIMING LIVES ELSEWHERE: the clap cadence is a pure function in
 * `src/domain/ambience.ts`, tested directly -- audio graphs cannot be heard
 * by CI, but the schedule can.
 *
 * On browsers without the Web Audio API the component renders nothing; a
 * dead control is worse than no control.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { thunderDelayMs } from "../domain/ambience";
import { useI18n } from "../i18n/I18nProvider";

type AudioContextCtor = new () => AudioContext;

function audioContextCtor(): AudioContextCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    AudioContext?: AudioContextCtor;
    webkitAudioContext?: AudioContextCtor;
  };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

/** Two seconds of white noise; the raw material for both rain and thunder. */
function noiseBuffer(ctx: AudioContext): AudioBuffer {
  const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
  return buffer;
}

interface Running {
  ctx: AudioContext;
  master: GainNode;
  timer: number;
}

export function WeatherSound() {
  const { t } = useI18n();
  const [on, setOn] = useState(false);
  const runningRef = useRef<Running | null>(null);

  const stop = useCallback(() => {
    const running = runningRef.current;
    if (!running) return;
    runningRef.current = null;
    window.clearTimeout(running.timer);
    const { ctx, master } = running;
    try {
      master.gain.setTargetAtTime(0, ctx.currentTime, 0.08);
    } catch {
      /* context already closing */
    }
    // Let the short fade finish, then release the audio hardware for real.
    window.setTimeout(() => {
      if (ctx.state !== "closed") void ctx.close().catch(() => {});
    }, 450);
  }, []);

  const start = useCallback(() => {
    const Ctor = audioContextCtor();
    if (!Ctor || runningRef.current) return;

    const ctx = new Ctor();
    const master = ctx.createGain();
    master.gain.value = 1;
    master.connect(ctx.destination);

    const buffer = noiseBuffer(ctx);

    // Rain: band-limited white noise, quiet enough to sit under speech.
    const rain = ctx.createBufferSource();
    rain.buffer = buffer;
    rain.loop = true;
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 300;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 3200;
    lp.Q.value = 0.6;
    const rainGain = ctx.createGain();
    rainGain.gain.value = 0.045;
    rain.connect(hp).connect(lp).connect(rainGain).connect(master);
    rain.start();

    const running: Running = { ctx, master, timer: 0 };

    const clap = () => {
      const now = ctx.currentTime;
      // Body: a noise burst that darkens as it rolls away.
      const burst = ctx.createBufferSource();
      burst.buffer = buffer;
      const burstLp = ctx.createBiquadFilter();
      burstLp.type = "lowpass";
      burstLp.frequency.setValueAtTime(240, now);
      burstLp.frequency.exponentialRampToValueAtTime(70, now + 2.4);
      const burstGain = ctx.createGain();
      burstGain.gain.setValueAtTime(0.0001, now);
      burstGain.gain.exponentialRampToValueAtTime(0.2, now + 0.12);
      burstGain.gain.exponentialRampToValueAtTime(0.0001, now + 2.6);
      burst.connect(burstLp).connect(burstGain).connect(master);
      burst.start(now);
      burst.stop(now + 2.8);
      // Weight: a sub-bass roll under the burst.
      const rumble = ctx.createOscillator();
      rumble.type = "sine";
      rumble.frequency.setValueAtTime(56, now);
      rumble.frequency.exponentialRampToValueAtTime(36, now + 1.8);
      const rumbleGain = ctx.createGain();
      rumbleGain.gain.setValueAtTime(0.0001, now);
      rumbleGain.gain.exponentialRampToValueAtTime(0.09, now + 0.15);
      rumbleGain.gain.exponentialRampToValueAtTime(0.0001, now + 2.2);
      rumble.connect(rumbleGain).connect(master);
      rumble.start(now);
      rumble.stop(now + 2.4);
    };

    const schedule = (first: boolean) => {
      running.timer = window.setTimeout(() => {
        if (runningRef.current !== running) return;
        clap();
        schedule(false);
      }, thunderDelayMs(Math.random, first));
    };
    schedule(true);

    runningRef.current = running;
    void ctx.resume().catch(() => {});
  }, []);

  const toggle = useCallback(() => {
    if (runningRef.current) {
      stop();
      setOn(false);
    } else {
      start();
      setOn(true);
    }
  }, [start, stop]);

  // Suspend while the tab is hidden; resume when it returns.
  useEffect(() => {
    if (!on) return;
    const onVisibility = () => {
      const running = runningRef.current;
      if (!running) return;
      if (document.hidden) void running.ctx.suspend().catch(() => {});
      else void running.ctx.resume().catch(() => {});
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [on]);

  // Unmount: stop for good.
  useEffect(() => () => stop(), [stop]);

  if (!audioContextCtor()) return null;

  return (
    <button
      type="button"
      className="weather-sound"
      aria-pressed={on}
      onClick={toggle}
    >
      {on ? t("hero.sound.on") : t("hero.sound.off")}
    </button>
  );
}
