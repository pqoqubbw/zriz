import type { Block } from "@/lib/doc/schema";

type Anchors = {
  of: (block: Block) => string;
};

const slugify = (text: string): string =>
  text
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/gu, "-")
    .replaceAll(/^-|-$/gu, "");

const headingOf = (block: Block): string | null => {
  if (block.kind === "section") {
    return block.title;
  }

  if (block.kind === "part") {
    return block.name;
  }

  if (block.kind === "qa") {
    return block.question;
  }

  return null;
};

const walkBlocks = (blocks: readonly Block[]): Block[] =>
  blocks.flatMap((block) => [
    block,
    ...("blocks" in block ? walkBlocks(block.blocks) : []),
  ]);

const anchorsOf = (blocks: readonly Block[]): Anchors => {
  const ids = new Map<Block, string>();
  const seen = new Map<string, number>();

  for (const block of walkBlocks(blocks)) {
    const heading = headingOf(block);

    if (heading !== null) {
      const base = slugify(heading);
      const count = seen.get(base) ?? 0;

      seen.set(base, count + 1);
      ids.set(block, count === 0 ? base : `${base}-${count + 1}`);
    }
  }

  return {
    of: (block) => {
      const id = ids.get(block);

      if (id === undefined) {
        throw new Error("block has no anchor");
      }

      return id;
    },
  };
};

export type { Anchors };
export { anchorsOf, walkBlocks };
