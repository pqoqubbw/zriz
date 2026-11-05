import { mkdirSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

import { chromium } from "playwright";
import type { Page } from "playwright";
import sharp from "sharp";

import { DEMO_NAMES, DEMO_SPECS } from "../demos/registry.ts";
import type { DemoName, ZoneSpec } from "../demos/registry.ts";

type Base = "aspect" | "avatar" | "editor";

type Cell = {
  caption: string;
  degrees: number;
  file: string;
};

type Width = {
  cells: Partial<Record<Base, Cell>>;
  name: string;
  viewport: number;
};

type Job = {
  base: Base;
  cell: Cell;
  demo: DemoName;
  whole: boolean;
  width: Width;
};

const WIDTHS: readonly Width[] = [
  {
    cells: {
      aspect: {
        caption: "free, also after reset: presets follow the photo",
        degrees: 0,
        file: "sec2.html",
      },
      avatar: {
        caption: "at rest: zoom out is off at 1× (the demo derives it)",
        degrees: 0,
        file: "sec3.html",
      },
      editor: {
        caption: "landscape 3:2, at rest: every stage is 380 tall",
        degrees: 0,
        file: "sec0.html",
      },
    },
    name: "560",
    viewport: 1280,
  },
  {
    cells: {
      aspect: { caption: "aspect ratio", degrees: 0, file: "sec5.html" },
      avatar: { caption: "avatar", degrees: 0, file: "sec5.html" },
      editor: { caption: "introduction", degrees: 4, file: "sec5.html" },
    },
    name: "390",
    viewport: 390,
  },
  {
    cells: {
      aspect: {
        caption: "360 wide phone: aspect ratio",
        degrees: 0,
        file: "sec5.html",
      },
      editor: {
        caption: "360 wide phone: introduction",
        degrees: 4,
        file: "sec5.html",
      },
    },
    name: "360",
    viewport: 360,
  },
];

const OURS_HIDDEN =
  '[data-zriz-item="image"], [data-zriz-item="mask"], [data-zriz-item="area"], [data-zriz-item="dial-ticks"] { opacity: 0 !important; }';

const BOARD_HIDDEN =
  '[layer-name="photo"], [layer-name="scrim"], [layer-name="crop area"], [layer-name="dial"] > :not([layer-name="needle"]) { opacity: 0 !important; }';

const CHANNEL_LIMIT = 24;

const MAX_KEYS = 40;

const PANEL_PAD = 4;

const SCALE = 2;

const { values } = parseArgs({
  options: {
    board: { type: "string" },
    demo: { type: "string" },
    out: { default: "demo-board-diff", type: "string" },
    url: { default: "http://localhost:4777", type: "string" },
  },
});

if (values.board === undefined) {
  process.stderr.write(
    "usage: node scripts/demo-board-diff.ts --board <demo-board/out> [--url <docs url>] [--out <folder>] [--demo <name,name>]\n"
  );

  process.exit(1);
}

const out = path.resolve(values.out);

mkdirSync(out, { recursive: true });

const baseOf = (zone: ZoneSpec | undefined): Base => {
  if (zone?.kind === "zoom") {
    return "avatar";
  }

  return zone?.kind === "aspect" || zone?.kind === "track"
    ? "aspect"
    : "editor";
};

const matchesBase = (zones: readonly ZoneSpec[], base: Base): boolean => {
  const [zone, ...rest] = zones;

  if (!zone || rest.length > 0) {
    return false;
  }

  if (base === "editor") {
    return (
      zone.kind === "dial" &&
      zone.value &&
      zone.start === "rotate-left" &&
      zone.end === "flip-horizontal"
    );
  }

  return zone.kind === (base === "aspect" ? "aspect" : "zoom");
};

const jobsFor = (demo: DemoName): Job[] => {
  const { zones } = DEMO_SPECS[demo];
  const base = baseOf(zones[0]);
  const whole = matchesBase(zones, base);

  return WIDTHS.flatMap((width): Job[] => {
    const own = width.cells[base];
    const cell = own ?? width.cells.editor;

    return cell
      ? [{ base, cell, demo, whole: whole && own !== undefined, width }]
      : [];
  });
};

const press = async (
  page: Page,
  degrees: number,
  left: number
): Promise<void> => {
  const now = Number(
    await page
      .locator('[data-demo] [data-zriz-item="dial"]')
      .getAttribute("aria-valuenow")
  );

  if (left === 0 || Math.abs(now - degrees) < 0.05) {
    return;
  }

  await page.keyboard.press(now < degrees ? "ArrowRight" : "ArrowLeft");
  await press(page, degrees, left - 1);
};

const straighten = async (page: Page, degrees: number): Promise<void> => {
  const dial = page.locator('[data-demo] [data-zriz-item="dial"]');

  if (degrees === 0 || (await dial.count()) === 0) {
    return;
  }

  await dial.focus();
  await press(page, degrees, MAX_KEYS);
  await dial.blur();
  await page.waitForTimeout(800);
};

const shootOurs = async (
  page: Page,
  job: Job
): Promise<{ image: Buffer; stage: number }> => {
  await page.setViewportSize({ height: 900, width: job.width.viewport });

  await page.goto(`${values.url}/docs/${job.demo}`, {
    waitUntil: "networkidle",
  });

  const demo = page.locator("[data-demo]").first();

  await demo.scrollIntoViewIfNeeded();
  await page.waitForSelector('[data-zriz-item="image"][data-ready]');
  await straighten(page, job.cell.degrees);
  await page.addStyleTag({ content: OURS_HIDDEN });
  await page.mouse.move(0, 0);

  const panel = await demo.boundingBox();
  const stage = await page
    .locator('[data-demo] [data-slot="stage"]')
    .first()
    .boundingBox();

  return {
    image: await demo.screenshot(),
    stage: (stage?.y ?? 0) + (stage?.height ?? 0) - (panel?.y ?? 0) + PANEL_PAD,
  };
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

const topOf = async (image: Buffer, height: number): Promise<Buffer> => {
  const meta = await sharp(image).metadata();

  return await sharp(image)
    .extract({
      height: Math.min(Math.round(height), meta.height ?? 0),
      left: 0,
      top: 0,
      width: meta.width ?? 0,
    })
    .png()
    .toBuffer();
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

const runJob = async (page: Page, job: Job): Promise<void> => {
  const name = `${job.demo}-${job.width.name}`;
  const ours = await shootOurs(page, job);
  const board = await shootBoard(page, job.cell);
  const height = ours.stage * SCALE;
  const mine = job.whole ? ours.image : await topOf(ours.image, height);
  const theirs = job.whole ? board : await topOf(board, height);

  await sharp(mine).toFile(path.join(out, `${name}-ours.png`));
  await sharp(theirs).toFile(path.join(out, `${name}-board.png`));

  const share = await compare(mine, theirs, name);
  const scope = job.whole ? "whole demo" : "stage only";

  process.stdout.write(
    `${name}: ${(share * 100).toFixed(2)}% of pixels differ from "${job.cell.caption}" (${scope})\n`
  );
};

const runJobs = async (page: Page, jobs: readonly Job[]): Promise<void> => {
  const [job, ...rest] = jobs;

  if (!job) {
    return;
  }

  await runJob(page, job);
  await runJobs(page, rest);
};

const picked = values.demo?.split(",") ?? [];

const JOBS = DEMO_NAMES.filter(
  (demo) => picked.length === 0 || picked.includes(demo)
).flatMap(jobsFor);

const browser = await chromium.launch();

try {
  const page = await browser.newPage({
    bypassCSP: true,
    deviceScaleFactor: SCALE,
  });

  await runJobs(page, JOBS);
} finally {
  await browser.close();
}
