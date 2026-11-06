import {
  code,
  column,
  defineDoc,
  demo,
  p,
  section,
  table,
} from "@/lib/doc/define";

const STYLING_PAGE = defineDoc({
  blocks: [
    section(
      "Add the stylesheet",
      p(
        "Import the stylesheet once. [Bundle size](bundle-size) lists its weight:"
      ),
      code("styling/import.ts"),
      table({
        columns: [
          column("Part", "mono"),
          column("What the stylesheet sets", "prose"),
        ],
        rows: [
          ["Viewport", "`overflow: clip` and a grab cursor"],
          ["Mask", "The scrim colour. It fades to 60% during a gesture"],
          [
            "Area",
            'A 1 px outline inside the crop, a two-tone ring on keyboard focus, and `opacity: 0` on it and its handles while `Root` has `data-transition="rotate"`',
          ],
          [
            "Handle",
            'A corner mark of two short lines or an edge bar, and a resize cursor. Corners hide with `shape="circle"`',
          ],
          ["Grid", "White lines that fade in during a gesture"],
          [
            "Dial",
            "40 px height, sideways clip, a grab cursor, centre line, tick colours, the zero dot",
          ],
        ],
      }),
      p(
        "It paints nothing on `Zoom`, the buttons or the aspect items. The demos on this site style those themselves. [Viewport](viewport) shows how to size the box."
      ),
      p(
        "Every rule sits in `:where()` inside `@layer components.zriz`. A class with no layer wins in any import order, and so does a class in your `components` or `utilities` layer, Tailwind included. A class in any other layer wins only when that layer is declared after the stylesheet. `@zriz/core/styles.css` is the same file for [vanilla JS](vanilla-js)."
      ),
      p(
        "A page-wide `transition` cannot make the crop trail your finger. zriz sets `transition-property` inline to `none` on `Area`, `DialTicks` and `ZoomThumb`, and to `opacity` on `Mask`, so the mask keeps its fade. A transition of your own on those parts needs `!important`."
      ),
      p(
        "The first line of the file names `properties`, `theme`, `base`, `components` and `utilities`, so a stylesheet loaded first sets the order of those layers on your page. To keep your own order, and to let every layer of yours win, import it into a layer of its own:"
      ),
      code("styling/layer.css")
    ),
    section(
      "Style a part by its state",
      p(
        "`className` takes a string, or a function that gets the part's state:"
      ),
      code("styling/classname.jsx.tsx"),
      p(
        "Return `undefined` from the function for no class. To swap the element itself, see [composition](composition)."
      )
    ),
    section(
      "Style with data attributes",
      p(
        "Every part's outer element carries `data-zriz-item` with its part name in kebab case, such as `aspect-item` or `dial-ticks`. The ticks and grid lines inside carry none, so select them through their part, as [dial](dial) shows. `Root` also marks the gesture in progress with `data-rotating`, `data-panning`, `data-pinching`, `data-resizing` or `data-zooming`. This rule hides the handles from a press on the dial until the pointer lets go, and while the dial glides:"
      ),
      code("styling/attributes.css"),
      p("Each component page lists the attributes that part sets.")
    ),
    section(
      "Change the colours",
      p(
        "Set the colour variables on `Root`, on one part or on any ancestor. This one makes the scrim white in light mode and darker in dark mode, and the accent blue:"
      ),
      code("styling/variables.css"),
      table({
        columns: [
          column("Variable", "mono", { width: 136 }),
          column("Light, dark", "prose", { width: 184 }),
          column("What it sets", "prose"),
        ],
        rows: [
          [
            "--zriz-scrim",
            "`#f7f7f7eb`, `#000000c7`",
            "The mask outside the crop",
          ],
          [
            "--zriz-line",
            "`#000`, `#fff`",
            "Outline, handle marks, dial centre line, major ticks, zero dot",
          ],
          ["--zriz-grid", "`#fff9` in both", "Grid lines"],
          ["--zriz-tick", "`#949494`, `#666`", "Minor ticks on the dial"],
          [
            "--zriz-accent",
            "`#fdca00` in both",
            "Dial centre line while you drag the dial",
          ],
        ],
      }),
      p(
        "Write a value with `light-dark()` to keep both schemes, or a single colour to use it in both."
      ),
      demo("styling"),
      p(
        "The demo above switches between the stylesheet's colours and two light looks of its own. Each look sets all five variables on `Root`. Drag the dial to see the accent."
      )
    ),
    section(
      "Follow dark mode",
      p(
        "The parts follow the page's `color-scheme`. The light values above apply in light mode and the dark values in dark mode."
      ),
      p("With this rule on the page, the parts follow the system setting:"),
      code("styling/scheme.css"),
      p(
        'To pin one part, put `data-theme="dark"` or the class `dark` on the part itself. It wins over a themed wrapper. `light` works on the part itself, but its children stay dark inside a dark wrapper:'
      ),
      code("styling/pin.jsx.tsx"),
      p(
        "In forced colours mode, the marks the stylesheet paints switch to `CanvasText`, and the dial's centre line to `Highlight` during a drag. The browser turns the scrim into a veil of `Canvas`, so a dark `--zriz-scrim` shows in the palette's own colour. The other `--zriz-*` variables keep your values, on `Root` or on one part, so CSS of your own that reads one needs a `forced-colors` rule with a system colour."
      )
    ),
    section(
      "Style with Tailwind",
      p(
        "Without the stylesheet, utilities paint everything, the viewport's clip included. Tailwind's `data-*` variants read the state attributes:"
      ),
      code("styling/tailwind.jsx.tsx"),
      p(
        "The mask turns 60% black, and the crop gets a white ring that thickens during a gesture. Forced colours mode removes the ring, because it is a box shadow, so `forced-colors:border` draws the frame there."
      )
    ),
  ],
  lede: "The parts carry no colour. Paint them with the optional stylesheet, your own CSS or Tailwind.",
});

export { STYLING_PAGE };
