import { pageMarkdown, phrasing, prose } from "@/lib/doc/markdown";
import {
  blockquote,
  heading,
  item,
  link,
  list,
  paragraph,
  printMarkdown,
  text,
} from "@/lib/doc/mdast";
import { DOCS } from "@/lib/docs";
import { NAV_ENTRIES, NAV_GROUPS } from "@/lib/nav";
import {
  LLMS_FULL_URL,
  markdownUrl,
  SITE_DESCRIPTION,
  SITE_ORIGIN,
} from "@/lib/site";

const indexMarkdown = (): string =>
  printMarkdown([
    heading(1, [text("zriz")]),
    blockquote([
      prose(
        `${SITE_DESCRIPTION} it ships as \`@zriz/react\` and \`@zriz/core\`. every page below is markdown, and any page url plus \`.md\` returns the same.`
      ),
      prose(
        `a skill for coding agents is at \`${SITE_ORIGIN}/skill.md\`, and an mcp server with the tools \`search_docs\` and \`get_page\` answers at \`${SITE_ORIGIN}/mcp\`.`
      ),
    ]),
    ...NAV_GROUPS.flatMap((group) => [
      heading(2, [text(group.title === "" ? "start" : group.title)]),
      list(
        group.items.map(({ slug, title }) =>
          item([
            paragraph([
              link(markdownUrl(slug), title),
              text(": "),
              ...phrasing(DOCS[slug].lede),
            ]),
          ])
        )
      ),
    ]),
    heading(2, [text("everything")]),
    list([item([paragraph([link(LLMS_FULL_URL, "all pages in one file")])])]),
  ]);

const fullMarkdown = (): string =>
  NAV_ENTRIES.map(({ slug }) => pageMarkdown(slug, true)).join("\n---\n\n");

export { fullMarkdown, indexMarkdown };
