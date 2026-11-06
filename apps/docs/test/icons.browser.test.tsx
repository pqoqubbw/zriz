import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ICON_NAMES, Icon } from "../components/ui/icon";
import {
  ICON_NAMES as DEMO_ICON_NAMES,
  Icon as DemoIcon,
} from "../demos/shell/icon";

type InkBox = {
  bottom: number;
  left: number;
  right: number;
  top: number;
};

const SCALE = 40;
const SIZE = 20 * SCALE;
const MAX_OFFSET = 0.2;
const STEP = 1 / SCALE;
const EDGE = 2 - 1.25 / 2;

const NAMES = [
  ...ICON_NAMES.map((name) => ({ demo: false, name })),
  ...DEMO_ICON_NAMES.map((name) => ({ demo: true, name })),
].map(({ demo, name }) => [demo ? `demo ${name}` : name, demo, name] as const);

const elementOf = (demo: boolean, name: string): ReactElement => {
  const own = DEMO_ICON_NAMES.find((each) => each === name);
  const site = ICON_NAMES.find((each) => each === name);

  if (demo && own) {
    return <DemoIcon color="#000" height={SIZE} name={own} width={SIZE} />;
  }

  if (!demo && site) {
    return <Icon color="#000" height={SIZE} name={site} width={SIZE} />;
  }

  throw new Error(`no icon named ${name}`);
};

const svgOf = (demo: boolean, name: string): SVGSVGElement => {
  const host = document.createElement("div");

  host.innerHTML = renderToStaticMarkup(elementOf(demo, name));

  const svg = host.querySelector("svg");

  if (!svg) {
    throw new Error(`no svg for ${name}`);
  }

  svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");

  return svg;
};

const inkBoxOf = async (svg: SVGSVGElement): Promise<InkBox> => {
  const image = new Image();

  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.outerHTML)}`;

  await image.decode();

  const canvas = document.createElement("canvas");

  canvas.width = SIZE;
  canvas.height = SIZE;

  const context = canvas.getContext("2d", { willReadFrequently: true });

  if (!context) {
    throw new Error("no canvas");
  }

  context.drawImage(image, 0, 0, SIZE, SIZE);

  const { data } = context.getImageData(0, 0, SIZE, SIZE);
  const box = { bottom: -1, left: SIZE, right: -1, top: SIZE };

  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      if ((data[(y * SIZE + x) * 4 + 3] ?? 0) >= 128) {
        box.left = Math.min(box.left, x);
        box.right = Math.max(box.right, x + 1);
        box.top = Math.min(box.top, y);
        box.bottom = Math.max(box.bottom, y + 1);
      }
    }
  }

  return {
    bottom: box.bottom / SCALE,
    left: box.left / SCALE,
    right: box.right / SCALE,
    top: box.top / SCALE,
  };
};

describe("icons", () => {
  it.each(NAMES)("draws %s on the 20 px grid", (_, demo, name) => {
    const svg = svgOf(demo, name);

    expect({
      linecap: svg.getAttribute("stroke-linecap"),
      linejoin: svg.getAttribute("stroke-linejoin"),
      paths: svg.querySelectorAll("path").length > 0,
      stroke: svg.getAttribute("stroke-width"),
      transforms: svg.querySelectorAll("[transform]").length,
      viewBox: svg.getAttribute("viewBox"),
    }).toStrictEqual({
      linecap: "round",
      linejoin: "round",
      paths: true,
      stroke: "1.25",
      transforms: 0,
      viewBox: "0 0 20 20",
    });
  });

  it.each(NAMES)("centres the ink of %s in its box", async (_, demo, name) => {
    const box = await inkBoxOf(svgOf(demo, name));

    expect(
      Math.min(box.left, box.top, 20 - box.right, 20 - box.bottom)
    ).toBeGreaterThanOrEqual(EDGE);

    expect(Math.abs((box.left + box.right) / 2 - 10)).toBeLessThanOrEqual(
      MAX_OFFSET + STEP / 2
    );

    expect(Math.abs((box.top + box.bottom) / 2 - 10)).toBeLessThanOrEqual(
      MAX_OFFSET + STEP / 2
    );
  });
});
