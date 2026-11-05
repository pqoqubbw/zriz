"use client";

import { useState } from "react";

import { DemoShell } from "@/demos/shell/demo-shell";
import { TrackZone } from "@/demos/shell/track-zone";

type Format = (typeof FORMATS)[number];

const FORMATS = ["jpeg", "png", "webp"] as const;

const MAX_SIZE = { height: 2048, width: 2048 };

const ExportingDemo = () => {
  const [format, setFormat] = useState<Format>("jpeg");

  return (
    <DemoShell
      exportOptions={{ maxSize: MAX_SIZE, type: `image/${format}` }}
      name="exporting"
    >
      <TrackZone
        items={FORMATS}
        label="File format"
        onChange={setFormat}
        value={format}
      />
    </DemoShell>
  );
};

export default ExportingDemo;
