"use client";

import * as Cropper from "@zriz/react/cropper";

import { Icon } from "@/components/ui/icon";
import { useDemoDim } from "@/demos/shell/context";
import { DemoShell } from "@/demos/shell/demo-shell";
import { ghostVariants } from "@/demos/shell/ghost";
import { Zone, ZoneRow } from "@/demos/shell/layout";

const ButtonsRow = () => {
  const dim = useDemoDim();

  return (
    <Zone data-dim={dim ? "" : undefined} kind="row">
      <ZoneRow>
        <Cropper.Rotate aria-label="Rotate left" className={ghostVariants()}>
          <Icon className="size-5" name="rotate-left" />
        </Cropper.Rotate>
        <Cropper.Rotate
          aria-label="Rotate right"
          className={ghostVariants()}
          direction="cw"
        >
          <Icon className="size-5" name="rotate-right" />
        </Cropper.Rotate>
        <Cropper.Flip aria-label="Flip" className={ghostVariants()}>
          <Icon className="size-5" name="flip-horizontal" />
        </Cropper.Flip>
        <Cropper.Flip
          aria-label="Flip vertically"
          axis="y"
          className={ghostVariants()}
        >
          <Icon className="size-5" name="flip-vertical" />
        </Cropper.Flip>
      </ZoneRow>
    </Zone>
  );
};

const ButtonsDemo = () => (
  <DemoShell name="buttons">
    <ButtonsRow />
  </DemoShell>
);

export default ButtonsDemo;
