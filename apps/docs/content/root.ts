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
      "anatomy",
      p(
        "everything goes inside `Root`. `Image`, `Mask` and `Area` go in `Viewport`. the controls can sit anywhere, in any wrapper:"
      ),
      code("root/anatomy.jsx.tsx")
    ),
    section(
      "lock the cropper while you save",
      p(
        "`disabled` ignores every gesture, key and button press, and every cropper method that moves the crop, such as `rotate90()` or `setZoom()`, except `setValue()`, `setImage()` and `setOptions()`. `Root` gets `data-disabled`, so css can grey it out. `value` and a new `src` still apply, and `aspect`, `rotation` and `zoom` set while disabled apply once it ends:"
      ),
      code("root/disabled.jsx.tsx"),
      p("grey out the buttons while it is set:"),
      code("root/disabled.css")
    ),
    section(
      "dim the controls during a gesture",
      p(
        "`Root` carries data attributes for what the cropper is doing. this rule fades the toolbar during any gesture, a key press included, and for a short hold after it, see [accessibility](accessibility):"
      ),
      code("root/dim.css")
    ),
    section(
      "put it in a drawer",
      p(
        "`Root` carries `data-vaul-no-drag` and `data-base-ui-swipe-ignore`, so a swipe on the photo or a control moves the crop and leaves a vaul or base ui drawer where it is. give the drawer a handle or free space outside `Root`. to let the drawer drag from inside, set the attribute to `null` on `Root`, such as `data-vaul-no-drag={null}`."
      )
    ),
    section(
      "api",
      part(
        "Root",
        "renders a `<div>`. every other part goes inside it. every part also takes `className`, `render` and the props of its element, see [composition](composition). `className` and `render` get `{ snapshot, chrome }`. `snapshot` holds the fields `useCropperState` lists on [hooks](hooks). `chrome` holds `grid`, `active`, `transition` and `overscroll`, the values behind `data-grid`, `data-interacting`, `data-transition` and `data-overscroll`.",
        props([
          {
            name: "src",
            text: "the photo: a url or a `Blob` such as a `File`. `null` clears it, `undefined` leaves it alone",
            type: "string | Blob | null",
          },
          {
            name: "crossOrigin",
            text: "the cors mode when the photo is on another domain",
            type: '"anonymous" | "use-credentials"',
          },
          {
            name: "previewEdge",
            text: "the longest side of the preview in pixels. the default follows the screen, see [loading images](loading-images). a grid of small `Root`s saves memory with a low one",
            type: "number",
          },
          {
            default: "true",
            name: "svg",
            text: "`false` refuses svg files, which then fail with `decode`",
            type: "boolean",
          },
          {
            name: "image",
            text: "the photo's pixel size up front, read once",
            type: "Size | null",
          },
          {
            name: "value",
            text: "controls the whole value. `onValueChange` does not fire when you set it",
            type: "CropValue",
          },
          {
            name: "defaultValue",
            text: "the starting value. fields you leave out use the defaults",
            type: "Partial<CropValue>",
          },
          {
            name: "aspect",
            text: "controls the aspect alone, a ratio like `4 / 3`",
            type: '"free" | "original" | number',
          },
          {
            name: "rotation",
            text: "controls the straighten angle alone, up to 45° each way",
            type: "number",
          },
          {
            name: "zoom",
            text: "controls the zoom alone. 1 is the largest crop",
            type: "number",
          },
          {
            default: '"rect"',
            name: "shape",
            text: 'the crop shape. a circle locks the aspect to 1, draws a round mask and exports a round png, and the stylesheet hides the corner handles, see [avatar](avatar). back to `"rect"`, the crop takes the aspect it held before. a `Root` that started as a circle takes `defaultValue` or `"free"`, and reset follows',
            type: '"rect" | "circle"',
          },
          {
            default: "{ width: 1, height: 1 }",
            name: "minSize",
            text: "the smallest crop in source pixels, along the photo's own sides. a large one narrows the straighten range. [exporting](exporting) says when a crop can come out smaller",
            type: "Size",
          },
          {
            default: "15",
            name: "maxZoom",
            text: "the deepest zoom. every gesture, key and control stops there",
            type: "number",
          },
          {
            name: "onValueChange",
            text: "at most once per frame while the crop moves, with a reason and `cancel()`, see [events](events)",
            type: "(value, details) => void",
          },
          {
            name: "onValueCommit",
            text: "called once when a gesture or a write is done, with `pixelCrop`, the export plan, see [events](events)",
            type: "(value, details) => void",
          },
          {
            name: "onLoad",
            text: "called when the photo is decoded and ready to crop",
            type: "(image) => void",
          },
          {
            name: "onError",
            text: "called with a typed error when the photo cannot load, see [errors](errors)",
            type: "(error) => void",
          },
          {
            name: "cropper",
            text: "uses an instance from `useCropper`. `image`, `defaultValue`, `plugins` and `focalLength` then come from `useCropper`",
            type: "Cropper",
          },
          {
            name: "actionsRef",
            text: "gives you the cropper, for calls like `rotate90()` from a button",
            type: "Ref<Cropper>",
          },
          {
            name: "plugins",
            text: "runs each plugin's `init` once, when `Root` makes the cropper, see [cropper](cropper)",
            type: "readonly CropperPlugin[]",
          },
          {
            default: "false",
            name: "disabled",
            text: "ignores gestures, keys, buttons and the cropper methods that move the crop. `value` and `setValue()` still apply. sets `data-disabled`",
            type: "boolean",
          },
          {
            default: '"auto"',
            name: "motion",
            text: "follows the system motion setting, or forces full or short motion",
            type: '"auto" | "always" | "reduce"',
          },
          {
            default: "500",
            name: "recenterDelay",
            text: "milliseconds after a gesture before the crop recentres",
            type: "number",
          },
          {
            name: "dir",
            text: "the reading direction for keys and sliders. with no value, each part reads its computed `direction` at the press. with a value, `Root` also sets the html `dir` attribute",
            type: '"ltr" | "rtl"',
          },
          {
            name: "locale",
            text: "formats the values screen readers hear",
            type: "string",
          },
          {
            default: "26",
            name: "focalLength",
            text: "the lens as a 35 mm equivalent, used for perspective correction. at a strong tilt, zriz lengthens a lens too short to keep the photo in front of it",
            type: "number",
          },
        ]),
        attrs([
          {
            name: "data-interacting",
            text: "during a gesture and for a short hold after it, see [accessibility](accessibility)",
          },
          { name: "data-panning", text: "while a pointer drags the photo" },
          {
            name: "data-pinching",
            text: "while two fingers pinch or twist on a touch screen, or a trackpad pinches in safari",
          },
          { name: "data-resizing", text: "while a handle resizes the crop" },
          {
            name: "data-rotating",
            text: "while a pointer drags the dial and while it glides after",
          },
          {
            name: "data-zooming",
            text: "while the wheel pans or zooms, a pointer drags `Zoom`, or a `useZoom` slider moves",
          },
          {
            name: "data-settling",
            text: "while any animation runs: a glide, a spring back, a recentre or a button's move",
          },
          { name: "data-changed", text: "while `Reset` has a change to undo" },
          { name: "data-mirrored", text: "while the photo is flipped" },
          {
            name: "data-overscroll",
            text: "while you pull past an edge or a zoom limit",
          },
          { name: "data-disabled", text: "while `disabled` is set" },
          { name: "data-reduced-motion", text: "while short motion is on" },
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
            text: '`"rotate"`, `"flip"`, `"morph"` or `"recenter"` while that transition runs. `"morph"` covers reset, an aspect pick, an orientation swap and undo. a reset or undo across a quarter turn runs as `"rotate"`, which hides `Area` and shows only the crop turning with the photo',
          },
          { name: "data-shape", text: '`"rect"` or `"circle"`' },
        ])
      )
    ),
  ],
  lede: "`Root` loads the photo, keeps the crop and holds every other part.",
});

export { ROOT_PAGE };
