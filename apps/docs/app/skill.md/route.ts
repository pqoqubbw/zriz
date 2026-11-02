import { origin } from "@/lib/site";

export const dynamic = "force-static";

const skill = `---
name: zriz
description: add an image cropper with a straighten dial to a react app with zriz (@zriz/react), the way the crop tool in ios photos works.
---

# zriz

> [llms.txt](${origin}/llms.txt)

use this when a react app needs a user to crop, straighten, rotate or flip a photo, or pick an avatar.

## install

\`\`\`sh
pnpm add @zriz/react @zriz/core
\`\`\`

import the stylesheet once, then build the cropper from the parts in \`@zriz/react/cropper\`, in a file that starts with \`"use client"\`:

\`\`\`tsx
import "@zriz/react/styles.css";
import * as Cropper from "@zriz/react/cropper";
\`\`\`

## steps

1. read ${origin}/docs/quick-start.md and follow it.
2. render \`Cropper.Root\` with \`src\`, then \`Cropper.Viewport\` with a height, \`Cropper.Image\`, \`Cropper.Mask\` and \`Cropper.Area\` with \`Cropper.Handle\` parts inside it so the crop can be resized (${origin}/docs/crop-area.md).
3. add \`Cropper.Dial\` with \`Cropper.DialTicks\` to straighten.
4. read the crop in \`onValueCommit\`. to make a file, pass a ref to \`actionsRef\` on \`Root\` and call \`exportCrop(ref.current)\` from \`@zriz/core/dom\` after \`onLoad\` fires (${origin}/docs/exporting.md).

## rules

- give every part that asks for a name an \`aria-label\`; development builds warn otherwise.
- \`Viewport\` has no height of its own.
- the parts ship unstyled except for the optional stylesheet.
- every docs page is markdown at its url plus \`.md\`; the full set is ${origin}/llms-full.txt.
`;

export const GET = () =>
  new Response(skill, {
    headers: { "Content-Type": "text/markdown; charset=utf-8" },
  });
