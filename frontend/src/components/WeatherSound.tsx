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
import { AMB_GAINS, WIND_BAND, thunderDelayMs, thunderShape, windGustMs } from "../domain/ambience";
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
    // Let the short fade finish, then release the audio hardware for real. The
    // context close tears down every looping source and LFO at once, so the
    // wind and bed layers do not outlive the toggle.
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

    /**
     * ONE noise buffer, several filter chains off it.
     *
     * The layers differ by filter and gain, not by sample data, so there is no
     * reason to allocate more than one buffer.
     */

    // Rain: the near hiss, band-limited so it sits under reading level.
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
    rainGain.gain.value = AMB_GAINS.rain;
    rain.connect(hp).connect(lp).connect(rainGain).connect(master);

    // Far rain: duller and quieter. This layer is what adds DEPTH -- a single
    // rain voice sounds like a tap running rather than like weather.
    const rainFar = ctx.createBufferSource();
    rainFar.buffer = buffer;
    rainFar.loop = true;
    const farLp = ctx.createBiquadFilter();
    farLp.type = "lowpass";
    farLp.frequency.value = 900;
    const farGain = ctx.createGain();
    farGain.gain.value = AMB_GAINS.rainFar;
    rainFar.connect(farLp).connect(farGain).connect(master);

    // Wind: band-pass noise whose centre frequency is swept by a slow LFO.
    // The sweep is what makes it read as a gust rather than as hiss.
    const wind = ctx.createBufferSource();
    wind.buffer = buffer;
    wind.loop = true;
    const windBand = ctx.createBiquadFilter();
    windBand.type = "bandpass";
    windBand.frequency.value = (WIND_BAND.low + WIND_BAND.high) / 2;
    windBand.Q.value = WIND_BAND.q;
    const windGain = ctx.createGain();
    windGain.gain.value = AMB_GAINS.wind;
    wind.connect(windBand).connect(windGain).connect(master);

    const gustLfo = ctx.createOscillator();
    gustLfo.type = "sine";
    const gustPeriod = windGustMs(Math.random) / 1000;
    gustLfo.frequency.value = 1 / gustPeriod;
    const gustDepth = ctx.createGain();
    gustDepth.gain.value = (WIND_BAND.high - WIND_BAND.low) / 2;
    gustLfo.connect(gustDepth).connect(windBand.frequency);

    // A second, slower LFO on the amplitude, so a gust builds and fades
    // instead of merely sliding between two filter frequencies.
    const swellLfo = ctx.createOscillator();
    swellLfo.type = "sine";
    swellLfo.frequency.value = 1 / (gustPeriod * 1.7);
    const swellDepth = ctx.createGain();
    swellDepth.gain.value = AMB_GAINS.wind * 0.55;
    swellLfo.connect(swellDepth).connect(windGain.gain);

    // Bed: a very low, very quiet rumble giving the storm weight. Without it the
    // mix sits in the mid range and sounds thin.
    const bed = ctx.createBufferSource();
    bed.buffer = buffer;
    bed.loop = true;
    const bedLp = ctx.createBiquadFilter();
    bedLp.type = "lowpass";
    bedLp.frequency.value = 110;
    const bedGain = ctx.createGain();
    bedGain.gain.value = AMB_GAINS.bed;
    bed.connect(bedLp).connect(bedGain).connect(master);

    rain.start();
    rainFar.start();
    wind.start();
    gustLfo.start();
    swellLfo.start();
    bed.start();

    const running: Running = { ctx, master, timer: 0 };

    const clap = () => {
      const now = ctx.currentTime;
      const s = thunderShape(Math.random);
      const decay = s.seconds;

      // Body: a noise burst that darkens as it rolls away.
      const burst = ctx.createBufferSource();
      burst.buffer = buffer;
      const burstLp = ctx.createBiquadFilter();
      burstLp.type = "lowpass";
      burstLp.frequency.setValueAtTime(s.openHz, now);
      burstLp.frequency.exponentialRampToValueAtTime(s.closedHz, now + decay * 0.85);
      const burstGain = ctx.createGain();
      burstGain.gain.setValueAtTime(0.0001, now);
      burstGain.gain.exponentialRampToValueAtTime(s.peak, now + 0.1);
      burstGain.gain.exponentialRampToValueAtTime(0.0001, now + decay);
      burst.connect(burstLp).connect(burstGain).connect(master);
      burst.start(now);
      burst.stop(now + decay + 0.2);

      /**
       * Weight: a sub-bass roll under the burst, plus a DELAYED, quieter second
       * roll. The delay is what makes thunder sound like it came from somewhere
       * away -- a return off a far ridge arrives late and duller -- and it is the
       * single biggest difference between "a thump" and "a storm".
       */
      const roll = (at: number, peak: number, fromHz: number, toHz: number, length: number) => {
        const osc = ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.setValueAtTime(fromHz, at);
        osc.frequency.exponentialRampToValueAtTime(toHz, at + length * 0.8);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, at);
        g.gain.exponentialRampToValueAtTime(peak, at + 0.12);
        g.gain.exponentialRampToValueAtTime(0.0001, at + length);
        osc.connect(g).connect(master);
        osc.start(at);
        osc.stop(at + length + 0.1);
      };

      roll(now, s.rumblePeak, s.rumbleHz, s.rumbleHz * 0.55, decay * 0.8);
      roll(now + s.echoDelay, s.rumblePeak * s.echoGain, s.rumbleHz * 0.8, s.rumbleHz * 0.4, decay);

      // The echo also arrives as a faint, further-filtered noise wash.
      const echo = ctx.createBufferSource();
      echo.buffer = buffer;
      const echoLp = ctx.createBiquadFilter();
      echoLp.type = "lowpass";
      echoLp.frequency.setValueAtTime(s.closedHz * 2.4, now + s.echoDelay);
      const echoGain = ctx.createGain();
      echoGain.gain.setValueAtTime(0.0001, now + s.echoDelay);
      echoGain.gain.exponentialRampToValueAtTime(s.peak * s.echoGain * 0.5, now + s.echoDelay + 0.2);
      echoGain.gain.exponentialRampToValueAtTime(0.0001, now + s.echoDelay + decay);
      echo.connect(echoLp).connect(echoGain).connect(master);
      echo.start(now + s.echoDelay);
      echo.stop(now + s.echoDelay + decay + 0.2);
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
