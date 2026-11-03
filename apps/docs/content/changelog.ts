import { defineDoc, p, section } from "@/lib/doc/define";

const CHANGELOG_PAGE = defineDoc({
  blocks: [
    section(
      "0.0.0, not published yet",
      p(
        "the first version. nothing is on npm yet, so there is nothing to upgrade from. [introduction](introduction) lists what it does."
      )
    ),
  ],
  lede: "what changed in each published version of zriz, newest first.",
});

export { CHANGELOG_PAGE };
