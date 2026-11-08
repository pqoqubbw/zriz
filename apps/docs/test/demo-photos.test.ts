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

const GENERATED_RIGHTS = "Generated, owned by the author";

const SHA256 = /^[0-9a-f]{64}$/u;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/u;

const rightsOf = (page: string): string | undefined => {
  if (NPGALLERY_PAGE.test(page)) {
    return NPGALLERY_RIGHTS;
  }

  if (COMMONS_PAGE.test(page)) {
    return COMMONS_RIGHTS;
  }

  return page === "" ? GENERATED_RIGHTS : undefined;
};

const NEVER = /(?!)/u;

const EMPTY = /^$/u;

const COMMONS_FILE =
  /^https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\/.+$/u;

const originalOf = (page: string): RegExp => {
  const id = NPGALLERY_PAGE.exec(page)?.groups?.id;

  if (id === undefined) {
    if (COMMONS_PAGE.test(page)) {
      return COMMONS_FILE;
    }

    return page === "" ? EMPTY : NEVER;
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
  it.each(PHOTOS)(
    "$name ships as its recorded, light, clean file",
    async (photo) => {
      const bytes = fileOf(photo.url);
      const meta = await sharp(bytes).metadata();

      expect(readdirSync("public/demo").toSorted()).toStrictEqual(
        PHOTOS.map((entry) => entry.url.replace("/demo/", "")).toSorted()
      );

      expect({
        blocks: [
          bytes.toString("latin1", 0, 4),
          bytes.toString("latin1", 8, 12),
          ...chunksOf(bytes),
        ],
        bytes: bytes.length,
        format: meta.format,
        longEdge: Math.max(photo.width, photo.height),
        metadata: [meta.exif, meta.icc, meta.xmp],
        sha256: createHash("sha256").update(bytes).digest("hex"),
        size: [meta.width, meta.height],
        url: photo.url,
      }).toStrictEqual({
        blocks: ["RIFF", "WEBP", "VP8 "],
        bytes: photo.bytes,
        format: "webp",
        longEdge: DEMO_PHOTO_LONG_EDGE,
        metadata: [undefined, undefined, undefined],
        sha256: photo.sha256,
        size: [photo.width, photo.height],
        url: `/demo/${photo.name}.webp`,
      });

      expect(bytes.length).toBeLessThanOrEqual(DEMO_PHOTO_BUDGET);
    }
  );

  it.each(PHOTOS)("$name records where it came from", (photo) => {
    const { source } = photo;
    const { crop, height, width } = source;

    expect({
      author: /\S/u.test(source.author),
      created: ISO_DATE.test(source.created),
      fetched: ISO_DATE.test(source.fetched),
      file: originalOf(source.page).test(source.file),
      rights: source.rights,
      sha256: SHA256.test(source.sha256),
      title: /\S/u.test(source.title),
    }).toStrictEqual({
      author: true,
      created: true,
      fetched: true,
      file: true,
      rights: rightsOf(source.page),
      sha256: true,
      title: true,
    });

    expect({
      inside: [
        crop.left >= 0,
        crop.top >= 0,
        crop.left + crop.width <= width,
        crop.top + crop.height <= height,
      ],
      ratio: crop.width * photo.height,
    }).toStrictEqual({
      inside: [true, true, true, true],
      ratio: crop.height * photo.width,
    });
  });
});
