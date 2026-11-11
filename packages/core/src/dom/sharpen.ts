import { applyHomography, invertMatrix3 } from "../geometry/matrix";
import { toolsOf } from "./free";
import type { LoadedImage } from "./image";
import type { Region } from "./kernel";
import { TIMEOUT_MS } from "./turn";
import type { ViewFrame } from "./view";

const SHARPEN_RATIO = 1.02;

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

const refine = async (
  frame: ViewFrame,
  image: LoadedImage,
  live: () => boolean = () => true
): Promise<{ bitmap: ImageBitmap | null; region: Region }> => {
  const { dpr } = frame.layout;
  const [a, c, , b, d] = frame.matrix;
  const devicePerSource = Math.sqrt(Math.abs(a * d - b * c)) * dpr;
  const previewPerSource =
    Math.max(image.preview.width, image.preview.height) /
    Math.max(image.width, image.height);
  const ratio = devicePerSource / previewPerSource;

  if (ratio <= 1 / SHARPEN_RATIO) {
    const visible = visibleRect(frame, image);
    const kx = image.preview.width / image.width;
    const ky = image.preview.height / image.height;
    const x = Math.floor(visible.x * kx);
    const y = Math.floor(visible.y * ky);
    const width = Math.min(
      image.preview.width - x,
      Math.max(1, Math.ceil((visible.x + visible.width) * kx) - x)
    );
    const height = Math.min(
      image.preview.height - y,
      Math.max(1, Math.ceil((visible.y + visible.height) * ky) - y)
    );

    return {
      bitmap: await toolsOf().resampleOff(
        image.id,
        { height, width, x, y },
        Math.max(1, Math.round(width * ratio)),
        Math.max(1, Math.round(height * ratio))
      ),
      region: {
        height: height / ky,
        width: width / kx,
        x: x / kx,
        y: y / ky,
      },
    };
  }

  if (ratio > SHARPEN_RATIO && previewPerSource < 1) {
    const region = visibleRect(frame, image);

    return {
      bitmap: await toolsOf().decodeTurn(
        async () =>
          live()
            ? await toolsOf().regionOff(
                image.source,
                region,
                Math.max(1, Math.round(region.width * devicePerSource)),
                Math.max(1, Math.round(region.height * devicePerSource))
              )
            : null,
        TIMEOUT_MS,
        undefined
      ),
      region,
    };
  }

  return {
    bitmap: null,
    region: { height: image.height, width: image.width, x: 0, y: 0 },
  };
};

export { refine };
