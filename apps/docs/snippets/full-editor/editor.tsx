"use client";

import { exportCrop } from "@zriz/core/dom";
import type {
  ChangeReason,
  CommitDetails,
  Cropper as CropperApi,
  CropValue,
} from "@zriz/react";
import * as Cropper from "@zriz/react/cropper";
import "@zriz/react/styles.css";
import { useEffect, useRef, useState } from "react";
import "./forced-colors.css";

const handles = [
  "top-left",
  "top",
  "top-right",
  "right",
  "bottom-right",
  "bottom",
  "bottom-left",
  "left",
] as const;

const track = {
  width: 200,
  height: 24,
  backgroundImage:
    "linear-gradient(currentColor, currentColor)",
  backgroundSize: "100% 2px",
  backgroundPosition: "center",
  backgroundRepeat: "no-repeat",
};

const thumb = {
  top: 4,
  width: 16,
  height: 16,
  borderRadius: 8,
  background: "currentColor",
  translate: "-50%",
};

const aspects = [
  { label: "free", value: "free" },
  { label: "original", value: "original" },
  { label: "square", value: 1 },
  { label: "4:5", value: 4 / 5 },
  { label: "16:9", value: 16 / 9 },
] as const;

const spoken: Partial<Record<ChangeReason, string>> = {
  "rotate-90": "Turned 90 degrees",
  flip: "Flipped",
  orientation: "Orientation swapped",
  reset: "Crop reset",
};

const announce = (_: CropValue, details: CommitDetails) =>
  spoken[details.reason] ?? null;

const instructions = [
  "Drag the photo to move it.",
  "Arrows move the crop. Alt and arrows resize it.",
  "Plus and minus zoom, and 0 resets.",
].join(" ");

type Props = { src: string; onSave: (jpeg: Blob) => void };

export const Editor = ({ src, onSave }: Props) => {
  const actions = useRef<CropperApi>(null);
  const running = useRef<AbortController | null>(null);
  const [saving, setSaving] = useState(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [exportFailed, setExportFailed] = useState(false);
  const [shown, setShown] = useState(src);

  if (shown !== src) {
    setShown(src);
    setReady(false);
    setFailed(false);
    setExportFailed(false);
  }

  useEffect(() => () => running.current?.abort(), [src]);

  const save = async () => {
    if (!actions.current || running.current) return;
    const controller = new AbortController();

    running.current = controller;
    setSaving(true);
    setExportFailed(false);

    try {
      const { blob } = await exportCrop(actions.current, {
        signal: controller.signal,
      });

      onSave(blob);
    } catch {
      setExportFailed(!controller.signal.aborted);
    } finally {
      running.current = null;
      setSaving(false);
    }
  };

  return (
    <Cropper.Root
      key={src}
      actionsRef={actions}
      src={src}
      onLoad={() => setReady(true)}
      onError={() => setFailed(true)}
    >
      <Cropper.Viewport
        style={{ maxWidth: 640, height: 480, padding: 24 }}
      >
        <Cropper.Image />
        <Cropper.Mask />
        <Cropper.Area aria-label="Crop area">
          <Cropper.Grid />
          {handles.map((position) => (
            <Cropper.Handle
              key={position}
              position={position}
            />
          ))}
        </Cropper.Area>
      </Cropper.Viewport>
      <Cropper.DialValue
        format={(degrees) =>
          `${Math.sign(degrees) * Math.round(Math.abs(degrees))}°`
        }
      />
      <Cropper.Dial
        aria-label="Straighten"
        style={{ maxWidth: 361 }}
      >
        <Cropper.DialTicks />
      </Cropper.Dial>
      <Cropper.Zoom aria-label="Zoom" style={track}>
        <Cropper.ZoomThumb style={thumb} />
      </Cropper.Zoom>
      <Cropper.AspectGroup aria-label="Aspect ratio">
        {aspects.map((aspect) => (
          <Cropper.AspectItem
            key={aspect.label}
            value={aspect.value}
          >
            {aspect.label}
          </Cropper.AspectItem>
        ))}
      </Cropper.AspectGroup>
      <Cropper.Orientation>orientation</Cropper.Orientation>
      <Cropper.Rotate>rotate</Cropper.Rotate>
      <Cropper.Flip>flip</Cropper.Flip>
      <Cropper.Reset>reset</Cropper.Reset>
      <Cropper.Instructions>
        {instructions}
      </Cropper.Instructions>
      <Cropper.Announcer announce={announce} />
      <button
        type="button"
        disabled={!ready}
        aria-disabled={saving}
        onClick={save}
      >
        export
      </button>
      {failed && <p role="alert">this photo does not open.</p>}
      {exportFailed && (
        <p role="alert">this crop did not save. try again.</p>
      )}
    </Cropper.Root>
  );
};
