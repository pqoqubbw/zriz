import { createHighlighterCore } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";
import css from "shiki/langs/css.mjs";
import html from "shiki/langs/html.mjs";
import json from "shiki/langs/json.mjs";
import shellscript from "shiki/langs/shellscript.mjs";
import tsx from "shiki/langs/tsx.mjs";
import ts from "shiki/langs/typescript.mjs";

import { roleOfMark, roles, theme } from "@/lib/doc/code-theme";
import { languageOf } from "@/lib/doc/snippets";

const highlighter = createHighlighterCore({
  engine: createJavaScriptRegexEngine(),
  langs: [css, html, json, shellscript, ts, tsx],
  themes: [theme],
});

const escape = (text: string): string =>
  text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

export const highlight = async (
  code: string,
  file: string
): Promise<string> => {
  const engine = await highlighter;
  const lines = engine.codeToTokensBase(code, {
    lang: languageOf(file).shiki,
    theme: "zriz",
    ...(file.endsWith(".jsx.tsx")
      ? { grammarContextCode: "const _ = <>" }
      : {}),
  });
  return lines
    .map((tokens) => {
      const runs: [string, string][] = [];
      for (const token of tokens) {
        const role =
          roleOfMark.get((token.color ?? "").toLowerCase()) ?? "plain";
        const blank = token.content.trim() === "";
        const last = runs.at(-1);
        if (last !== undefined && (blank || last[1] === roles[role])) {
          last[0] += token.content;
        } else {
          runs.push([token.content, blank ? "" : roles[role]]);
        }
      }
      return runs
        .map(([text, name]) =>
          name === ""
            ? escape(text)
            : `<span class=${name}>${escape(text)}</span>`
        )
        .join("");
    })
    .join("\n");
};
