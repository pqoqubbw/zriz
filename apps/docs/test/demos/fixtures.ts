import type { DemoPhotoKind } from "../../demos/registry";

type Shape = "landscape" | "panorama" | "portrait" | "square" | "tall";

const SHAPES: Record<Shape, number> = {
  landscape: 3 / 2,
  panorama: 3,
  portrait: 2 / 3,
  square: 1,
  tall: 9 / 16,
};

const LONG_EDGE = 1200;

const fixtureBlob = async (ratio: number): Promise<Blob> => {
  const width = Math.round(ratio >= 1 ? LONG_EDGE : LONG_EDGE * ratio);
  const height = Math.round(ratio >= 1 ? LONG_EDGE / ratio : LONG_EDGE);
  const canvas = new OffscreenCanvas(width, height);
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("no 2d context");
  }

  const sky = context.createLinearGradient(0, 0, 0, height);

  sky.addColorStop(0, "#6f8fb3");
  sky.addColorStop(0.55, "#d9c7a6");
  sky.addColorStop(0.56, "#3d5a73");
  sky.addColorStop(1, "#1f2f3d");
  context.fillStyle = sky;
  context.fillRect(0, 0, width, height);
  context.fillStyle = "#f2e3c4";
  context.beginPath();

  context.arc(
    width * 0.5,
    height * 0.3,
    Math.min(width, height) * 0.08,
    0,
    Math.PI * 2
  );

  context.fill();

  return await canvas.convertToBlob({ type: "image/png" });
};

const fixtureFile = async (shape: Shape): Promise<File> => {
  const blob = await fixtureBlob(SHAPES[shape]);

  return new File([blob], `${shape}.png`, { type: "image/png" });
};

const fixtureUrl = async (shape: Shape): Promise<string> =>
  URL.createObjectURL(await fixtureBlob(SHAPES[shape]));

const photoMock = async (): Promise<{
  photoUrl: (kind: DemoPhotoKind) => string;
}> => {
  const urls: Record<DemoPhotoKind, string> = {
    landscape: await fixtureUrl("landscape"),
  };

  return { photoUrl: (kind) => urls[kind] };
};

export type { Shape };
export { SHAPES, fixtureBlob, fixtureFile, fixtureUrl, photoMock };
