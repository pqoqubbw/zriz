export interface Clock {
  now: () => number;
  request: (step: (time: number) => void) => number;
  cancel: (handle: number) => void;
}

export interface Motion {
  value: number;
  velocity: number;
}

export interface VelocityTracker {
  push: (time: number, value: number) => void;
  velocity: (time: number) => number;
  reset: () => void;
}

const fallbackFrame = 1000 / 60;
const MIN_FIT_SPAN = 10;

export const frameClock = (): Clock => {
  if (typeof globalThis.requestAnimationFrame === "function") {
    return {
      cancel: (handle) => {
        globalThis.cancelAnimationFrame(handle);
      },
      now: () => performance.now(),
      request: (step) => globalThis.requestAnimationFrame(step),
    };
  }
  let id = 0;
  const timers = new Map<number, ReturnType<typeof setTimeout>>();
  return {
    cancel: (handle) => {
      clearTimeout(timers.get(handle));
      timers.delete(handle);
    },
    now: () => performance.now(),
    request: (step) => {
      id += 1;
      const key = id;
      timers.set(
        key,
        setTimeout(() => {
          timers.delete(key);
          step(performance.now());
        }, fallbackFrame)
      );
      return key;
    },
  };
};

export const spring = (
  displacement: number,
  velocity: number,
  omega: number,
  zeta: number,
  time: number
): Motion => {
  const t = time / 1000;
  const x0 = displacement;
  const v0 = velocity;
  if (zeta === 1) {
    const b = v0 + omega * x0;
    const e = Math.exp(-omega * t);
    return {
      value: (x0 + b * t) * e,
      velocity: (v0 - omega * b * t) * e,
    };
  }
  if (zeta < 1) {
    const wd = omega * Math.sqrt(1 - zeta * zeta);
    const a = zeta * omega;
    const b = (v0 + a * x0) / wd;
    const e = Math.exp(-a * t);
    const cos = Math.cos(wd * t);
    const sin = Math.sin(wd * t);
    return {
      value: e * (x0 * cos + b * sin),
      velocity: e * ((b * wd - a * x0) * cos - (x0 * wd + a * b) * sin),
    };
  }
  const root = omega * Math.sqrt(zeta * zeta - 1);
  const r1 = -zeta * omega + root;
  const r2 = -zeta * omega - root;
  const c2 = (v0 - r1 * x0) / (r2 - r1);
  const c1 = x0 - c2;
  const e1 = Math.exp(r1 * t);
  const e2 = Math.exp(r2 * t);
  return {
    value: c1 * e1 + c2 * e2,
    velocity: c1 * r1 * e1 + c2 * r2 * e2,
  };
};

export const decay = (velocity: number, tau: number, time: number): Motion => {
  const e = Math.exp(-time / tau);
  return { value: (velocity / 1000) * tau * (1 - e), velocity: velocity * e };
};

export const decayDistance = (velocity: number, tau: number): number =>
  (velocity / 1000) * tau;

export const isAtRest = (
  motion: Motion,
  distance = 0.01,
  speed = 0.01
): boolean =>
  Math.abs(motion.value) < distance && Math.abs(motion.velocity) < speed;

export const velocityTracker = (
  window = 100,
  limit = 20,
  stale = 40
): VelocityTracker => {
  let times: number[] = [];
  let values: number[] = [];
  return {
    push(time, value) {
      const previous = times.at(-1);
      if (previous !== undefined && time - previous > stale) {
        times = [];
        values = [];
      }
      times.push(time);
      values.push(value);
      while (
        times.length > limit ||
        (times.length > 2 && time - (times[0] ?? time) > window)
      ) {
        times.shift();
        values.shift();
      }
    },
    reset() {
      times = [];
      values = [];
    },
    velocity(time) {
      const n = times.length;
      const [first] = times;
      const last = times[n - 1];
      if (
        first === undefined ||
        last === undefined ||
        last - first < MIN_FIT_SPAN ||
        time - last > stale
      ) {
        return 0;
      }
      let st = 0;
      let sv = 0;
      for (let i = 0; i < n; i += 1) {
        st += times[i] ?? 0;
        sv += values[i] ?? 0;
      }
      const mt = st / n;
      const mv = sv / n;
      let num = 0;
      let den = 0;
      for (let i = 0; i < n; i += 1) {
        const dt = (times[i] ?? 0) - mt;
        num += dt * ((values[i] ?? 0) - mv);
        den += dt * dt;
      }
      return (num / den) * 1000;
    },
  };
};
