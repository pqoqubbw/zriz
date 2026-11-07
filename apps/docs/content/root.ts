import {
  attrs,
  code,
  defineDoc,
  demo,
  p,
  part,
  props,
  section,
} from "@/lib/doc/define";

const ROOT_PAGE = defineDoc({
  blocks: [
    demo("root"),
    section(
      "Anatomy",
      p(
        "Everything goes inside `Root`. `Image`, `Mask` and `Area` go in `Viewport`. The controls can sit anywhere, in any wrapper:"
      ),
      code("root/anatomy.jsx.tsx")
    ),
    section(
      "Lock the cropper while you save",
      p(
        "`disabled` ignores every gesture, key and button press, and every cropper method that moves the crop, such as `rotate90()` or `setZoom()`, except `setValue()`, `setImage()` and `setOptions()`. `Root` gets `data-disabled`, so CSS can grey it out. `value` and a new `src` still apply, and `aspect`, `rotation` and `zoom` set while disabled apply once it ends:"
      ),
      code("root/disabled.jsx.tsx"),
      p("Grey out the buttons while it is set:"),
      code("root/disabled.css"),
      p(
        "The demo above sets `disabled` while its download runs. It adds handles, a grid and the styles from the zriz site."
      )
    ),
    section(
      "Dim the controls during a gesture",
      p(
        "`Root` carries data attributes for what the cropper is doing. This rule fades the toolbar during any gesture, a key press included, and for a short hold after it, see [accessibility](accessibility):"
      ),
      code("root/dim.css")
    ),
    section(
      "Put it in a drawer",
      p(
        "`Root` carries `data-vaul-no-drag` and `data-base-ui-swipe-ignore`, so a swipe on the photo or a control moves the crop and leaves a Vaul or Base UI drawer where it is. Give the drawer a handle or free space outside `Root`. To let the drawer drag from inside, set the attribute to `null` on `Root`, such as `data-vaul-no-drag={null}`."
      )
    ),
    section(
      "API",
      part(
        "Root",
        "Renders a `<div>`. Every other part goes inside it. Every part also takes `className`, `render` and the props of its element, see [composition](composition). `className` and `render` get `{ snapshot, chrome }`. `snapshot` holds the fields `useCropperState` lists on [hooks](hooks). `chrome` holds `grid`, `active`, `transition` and `overscroll`, the values behind `data-grid`, `data-interacting`, `data-transition` and `data-overscroll`.",
        props([
          {
            name: "src",
            text: "The photo: a URL or a `Blob` such as a `File`. `null` clears it, `undefined` leaves it alone",
            type: "string | Blob | null",
          },
          {
            name: "crossOrigin",
            text: "The CORS mode when the photo is on another domain",
            type: '"anonymous" | "use-credentials"',
          },
          {
            name: "previewEdge",
            text: "The longest side of the preview in pixels. The default follows the screen, see [loading images](loading-images). A grid of small `Root`s saves memory with a low one. A new `previewEdge`, `crossOrigin` or `svg` loads the photo again and fires `onLoad` again. The crop stays, so keep `previewEdge` steady",
            type: "number",
          },
          {
            default: "true",
            name: "svg",
            text: "`false` refuses SVG files, which then fail with `decode`. With `true`, an SVG that would freeze the page fails with `too-large`, see [security](security)",
            type: "boolean",
          },
          {
            name: "image",
            text: "The photo's pixel size up front, read once",
            type: "Size | null",
          },
          {
            name: "value",
            text: "Controls the whole value. `onValueChange` does not fire when you set it",
            type: "CropValue",
          },
          {
            name: "defaultValue",
            text: "The starting value. Fields you leave out use the defaults",
            type: "Partial<CropValue>",
          },
          {
            name: "aspect",
            text: "Controls the aspect alone, a ratio like `4 / 3`",
            type: '"free" | "original" | number',
          },
          {
            name: "rotation",
            text: "Controls the straighten angle alone, up to 45° each way",
            type: "number",
          },
          {
            name: "zoom",
            text: "Controls the zoom alone. 1 is the largest crop",
            type: "number",
          },
          {
            default: '"rect"',
            name: "shape",
            text: 'The crop shape. A circle locks the aspect to 1, draws a round mask and exports a round PNG, and the stylesheet hides the corner handles, see [avatar](avatar). Back to `"rect"`, the crop takes the aspect it held before. A `Root` that started as a circle takes `defaultValue` or `"free"`, and reset follows',
            type: '"rect" | "circle"',
          },
          {
            default: "{ width: 1, height: 1 }",
            name: "minSize",
            text: "The smallest crop in source pixels, along the photo's own sides. A large one narrows the straighten range. [Exporting](exporting) says when a crop can come out smaller",
            type: "Size",
          },
          {
            default: "15",
            name: "maxZoom",
            text: "The deepest zoom. Every gesture, key and control stops there",
            type: "number",
          },
          {
            name: "onValueChange",
            text: "At most once per frame while the crop moves, with a reason and `cancel()`, see [events](events)",
            type: "(value, details) => void",
          },
          {
            name: "onValueCommit",
            text: "Called once when a gesture or a write is done, with `pixelCrop`, the export plan, see [events](events)",
            type: "(value, details) => void",
          },
          {
            name: "onLoad",
            text: "Called when the photo is decoded and ready to crop",
            type: "(image) => void",
          },
          {
            name: "onError",
            text: "Called with a typed error when the photo cannot load, see [errors](errors)",
            type: "(error) => void",
          },
          {
            name: "cropper",
            text: "Uses an instance from `useCropper`. `image`, `defaultValue`, `plugins` and `focalLength` then come from `useCropper`",
            type: "Cropper",
          },
          {
            name: "actionsRef",
            text: "Gives you the cropper, for calls like `rotate90()` from a button",
            type: "Ref<Cropper>",
          },
          {
            name: "plugins",
            text: "Runs each plugin's `init` once, when `Root` makes the cropper, see [cropper](cropper)",
            type: "readonly CropperPlugin[]",
          },
          {
            default: "false",
            name: "disabled",
            text: "Ignores gestures, keys, buttons and the cropper methods that move the crop. `value` and `setValue()` still apply. Sets `data-disabled`",
            type: "boolean",
          },
          {
            default: '"auto"',
            name: "motion",
            text: "Follows the system motion setting, or forces full or short motion",
            type: '"auto" | "always" | "reduce"',
          },
          {
            default: "500",
            name: "recenterDelay",
            text: "Milliseconds after a gesture before the crop recentres",
            type: "number",
          },
          {
            name: "dir",
            text: "The reading direction for `Dial`, `Zoom` and `AspectGroup`. In RTL their left and right swap. `Area`'s arrow keys stay physical. With no value, each of these parts reads its computed `direction` at the press. With a value, `Root` also sets the HTML `dir` attribute",
            type: '"ltr" | "rtl"',
          },
          {
            name: "locale",
            text: "Formats the values screen readers hear",
            type: "string",
          },
          {
            default: "26",
            name: "focalLength",
            text: "The lens as a 35 mm equivalent, used for perspective correction. At a strong tilt, zriz lengthens a lens too short to keep the photo in front of it. Read once, when `Root` makes the cropper. `cropper.setOptions()` changes it, from the next `setValue()`, `reset()` or `setImage()`",
            type: "number",
          },
        ]),
        attrs([
          {
            name: "data-interacting",
            text: "During a gesture and for a short hold after it, see [accessibility](accessibility)",
          },
          {
            name: "data-panning",
            text: "From a press on the photo until the pointer lets go, even if it never moves",
          },
          {
            name: "data-pinching",
            text: "While two fingers pinch or twist on a touch screen, or a trackpad pinches in Safari",
          },
          {
            name: "data-resizing",
            text: "From a press on a handle until the pointer lets go, even if it never moves",
          },
          {
            name: "data-rotating",
            text: "From a press on the dial until the pointer lets go, even if it never moves, and while the dial glides after",
          },
          {
            name: "data-zooming",
            text: "While the wheel pans or zooms, from a press on `Zoom` until the pointer lets go, or while a `useZoom` slider moves",
          },
          {
            name: "data-settling",
            text: "While any animation runs: a glide, a spring back, a recentre or a button's move",
          },
          { name: "data-changed", text: "While `Reset` has a change to undo" },
          { name: "data-mirrored", text: "While the photo is flipped" },
          {
            name: "data-overscroll",
            text: "While you pull past an edge or a zoom limit",
          },
          { name: "data-disabled", text: "While `disabled` is set" },
          { name: "data-reduced-motion", text: "While short motion is on" },
          {
            name: "data-orientation",
            text: '`"landscape"` above 1, `"portrait"` below 1, `"square"` at 1 and while the aspect is `"free"` or `"original"`',
          },
          {
            name: "data-grid",
            text: '`"coarse"`, `"fine"` or `"none"`, see [crop area](crop-area)',
          },
          {
            name: "data-transition",
            text: '`"rotate"`, `"flip"`, `"morph"` or `"recenter"` while that transition runs. `"morph"` covers reset, an aspect pick, an orientation swap and undo. A reset or undo across a quarter turn runs as `"rotate"`, which hides `Area` and shows only the crop turning with the photo',
          },
          { name: "data-shape", text: '`"rect"` or `"circle"`' },
        ])
      )
    ),
  ],
  lede: "`Root` loads the photo, keeps the crop and holds every other part.",
});

export { ROOT_PAGE };
