"use client";

import * as Cropper from "@zriz/react/cropper";
import type { ReactNode } from "react";

import { useDemoDim } from "@/demos/shell/context";
import { Ruler, Scale, Value, Zone, ZoneRow } from "@/demos/shell/layout";

type DialZoneProps = {
  end?: ReactNode;
  start?: ReactNode;
  value?: boolean;
};

const MINUS = "−";

const formatAngle = (degrees: number): string => {
  const rounded = Math.round(degrees * 10) / 10;

  return `${rounded < 0 ? MINUS : ""}${Math.abs(rounded).toFixed(1)}`;
};

const DialZone = ({ end, start, value = true }: DialZoneProps) => {
  const dim = useDemoDim();
  const ruler = (
    <Ruler>
      <div className="absolute inset-x-0 top-2.75">
        <Cropper.Dial
          aria-label="Straighten"
          className="w-full focus-visible:corners-none"
        >
          <Cropper.DialTicks />
        </Cropper.Dial>
      </div>
    </Ruler>
  );

  return (
    <Zone data-dim={dim ? "" : undefined} kind={value ? "dial" : "strip"}>
      <ZoneRow dial>
        {start}
        {value ? (
          <Scale
            value={
              <Value unit="°">
                <Cropper.DialValue format={formatAngle} />
              </Value>
            }
          >
            {ruler}
          </Scale>
        ) : (
          ruler
        )}
        {end}
      </ZoneRow>
    </Zone>
  );
};

export { DialZone, formatAngle };
