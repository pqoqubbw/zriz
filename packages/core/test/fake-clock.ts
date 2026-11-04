import type { Clock } from "../src";

type FakeClock = {
  clock: Clock;
  frame: (ms?: number) => void;
  frames: (count: number, ms?: number) => void;
  pending: () => number;
};

const fakeClock = (): FakeClock => {
  let time = 0;
  let id = 0;
  const queue = new Map<number, (time: number) => void>();

  const frame = (ms = 1000 / 60): void => {
    time += ms;
    const steps = [...queue.values()];

    queue.clear();

    for (const step of steps) {
      step(time);
    }
  };

  return {
    clock: {
      cancel: (handle) => {
        queue.delete(handle);
      },
      now: () => time,
      request: (step) => {
        id += 1;
        queue.set(id, step);

        return id;
      },
    },
    frame,
    frames(count, ms) {
      for (let i = 0; i < count; i += 1) {
        frame(ms);
      }
    },
    pending: () => queue.size,
  };
};

export type { FakeClock };
export { fakeClock };
