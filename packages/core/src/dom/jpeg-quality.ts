import { canvasFor, context2d, free } from "./media";

const LUMA_SUM = 3688;

const SCAN = 262_144;

const tableSum = (
  view: DataView,
  start: number,
  end: number
): number | null => {
  let at = start;

  while (at < end && at < view.byteLength) {
    const head = view.getUint8(at);
    const wide = Math.floor(head / 16) === 1;
    const size = wide ? 128 : 64;

    if (at + 1 + size > view.byteLength) {
      return null;
    }

    if (head % 16 === 0) {
      let sum = 0;

      for (let i = 0; i < 64; i += 1) {
        sum += wide
          ? view.getUint16(at + 1 + i * 2)
          : view.getUint8(at + 1 + i);
      }

      return sum;
    }

    at += 1 + size;
  }

  return null;
};

const lumaSum = (view: DataView): number | null => {
  if (view.byteLength < 4 || view.getUint16(0) !== 0xff_d8) {
    return null;
  }

  let at = 2;

  while (at + 4 <= view.byteLength) {
    if (view.getUint8(at) !== 0xff) {
      return null;
    }

    const marker = view.getUint8(at + 1);

    if (marker === 0xff) {
      at += 1;
    } else if (marker === 0xda || marker === 0xd9) {
      return null;
    } else {
      const end = at + 2 + view.getUint16(at + 2);
      const sum = marker === 0xdb ? tableSum(view, at + 4, end) : null;

      if (sum !== null) {
        return sum;
      }

      at = end;
    }
  }

  return null;
};

const tableQuality = (sum: number): number => {
  const scale = (sum * 100) / LUMA_SUM;
  const quality = scale <= 100 ? (200 - scale) / 2 : 5000 / scale;

  return Math.min(1, Math.max(0.01, Math.round(quality) / 100));
};

const jpegQuality = async (blob: Blob): Promise<number | null> => {
  const sum = lumaSum(new DataView(await blob.slice(0, SCAN).arrayBuffer()));

  if (sum === null || sum <= 0) {
    return null;
  }

  return tableQuality(sum);
};

const search = async (
  canvas: OffscreenCanvas,
  target: number,
  low: number,
  high: number,
  steps: number
): Promise<number> => {
  if (steps === 0) {
    return low;
  }

  const middle = (low + high) / 2;
  const quality = await jpegQuality(
    await canvas.convertToBlob({ quality: middle, type: "image/jpeg" })
  );

  if (quality === null) {
    return target;
  }

  return quality > target
    ? await search(canvas, target, low, middle, steps - 1)
    : await search(canvas, target, middle, high, steps - 1);
};

const matches = new Map<number, Promise<number>>();

const match = async (target: number): Promise<number> => {
  const canvas = canvasFor({ height: 8, width: 8 });

  context2d(canvas).fillRect(0, 0, 8, 8);

  try {
    return "convertToBlob" in canvas
      ? await search(canvas, target, 0, 1, 8)
      : target;
  } finally {
    free(canvas);
  }
};

const encoderQuality = async (target: number): Promise<number> => {
  let known = matches.get(target);

  if (!known) {
    known = match(target).catch(() => target);
    matches.set(target, known);
  }

  return await known;
};

export { encoderQuality, jpegQuality };
