import { describe, expect, it } from "vitest";

import { anchorsOf, walkBlocks } from "@/lib/doc/anchors";
import { highlight } from "@/lib/doc/highlight";
import { pageMarkdown } from "@/lib/doc/markdown";
import type { Block } from "@/lib/doc/schema";
import { textOf } from "@/lib/doc/snippets";
import { DOCS } from "@/lib/docs";
import { PAGE_ORDER } from "@/lib/nav";

const CODE_BLOCKS = PAGE_ORDER.flatMap((slug) =>
  walkBlocks(DOCS[slug].blocks).flatMap((block) =>
    block.kind === "code" || block.kind === "excerpt" ? [{ block, slug }] : []
  )
);

const rowTextsOf = (block: Block): string[] => {
  if (
    block.kind === "props" ||
    block.kind === "attrs" ||
    block.kind === "variables" ||
    block.kind === "keys"
  ) {
    return block.rows.map((row) => row.text);
  }

  if (block.kind === "messages") {
    return block.rows.map((row) => row.fix);
  }

  if (block.kind === "table") {
    return block.rows.flatMap((row) =>
      row.filter(
        (_, i) =>
          i >= block.columns.length || block.columns[i]?.kind === "prose"
      )
    );
  }

  return [];
};

describe("content", () => {
  it.each(PAGE_ORDER)("gives every heading on %s its own anchor", (slug) => {
    const blocks = walkBlocks(DOCS[slug].blocks).filter(
      (block) =>
        block.kind === "section" || block.kind === "part" || block.kind === "qa"
    );
    const anchors = anchorsOf(DOCS[slug].blocks);
    const ids = blocks.map((block) => anchors.of(block));

    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(PAGE_ORDER)("ends no row text on %s with a full stop", (slug) => {
    const stopped = walkBlocks(DOCS[slug].blocks)
      .flatMap(rowTextsOf)
      .filter((text) => text.endsWith("."));

    expect(stopped).toStrictEqual([]);
  });

  it.each(PAGE_ORDER)("writes %s as markdown", (slug) => {
    expect(pageMarkdown(slug)).toMatchSnapshot();
  });

  it("shows the approved code and colours", async () => {
    const shown = await Promise.all(
      CODE_BLOCKS.map(async ({ block, slug }) => {
        const text = textOf(block);

        return [slug, block.file, text, await highlight(text, block.file)];
      })
    );

    expect(shown).toMatchSnapshot();
  });
});
