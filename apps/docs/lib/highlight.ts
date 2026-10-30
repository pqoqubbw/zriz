import { codeToHtml } from "shiki";

export const highlight = async (code: string, lang = "tsx") =>
  await codeToHtml(code, {
    defaultColor: false,
    lang,
    themes: { dark: "github-dark-default", light: "github-light-default" },
  });
