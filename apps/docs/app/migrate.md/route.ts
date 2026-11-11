import { COMPARISON_ENTRIES } from "@/lib/nav";
import { textResponse } from "@/lib/responses";
import { LLMS_URL, markdownUrl } from "@/lib/site";

const PACKAGES = {
  "zriz-vs-antd-img-crop": "antd-img-crop",
  "zriz-vs-ark-ui":
    "@ark-ui/react, when it imports ImageCropper, or @zag-js/image-cropper",
  "zriz-vs-cropperjs": "cropperjs",
  "zriz-vs-croppie": "croppie",
  "zriz-vs-react-advanced-cropper": "react-advanced-cropper",
  "zriz-vs-react-avatar-editor": "react-avatar-editor",
  "zriz-vs-react-cropper": "react-cropper",
  "zriz-vs-react-easy-crop": "react-easy-crop",
  "zriz-vs-react-image-crop": "react-image-crop",
  "zriz-vs-uppy-image-editor": "@uppy/image-editor",
} as const satisfies Record<string, string>;

const guides = COMPARISON_ENTRIES.map(({ slug }) => {
  const name = Object.entries(PACKAGES).find(([key]) => key === slug)?.[1];

  return `- \`${name ?? slug}\`: ${markdownUrl(slug)}`;
}).join("\n");

const MIGRATE = `---
name: zriz-migrate
description: Move a React project from another image cropper (react-easy-crop, react-image-crop, Cropper.js, react-cropper, react-avatar-editor, react-advanced-cropper, Croppie, antd-img-crop, Ark UI Image Cropper, Uppy Image Editor) to zriz (@zriz/react).
---

# Migrate to zriz

> [llms.txt](${LLMS_URL})

Use this when a project crops images with another library and the user asked to move it to zriz.

## Find the guide

Look in \`package.json\` for one of these packages and read its page. Each page has a section on migrating: what zriz has no equivalent for, a map from the old API to zriz, how saved crops convert, and working zriz code.

${guides}

If \`react-cropper\` or \`@uppy/image-editor\` is listed next to \`cropperjs\`, read that page, not the Cropper.js one.

## Steps

1. Read the guide for the package in use. Then read ${markdownUrl("quick-start")}.
2. List every place the old cropper is used, and what the app does with its output: a file it uploads, coordinates it sends to a server, a crop it saves and restores.
3. Compare that list with the part of the guide that names what zriz has no equivalent for. If the project relies on one of those, stop and tell the user before you change anything.
4. Install with \`pnpm add @zriz/react @zriz/core\`, or the project's package manager. zriz needs React 18.2 or 19 and ships as ES modules only.
5. Replace one cropper at a time. Build it from the parts in \`@zriz/react/cropper\`, in a file that starts with \`"use client"\`, and import \`@zriz/react/styles.css\` once.
6. Keep the same crop model. If the old cropper had a fixed frame with a zoom slider, build that. If it had a box with handles, build that.
7. Replace the old export code with \`exportCrop\` from \`@zriz/core/dom\`, see ${markdownUrl("exporting")}, or send \`getValue()\` to the server and cut there, see ${markdownUrl("server-crop")}.
8. If the app stores crops, convert them as the guide says, and keep the old values until the user has checked the result. The zriz value is described at ${markdownUrl("value")}.
9. Remove the old package and its stylesheet import only after every use is replaced.

## Rules

- zriz ships no ready UI and no words. Write the layout, the styles for the zoom slider and the buttons, and an \`aria-label\` for every part that asks for one, in the project's own design system.
- \`Viewport\` has no height of its own. Give it one.
- Do not claim the result is the same if the old library allowed something zriz does not, such as a crop that shows empty area, a zoom out below fit, or one free angle past 45°. Say what changed.
- Run the project's type check and tests, and open the page with the cropper, before you say it is done.
`;

const GET = () => textResponse(MIGRATE, "text/markdown");

export { GET };
export const dynamic = "force-static";
