"use client";

import { useSyncExternalStore } from "react";

import { playground } from "@/demos/playground/store";
import type { PlaygroundState } from "@/demos/playground/store";

const usePlayground = <T>(select: (state: PlaygroundState) => T): T =>
  useSyncExternalStore(
    playground.subscribe,
    () => select(playground.getState()),
    () => select(playground.getServerState())
  );

export { usePlayground };
