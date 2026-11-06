"use client";

import { parse, serialize } from "@zriz/core";
import type { CommitDetails, CropValue } from "@zriz/react";
import * as Cropper from "@zriz/react/cropper";

import type { DemoPhoto } from "@/demos/shell/context";
import { DemoShell } from "@/demos/shell/demo-shell";
import type { PhotoProps } from "@/demos/shell/demo-shell";
import { DialZone } from "@/demos/shell/dial-zone";
import { ghostVariants } from "@/demos/shell/ghost";
import { Icon } from "@/demos/shell/icon";

const PREFIX = "zriz-docs:saving-state:";

const read = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const write = (key: string, text: string): void => {
  try {
    localStorage.setItem(key, text);
  } catch (error) {
    console.warn("the crop was not saved", error);
  }
};

const savedCrop = (photo: DemoPhoto): PhotoProps => {
  const key = `${PREFIX}${photo.id}`;

  return {
    defaultValue: parse(read(key)) ?? undefined,
    onValueCommit: (value: CropValue, details: CommitDetails) => {
      if (details.reason !== "coverage") {
        write(key, serialize(value));
      }
    },
  };
};

const SavingStateDemo = () => (
  <DemoShell name="saving-state" photoProps={savedCrop}>
    <DialZone
      end={
        <Cropper.Flip aria-label="Flip" className={ghostVariants()}>
          <Icon className="size-5" name="flip-horizontal" />
        </Cropper.Flip>
      }
      start={
        <Cropper.Rotate aria-label="Rotate left" className={ghostVariants()}>
          <Icon className="size-5" name="rotate-left" />
        </Cropper.Rotate>
      }
    />
  </DemoShell>
);

export default SavingStateDemo;
