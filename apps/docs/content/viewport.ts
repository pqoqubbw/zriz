import {
  attrs,
  code,
  column,
  defineDoc,
  demo,
  p,
  part,
  props,
  section,
  table,
  variables,
} from "@/lib/doc/define";

const VIEWPORT_PAGE = defineDoc({
  blocks: [
    demo("viewport"),
    section(
      "anatomy",
      p(
        "`Viewport` goes inside `Root`, with `Image`, `Mask` and `Area` inside it. its width fills the parent like any block, so give it a height:"
      ),
      code("viewport/anatomy.jsx.tsx"),
      p(
        "one `Viewport` per cropper. a second one takes over the layout, and zriz warns in development. draw a live preview with `useCropperFrame`."
      ),
      p(
        "zriz makes it `position: relative` when it is static and sets `touch-action: none`, so the page does not scroll under a finger. `Image` clips the photo to the box by itself. the stylesheet also clips the viewport, so a handle at its edge never hangs outside it."
      ),
      p(
        "the track in the demo above sets `wheel` to pan or zoom. the photo pans once you zoom in. the demo uses the styles from the zriz site."
      )
    ),
    section(
      "leave room around the crop",
      p(
        "zriz fits the crop inside the viewport's padding. without padding the crop touches the edges, and the clip cuts the handles in half. 24 px leaves room for the 44 px hit box to grab, see [crop area](crop-area):"
      ),
      code("viewport/padding.css"),
      p("the crop fits again whenever the viewport changes size.")
    ),
    section(
      "put it in a dialog",
      p(
        "centre the dialog with `inset: 0` and `margin: auto`. a percent translate on an odd size puts everything inside on a half pixel, and at 1x chromium blurs the crop's outline."
      )
    ),
    section(
      "choose what the wheel does",
      p(
        'a plain wheel or two-finger scroll pans the photo. `wheel="zoom"` makes it zoom, and `wheel="none"` leaves it to the page. pinch and ctrl + wheel zoom in every mode:'
      ),
      code("viewport/wheel.jsx.tsx")
    ),
    section(
      "turn off the two-finger twist",
      p(
        "a twist straightens the photo once it passes 5°. to keep two fingers for pinch only:"
      ),
      code("viewport/twist.jsx.tsx")
    ),
    section(
      "fade the photo in when it loads",
      p(
        "`Image` gets `data-ready` once the cropper knows the photo's size: when it decodes, or at once when you pass `image` to `Root`. hide it until then:"
      ),
      code("viewport/fade.css")
    ),
    section(
      "darken the mask",
      p(
        "the stylesheet paints the mask with `--zriz-scrim`. set it to any colour:"
      ),
      code("viewport/scrim.css")
    ),
    section(
      "what each gesture does",
      p(
        "`Viewport` handles pointer, touch and wheel input with no extra code:"
      ),
      table({
        columns: [
          column("input", "prose", { width: 200 }),
          column("what it does", "prose"),
        ],
        rows: [
          ["drag", "pans the photo under the crop"],
          ["pinch, trackpad pinch", "zooms, with a rubber band at both ends"],
          ["twist two fingers", "straightens once the twist passes 5°"],
          [
            "wheel, trackpad scroll",
            "pans by default. at the edge the page scrolls on. `wheel` changes it",
          ],
          ["ctrl + wheel", "zooms, whatever `wheel` is set to"],
          ["escape during a drag", "cancels the drag and puts the photo back"],
        ],
      }),
      p(
        "a press on a button, link, input or other control inside `Viewport` starts no pan, so its click still lands. the same goes for content you portal out of it."
      ),
      p(
        "a twist counts as a pinch, so `Root` gets `data-pinching` and the thirds grid shows. a trackpad twist works only in safari. the crop's keys are on [crop area](crop-area)."
      )
    ),
    section(
      "api",
      part(
        "Viewport",
        "renders a `<div>` inside `Root`. gesture attributes like `data-panning` go on `Root`. every part also takes `className`, `render` and the props of its element, see [composition](composition). `className` and `render` get `{ interacting }`.",
        props([
          {
            default: '"pan"',
            name: "wheel",
            text: "what a plain wheel or two-finger scroll does",
            type: '"pan" | "zoom" | "none"',
          },
          {
            default: "true",
            name: "rotateGesture",
            text: "lets a two-finger twist straighten the photo",
            type: "boolean",
          },
        ])
      ),
      part(
        "Image",
        "renders a `<div>` inside `Viewport`. it holds an `<img>` that moves while you drag and a `<canvas>` drawn sharp at rest. `className` and `render` get `{ ready }`.",
        props([
          {
            default: '""',
            name: "alt",
            text: "names the photo for screen readers. leave it empty when the crop is described elsewhere",
            type: "string",
          },
        ]),
        attrs([
          {
            name: "data-ready",
            text: "once the cropper knows the photo's size: after it decodes, or at once with `image` on `Root`",
          },
          { name: "data-sharp", text: "while the sharp canvas frame shows" },
        ])
      ),
      part(
        "Mask",
        "renders an `aria-hidden` `<div>` inside `Viewport`. it has no props of its own. `className` and `render` get `{ shape }`.",
        attrs([
          { name: "data-shape", text: '`"rect"` or `"circle"`, from `Root`' },
          {
            name: "data-interacting",
            text: "during a gesture and for a short hold after it, see [accessibility](accessibility)",
          },
        ]),
        variables([
          {
            name: "--zriz-scrim",
            text: "paints the mask outside the crop. [styling](styling) lists its light and dark values",
          },
        ]),
        p("the stylesheet fades it during a gesture, see [styling](styling).")
      )
    ),
  ],
  lede: "`Viewport` takes the gestures, `Image` draws the photo in it and `Mask` dims everything outside the crop.",
});

export { VIEWPORT_PAGE };
