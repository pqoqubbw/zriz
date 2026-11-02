import { describe, expect, it } from "vitest";

import { anchorsOf } from "@/lib/doc/anchors";
import { highlight } from "@/lib/doc/highlight";
import { pageMarkdown } from "@/lib/doc/markdown";
import type { Block } from "@/lib/doc/schema";
import { textOf } from "@/lib/doc/snippets";
import { docs } from "@/lib/docs";
import { order } from "@/lib/nav";

const walk = (blocks: readonly Block[]): Block[] =>
  blocks.flatMap((block) => [
    block,
    ...("blocks" in block ? walk(block.blocks) : []),
  ]);

const code = order.flatMap((slug) =>
  walk(docs[slug].blocks).flatMap((block) =>
    block.kind === "code" || block.kind === "excerpt" ? [{ block, slug }] : []
  )
);

describe("content", () => {
  it.each(order)("gives every heading on %s its own anchor", (slug) => {
    const blocks = walk(docs[slug].blocks).filter(
      (block) =>
        block.kind === "section" || block.kind === "part" || block.kind === "qa"
    );
    const anchors = anchorsOf(docs[slug].blocks);
    const ids = blocks.map((block) => anchors.of(block));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(order)("writes %s as markdown", (slug) => {
    expect(pageMarkdown(slug)).toMatchSnapshot();
  });

  it("shows the approved code and colours", async () => {
    const shown = await Promise.all(
      code.map(async ({ block, slug }) => {
        const text = textOf(block);
        return [slug, block.file, text, await highlight(text, block.file)];
      })
    );
    expect(shown).toMatchSnapshot();
  });
});
