import { createCropper } from "@zriz/core";
import type { Clock } from "@zriz/core";

const queue = new Map<number, (time: number) => void>();
let id = 0;
let now = 0;

const clock: Clock = {
  now: () => now,
  request: (step) => {
    id += 1;
    queue.set(id, step);
    return id;
  },
  cancel: (handle) => {
    queue.delete(handle);
  },
};

const advance = (ms: number) => {
  now += ms;
  const steps = [...queue.values()];
  queue.clear();
  for (const step of steps) step(now);
};

const commits: number[] = [];
const cropper = createCropper({
  clock,
  image: { width: 4032, height: 3024 },
  onValueCommit: (value) => commits.push(value.rotation),
});

cropper.setRotation(7);
advance(16);
console.log(commits);
