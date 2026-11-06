"use client";

import dynamic from "next/dynamic";

const Controls = dynamic(async () => {
  const { Controls: Loaded } = await import("@/components/doc/controls");

  return Loaded;
});

const DemoMount = dynamic(async () => {
  const { DemoMount: Loaded } = await import("@/components/doc/demo-mount");

  return Loaded;
});

const DownloadAction = dynamic(async () => {
  const { DownloadAction: Loaded } =
    await import("@/demos/playground/download-action");

  return Loaded;
});

const LiveCode = dynamic(async () => {
  const { LiveCode: Loaded } = await import("@/demos/playground/live-code");

  return Loaded;
});

const LiveLog = dynamic(async () => {
  const { LiveLog: Loaded } = await import("@/demos/playground/live-log");

  return Loaded;
});

const PlaygroundCopy = dynamic(async () => {
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
