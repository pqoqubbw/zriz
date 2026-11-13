import {
  code,
  defineDoc,
  demo,
  excerpt,
  p,
  prompt,
  section,
} from "@/lib/doc/define";

const QUICK_START_PAGE = defineDoc({
  blocks: [
    section(
      "Set it up with an agent",
      p(
        "Paste this prompt into Claude Code, Cursor or any other coding agent. It reads this page and does the steps below for you:"
      ),
      prompt(
        "Add zriz to this project. Read https://zriz.dev/docs/quick-start.md and follow it: install @zriz/react and @zriz/core, import its stylesheet and render a cropper with corner handles, the straighten dial and a file picker for the photo. Build it from the zriz parts, not a crop box of your own, and give every part that asks for one an aria-label. When it works, show me where onValueCommit hands back the crop."
      )
    ),
    section(
      "Install",
      code("quick-start/install.sh"),
      p(
        "With npm, run `npm install @zriz/react @zriz/core`. Yarn and Bun work too. [FAQ](faq) lists what zriz needs."
      )
    ),
    section(
      "Render a cropper",
      p(
        "Save this component in its own file and render `<PhotoCropper />` from a page. It loads a sample photo, and the stylesheet gives it the default look:"
      ),
      code("quick-start/render.tsx"),
      p(
        "`Viewport` needs a size, and the image and the mask fill it. The 24 px padding leaves room for the handles, see [viewport](viewport). The cropper now drags, pinches, resizes and straightens:"
      ),
      demo("quick-start"),
      p(
        "The demo above runs this component at the zriz site's size, with a public domain photo, open, reset and download buttons and the site's styles. Like the code, it shows no angle above the dial."
      )
    ),
    section(
      "Let the user pick a photo",
      p("Keep the chosen file in state and pass it to `src`:"),
      code("quick-start/pick.tsx"),
      p(
        "`src` takes a URL, a `File` or a `Blob`. While it is `null`, the viewport stays empty. When a photo cannot load, `onError` gets a `ZrizError`, and [errors](errors) lists its codes. A URL from another domain needs CORS headers, and a new photo keeps the current crop. [Loading images](loading-images) explains both."
      )
    ),
    section(
      "Get the crop",
      p(
        "Add `onValueCommit` to `Root` in the picker above. It fires once when a gesture ends, a key press on the crop or the dial included, or on the frame after a write such as `rotate90()`. The first photo sends no commit until the user touches it, and a later photo sends one only when it has to refit the crop, see [events](events)."
      ),
      excerpt("quick-start/commit.tsx", ["<Cropper.Root", ">"]),
      p(
        "`value` is the crop as fractions of the photo, ready to store and load back. [Value](value) lists every field. `details.pixelCrop` is the export plan for that crop in source pixels, or `null` before a photo loads. Its `pixelRect` is the crop rectangle, and it is `null` with a straighten angle or perspective. `getPixelCrop()` on the cropper from `actionsRef` reads it for an untouched photo, see [hooks](hooks). [Exporting](exporting) turns the crop into a file in the browser or on your server."
      ),
      p(
        "[Playground](playground) changes the main props live, and [full editor](full-editor) puts every part in one component."
      ),
      p(
        "If zriz made your day a little easier, [a star on GitHub](https://github.com/pqoqubbw/zriz) would mean a lot to us."
      )
    ),
  ],
  lede: "Go from an empty project to a cropper that hands you the crop.",
});

export { QUICK_START_PAGE };
