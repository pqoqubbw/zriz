"use client";

import { DemoShell } from "@/demos/shell/demo-shell";
import type { HandlePosition } from "@/demos/shell/demo-shell";
import { DialZone } from "@/demos/shell/dial-zone";

const CORNERS: readonly HandlePosition[] = [
  "top-left",
  "top-right",
  "bottom-right",
  "bottom-left",
];

const QuickStartDemo = () => (
  <DemoShell grid={false} handles={CORNERS} name="quick-start">
    <DialZone value={false} />
  </DemoShell>
);

export default QuickStartDemo;
