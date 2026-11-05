"use client";

import { cva } from "class-variance-authority";
import { useState } from "react";

import { DemoShell } from "@/demos/shell/demo-shell";
import { DialZone } from "@/demos/shell/dial-zone";
import { TrackZone } from "@/demos/shell/track-zone";

type Look = (typeof LOOKS)[number];

const LOOKS = ["default", "ink", "soft"] as const;

const lookVariants = cva("", {
  variants: {
    look: {
      default: "",
      ink: "[--zriz-accent:#3358d4] [--zriz-grid:#ffffffb3] [--zriz-line:#1e3a8a] [--zriz-scrim:#f5f7fbeb] [--zriz-tick:#93a3c4]",
      soft: "[--zriz-accent:#c4785a] [--zriz-grid:#ffffff80] [--zriz-line:#57534e] [--zriz-scrim:#f8f6f2eb] [--zriz-tick:#b8b0a6]",
    } satisfies Record<Look, string>,
  },
});

const StylingDemo = () => {
  const [look, setLook] = useState<Look>("default");

  return (
    <DemoShell className={lookVariants({ look })} name="styling">
      <DialZone />
      <TrackZone
        items={LOOKS}
        label="Colours"
        onChange={setLook}
        value={look}
      />
    </DemoShell>
  );
};

export default StylingDemo;
