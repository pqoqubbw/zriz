import { createCropper, parse, toSharp } from "@zriz/core";
import sharp from "sharp";
import type { OutputInfo, Sharp } from "sharp";
import { canCrop } from "../../../can-crop";
import { MAX_ZOOM, MIN_SIZE } from "../../../crop-limits";

const MAX_BODY = 50 * 1024 * 1024;
const MAX_VALUE = 4096;
const MAX_PIXELS = 120_000_000;
const MAX_RUNNING = 2;
const MAX_SECONDS = 30;
const HEADERS = {
  "cache-control": "private, no-store",
  "x-content-type-options": "nosniff",
};

sharp.block({ operation: ["VipsForeignLoad"] });

sharp.unblock({
  operation: [
    "VipsForeignLoadJpegBuffer",
    "VipsForeignLoadPngBuffer",
    "VipsForeignLoadWebpBuffer",
    "VipsForeignLoadHeifBuffer",
  ],
});

let running = 0;

const refuse = (text: string, status: number) =>
  new Response(text, { headers: HEADERS, status });

type Raw = { data: Buffer; info: OutputInfo };
const open = (image: Raw) =>
  sharp(image.data, {
    raw: image.info,
    limitInputPixels: false,
  });
const raw = (pipeline: Sharp) =>
  pipeline
    .timeout({ seconds: MAX_SECONDS })
    .raw()
    .toBuffer({ resolveWithObject: true });

const cut = async (input: Buffer, value: string) => {
  const saved = parse(value);

  if (!saved) throw new TypeError("not a crop value");
  const upright = await raw(
    sharp(input, { limitInputPixels: MAX_PIXELS }).rotate()
  );
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

const readForm = async (request: Request) => {
  let seen = 0;
  const capped = request.body?.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, stream) {
        seen += chunk.length;
        if (seen > MAX_BODY) stream.error(new RangeError());
        else stream.enqueue(chunk);
      },
    })
  );
  const form = await new Response(capped, {
    headers: request.headers,
  })
    .formData()
    .catch(() => null);

  return { form, over: seen > MAX_BODY };
};

const answer = async (request: Request) => {
  const { form, over } = await readForm(request);

  if (over) return refuse("this upload is too large.", 413);
  const file = form?.get("file");
  const value = form?.get("value");

  if (
    !(file instanceof File) ||
    file.size === 0 ||
    typeof value !== "string"
  ) {
    return refuse("send a file and a crop value.", 400);
  }

  if (value.length > MAX_VALUE) {
    return refuse("this crop does not fit this photo.", 422);
  }

  const input = Buffer.from(await file.arrayBuffer());
  const meta = await sharp(input)
    .metadata()
    .catch(() => null);

  if (!meta) return refuse("sharp cannot open this file.", 400);

  if (meta.format === "heif" && meta.compression !== "av1") {
    return refuse("send a jpeg, png, webp or avif.", 415);
  }

  if (meta.width * meta.height > MAX_PIXELS) {
    return refuse("this photo has too many pixels.", 413);
  }

  if (meta.format === "webp" && (meta.orientation ?? 1) > 1) {
    return refuse(
      "save this webp without an orientation tag.",
      422
    );
  }

  try {
    const crop = await cut(input, value);
    const jpeg = await crop
      .timeout({ seconds: MAX_SECONDS })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 92 })
      .toBuffer();

    return new Response(new Uint8Array(jpeg), {
      headers: { ...HEADERS, "content-type": "image/jpeg" },
    });
  } catch {
    return refuse("this crop does not fit this photo.", 422);
  }
};

export const POST = async (request: Request) => {
  if (!(await canCrop(request))) {
    return refuse("sign in to crop a photo.", 401);
  }

  const length = Number(request.headers.get("content-length"));

  if (!(length > 0) || length > MAX_BODY) {
    return refuse("this upload is too large.", 413);
  }

  if (running >= MAX_RUNNING) {
    return refuse("the server is busy. try again.", 503);
  }

  running += 1;

  try {
    return await answer(request);
  } finally {
    running -= 1;
  }
};
