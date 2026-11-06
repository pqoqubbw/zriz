"use client";

import { CropperContext, useCropperFrame } from "@zriz/react";
import type { Cropper as CropperApi } from "@zriz/react";
import * as Cropper from "@zriz/react/cropper";
import { useContext, useRef, useSyncExternalStore } from "react";

import { Icon } from "@/components/ui/icon";
import { useDemoDim } from "@/demos/shell/context";
import { ghostVariants } from "@/demos/shell/ghost";
import { Ruler, Scale, Value, Zone, ZoneRow } from "@/demos/shell/layout";

const STEP = 1.25;

const EDGE = 0.0005;

const formatZoom = (zoom: number): string =>
  (Math.round(zoom * 10) / 10).toFixed(1);

const useZoomEdge = (cropper: CropperApi, edge: "max" | "min"): boolean =>
  useSyncExternalStore(
    (listener) => cropper.on("frame", listener),
    () => {
      const zoom = cropper.getZoom();

      return edge === "min"
        ? zoom <= 1 + EDGE
        : zoom >= cropper.getMaxZoom() - EDGE;
    },
    () => edge === "min"
  );

const useCropperApi = (): CropperApi => {
  const cropper = useContext(CropperContext);

  if (!cropper) {
    throw new Error("zoom zone: render inside the demo shell");
  }

  return cropper;
};

const ZoomZone = () => {
  const dim = useDemoDim();
  const text = useRef<HTMLSpanElement>(null);
  const cropper = useCropperApi();
  const atMin = useZoomEdge(cropper, "min");
  const atMax = useZoomEdge(cropper, "max");

  useCropperFrame(() => {
    if (text.current) {
      text.current.textContent = formatZoom(cropper.getZoom());
    }
  });

  return (
    <Zone data-dim={dim ? "" : undefined} kind="zoom">
      <ZoneRow>
        <Cropper.ZoomStep
          aria-disabled={(atMin && !dim) || undefined}
          aria-label="Zoom out"
          className={ghostVariants()}
          factor={1 / STEP}
        >
          <Icon className="size-5" name="zoom-out" />
        </Cropper.ZoomStep>
        <Scale
          value={
            <Value unit="×">
              <span ref={text}>{formatZoom(1)}</span>
            </Value>
          }
        >
          <Ruler width="zoom">
            <span className="absolute inset-x-2 top-3.5 h-1 rounded-full bg-rail" />
            <Cropper.Zoom
              aria-label="Zoom"
              className="mx-4 h-8 focus-visible:corners-none"
            >
              <Cropper.ZoomThumb className="top-2 size-4 -translate-x-1/2 rounded-full bg-white shadow-raised" />
            </Cropper.Zoom>
          </Ruler>
        </Scale>
        <Cropper.ZoomStep
          aria-disabled={(atMax && !dim) || undefined}
          aria-label="Zoom in"
          className={ghostVariants()}
          factor={STEP}
        >
          <Icon className="size-5" name="zoom-in" />
        </Cropper.ZoomStep>
      </ZoneRow>
    </Zone>
  );
};

export { ZoomZone, formatZoom };
