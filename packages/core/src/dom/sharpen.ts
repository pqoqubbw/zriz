import { applyHomography, invertMatrix3 } from "../geometry/matrix";
import type { LoadedImage } from "./image";
import type { Region } from "./kernel";
import type { ViewFrame } from "./view";
import { regionOff, resampleOff } from "./worker";

const DETAIL = 1.02;

const visibleRect = (frame: ViewFrame, image: LoadedImage): Region => {
  const back = invertMatrix3(frame.matrix);
  const { width, height } = frame.layout;
  const corners = [
    applyHomography(back, { x: 0, y: 0 }),
    applyHomography(back, { x: width, y: 0 }),
    applyHomography(back, { x: 0, y: height }),
    applyHomography(back, { x: width, y: height }),
  ];
  const x0 = Math.max(0, Math.floor(Math.min(...corners.map((c) => c.x))));
  const y0 = Math.max(0, Math.floor(Math.min(...corners.map((c) => c.y))));
  const x1 = Math.min(
    image.width,
    Math.ceil(Math.max(...corners.map((c) => c.x)))
  );
  const y1 = Math.min(
    image.height,
    Math.ceil(Math.max(...corners.map((c) => c.y)))
  );
  return {
    height: Math.max(1, y1 - y0),
    width: Math.max(1, x1 - x0),
    x: x0,
    y: y0,
  };
};

export const refine = async (
  frame: ViewFrame,
  image: LoadedImage
): Promise<{ bitmap: ImageBitmap | null; region: Region }> => {
  const { dpr } = frame.layout;
  const [a, c, , b, d] = frame.matrix;
  const devicePerSource = Math.sqrt(Math.abs(a * d - b * c)) * dpr;
  const previewPerSource =
    Math.max(image.preview.width, image.preview.height) /
    Math.max(image.width, image.height);
  const ratio = devicePerSource / previewPerSource;
  if (ratio <= 1 / DETAIL) {
    return {
      bitmap: await resampleOff(image.id, ratio),
      region: { height: image.height, width: image.width, x: 0, y: 0 },
    };
  }
  if (ratio > DETAIL && previewPerSource < 1) {
    const region = visibleRect(frame, image);
    return {
      bitmap: await regionOff(
        image.source,
        region,
        Math.max(1, Math.round(region.width * devicePerSource)),
        Math.max(1, Math.round(region.height * devicePerSource))
      ),
      region,
    };
  }
  return {
    bitmap: null,
    region: { height: image.height, width: image.width, x: 0, y: 0 },
  };
};
