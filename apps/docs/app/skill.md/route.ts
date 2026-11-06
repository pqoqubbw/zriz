import { textResponse } from "@/lib/responses";
import { LLMS_FULL_URL, LLMS_URL, markdownUrl } from "@/lib/site";

const SKILL = `---
name: zriz
description: Add an image cropper with a straighten dial to a React app with zriz (@zriz/react), the way the crop tool in iOS Photos works.
---

# zriz

> [llms.txt](${LLMS_URL})

Use this when a React app needs a user to crop, straighten, rotate or flip a photo, or pick an avatar.

## Install

\`\`\`sh
pnpm add @zriz/react @zriz/core
\`\`\`

Import the stylesheet once, then build the cropper from the parts in \`@zriz/react/cropper\`, in a file that starts with \`"use client"\`:

\`\`\`tsx
import "@zriz/react/styles.css";
import * as Cropper from "@zriz/react/cropper";
\`\`\`

## Steps

1. Read ${markdownUrl("quick-start")} and follow it.
2. Render \`Cropper.Root\` with \`src\`, then \`Cropper.Viewport\` with a height, \`Cropper.Image\`, \`Cropper.Mask\` and \`Cropper.Area\` with \`Cropper.Handle\` parts inside it so the crop can be resized (${markdownUrl("crop-area")}).
3. Add \`Cropper.Dial\` with \`Cropper.DialTicks\` to straighten.
4. Read the crop in \`onValueCommit\`. To make a file, pass a ref to \`actionsRef\` on \`Root\` and call \`exportCrop(ref.current)\` from \`@zriz/core/dom\` after \`onLoad\` fires (${markdownUrl("exporting")}).

## Rules

- Give every part that asks for a name an \`aria-label\`; development builds warn otherwise.
- \`Viewport\` has no height of its own.
- The parts ship unstyled except for the optional stylesheet.
- Every docs page is Markdown at its URL plus \`.md\`; the full set is ${LLMS_FULL_URL}.
`;

const GET = () => textResponse(SKILL, "text/markdown");

export { GET };
export const dynamic = "force-static";
