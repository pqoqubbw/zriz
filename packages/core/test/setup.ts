import { configureGlobal } from "fast-check";

configureGlobal({ numRuns: Number(process.env.RUNS ?? 1000) });
