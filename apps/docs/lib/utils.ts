import { createCn } from "cn/config";

import { CN_THEME } from "@/lib/cn";

const cn = createCn({
  extend: {
    theme: {
      ...CN_THEME,
      "font-weight": [...CN_THEME["font-weight"], "normal"],
      radius: [...CN_THEME.radius, "sm", "md", "lg", "xl"],
      shadow: [...CN_THEME.shadow, "xs", "sm", "md", "lg"],
      text: [...CN_THEME.text, "xs", "sm", "base", "lg"],
    },
  },
});

export { cn };
