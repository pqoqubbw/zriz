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

const LiveCode = dynamic(async () => {
  const { LiveCode: Loaded } = await import("@/demos/playground/live-code");

  return Loaded;
});

const LiveLog = dynamic(async () => {
  const { LiveLog: Loaded } = await import("@/demos/playground/live-log");

  return Loaded;
});

export { Controls, DemoMount, LiveCode, LiveLog };
