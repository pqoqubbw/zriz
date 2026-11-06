"use client";

import * as Cropper from "@zriz/react/cropper";

import { AspectZone } from "@/demos/shell/aspect-zone";
import { DemoShell } from "@/demos/shell/demo-shell";
import { DialZone } from "@/demos/shell/dial-zone";
import { ghostVariants } from "@/demos/shell/ghost";
import { Icon } from "@/demos/shell/icon";

const FullEditorDemo = () => (
  <DemoShell name="full-editor">
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
    <AspectZone />
  </DemoShell>
);

export default FullEditorDemo;
