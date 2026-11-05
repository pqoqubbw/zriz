"use client";

import { useState } from "react";

import { DemoShell } from "@/demos/shell/demo-shell";
import { TrackZone } from "@/demos/shell/track-zone";

type Wheel = (typeof WHEELS)[number];

const WHEELS = ["pan", "zoom"] as const;

const ViewportDemo = () => {
  const [wheel, setWheel] = useState<Wheel>("pan");

  return (
    <DemoShell name="viewport" viewport={{ wheel }}>
      <TrackZone
        items={WHEELS}
        label="Wheel"
        onChange={setWheel}
        value={wheel}
      />
    </DemoShell>
  );
};

export default ViewportDemo;
