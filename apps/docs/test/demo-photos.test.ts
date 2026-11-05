import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";

import sharp from "sharp";
import { describe, expect, it } from "vitest";

import {
  DEMO_PHOTO_BUDGET,
  DEMO_PHOTO_LONG_EDGE,
  DEMO_PHOTOS,
} from "@/lib/demo-photos";

const PHOTOS = Object.values(DEMO_PHOTOS);

const NPGALLERY_PAGE =
  /^https:\/\/npgallery\.nps\.gov\/AssetDetail\/(?<id>[0-9a-f-]{32,36})$/u;

const NPGALLERY_RIGHTS = "Public domain:Full Granting Rights";

const COMMONS_PAGE = /^https:\/\/commons\.wikimedia\.org\/wiki\/File:.+$/u;

const COMMONS_RIGHTS = "CC0 1.0";

const SHA256 = /^[0-9a-f]{64}$/u;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/u;

const rightsOf = (page: string): string | undefined => {
  if (NPGALLERY_PAGE.test(page)) {
    return NPGALLERY_RIGHTS;
  }

  return COMMONS_PAGE.test(page) ? COMMONS_RIGHTS : undefined;
};

const NEVER = /^$/u;

const COMMONS_FILE =
  /^https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\/.+$/u;

const originalOf = (page: string): RegExp => {
  const id = NPGALLERY_PAGE.exec(page)?.groups?.id;

  if (id === undefined) {
    return COMMONS_PAGE.test(page) ? COMMONS_FILE : NEVER;
  }

  return new RegExp(
    `^https://npgallery\\.nps\\.gov/GetAsset/${id}/original\\.jpg$`,
    "iu"
  );
};

const fileOf = (url: string): Buffer => readFileSync(`public${url}`);

const chunksOf = (bytes: Buffer): string[] => {
  const chunks: string[] = [];

  for (let offset = 12; offset + 8 <= bytes.length;) {
    const size = bytes.readUInt32LE(offset + 4);

    chunks.push(bytes.toString("latin1", offset, offset + 4));

    offset += 8 + size + (size % 2);
  }

  return chunks;
};

describe("demo photos", () => {
  it("records every file in public/demo", () => {
    expect(readdirSync("public/demo").toSorted()).toStrictEqual(
      PHOTOS.map((photo) => photo.url.replace("/demo/", "")).toSorted()
    );
  });

  it.each(PHOTOS)("$name matches its record", async (photo) => {
    const bytes = fileOf(photo.url);
    const meta = await sharp(bytes).metadata();

    expect(photo.url).toBe(`/demo/${photo.name}.webp`);
    expect(bytes).toHaveLength(photo.bytes);
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(photo.sha256);
    expect(meta.format).toBe("webp");

    expect([meta.width, meta.height]).toStrictEqual([
      photo.width,
      photo.height,
    ]);
  });

  it.each(PHOTOS)("$name stays within the weight budget", (photo) => {
    expect(fileOf(photo.url).length).toBeLessThanOrEqual(DEMO_PHOTO_BUDGET);
    expect(Math.max(photo.width, photo.height)).toBe(DEMO_PHOTO_LONG_EDGE);
  });

  it.each(PHOTOS)("$name carries no metadata", async (photo) => {
    const bytes = fileOf(photo.url);
    const meta = await sharp(bytes).metadata();

    expect([
      bytes.toString("latin1", 0, 4),
      bytes.toString("latin1", 8, 12),
      ...chunksOf(bytes),
    ]).toStrictEqual(["RIFF", "WEBP", "VP8 "]);

    expect(meta.exif).toBeUndefined();
    expect(meta.icc).toBeUndefined();
    expect(meta.xmp).toBeUndefined();
  });

  it.each(PHOTOS)("$name quotes the rights line of its page", (photo) => {
    expect(photo.source.rights).toBe(rightsOf(photo.source.page));
  });

  it.each(PHOTOS)("$name names the original file of its page", (photo) => {
    expect(photo.source.file).toMatch(originalOf(photo.source.page));
  });

  it.each(PHOTOS)("$name records who made it and when", (photo) => {
    const { source } = photo;

    expect(source.author.length).toBeGreaterThan(0);
    expect(source.title.length).toBeGreaterThan(0);
    expect(source.sha256).toMatch(SHA256);
    expect(source.fetched).toMatch(ISO_DATE);
    expect(source.created).toMatch(ISO_DATE);
  });

  it.each(PHOTOS)("$name is cut from inside its source", (photo) => {
    const { crop, height, width } = photo.source;

    expect(crop.left).toBeGreaterThanOrEqual(0);
    expect(crop.top).toBeGreaterThanOrEqual(0);
    expect(crop.left + crop.width).toBeLessThanOrEqual(width);
    expect(crop.top + crop.height).toBeLessThanOrEqual(height);
    expect(crop.width * photo.height).toBe(crop.height * photo.width);
  });

  it("ships a 3:2 landscape and a 2:3 portrait", () => {
    expect(DEMO_PHOTOS.landscape.width * 2).toBe(
      DEMO_PHOTOS.landscape.height * 3
    );

    expect(DEMO_PHOTOS.portrait.width * 3).toBe(
      DEMO_PHOTOS.portrait.height * 2
    );
  });
});
