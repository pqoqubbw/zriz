import * as Cropper from "@zriz/react/cropper";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ACCESSIBILITY_PAGE } from "@/content/accessibility";
import { anchorsOf, walkBlocks } from "@/lib/doc/anchors";
import { pageMarkdown } from "@/lib/doc/markdown";
import { textOf } from "@/lib/doc/snippets";
import { DOCS } from "@/lib/docs";
import { PAGE_ORDER } from "@/lib/nav";

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

  it("installs core beside react, since react peers it", () => {
    expect(pageMarkdown("quick-start")).toContain(
      "pnpm add @zriz/react @zriz/core"
    );
  });

  it.each(PAGE_ORDER)(
    "keeps every heading and code block of %s in its markdown",
    (slug) => {
      const markdown = pageMarkdown(slug);
      const headings = new Set(
        markdown
          .split("\n")
          .filter((line) => line.startsWith("#"))
          .map((line) => line.replace(/^#+ /u, ""))
      );
      const missing = walkBlocks(DOCS[slug].blocks).flatMap((block) => {
        if (block.kind === "section") {
          return headings.has(block.title) ? [] : [block.title];
        }

        if (block.kind === "qa") {
          return headings.has(block.question) ? [] : [block.question];
        }

        if (block.kind === "part") {
          return headings.has(`\`${block.name}\``) ? [] : [block.name];
        }

        if (block.kind === "code" || block.kind === "excerpt") {
          return markdown.includes(textOf(block)) ? [] : [block.file];
        }

        return [];
      });

      expect(missing).toStrictEqual([]);
      expect(markdown).not.toMatch(/^```\w*\n```$/mu);
    }
  );

  it("lists every hidden part and every button in the screen reader table", () => {
    const table = walkBlocks(ACCESSIBILITY_PAGE.blocks).find(
      (block) => block.kind === "table"
    );
    const rows = table?.kind === "table" ? table.rows : [];
    const rowOf = (name: keyof typeof Cropper) =>
      rows.find((row) => row[0]?.split(", ").includes(name) === true);
    const markup = renderToStaticMarkup(
      createElement(
        Cropper.Root,
        { src: "/p.jpg" },
        createElement(Cropper.DialTicks),
        createElement(Cropper.DialValue),
        createElement(Cropper.ZoomThumb),
        createElement(Cropper.ZoomStep, { factor: 2 })
      )
    );

    for (const name of ["DialTicks", "DialValue", "ZoomThumb"] as const) {
      expect(rowOf(name)?.[1]).toBe("Hidden");
    }

    expect(markup).toContain("<button");
    expect(rowOf("ZoomStep")?.[1]).toContain("Buttons");
    expect(markup.match(/aria-hidden="true"/gu)).toHaveLength(3);
  });
});
