import { toSharp } from "@zriz/core";
import type { ExportPlan } from "@zriz/core";
import sharp from "sharp";
import type { OutputInfo, Sharp } from "sharp";

type Raw = { data: Buffer; info: OutputInfo };
const open = (image: Raw) =>
  sharp(image.data, {
    raw: image.info,
    limitInputPixels: false,
  });
const raw = (pipeline: Sharp) =>
  pipeline.raw().toBuffer({ resolveWithObject: true });

const cut = async (input: Buffer, plan: ExportPlan) => {
  const upright = await raw(sharp(input).rotate());
  const steps = toSharp(plan, upright.info);
  if (steps.kind === "extract") {
    return open(upright)
      .extract(steps.extract)
      .flop(steps.flop)
      .rotate(steps.rotate);
  }
  const [[a, b], [c, d]] = steps.affine;
  const padded = await raw(open(upright).extend(steps.extend));
  const turned = await raw(
    open(padded).affine([a, b, c, d], steps.options)
  );
  return open(turned).extract(steps.extract);
};

export const POST = async (request: Request) => {
  const form = await request.formData();
  const file = form.get("file");
  const plan = form.get("plan");
  if (!(file instanceof File) || typeof plan !== "string") {
    return new Response("send a file and a plan.", {
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
  try {
    const crop = await cut(
      input,
      JSON.parse(plan) as ExportPlan
    );
    const jpeg = await crop
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 92 })
      .toBuffer();
    return new Response(new Uint8Array(jpeg), {
      headers: { "content-type": "image/jpeg" },
    });
  } catch {
    return new Response("this plan does not fit this photo.", {
      status: 422,
    });
  }
};
