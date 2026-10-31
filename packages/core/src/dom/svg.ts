import { drawn, fitEdge, loadElement } from "./media";
import { svgSize } from "./svg-size";

export { sniff } from "./svg-size";

export const fromSvg = async (
  blob: Blob,
  edge: number
): Promise<ImageBitmap> => {
  const size = fitEdge(svgSize(await blob.text()), edge * 4);
  const url = URL.createObjectURL(blob);
  try {
    return await drawn(await loadElement(url, undefined), fitEdge(size, edge));
  } finally {
    URL.revokeObjectURL(url);
  }
};
