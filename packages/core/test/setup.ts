import { configureGlobal } from "fast-check";

configureGlobal({ numRuns: Number(process.env.RUNS ?? 1000) });

if (!("getComputedStyle" in globalThis)) {
  Reflect.set(globalThis, "getComputedStyle", () => ({ direction: "ltr" }));
}
