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
      "add the stylesheet",
      p(
        "import the stylesheet once. [bundle size](bundle-size) lists its weight:"
      ),
      code("styling/import.ts"),
      table({
        columns: [
          column("part", "mono"),
          column("what the stylesheet sets", "prose"),
        ],
        rows: [
          ["Viewport", "`overflow: clip` and a grab cursor"],
          ["Mask", "the scrim colour. it fades to 60% during a gesture"],
          [
            "Area",
            "a 1 px outline inside the crop, and a two-tone ring on keyboard focus",
          ],
          [
            "Handle",
            'a corner mark of two short lines or an edge bar, and a resize cursor. corners hide with `shape="circle"`',
          ],
          ["Grid", "white lines that fade in during a gesture"],
          [
            "Dial",
            "40 px height, sideways clip, a grab cursor, centre line, tick colours, the zero dot",
          ],
        ],
      }),
      p(
        "it paints nothing on `Zoom`, the buttons or the aspect items. the demos on this site style those themselves. [viewport](viewport) shows how to size the box."
      ),
      p(
        "every rule sits in `:where()` inside `@layer components.zriz`. a class with no layer wins in any import order, and so does a class in your `components` or `utilities` layer, tailwind included. a class in any other layer wins only when that layer is declared after the stylesheet. `@zriz/core/styles.css` is the same file for [vanilla js](vanilla-js)."
      ),
      p(
        "a page-wide `transition` cannot make the crop trail your finger. zriz sets `transition-property` inline to `none` on `Area`, `DialTicks` and `ZoomThumb`, and to `opacity` on `Mask`, so the mask keeps its fade. a transition of your own on those parts needs `!important`."
      ),
      p(
        "the first line of the file names `properties`, `theme`, `base`, `components` and `utilities`, so a stylesheet loaded first sets the order of those layers on your page. to keep your own order, and to let every layer of yours win, import it into a layer of its own:"
      ),
      code("styling/layer.css")
    ),
    section(
      "style a part by its state",
      p(
        "`className` takes a string, or a function that gets the part's state:"
      ),
      code("styling/classname.jsx.tsx"),
      p(
        "return `undefined` from the function for no class. to swap the element itself, see [composition](composition)."
      )
    ),
    section(
      "style with data attributes",
      p(
        "every part's outer element carries `data-zriz-item` with its part name in kebab case, such as `aspect-item` or `dial-ticks`. the ticks and grid lines inside carry none, so select them through their part, as [dial](dial) shows. `Root` also marks the gesture in progress with `data-rotating`, `data-panning`, `data-pinching`, `data-resizing` or `data-zooming`. this rule hides the handles while the dial is dragged or thrown:"
      ),
      code("styling/attributes.css"),
      p("each component page lists the attributes that part sets.")
    ),
    section(
      "change the colours",
      p(
        "set the colour variables on `Root`, on one part or on any ancestor. this one makes the scrim white in light mode and darker in dark mode, and the accent blue:"
      ),
      code("styling/variables.css"),
      table({
        columns: [
          column("variable", "mono", { width: 136 }),
          column("light, dark", "prose", { width: 184 }),
          column("what it sets", "prose"),
        ],
        rows: [
          [
            "--zriz-scrim",
            "`#f7f7f7eb`, `#000000c7`",
            "the mask outside the crop",
          ],
          [
            "--zriz-line",
            "`#000`, `#fff`",
            "outline, handle marks, dial centre line, major ticks, zero dot",
          ],
          ["--zriz-grid", "`#fff9` in both", "grid lines"],
          ["--zriz-tick", "`#949494`, `#666`", "minor ticks on the dial"],
          [
            "--zriz-accent",
            "`#fdca00` in both",
            "dial centre line while you drag the dial",
          ],
        ],
      }),
      p(
        "write a value with `light-dark()` to keep both schemes, or a single colour to use it in both."
      )
    ),
    section(
      "follow dark mode",
      p(
        "the parts follow the page's `color-scheme`. the light values above apply in light mode and the dark values in dark mode:"
      ),
      demo("styling"),
      p("with this rule on the page, the parts follow the system setting:"),
      code("styling/scheme.css"),
      p(
        'to pin one part, put `data-theme="dark"` or the class `dark` on the part itself. it wins over a themed wrapper. `light` works on the part itself, but its children stay dark inside a dark wrapper:'
      ),
      code("styling/pin.jsx.tsx"),
      p(
        "in forced colours mode, the marks the stylesheet paints switch to `CanvasText`, and the dial's centre line to `Highlight` during a drag. the browser turns the scrim into a veil of `Canvas`, so a dark `--zriz-scrim` shows in the palette's own colour. the other `--zriz-*` variables keep your values, on `Root` or on one part, so css of your own that reads one needs a `forced-colors` rule with a system colour."
      )
    ),
    section(
      "style with tailwind",
      p(
        "without the stylesheet, utilities paint everything, the viewport's clip included. tailwind's `data-*` variants read the state attributes:"
      ),
      code("styling/tailwind.jsx.tsx"),
      p(
        "the mask turns 60% black, and the crop gets a white ring that thickens during a gesture. forced colours mode removes the ring, because it is a box shadow, so `forced-colors:border` draws the frame there."
      )
    ),
  ],
  lede: "the parts carry no colour. paint them with the optional stylesheet, your own css or tailwind.",
});

export { STYLING_PAGE };
