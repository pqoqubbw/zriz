import * as Cropper from "@zriz/react/cropper";

declare const file: Blob | null;
declare const src: string;
declare const setFile: (file: File | null) => void;

export const example = (
  <>
    <input
      aria-label="Choose a photo"
      type="file"
      accept="image/*"
      onChange={(event) =>
        setFile(event.target.files?.[0] ?? null)
      }
    />
    <Cropper.Root src={file}>
      <Cropper.Viewport style={{ maxWidth: 480, height: 360 }}>
        <Cropper.Image />
        <Cropper.Mask />
        <Cropper.Area aria-label="Crop area" />
      </Cropper.Viewport>
    </Cropper.Root>
  </>
);
