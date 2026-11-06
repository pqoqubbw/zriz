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
      "Anatomy",
      p(
        "`Viewport` goes inside `Root`, with `Image`, `Mask` and `Area` inside it. Its width fills the parent like any block, so give it a height:"
      ),
      code("viewport/anatomy.jsx.tsx"),
      p(
        "One `Viewport` per cropper. A second one takes over the layout, and zriz warns in development. Draw a live preview with `useCropperFrame`."
      ),
      p(
        "zriz makes it `position: relative` when it is static and sets `touch-action: none`, so the page does not scroll under a finger. `Image` clips the photo to the box by itself. The stylesheet also clips the viewport, so a handle at its edge never hangs outside it."
      ),
      p(
        "The track in the demo above sets `wheel` to pan or zoom. The photo pans once you zoom in. The demo uses the styles from the zriz site."
      )
    ),
    section(
      "Leave room around the crop",
      p(
        "zriz fits the crop inside the viewport's padding. Without padding the crop touches the edges, and the clip cuts the handles in half. 24 px leaves room for the 44 px hit box to grab, see [crop area](crop-area):"
      ),
      code("viewport/padding.css"),
      p("The crop fits again whenever the viewport changes size.")
    ),
    section(
      "Put it in a dialog",
      p(
        "Centre the dialog with `inset: 0` and `margin: auto`. A percent translate on an odd size puts everything inside on a half pixel, and at 1x Chromium blurs the crop's outline."
      )
    ),
    section(
      "Choose what the wheel does",
      p(
        'A plain wheel or two-finger scroll pans the photo. `wheel="zoom"` makes it zoom, and `wheel="none"` leaves it to the page. Pinch and Ctrl + wheel zoom in every mode:'
      ),
      code("viewport/wheel.jsx.tsx")
    ),
    section(
      "Turn off the two-finger twist",
      p(
        "A twist straightens the photo once it passes 5°. To keep two fingers for pinch only:"
      ),
      code("viewport/twist.jsx.tsx")
    ),
    section(
      "Fade the photo in when it loads",
      p(
        "`Image` gets `data-ready` once the cropper knows the photo's size: when it decodes, or at once when you pass `image` to `Root`. Hide it until then:"
      ),
      code("viewport/fade.css")
    ),
    section(
      "Darken the mask",
      p(
        "The stylesheet paints the mask with `--zriz-scrim`. Set it to any colour:"
      ),
      code("viewport/scrim.css")
    ),
    section(
      "What each gesture does",
      p(
        "`Viewport` handles pointer, touch and wheel input with no extra code:"
      ),
      table({
        columns: [
          column("Input", "prose", { width: 200 }),
          column("What it does", "prose"),
        ],
        rows: [
          ["Drag", "Pans the photo under the crop"],
          ["Pinch, trackpad pinch", "Zooms, with a rubber band at both ends"],
          ["Twist two fingers", "Straightens once the twist passes 5°"],
          [
            "Wheel, trackpad scroll",
            "Pans by default. At the edge the page scrolls on. `wheel` changes it",
          ],
          ["Ctrl + wheel", "Zooms, whatever `wheel` is set to"],
          ["Escape during a drag", "Cancels the drag and puts the photo back"],
        ],
      }),
      p(
        "A press on a button, link, input or other control inside `Viewport` starts no pan, so its click still lands. The same goes for content you portal out of it."
      ),
      p(
        "A twist counts as a pinch, so `Root` gets `data-pinching` and the thirds grid shows. A trackpad twist works only in Safari. The crop's keys are on [crop area](crop-area)."
      )
    ),
    section(
      "API",
      part(
        "Viewport",
        "Renders a `<div>` inside `Root`. Gesture attributes like `data-panning` go on `Root`. Every part also takes `className`, `render` and the props of its element, see [composition](composition). `className` and `render` get `{ interacting }`.",
        props([
          {
            default: '"pan"',
            name: "wheel",
            text: "What a plain wheel or two-finger scroll does",
            type: '"pan" | "zoom" | "none"',
          },
          {
            default: "true",
            name: "rotateGesture",
            text: "Lets a two-finger twist straighten the photo",
            type: "boolean",
          },
        ])
      ),
      part(
        "Image",
        "Renders a `<div>` inside `Viewport`. It holds an `<img>` that moves while you drag and a `<canvas>` drawn sharp at rest. `className` and `render` get `{ ready }`.",
        props([
          {
            default: '""',
            name: "alt",
            text: "Names the photo for screen readers. Leave it empty when the crop is described elsewhere",
            type: "string",
          },
        ]),
        attrs([
          {
            name: "data-ready",
            text: "Once the cropper knows the photo's size: after it decodes, or at once with `image` on `Root`",
          },
          { name: "data-sharp", text: "While the sharp canvas frame shows" },
        ])
      ),
      part(
        "Mask",
        "Renders an `aria-hidden` `<div>` inside `Viewport`. It has no props of its own. `className` and `render` get `{ shape }`.",
        attrs([
          { name: "data-shape", text: '`"rect"` or `"circle"`, from `Root`' },
          {
            name: "data-interacting",
            text: "During a gesture and for a short hold after it, see [accessibility](accessibility)",
          },
        ]),
        variables([
          {
            name: "--zriz-scrim",
            text: "Paints the mask outside the crop. [Styling](styling) lists its light and dark values",
          },
        ]),
        p("The stylesheet fades it during a gesture, see [styling](styling).")
      )
    ),
  ],
  lede: "`Viewport` takes the gestures, `Image` draws the photo in it and `Mask` dims everything outside the crop.",
});

export { VIEWPORT_PAGE };
