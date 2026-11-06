"use client";

import { imageOf } from "@zriz/core/dom";
import { CropperContext, useCropperState } from "@zriz/react";
import type { Aspect } from "@zriz/react";
import * as Cropper from "@zriz/react/cropper";
import { useContext } from "react";

import { useDemoDim } from "@/demos/shell/context";
import { ghostVariants } from "@/demos/shell/ghost";
import { Icon } from "@/demos/shell/icon";
import { Zone } from "@/demos/shell/layout";
import { Track, trackItemVariants } from "@/demos/shell/track";

type AspectRatio = readonly [number, number];

type AspectZoneProps = {
  ratios?: readonly AspectRatio[];
};

const RATIOS: readonly AspectRatio[] = [
  [4, 5],
  [9, 16],
];

const useWide = (): boolean => {
  const cropper = useContext(CropperContext);

  return useCropperState((state) => {
    if (typeof state.aspect === "number" && state.aspect !== 1) {
      return state.aspect > 1;
    }

    const image = cropper ? imageOf(cropper) : null;

    if (!image) {
      return true;
    }

    const ratio = image.width / image.height;

    return (state.quarterTurns % 2 === 1 ? 1 / ratio : ratio) >= 1;
  });
};

const ratioItem = (
  [width, height]: AspectRatio,
  wide: boolean
): { label: string; value: Aspect } =>
  wide
    ? { label: `${height}:${width}`, value: height / width }
    : { label: `${width}:${height}`, value: width / height };

const AspectZone = ({ ratios = RATIOS }: AspectZoneProps) => {
  const dim = useDemoDim();
  const wide = useWide();

  return (
    <Zone data-dim={dim ? "" : undefined} kind="aspect">
      <div className="flex gap-1.5">
        <Cropper.AspectGroup aria-label="Aspect ratio" render={<Track />}>
          <Cropper.AspectItem className={trackItemVariants()} value="free">
            Free
          </Cropper.AspectItem>
          <Cropper.AspectItem className={trackItemVariants()} value="original">
            Original
          </Cropper.AspectItem>
          <Cropper.AspectItem className={trackItemVariants()} value={1}>
            1:1
          </Cropper.AspectItem>
          {ratios.map((ratio) => {
            const item = ratioItem(ratio, wide);

            return (
              <Cropper.AspectItem
                className={trackItemVariants()}
                key={ratio.join(":")}
                value={item.value}
              >
                {item.label}
              </Cropper.AspectItem>
            );
          })}
        </Cropper.AspectGroup>
        <Cropper.Orientation
          aria-label="Swap orientation"
          className={ghostVariants()}
          render={(props, state) => (
            <button {...props} type="button">
              <Icon className="size-5" name={state.orientation} />
            </button>
          )}
        />
      </div>
    </Zone>
  );
};

export type { AspectRatio };
export { AspectZone };
