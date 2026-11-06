"use client";

import { lazy, Suspense } from "react";
import type { ComponentType } from "react";

const deferred = <Props extends object>(
  load: () => Promise<ComponentType<Props>>
) => {
  const Loaded = lazy(async () => ({ default: await load() }));

  const Deferred = (props: Props) => (
    <Suspense fallback={null}>
      <Loaded {...props} />
    </Suspense>
  );

  return Deferred;
};

const Controls = deferred(async () => {
  const { Controls: Loaded } = await import("@/components/doc/controls");

  return Loaded;
});

const DemoMount = deferred(async () => {
  const { DemoMount: Loaded } = await import("@/components/doc/demo-mount");

  return Loaded;
});

const DownloadAction = deferred(async () => {
  const { DownloadAction: Loaded } =
    await import("@/demos/playground/download-action");

  return Loaded;
});

const LiveCode = deferred(async () => {
  const { LiveCode: Loaded } = await import("@/demos/playground/live-code");

  return Loaded;
});

const LiveLog = deferred(async () => {
  const { LiveLog: Loaded } = await import("@/demos/playground/live-log");

  return Loaded;
});

const PlaygroundCopy = deferred(async () => {
  const { PlaygroundCopy: Loaded } =
    await import("@/demos/playground/playground-copy");

  return Loaded;
});

export {
  Controls,
  DemoMount,
  DownloadAction,
  LiveCode,
  LiveLog,
  PlaygroundCopy,
};
