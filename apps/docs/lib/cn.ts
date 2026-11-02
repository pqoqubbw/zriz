import { createCn } from "cn/config";

export const cn = createCn({
  extend: {
    theme: {
      "font-weight": ["regular", "book", "medium", "strong", "semibold"],
      "inset-shadow": ["rule"],
      radius: ["chip", "kbd", "item", "control", "group", "panel", "demo"],
      shadow: ["raised", "button"],
      text: [
        "title",
        "heading",
        "heading-mono",
        "lede",
        "body",
        "cell",
        "cell-mono",
        "nav",
        "logo",
        "caption",
        "code",
        "control",
        "small",
      ],
    },
  },
});
