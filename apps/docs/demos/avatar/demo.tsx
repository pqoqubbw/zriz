"use client";

import type { ExportOptions } from "@zriz/core/dom";

import { DemoShell } from "@/demos/shell/demo-shell";
import type { DemoShellProps, HandlePosition } from "@/demos/shell/demo-shell";
import { ZoomZone } from "@/demos/shell/zoom-zone";

const MIN_SIZE = { height: 512, width: 512 };

const EXPORT: ExportOptions = { maxSize: MIN_SIZE };

const NO_HANDLES: readonly HandlePosition[] = [];

const VIEWPORT: DemoShellProps["viewport"] = { wheel: "zoom" };

const AvatarDemo = () => (
  <DemoShell
    exportOptions={EXPORT}
    fresh
    grid={false}
    handles={NO_HANDLES}
    maxZoom={3}
    minSize={MIN_SIZE}
    name="avatar"
    svg={false}
    viewport={VIEWPORT}
  >
    <ZoomZone />
  </DemoShell>
);

export default AvatarDemo;
