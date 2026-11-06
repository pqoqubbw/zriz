"use client";

import type { ExportOptions } from "@zriz/core/dom";
import { CropperContext, useCropperState } from "@zriz/react";
import * as Cropper from "@zriz/react/cropper";
import { useContext, useEffect } from "react";

import {
  jsonText,
  rootChanges,
  viewportChanges,
} from "@/demos/playground/code";
import { playground } from "@/demos/playground/store";
import { usePlayground } from "@/demos/playground/use-playground";
import { DemoShell } from "@/demos/shell/demo-shell";
import { DialZone } from "@/demos/shell/dial-zone";
import { ghostVariants } from "@/demos/shell/ghost";
import { Icon } from "@/demos/shell/icon";
import { exportRun } from "@/demos/shell/use-download";

const PNG: ExportOptions = { type: "image/png" };

const savePng = exportRun(PNG);

const { change: handleChange, commit: handleCommit } = playground;

const Bridge = () => {
  const cropper = useContext(CropperContext);
  const ready = useCropperState((state) => state.ready);
  const vertical = usePlayground((state) => state.knobs.vertical);
  const horizontal = usePlayground((state) => state.knobs.horizontal);

  useEffect(
    () =>
      cropper
        ? playground.attach({
            copy: () => jsonText(cropper.getValue()),
            download: async (signal) => {
              await savePng(cropper, signal);
            },
          })
        : undefined,
    [cropper]
  );

  useEffect(() => {
    playground.setReady(ready);
  }, [ready]);

  useEffect(() => {
    if (!cropper || !ready) {
      return;
    }

    const now = cropper.getValue().perspective;

    if (now.vertical !== vertical || now.horizontal !== horizontal) {
      const perspective = { horizontal, vertical };

      playground.ask(perspective);
      cropper.setValue({ perspective });
    }
  }, [cropper, ready, vertical, horizontal]);

  return null;
};

const PlaygroundDemo = () => {
  const knobs = usePlayground((state) => state.knobs);

  useEffect(() => playground.reset, []);

  return (
    <DemoShell
      {...rootChanges(knobs)}
      exportOptions={PNG}
      name="playground"
      onValueChange={handleChange}
      onValueCommit={handleCommit}
      shape={knobs.shape}
      viewport={viewportChanges(knobs)}
    >
      <div className="contents in-data-disabled:**:data-[slot=scale]:opacity-40">
        <DialZone
          end={
            <Cropper.Flip aria-label="Flip" className={ghostVariants()}>
              <Icon className="size-5" name="flip-horizontal" />
            </Cropper.Flip>
          }
          start={
            <Cropper.Rotate
              aria-label="Rotate left"
              className={ghostVariants()}
            >
              <Icon className="size-5" name="rotate-left" />
            </Cropper.Rotate>
          }
        />
      </div>
      <Bridge />
    </DemoShell>
  );
};

export default PlaygroundDemo;
