import { mkdirSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

import { chromium } from "playwright";
import type { Page } from "playwright";
import sharp from "sharp";

type Cell = {
  caption: string;
  degrees: number;
  file: string;
  name: string;
  viewport: number;
};

const CELLS: readonly Cell[] = [
  {
    caption: "landscape 3:2, at rest: every stage is 380 tall",
    degrees: 0,
    file: "sec0.html",
    name: "desktop",
    viewport: 1280,
  },
  {
    caption: "introduction",
    degrees: 4,
    file: "sec5.html",
    name: "phone",
    viewport: 390,
  },
  {
    caption: "360 wide phone: introduction",
    degrees: 4,
    file: "sec5.html",
    name: "narrow",
    viewport: 360,
  },
];

const OURS_HIDDEN =
  '[data-zriz-item="image"], [data-zriz-item="mask"], [data-zriz-item="area"], [data-zriz-item="dial-ticks"] { opacity: 0 !important; }';

const BOARD_HIDDEN =
  '[layer-name="photo"], [layer-name="scrim"], [layer-name="crop area"], [layer-name="dial"] > :not([layer-name="needle"]) { opacity: 0 !important; }';

const CHANNEL_LIMIT = 24;

const SCALE = 2;

const { values } = parseArgs({
  options: {
    board: { type: "string" },
    out: { default: "demo-board-diff", type: "string" },
    url: { default: "http://localhost:4777", type: "string" },
  },
});

if (values.board === undefined) {
  process.stderr.write(
    "usage: node scripts/demo-board-diff.ts --board <demo-board/out> [--url <docs url>] [--out <folder>]\n"
  );

  process.exit(1);
}

const out = path.resolve(values.out);

mkdirSync(out, { recursive: true });

const MAX_KEYS = 40;

const press = async (
  page: Page,
  degrees: number,
  left: number
): Promise<void> => {
  const now = Number(
    await page.locator('[data-zriz-item="dial"]').getAttribute("aria-valuenow")
  );

  if (left === 0 || Math.abs(now - degrees) < 0.05) {
    return;
  }

  await page.keyboard.press(now < degrees ? "ArrowRight" : "ArrowLeft");
  await press(page, degrees, left - 1);
};

const straighten = async (page: Page, degrees: number): Promise<void> => {
  const dial = page.locator('[data-zriz-item="dial"]');

  await dial.focus();
  await press(page, degrees, MAX_KEYS);
  await dial.blur();
  await page.waitForTimeout(800);
};

const shootOurs = async (page: Page, cell: Cell): Promise<Buffer> => {
  await page.setViewportSize({ height: 900, width: cell.viewport });

  await page.goto(`${values.url}/docs/introduction`, {
    waitUntil: "networkidle",
  });

  await page.waitForSelector('[data-zriz-item="image"][data-ready]');
  await straighten(page, cell.degrees);
  await page.addStyleTag({ content: OURS_HIDDEN });
  await page.mouse.move(0, 0);

  return await page.locator("[data-demo]").first().screenshot();
};

const shootBoard = async (page: Page, cell: Cell): Promise<Buffer> => {
  await page.setViewportSize({ height: 900, width: 2200 });
  await page.goto(pathToFileURL(path.join(values.board ?? "", cell.file)).href);
  await page.addStyleTag({ content: BOARD_HIDDEN });

  return await page
    .locator(`[layer-name="${cell.caption}"] [layer-name="demo"]`)
    .first()
    .screenshot();
};

const compare = async (
  ours: Buffer,
  board: Buffer,
  name: string
): Promise<number> => {
  const meta = await sharp(board).metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  const a = await sharp(ours)
    .resize(width, height, { fit: "fill" })
    .removeAlpha()
    .raw()
    .toBuffer();
  const b = await sharp(board).removeAlpha().raw().toBuffer();
  const diff = Buffer.alloc(width * height * 3, 255);
  let off = 0;

  for (let pixel = 0; pixel < width * height; pixel += 1) {
    const at = pixel * 3;
    const delta = Math.max(
      Math.abs((a[at] ?? 0) - (b[at] ?? 0)),
      Math.abs((a[at + 1] ?? 0) - (b[at + 1] ?? 0)),
      Math.abs((a[at + 2] ?? 0) - (b[at + 2] ?? 0))
    );

    if (delta > CHANNEL_LIMIT) {
      off += 1;
      diff[at] = 220;
      diff[at + 1] = 0;
      diff[at + 2] = 0;
    }
  }

  await sharp(diff, { raw: { channels: 3, height, width } })
    .png()
    .toFile(path.join(out, `${name}-diff.png`));

  return off / (width * height);
};

const runCells = async (page: Page, index: number): Promise<void> => {
  const cell = CELLS[index];

  if (!cell) {
    return;
  }

  const ours = await shootOurs(page, cell);
  const board = await shootBoard(page, cell);

  await sharp(ours).toFile(path.join(out, `${cell.name}-ours.png`));
  await sharp(board).toFile(path.join(out, `${cell.name}-board.png`));

  const share = await compare(ours, board, cell.name);

  process.stdout.write(
    `${cell.name}: ${(share * 100).toFixed(2)}% of pixels differ\n`
  );

  await runCells(page, index + 1);
};

const browser = await chromium.launch();

try {
  const page = await browser.newPage({ deviceScaleFactor: SCALE });

  await runCells(page, 0);
} finally {
  await browser.close();
}
