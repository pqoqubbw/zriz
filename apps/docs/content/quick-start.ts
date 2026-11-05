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
      "set it up with an agent",
      p(
        "paste this prompt into claude code, cursor or any other coding agent. it reads this page and does the steps below for you:"
      ),
      prompt(
        "add zriz to this project. read https://zriz.dev/docs/quick-start.md and follow it: install @zriz/react and @zriz/core, import its stylesheet and render a cropper with corner handles, the straighten dial and a file picker for the photo. build it from the zriz parts, not a crop box of your own, and give every part that asks for one an aria-label. when it works, show me where onValueCommit hands back the crop."
      )
    ),
    section(
      "install",
      code("quick-start/install.sh"),
      p("npm, yarn and bun work too. [faq](faq) lists what zriz needs.")
    ),
    section(
      "render a cropper",
      p(
        "paste this component into a page. it loads a sample photo, and the stylesheet gives it the default look:"
      ),
      code("quick-start/render.tsx"),
      p(
        "`Viewport` needs a size, and the image and the mask fill it. the 24 px padding leaves room for the handles, see [viewport](viewport). the cropper now drags, pinches, resizes and straightens:"
      ),
      demo("quick-start")
    ),
    section(
      "let the user pick a photo",
      p("keep the chosen file in state and pass it to `src`:"),
      code("quick-start/pick.tsx"),
      p(
        "`src` takes a url, a `File` or a `Blob`. while it is `null`, the viewport stays empty. when a photo cannot load, `onError` gets a `ZrizError`, and [errors](errors) lists its codes. a url from another domain needs cors headers, and a new photo keeps the current crop. [loading images](loading-images) explains both."
      )
    ),
    section(
      "get the crop",
      p(
        "add `onValueCommit` to `Root` in the picker above. it fires once when a gesture ends, a key press on the crop or the dial included, or on the frame after a write such as `rotate90()`. a photo the user never touches sends no commit, see [events](events)."
      ),
      excerpt("quick-start/commit.tsx", ["<Cropper.Root", ">"]),
      p(
        "`value` is the crop as fractions of the photo, ready to store and load back. [value](value) lists every field. `details.pixelCrop` is the same crop in source pixels. `getPixelCrop()` on the cropper from `actionsRef` reads it for an untouched photo, see [hooks](hooks). [exporting](exporting) turns the crop into a file in the browser or on your server."
      ),
      p(
        "[playground](playground) changes the main props live, and [full editor](full-editor) puts every part in one component."
      )
    ),
  ],
  lede: "go from an empty project to a cropper that hands you the crop.",
});

export { QUICK_START_PAGE };
