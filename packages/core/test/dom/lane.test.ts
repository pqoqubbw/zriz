import { describe, expect, it } from "vitest";

import { via } from "../../src/dom/worker";
import type { Lane } from "../../src/dom/worker";

interface Local {
  run: () => Promise<number>;
}

const answering = (call: Lane<Local>["call"]): Lane<Local> => ({
  call,
  here: () => ({ run: async () => await Promise.resolve(7) }),
});

const run = async (target: Lane<Local>): Promise<number> =>
  await via(target, "run", []);

describe("worker replies", () => {
  it("keeps a reply", async () => {
    await expect(
      run(answering(async () => await Promise.resolve(1)))
    ).resolves.toBe(1);
  });

  it("runs here when the lane has no worker, and throws anything else", async () => {
    await expect(
      run(
        answering(
          async () => await Promise.reject(new Error("zriz:worker:none"))
        )
      )
    ).resolves.toBe(7);
    await expect(
      run(
        answering(async () => await Promise.reject(new Error("zriz:decode:x")))
      )
    ).rejects.toThrow("zriz:decode:x");
  });
});
