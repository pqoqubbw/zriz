import { createCropper, parse, toSharp } from "@zriz/core";
import sharp from "sharp";
import type { OutputInfo, Sharp } from "sharp";
import { MAX_ZOOM, MIN_SIZE } from "../../../crop-limits";

const MAX_BODY = 50 * 1024 * 1024;

type Raw = { data: Buffer; info: OutputInfo };
const open = (image: Raw) =>
  sharp(image.data, {
    raw: image.info,
    limitInputPixels: false,
  });
const raw = (pipeline: Sharp) =>
  pipeline.raw().toBuffer({ resolveWithObject: true });

const cut = async (input: Buffer, value: string) => {
  const saved = parse(value);
  if (!saved) throw new TypeError("not a crop value");
  const upright = await raw(sharp(input).rotate());
  const cropper = createCropper({
    image: upright.info,
    maxZoom: MAX_ZOOM,
    minSize: MIN_SIZE,
  });
  cropper.setValue(saved);
  const plan = cropper.getPixelCrop();
  if (!plan || plan.homography)
    throw new RangeError("no flat plan");
  const steps = toSharp(plan, upright.info);
  if (steps.kind === "extract") {
    const turned = await raw(
      open(upright)
        .extract(steps.extract)
        .flop(steps.flop)
        .rotate(steps.rotate)
    );
    return open(turned).resize({
      ...steps.resize,
      fit: "fill",
    });
  }
  const [[a, b], [c, d]] = steps.affine;
  const padded = await raw(
    open(upright).extract(steps.source).extend(steps.extend)
  );
  const turned = await raw(
    open(padded).affine([a, b, c, d], steps.options)
  );
  return open(turned).extract(steps.extract);
};

export const POST = async (request: Request) => {
  const length = Number(request.headers.get("content-length"));
  if (!length || length > MAX_BODY) {
    return new Response("this upload is too large.", {
      status: 413,
    });
  }
  const form = await request.formData();
  const file = form.get("file");
  const value = form.get("value");
  if (!(file instanceof File) || typeof value !== "string") {
    return new Response("send a file and a crop value.", {
      status: 400,
    });
  }
  const input = Buffer.from(await file.arrayBuffer());
  const meta = await sharp(input)
    .metadata()
    .catch(() => null);
  if (!meta) {
    return new Response("sharp cannot open this file.", {
      status: 400,
    });
  }
  if (meta.format === "webp" && (meta.orientation ?? 1) > 1) {
    return new Response(
      "save this webp without an orientation tag.",
      {
        status: 422,
      }
    );
  }
  try {
    const crop = await cut(input, value);
    const jpeg = await crop
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 92 })
      .toBuffer();
    return new Response(new Uint8Array(jpeg), {
      headers: { "content-type": "image/jpeg" },
    });
  } catch {
    return new Response("this crop does not fit this photo.", {
      status: 422,
    });
  }
};
