import { code, defineDoc, p, preview, section } from "@/lib/doc/define";

const SHADCN_PAGE = defineDoc({
  blocks: [
    section(
      "Before you start",
      p(
        "The blocks use the colours, `Button` and `Dialog` of your shadcn/ui project, so they follow your theme in light and dark. They work with the Radix and the Base UI styles, and need Tailwind CSS v4 and React 19. The React Aria styles have a different `Dialog` and `Button`, so the blocks do not fit them."
      ),
      p(
        "Each command adds the files to your project and installs `@zriz/react` and `@zriz/core`. Every block returns a `File`, ready for a form or an upload."
      )
    ),
    section(
      "Cropper",
      p(
        "The zriz parts in shadcn styles, and the base of every block below. It has the viewport with handles and a grid, a zoom slider, the straighten dial, rotate, flip, reset and an aspect ratio switch."
      ),
      preview("cropper"),
      code("shadcn/cropper.sh"),
      p(
        "Put the parts you need inside `Cropper`. `cropToFile` turns the crop into a `File`:"
      ),
      code("shadcn/cropper.tsx")
    ),
    section(
      "Avatar cropper",
      p(
        "A profile photo control. The visitor uploads a photo, moves it under a circle in a dialog and saves a round PNG. Adjust opens the same photo again with the last crop."
      ),
      preview("avatar-cropper"),
      code("shadcn/avatar-cropper.sh"),
      code("shadcn/avatar-cropper.tsx")
    ),
    section(
      "Image crop dialog",
      p(
        "A dialog you open with any image. It has an aspect ratio switch and a rotate button, and it hands the crop back as a file. Pass your own list of ratios, or one ratio to lock it."
      ),
      preview("image-crop-dialog"),
      code("shadcn/image-crop-dialog.sh"),
      code("shadcn/image-crop-dialog.tsx")
    ),
    section(
      "Cover cropper",
      p(
        "A wide cover image for a profile or a post. Reposition lets the visitor drag and zoom the image in place, and save exports a JPEG at the width you set."
      ),
      preview("cover-cropper"),
      code("shadcn/cover-cropper.sh"),
      code("shadcn/cover-cropper.tsx")
    ),
    section(
      "Image editor",
      p(
        "A full editor in a card: the straighten dial, rotate, flip, five aspect ratios and reset. `onSave` gets the file and the crop value, so you can store the value and open the editor on it later. [Saving state](saving-state) shows how."
      ),
      preview("image-editor"),
      code("shadcn/image-editor.sh"),
      code("shadcn/image-editor.tsx")
    ),
    section(
      "Image crop field",
      p(
        "A form field. The visitor picks or drops an image and frames it in place. The field keeps a file input in sync with the crop, so a plain form or a server action receives the cropped JPEG under `name`."
      ),
      preview("image-crop-field"),
      code("shadcn/image-crop-field.sh"),
      code("shadcn/image-crop-field.tsx")
    ),
  ],
  lede: "Cropper blocks for shadcn/ui. Each one installs with the shadcn CLI and becomes code in your project.",
});

export { SHADCN_PAGE };
