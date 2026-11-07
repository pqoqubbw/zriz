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
      "Anatomy",
      p("`Area` goes in `Viewport`. `Grid` and the handles go inside it:"),
      code("crop-area/anatomy.jsx.tsx"),
      p(
        'Leave out the handles you do not need. With `shape="circle"`, the stylesheet hides the four corner handles.'
      ),
      p(
        "`Area` points `aria-describedby` at the `Instructions` part. Render it with your own help text. Without it, the reference points at nothing and screen readers skip it. [Accessibility](accessibility) covers it and `Announcer`."
      ),
      p("The demo above uses the styles from the zriz site.")
    ),
    section(
      "Recolour the focus ring",
      p(
        "The stylesheet draws a two-tone ring inside `Area` on keyboard focus, so a crop flush with the viewport keeps it. Without the stylesheet, the browser draws its default ring. To recolour it:"
      ),
      code("crop-area/focus.css")
    ),
    section(
      "Make the handles easier to grab",
      p(
        "Each handle's hit box is 44 px square, centred on the crop's edge. Set `--zriz-handle-size` on `Area` to change all eight. Give the viewport padding of at least half that size, or the clip cuts the box, see [viewport](viewport):"
      ),
      code("crop-area/handles.css")
    ),
    section(
      "Know when the grid shows",
      p(
        "The grid hides at rest. It shows thirds (3 × 3) from the moment you press or move the crop, and a fine grid (9 × 9) while the dial moves:"
      ),
      table({
        columns: [
          column("When", "prose", { width: 200 }),
          column("What shows", "prose"),
        ],
        rows: [
          [
            "Press or move the crop",
            "The thirds grid fades in, even if a press never moves. A drag, pinch, twist, wheel, handle, `Zoom` or a `useZoom` slider counts",
          ],
          [
            "Drag the dial or press a key on it",
            "The fine grid fades in once the angle moves. A press that stays still shows none",
          ],
          [
            "Press a key on `Area` or `Zoom`",
            "No new grid. A grid that already shows stays",
          ],
          [
            "Let go or stop moving the crop",
            "It stays for a short hold, then fades out, see [accessibility](accessibility)",
          ],
          [
            "Let go of the dial",
            "The fine grid fades out at once, or when a flick's glide stops",
          ],
        ],
      })
    ),
    section(
      "Make the straighten grid fainter",
      p(
        "Lines of the fine grid carry no `data-coarse`. A fading grid keeps its lines, so this rule holds until the grid is gone:"
      ),
      code("crop-area/fine.css")
    ),
    section(
      "Keyboard",
      p("These keys work while `Area` has focus, never on the window:"),
      keys([
        { keys: [["arrow keys"]], text: "Move the crop by 1% of its size" },
        { keys: [["shift", "arrow keys"]], text: "Move it by 10%" },
        {
          keys: [["alt", "arrow keys"]],
          text: "Resize the crop by 1%, or 10% with Shift. Right and down grow it, left and up shrink it. A locked aspect keeps its ratio. A free crop changes that side only, and stops at the photo edge, `minSize`, `maxZoom` or 88 px on screen. The centre stays put",
        },
        { keys: [["+"], ["="]], text: "Zoom in 1.1×" },
        { keys: [["-"], ["_"]], text: "Zoom out 1.1×" },
        {
          keys: [["0"]],
          text: "Jump back to where `Reset` goes, with no spring",
        },
      ]),
      p("Escape during a handle drag cancels it and puts the crop back.")
    ),
    section(
      "API",
      part(
        "Area",
        'Renders a `<div role="application">` inside `Viewport`, with `tabIndex={0}` once a photo is placed and `tabIndex={-1}` until then, so tab skips an empty crop. zriz writes its position and size inline on every frame. Every part also takes `className`, `render` and the props of its element, see [composition](composition). `className` and `render` get `{ shape, interacting }`.',
        props([
          {
            name: "aria-label",
            text: 'Names the crop for screen readers, such as `"Crop area"`. Development builds warn without it',
            type: "string",
          },
          {
            default: "false",
            name: "liveVariables",
            text: "Writes the variables below on `Area` every frame",
            type: "boolean",
          },
        ]),
        table({
          columns: [
            column("Attribute", "mono", { width: 200 }),
            column("When", "prose"),
          ],
          rows: [
            ["data-shape", '`"rect"` or `"circle"`, from `Root`'],
            ["data-visible", "While a photo is placed"],
            [
              "data-interacting",
              "During a gesture, and while a zriz key is held down",
            ],
          ],
        }),
        table({
          columns: [
            column("Variable", "mono", { width: 200 }),
            column("What it sets", "prose"),
          ],
          rows: [
            [
              "--zriz-frame",
              "Paints the frame and the handle marks, `#fff` by default. [Styling](styling) lists every colour",
            ],
            [
              "--zriz-rotation",
              "With `liveVariables`, the straighten angle in degrees, like −4.5",
            ],
            [
              "--zriz-rotation-progress",
              "With `liveVariables`, the angle over its limit, from −1 to 1",
            ],
            ["--zriz-zoom", "With `liveVariables`, the zoom, 1 to `maxZoom`"],
            [
              "--zriz-zoom-progress",
              "With `liveVariables`, the zoom on a log scale, 0 to 1",
            ],
            [
              "--zriz-overscroll",
              "With `liveVariables`, how far in px a drag pulls the photo past an edge. 0 at rest",
            ],
          ],
        })
      ),
      part(
        "Handle",
        "Renders an `aria-hidden` `<div>` inside `Area`, so a `render` element must not take focus. A drag stops at the photo edge, the viewport's padding and `maxZoom`. Each side also stops at 88 px on screen or `minSize`, whichever is larger. A side already smaller stays put and can only grow. The stylesheet hides the corner handles on a circle only when they sit right inside `Area`. `className` and `render` get `{ position, active }`.",
        props([
          {
            name: "position",
            required: true,
            text: 'The corner or edge it drags: `"top-left"`, `"top"`, `"top-right"`, `"right"`, `"bottom-right"`, `"bottom"`, `"bottom-left"`, `"left"`',
            type: 'HandleProps["position"]',
          },
        ]),
        table({
          columns: [
            column("Attribute", "mono", { width: 200 }),
            column("When", "prose"),
          ],
          rows: [
            ["data-edge", "Always, set to its position"],
            [
              "data-active",
              "From a press on this handle until the pointer lets go, even if it never moves",
            ],
          ],
        }),
        table({
          columns: [
            column("Variable", "mono", { width: 200 }),
            column("What it sets", "prose"),
          ],
          rows: [
            [
              "--zriz-handle-size",
              "The hit box, 44 px square unless you set it",
            ],
          ],
        })
      ),
      part(
        "Grid",
        "Renders an `aria-hidden` `<div>` of `<span>` lines inside `Area`. It has no props of its own. The stylesheet gives each line 1 px. Without it, set `min-width` and `min-height` yourself. `className` and `render` get `{ grid }`.",
        table({
          columns: [
            column("Attribute", "mono", { width: 200 }),
            column("When", "prose"),
          ],
          rows: [
            ["data-grid", '`"coarse"` for thirds, `"fine"` or `"none"`'],
            ["data-visible", "While a grid shows"],
            ["data-axis", '`"x"` on vertical lines, `"y"` on horizontal ones'],
            ["data-coarse", "On each line of the thirds grid"],
          ],
        }),
        table({
          columns: [
            column("Variable", "mono", { width: 200 }),
            column("What it sets", "prose"),
          ],
          rows: [
            [
              "--zriz-grid",
              "Paints the grid lines. [Styling](styling) lists its default",
            ],
          ],
        })
      )
    ),
  ],
  lede: "`Area` is the crop you keep. `Handle` resizes it and `Grid` draws guides while you work.",
});

export { CROP_AREA_PAGE };
