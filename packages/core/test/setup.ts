import { configureGlobal } from "fast-check";

configureGlobal({ numRuns: Number(process.env.RUNS ?? 1000) });

globalThis.getComputedStyle ??= (() => ({
  direction: "ltr",
})) as unknown as typeof getComputedStyle;
