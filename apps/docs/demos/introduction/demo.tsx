"use client";

import type { CropValue } from "@zriz/react";
import * as Cropper from "@zriz/react/cropper";

import { DemoShell } from "@/demos/shell/demo-shell";
import { DialZone } from "@/demos/shell/dial-zone";
import { ghostVariants } from "@/demos/shell/ghost";
import { Icon } from "@/demos/shell/icon";

const save = (_value: CropValue): void => undefined;

const IntroductionDemo = () => (
  <DemoShell name="introduction" onValueCommit={save}>
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

export default IntroductionDemo;
