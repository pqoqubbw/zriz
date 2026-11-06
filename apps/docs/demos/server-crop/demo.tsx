"use client";

import { createCropper, parse, serialize, toSharp } from "@zriz/core";
import type { Cropper as CropperApi, SharpRecipe } from "@zriz/core";
import { imageOf } from "@zriz/core/dom";
import { CropperContext } from "@zriz/react";
import * as Cropper from "@zriz/react/cropper";
import { useContext, useState, useSyncExternalStore } from "react";

import { Panel } from "@/components/ui/panel";
import { useDemoDim } from "@/demos/shell/context";
import { DemoShell } from "@/demos/shell/demo-shell";
import { DialZone } from "@/demos/shell/dial-zone";
import { ghostVariants } from "@/demos/shell/ghost";
import { Icon } from "@/demos/shell/icon";
import type { DemoRun } from "@/demos/shell/use-download";
import { MAX_ZOOM, MIN_SIZE } from "@/snippets/server-crop/crop-limits";

type Sent = {
  cropper: CropperApi;
  steps: SharpRecipe | null;
  value: string;
};

type LinesProps = {
  children: string;
  label: string;
  slot: string;
};

type ResultProps = {
  sent: Sent | null;
};

const NO_PLAN = "422: this crop does not fit this photo.";

const INDENT = "  ";

const LINE = 28;

const isFlat = (items: readonly unknown[]): boolean =>
  items.every((each) => typeof each !== "object" || each === null);

const pretty = (data: unknown, depth = 0): string => {
  const inner = INDENT.repeat(depth + 1);
  const outer = INDENT.repeat(depth);

  if (Array.isArray(data)) {
    const line = `[${data.map((each) => JSON.stringify(each)).join(", ")}]`;

    if (isFlat(data) && line.length <= LINE) {
      return line;
    }

    const rows = data.map((each) => `${inner}${pretty(each, depth + 1)}`);

    return `[\n${rows.join(",\n")}\n${outer}]`;
  }

  if (typeof data === "object" && data !== null) {
    const entries: [string, unknown][] = Object.entries(data);
    const line = `{ ${entries
      .map(([key, each]) => `"${key}": ${JSON.stringify(each)}`)
      .join(", ")} }`;

    if (isFlat(entries.map(([, each]) => each)) && line.length <= LINE) {
      return line;
    }

    const rows = entries.map(
      ([key, each]) => `${inner}"${key}": ${pretty(each, depth + 1)}`
    );

    return `{\n${rows.join(",\n")}\n${outer}}`;
  }

  return JSON.stringify(data);
};

const Lines = ({ children, label, slot }: LinesProps) => (
  <Panel
    aria-label={label}
    className="-mx-4 scrollbar-none overflow-x-auto overscroll-x-contain rounded-none bg-transparent px-4"
    radius="demo"
    tabIndex={0}
  >
    <pre className="w-max pe-4" data-slot={slot}>
      {children}
    </pre>
  </Panel>
);

const planOf = (cropper: CropperApi, value: string): SharpRecipe | null => {
  const image = imageOf(cropper);
  const saved = parse(value);

  if (!image || !saved) {
    return null;
  }

  const size = { height: image.height, width: image.width };
  const server = createCropper({
    image: size,
    maxZoom: MAX_ZOOM,
    minSize: MIN_SIZE,
  });

  server.setValue(saved);

  const plan = server.getPixelCrop();

  server.destroy();

  return plan && !plan.homography ? toSharp(plan, size) : null;
};

const useLive = (): CropperApi => {
  const cropper = useContext(CropperContext);

  if (!cropper) {
    throw new Error("server crop result: render inside the demo shell");
  }

  return cropper;
};

const useStale = (cropper: CropperApi, sent: Sent | null): boolean =>
  useSyncExternalStore(
    (listener) => cropper.on("change", listener),
    () => sent !== null && serialize(cropper.getValue()) !== sent.value,
    () => false
  );

const Result = ({ sent }: ResultProps) => {
  const cropper = useLive();
  const stale = useStale(cropper, sent);
  const dim = useDemoDim();

  if (!sent || sent.cropper !== cropper) {
    return null;
  }

  return (
    <dl
      className="mt-2 flex w-full flex-col gap-1 rounded-control p-4 font-mono text-code text-code-ink inset-shadow-edge data-dim:opacity-40 data-stale:opacity-40"
      data-dim={dim ? "" : undefined}
      data-slot="result"
      data-stale={stale ? "" : undefined}
    >
      <dt className="text-faint">serialize(value)</dt>
      <dd>
        <Lines label="Sent value" slot="sent-value">
          {sent.value}
        </Lines>
      </dd>
      <dt className="mt-3 text-faint">toSharp(plan)</dt>
      <dd>
        <Lines label="Sharp steps" slot="sent-plan">
          {sent.steps ? pretty(sent.steps) : NO_PLAN}
        </Lines>
      </dd>
    </dl>
  );
};

const ServerCropDemo = () => {
  const [sent, setSent] = useState<Sent | null>(null);

  const send: DemoRun = async (cropper) => {
    const value = serialize(cropper.getValue());

    setSent({ cropper, steps: planOf(cropper, value), value });

    await Promise.resolve();
  };

  return (
    <DemoShell
      maxZoom={MAX_ZOOM}
      minSize={MIN_SIZE}
      name="server-crop"
      onAction={send}
      photoProps={() => ({})}
      svg={false}
    >
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
      <Result sent={sent} />
    </DemoShell>
  );
};

export default ServerCropDemo;
