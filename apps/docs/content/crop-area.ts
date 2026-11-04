import {
  code,
  column,
  defineDoc,
  demo,
  keys,
  p,
  part,
  props,
  section,
  table,
} from "@/lib/doc/define";

const CROP_AREA_PAGE = defineDoc({
  blocks: [
    demo("crop-area"),
    section(
      "anatomy",
      p("`Area` goes in `Viewport`. `Grid` and the handles go inside it:"),
      code("crop-area/anatomy.jsx.tsx"),
      p(
        'leave out the handles you do not need. with `shape="circle"`, the stylesheet hides the four corner handles.'
      ),
      p(
        "`Area` points `aria-describedby` at the `Instructions` part. render it with your own help text. without it, the reference points at nothing and screen readers skip it. [accessibility](accessibility) covers it and `Announcer`."
      )
    ),
    section(
      "add a focus ring",
      p("the browser draws its default ring on `Area`. to draw your own:"),
      code("crop-area/focus.css")
    ),
    section(
      "make the handles easier to grab",
      p(
        "each handle's hit box is 44 px square, centred on the crop's edge. set `--zriz-handle-size` on `Area` to change all eight. give the viewport padding of at least half that size, or the clip cuts the box, see [viewport](viewport):"
      ),
      code("crop-area/handles.css")
    ),
    section(
      "know when the grid shows",
      p(
        "the grid hides at rest. it shows thirds (3 × 3) while you move the crop and a fine grid (9 × 9) while you drag the dial:"
      ),
      table({
        columns: [
          column("when", "prose", { width: 200 }),
          column("what shows", "prose"),
        ],
        rows: [
          [
            "move the crop",
            "the thirds grid fades in. a drag, pinch, twist, wheel, handle, `Zoom` or a `useZoom` slider counts",
          ],
          ["drag the dial", "the fine grid fades in"],
          [
            "press a key on `Area`, `Dial` or `Zoom`",
            "no new grid. a grid that already shows stays",
          ],
          [
            "stop moving the crop",
            "it stays for a short hold, then fades out, see [accessibility](accessibility)",
          ],
          [
            "let go of the dial",
            "the fine grid fades out at once, or when a flick's glide stops",
          ],
        ],
      })
    ),
    section(
      "make the straighten grid fainter",
      p(
        "lines of the fine grid carry no `data-coarse`. a fading grid keeps its lines, so this rule holds until the grid is gone:"
      ),
      code("crop-area/fine.css")
    ),
    section(
      "keyboard",
      p("these keys work while `Area` has focus, never on the window:"),
      keys([
        { keys: [["arrow keys"]], text: "move the crop by 1% of its size" },
        { keys: [["shift", "arrow keys"]], text: "move it by 10%" },
        {
          keys: [["alt", "arrow keys"]],
          text: "resize the crop by 1%, or 10% with shift. right and down grow it, left and up shrink it. a locked aspect keeps its ratio. a free crop changes that side only, and stops at the photo edge, `minSize` or 88 px on screen. the centre stays put",
        },
        { keys: [["+"], ["="]], text: "zoom in 1.1×" },
        { keys: [["-"], ["_"]], text: "zoom out 1.1×" },
        {
          keys: [["0"]],
          text: "jump back to where `Reset` goes, with no spring",
        },
      ]),
      p("escape during a handle drag cancels it and puts the crop back.")
    ),
    section(
      "api",
      part(
        "Area",
        'renders a `<div role="group">` with `tabIndex={0}` inside `Viewport`. zriz writes its position and size inline on every frame. every part also takes `className`, `render` and the props of its element, see [composition](composition). `className` and `render` get `{ shape, interacting }`.',
        props([
          {
            name: "aria-label",
            text: 'names the crop for screen readers, such as `"Crop area"`. development builds warn without it',
            type: "string",
          },
          {
            default: "false",
            name: "liveVariables",
            text: "writes the variables below on `Area` every frame",
            type: "boolean",
          },
        ]),
        table({
          columns: [
            column("attribute", "mono", { width: 200 }),
            column("when", "prose"),
          ],
          rows: [
            ["data-shape", '`"rect"` or `"circle"`, from `Root`'],
            [
              "data-interacting",
              "during a gesture, and while a zriz key is held down",
            ],
          ],
        }),
        table({
          columns: [
            column("variable", "mono", { width: 200 }),
            column("what it sets", "prose"),
          ],
          rows: [
            [
              "--zriz-line",
              "paints the frame and the handle marks. [styling](styling) lists its light and dark values",
            ],
            [
              "--zriz-rotation",
              "with `liveVariables`, the straighten angle in degrees, like −4.5",
            ],
            [
              "--zriz-rotation-progress",
              "with `liveVariables`, the angle over its limit, from −1 to 1",
            ],
            ["--zriz-zoom", "with `liveVariables`, the zoom, 1 to `maxZoom`"],
            [
              "--zriz-zoom-progress",
              "with `liveVariables`, the zoom on a log scale, 0 to 1",
            ],
            [
              "--zriz-overscroll",
              "with `liveVariables`, how far in px a drag pulls the photo past an edge. 0 at rest",
            ],
          ],
        })
      ),
      part(
        "Handle",
        "renders an `aria-hidden` `<div>` inside `Area`, so a `render` element must not take focus. the stylesheet hides the corner handles on a circle only when they sit right inside `Area`. `className` and `render` get `{ position, active }`.",
        props([
          {
            name: "position",
            required: true,
            text: 'the corner or edge it drags: `"top-left"`, `"top"`, `"top-right"`, `"right"`, `"bottom-right"`, `"bottom"`, `"bottom-left"`, `"left"`',
            type: "HandleEdge",
          },
        ]),
        table({
          columns: [
            column("attribute", "mono", { width: 200 }),
            column("when", "prose"),
          ],
          rows: [
            ["data-edge", "always, set to its position"],
            ["data-active", "while this handle is dragged"],
          ],
        }),
        table({
          columns: [
            column("variable", "mono", { width: 200 }),
            column("what it sets", "prose"),
          ],
          rows: [
            [
              "--zriz-handle-size",
              "the hit box, 44 px square unless you set it",
            ],
          ],
        })
      ),
      part(
        "Grid",
        "renders an `aria-hidden` `<div>` of `<span>` lines inside `Area`. it has no props of its own. the stylesheet gives each line 1 px. without it, set `min-width` and `min-height` yourself. `className` and `render` get `{ grid }`.",
        table({
          columns: [
            column("attribute", "mono", { width: 200 }),
            column("when", "prose"),
          ],
          rows: [
            ["data-grid", '`"coarse"` for thirds, `"fine"` or `"none"`'],
            ["data-visible", "while a grid shows"],
            ["data-axis", '`"x"` on vertical lines, `"y"` on horizontal ones'],
            ["data-coarse", "on each line of the thirds grid"],
          ],
        }),
        table({
          columns: [
            column("variable", "mono", { width: 200 }),
            column("what it sets", "prose"),
          ],
          rows: [
            [
              "--zriz-grid",
              "paints the grid lines. [styling](styling) lists its default",
            ],
          ],
        })
      )
    ),
  ],
  lede: "`Area` is the crop you keep. `Handle` resizes it and `Grid` draws guides while you work.",
});

export { CROP_AREA_PAGE };
