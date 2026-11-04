import {
  array,
  constantFrom,
  double,
  assert as fcAssert,
  integer,
  oneof,
  property,
  record,
} from "fast-check";
import { describe, expect, it } from "vitest";

import { createCropper } from "../src";
import type { Cropper } from "../src";
import { fakeClock } from "./fake-clock";

const OWNER = "session";

type Step = (cropper: Cropper) => void;

const number = (min: number, max: number) =>
  double({ max, min, noDefaultInfinity: true, noNaN: true });

const steps = oneof(
  number(-60, 60).map<Step>((angle) => (cropper) => {
    cropper.setRotation(angle);
  }),
  number(0.5, 20).map<Step>((zoom) => (cropper) => {
    cropper.setZoom(zoom);
  }),
  record({ x: number(-400, 400), y: number(-400, 400) }).map<Step>(
    ({ x, y }) =>
      (cropper) => {
        cropper.panBy(x, y);
      }
  ),
  constantFrom<Step>(
    (cropper) => {
      cropper.rotate90();
    },
    (cropper) => {
      cropper.rotate90("cw");
    },
    (cropper) => {
      cropper.flip();
    },
    (cropper) => {
      cropper.reset();
    },
    (cropper) => {
      cropper.setAspect(1);
    },
    (cropper) => {
      cropper.setAspect("free");
    },
    (cropper) => {
      cropper.begin("pan", undefined, OWNER);
    },
    (cropper) => {
      cropper.end(undefined, OWNER);
    },
    (cropper) => {
      cropper.cancel(undefined, OWNER);
    },
    (cropper) => {
      cropper.stop();
    },
    (cropper) => {
      cropper.setValue({ ...cropper.getValue() });
    },
    (cropper) => {
      cropper.setImage({ height: 1000, width: 2000 });
    },
    (cropper) => {
      cropper.setOptions({ maxZoom: 4 });
    },
    (cropper) => {
      cropper.setOptions({ maxZoom: 15 });
    },
    (cropper) => {
      cropper.run(() => false);
    }
  )
);

const finite = (cropper: Cropper): boolean => {
  const { center, rotation, size } = cropper.getValue();
  return [center.x, center.y, rotation, size.width, size.height].every((n) =>
    Number.isFinite(n)
  );
};

const session = (image: { height: number; width: number }, run: Step[]) => {
  const time = fakeClock();
  const cropper = createCropper({ clock: time.clock, image });
  const broken: string[] = [];
  let open = 0;
  let settled = 0;
  let wasSettling = false;
  cropper.on("gesturestart", () => {
    open += 1;
  });
  cropper.on("gestureend", () => {
    open -= 1;
  });
  cropper.on("settle", () => {
    settled += 1;
  });
  cropper.subscribe(() => {
    wasSettling ||= cropper.getState().settling;
  });
  cropper.on("change", (value, details) => {
    if (details.changed.length === 0) {
      broken.push("a change with no fields");
    }
    if (details.previous === value) {
      broken.push("a change that moved nothing");
    }
  });
  cropper.on("commit", (value) => {
    if (cropper.getState().committed !== value) {
      broken.push("a commit that reads an old snapshot");
    }
    if (cropper.getState().interacting !== null && open === 0) {
      broken.push("a commit with a gesture no one opened");
    }
  });
  for (const step of run) {
    step(cropper);
    time.frame();
    if (!finite(cropper)) {
      broken.push("a value that is not finite");
    }
    if ((cropper.getState().interacting === null) !== (open === 0)) {
      broken.push("gesture events that disagree with interacting");
    }
  }
  cropper.end(undefined, OWNER);
  time.frames(240);
  const end = {
    broken,
    open,
    pending: time.pending(),
    settling: cropper.getState().settling,
  };
  cropper.destroy();
  return { end, settled, time, wasSettling };
};

describe("a session of random writes and frames", () => {
  it("reads the new snapshot in a commit a photo sends during a gesture", () => {
    const time = fakeClock();
    const cropper = createCropper({
      clock: time.clock,
      image: { height: 3000, width: 4000 },
    });
    cropper.setAspect(0.5);
    time.frame();
    const seen: boolean[] = [];
    cropper.on("commit", (value) => {
      seen.push(cropper.getState().committed === value);
    });
    cropper.begin("pan", undefined, OWNER);
    cropper.setImage({ height: 100, width: 100 });
    time.frames(2);
    cropper.end(undefined, OWNER);
    time.frames(2);
    expect(seen).toContain(true);
    expect(seen).not.toContain(false);
  });

  it("refuses a gesture after destroy", () => {
    const cropper = createCropper({ image: { height: 300, width: 400 } });
    cropper.destroy();
    expect(cropper.begin("pan")).toBeFalsy();
  });

  it("keeps its events, its snapshot and its value in step", () => {
    fcAssert(
      property(
        record({
          height: integer({ max: 12_000, min: 400 }),
          width: integer({ max: 12_000, min: 400 }),
        }),
        array(steps, { maxLength: 40 }),
        (image, run) => {
          const { end, settled, time, wasSettling } = session(image, run);
          expect(end).toStrictEqual({
            broken: [],
            open: 0,
            pending: 0,
            settling: false,
          });
          expect(settled > 0 || !wasSettling).toBeTruthy();
          expect(time.pending()).toBe(0);
        }
      ),
      { numRuns: 400 }
    );
  });
});
