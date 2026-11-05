"use client";

import { DemoShell } from "@/demos/shell/demo-shell";
import { ZoomZone } from "@/demos/shell/zoom-zone";

const ZoomDemo = () => (
  <DemoShell maxZoom={3} name="zoom">
    <ZoomZone />
  </DemoShell>
);

export default ZoomDemo;
