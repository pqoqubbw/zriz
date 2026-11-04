import * as Cropper from "@zriz/react/cropper";
import type { CropValue } from "@zriz/react";

declare const photo: Blob;
declare const src: string;
declare const save: (value: CropValue) => void;

export const example = (
  <Cropper.Root
    src={photo}
    motion="reduce"
    maxZoom={8}
    onValueCommit={save}
  >
    <Cropper.Viewport wheel="zoom" style={{ height: 400 }}>
      <Cropper.Image />
      <Cropper.Mask />
      <Cropper.Area aria-label="Crop area">
        <Cropper.Grid />
      </Cropper.Area>
    </Cropper.Viewport>
    <Cropper.DialValue
      format={(angle) =>
        `${Math.sign(angle) * Math.round(Math.abs(angle))}°`
      }
    />
    <Cropper.Dial aria-label="Straighten">
      <Cropper.DialTicks />
    </Cropper.Dial>
    <Cropper.AspectGroup aria-label="Aspect ratio">
      <Cropper.AspectItem value="free">free</Cropper.AspectItem>
      <Cropper.AspectItem value={1}>1:1</Cropper.AspectItem>
      <Cropper.AspectItem value={4 / 5}>4:5</Cropper.AspectItem>
      <Cropper.AspectItem value={16 / 9}>16:9</Cropper.AspectItem>
    </Cropper.AspectGroup>
  </Cropper.Root>
);
