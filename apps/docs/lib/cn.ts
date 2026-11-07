import { createCn } from "cn/config";

const CN_THEME = {
  "font-weight": ["regular", "book", "medium", "strong", "semibold"],
  "inset-shadow": ["rule", "edge", "focus"],
  radius: [
    "chip",
    "kbd",
    "button",
    "item",
    "control",
    "group",
    "panel",
    "demo",
  ],
  shadow: ["raised", "secondary", "button", "lift", "error"],
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
  tracking: ["strong"],
};

const cn = createCn({ extend: { theme: CN_THEME } });

export { CN_THEME, cn };
