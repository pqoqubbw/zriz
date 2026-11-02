import type { Block } from "@/lib/doc/schema";

export interface Anchors {
  of: (block: Block) => string;
}

const slugify = (text: string): string =>
  text
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/gu, "-")
    .replaceAll(/^-|-$/gu, "");

const titleOf = (block: Block): string | null => {
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

const childrenOf = (block: Block): readonly Block[] =>
  "blocks" in block ? block.blocks : [];

export const anchorsOf = (blocks: readonly Block[]): Anchors => {
  const ids = new Map<Block, string>();
  const seen = new Map<string, number>();
  const visit = (block: Block): void => {
    const title = titleOf(block);
    if (title !== null) {
      const base = slugify(title);
      const count = seen.get(base) ?? 0;
      seen.set(base, count + 1);
      ids.set(block, count === 0 ? base : `${base}-${count + 1}`);
    }
    for (const child of childrenOf(block)) {
      visit(child);
    }
  };
  for (const block of blocks) {
    visit(block);
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
