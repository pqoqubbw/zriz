import {
  attrs,
  code,
  defineDoc,
  demo,
  keys,
  p,
  part,
  props,
  section,
  variables,
} from "@/lib/doc/define";

const DIAL_PAGE = defineDoc({
  blocks: [
    demo("dial"),
    section(
      "anatomy",
      p(
        "put `DialTicks` inside `Dial`. `Dial` and `DialValue` go anywhere inside `Root`:"
      ),
      code("dial/anatomy.jsx.tsx"),
      p(
        "the stylesheet makes `Dial` 40 px tall and clips its ticks at the sides only, so the zero dot above them stays in view. it draws the ticks and the centre line. `DialValue` ships bare."
      )
    ),
    section(
      "drag and flick the ruler",
      p(
        "drag the ruler 4 px to turn 1°. a quick flick keeps it gliding after you let go, and past the limit it stretches and springs back. on touch, a vertical swipe scrolls the page instead."
      )
    ),
    section(
      "set the ruler width",
      p(
        "`Dial` fills its parent's width. ticks sit 9 px apart, one every 2.25°, so 361 px fits all 41 ticks:"
      ),
      code("dial/width.jsx.tsx")
    ),
    section(
      "add a degree sign",
      p(
        "`format` on `DialValue` gets the angle in degrees and returns the text to show:"
      ),
      code("dial/degree.jsx.tsx")
    ),
    section(
      "make the major ticks taller",
      p("ticks carry no `data-zriz-item`. select them through `DialTicks`:"),
      code("dial/major.css")
    ),
    section(
      "change the drag colour",
      p(
        "the centre line takes the accent colour while you drag. `--zriz-accent` sets it, and [styling](styling) lists its default:"
      ),
      code("dial/accent.css")
    ),
    section(
      "keyboard",
      p("these keys work while `Dial` has focus:"),
      keys([
        { keys: [["left"], ["right"]], text: "lower or raise the angle by 1°" },
        { keys: [["up"], ["down"]], text: "raise or lower the angle by 1°" },
        { keys: [["shift", "arrow keys"]], text: "the same by 10°" },
        {
          keys: [["page up"], ["page down"]],
          text: "raise or lower the angle by 10°",
        },
        {
          keys: [["home"], ["end"]],
          text: "go to the lowest or the highest angle, −45° or 45° at most",
        },
        { keys: [["0"]], text: "straighten to 0°" },
      ]),
      p(
        'with `dir="rtl"` on `Root`, left and right swap. up and down stay the same.'
      )
    ),
    section(
      "api",
      part(
        "Dial",
        'renders a `<div role="slider">` anywhere inside `Root`. every part also takes `className`, `render` and the props of its element, see [composition](composition). `className` and `render` get `{ dragging }`.',
        props([
          {
            name: "aria-label",
            text: "names the slider for screen readers. development builds warn without it",
            type: "string",
          },
          {
            name: "format",
            text: 'how screen readers hear the angle, merged over the default `"5 degrees"`',
            type: "Intl.NumberFormatOptions",
          },
        ]),
        attrs([
          { name: "data-dragging", text: "while a pointer drags the ruler" },
          {
            name: "data-snapped",
            text: "while the angle rests at exactly 0°, from the start too. the zero dot hides then. a drag through 0° leaves it as it was until you let go",
          },
        ]),
        variables([
          {
            name: "--zriz-line",
            text: "paints the centre line, the zero dot and the major ticks. [styling](styling) lists its light and dark values",
          },
          {
            name: "--zriz-accent",
            text: "paints the centre line while you drag. [styling](styling) lists its default",
          },
        ])
      ),
      part(
        "DialTicks",
        "renders an `aria-hidden` `<div>` of `<span>` ticks inside `Dial`. `className` and `render` get `{ count }`.",
        props([
          {
            default: "41",
            name: "count",
            text: "how many ticks to draw, 2.25° apart. 41 spans 45° each way. use an odd count so one tick sits at 0°",
            type: "number",
          },
        ]),
        attrs([
          {
            name: "data-major",
            text: "every tenth tick from the centre: 0°, 22.5° and 45° each way",
          },
          { name: "data-zero", text: "the centre tick, at 0°" },
          {
            name: "data-fade",
            text: '`"0"`, `"1"` or `"2"` on the last three ticks at each end, outermost `"0"`',
          },
        ]),
        variables([
          {
            name: "--zriz-tick",
            text: "paints the minor ticks. [styling](styling) lists its light and dark values",
          },
          {
            name: "--zriz-tick-index",
            text: "on each tick, its index from the left, from 0 to `count` minus 1",
          },
        ])
      ),
      part(
        "DialValue",
        "renders an `aria-hidden` `<span>` anywhere inside `Root`. zriz writes its text, so it takes no children, and neither does a `render` element.",
        props([
          {
            name: "format",
            text: "turns the angle into the text shown. the default rounds it and adds no unit",
            type: "(angle: number) => string",
          },
        ])
      )
    ),
  ],
  lede: "the ruler that levels a tilted photo, up to 45° each way, like the one in ios photos.",
});

export { DIAL_PAGE };
