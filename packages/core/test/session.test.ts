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

  it("sends the value and crop from before a subscriber's write in a settling commit", () => {
    const time = fakeClock();
    const cropper = createCropper({
      clock: time.clock,
      image: { height: 1000, width: 2000 },
    });
    const { committed } = cropper.getState();
    const before: unknown[] = [];
    cropper.subscribe(() => {
      if (before.length === 0 && cropper.getState().committed !== committed) {
        before.push([cropper.getValue(), cropper.getPixelCrop()]);
        cropper.setZoom(3);
      }
    });
    const sent: unknown[] = [];
    cropper.on("commit", (value, { pixelCrop }) => {
      sent.push([value, pixelCrop]);
    });
    cropper.setZoom(2);
    time.frames(2);
    expect(sent[0]).toStrictEqual(before[0]);
    expect(sent.at(-1)).toStrictEqual([
      cropper.getValue(),
      cropper.getPixelCrop(),
    ]);
  });

  it("sends the value and crop from before a subscriber's write when a photo commits during a gesture", () => {
    const time = fakeClock();
    const cropper = createCropper({
      clock: time.clock,
      image: { height: 3000, width: 4000 },
    });
    cropper.setAspect(0.5);
    time.frame();
    const { committed } = cropper.getState();
    const before: unknown[] = [];
    cropper.subscribe(() => {
      if (before.length === 0 && cropper.getState().committed !== committed) {
        before.push([cropper.getValue(), cropper.getPixelCrop()]);
        cropper.setZoom(3);
      }
    });
    const sent: unknown[] = [];
    const read: boolean[] = [];
    cropper.on("commit", (value, { pixelCrop }) => {
      sent.push([value, pixelCrop]);
      read.push(cropper.getState().committed === value);
    });
    cropper.begin("pan", undefined, OWNER);
    cropper.setImage({ height: 100, width: 100 });
    expect(sent).toStrictEqual(before);
    expect(read).toStrictEqual([true]);
    cropper.end(undefined, OWNER);
    time.frames(2);
    expect(cropper.getState().committed).toStrictEqual(cropper.getValue());
    expect(sent.at(-1)).toStrictEqual([
      cropper.getValue(),
      cropper.getPixelCrop(),
    ]);
  });

  it("ends on the newest commit when a subscriber settles a later write inside one", () => {
    const time = fakeClock();
    const cropper = createCropper({
      clock: time.clock,
      image: { height: 1000, width: 2000 },
    });
    const { committed } = cropper.getState();
    let wrote = false;
    cropper.subscribe(() => {
      if (!wrote && cropper.getState().committed !== committed) {
        wrote = true;
        cropper.setZoom(3);
        cropper.stop();
      }
    });
    const sent: unknown[] = [];
    cropper.on("commit", (value) => {
      sent.push(value);
      expect(cropper.getState().committed).toBe(value);
    });
    cropper.setZoom(2);
    time.frames(2);
    expect(sent.at(-1)).toStrictEqual(cropper.getValue());
    expect(cropper.getState().committed).toStrictEqual(cropper.getValue());
  });

  it.each<[string, (cropper: Cropper) => void]>([
    [
      "ends the gesture",
      (cropper) => {
        cropper.end(undefined, OWNER);
      },
    ],
    [
      "destroys the cropper",
      (cropper) => {
        cropper.destroy();
      },
    ],
  ])("takes a photo when a listener %s during its commit", (_name, act) => {
    const swap = (wire: (cropper: Cropper, run: () => void) => void) => {
      const time = fakeClock();
      const cropper = createCropper({
        clock: time.clock,
        image: { height: 3000, width: 4000 },
      });
      cropper.setAspect(0.5);
      time.frame();
      const { committed } = cropper.getState();
      wire(cropper, () => {
        if (cropper.getState().committed !== committed) {
          act(cropper);
        }
      });
      cropper.begin("pan", undefined, OWNER);
      cropper.setImage({ height: 100, width: 100 });
      expect(cropper.getState().interacting).toBeNull();
      time.frames(2);
      cropper.destroy();
    };
    swap((cropper, run) => {
      cropper.subscribe(run);
    });
    swap((cropper, run) => {
      cropper.on("commit", run);
    });
  });

  it("sends the crop of a change listener's write when a photo commits during a gesture", () => {
    const time = fakeClock();
    const cropper = createCropper({
      clock: time.clock,
      image: { height: 3000, width: 4000 },
    });
    cropper.setAspect(0.5);
    time.frame();
    const off = cropper.on("change", () => {
      off();
      cropper.setZoom(3);
    });
    const sent: unknown[] = [];
    cropper.on("commit", (value, { pixelCrop }) => {
      sent.push([value, pixelCrop]);
    });
    cropper.begin("pan", undefined, OWNER);
    cropper.setImage({ height: 100, width: 100 });
    expect(sent).toStrictEqual([[cropper.getValue(), cropper.getPixelCrop()]]);
    cropper.end(undefined, OWNER);
    time.frames(2);
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
