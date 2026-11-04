import { drawn, fitEdge, loadElement, textOf } from "./media";
import { svgSize } from "./svg-size";

const fromSvg = async (blob: Blob, edge: number): Promise<ImageBitmap> => {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const size = fitEdge(svgSize(textOf(bytes)), edge);
  const reader = new FileReader();

  await new Promise((resolve) => {
    reader.onloadend = resolve;
    reader.readAsDataURL(blob.slice(0, blob.size, "image/svg+xml"));
  });

  const url = typeof reader.result === "string" ? reader.result : "";

  return await drawn(await loadElement(url), size);
};

export { isSvg } from "./svg-size";
export { fromSvg };
