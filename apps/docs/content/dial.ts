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
      "Anatomy",
      p(
        "Put `DialTicks` inside `Dial`. `Dial` and `DialValue` go anywhere inside `Root`:"
      ),
      code("dial/anatomy.jsx.tsx"),
      p(
        "The stylesheet makes `Dial` 40 px tall and clips its ticks at the sides only, so the zero dot above them stays in view, and fades them out over 48 px at each side. It draws the ticks and the centre line. `DialValue` ships bare."
      ),
      p(
        "The demo above shows the angle to one decimal with a degree sign and uses the styles from the zriz site."
      )
    ),
    section(
      "Drag and flick the ruler",
      p(
        "The first 10 px of a drag only pick up the ruler. After that, every 4 px turns 1°. A quick flick keeps it gliding after you let go, and past the limit it stretches and springs back. On touch, a vertical swipe scrolls the page instead."
      ),
      p(
        "The ruler reads like a ruler, with positive angles to the right of 0°. Drag it left, or press the right arrow, and the angle grows past the centre line."
      ),
      p(
        "A drag catches at 0°. Within 1° of it the angle holds at exactly 0°, and past that it carries on from 0° without a jump, so a level horizon takes no fiddling. A flick that comes to rest within 1° lands on 0°. Keys, the wheel and `setRotation` keep the exact angle."
      ),
      p(
        "The photo zooms in as the angle grows. One gesture back to 0° restores the zoom. Separate gestures keep it, as in iOS Photos, until `Reset` or `Zoom` takes it back."
      )
    ),
    section(
      "Set the ruler width",
      p(
        "`Dial` fills its parent's width. Ticks sit 9 px apart, one every 2.25°, so 361 px fits all 41 ticks:"
      ),
      code("dial/width.jsx.tsx"),
      p(
        "The demo above is 360 px wide, as on the zriz site, so its outermost ticks fall on the edges."
      )
    ),
    section(
      "Add a degree sign",
      p(
        "`format` on `DialValue` gets the angle in degrees and returns the text to show:"
      ),
      code("dial/degree.jsx.tsx")
    ),
    section(
      "Make the major ticks taller",
      p("Ticks carry no `data-zriz-item`. Select them through `DialTicks`:"),
      code("dial/major.css")
    ),
    section(
      "Change the drag colour",
      p(
        "The centre line takes the accent colour while you drag. `--zriz-accent` sets it, and [styling](styling) lists its default:"
      ),
      code("dial/accent.css")
    ),
    section(
      "Keyboard",
      p("These keys work while `Dial` has focus:"),
      keys([
        { keys: [["left"], ["right"]], text: "Lower or raise the angle by 1°" },
        { keys: [["up"], ["down"]], text: "Raise or lower the angle by 1°" },
        { keys: [["shift", "arrow keys"]], text: "The same by 10°" },
        {
          keys: [["page up"], ["page down"]],
          text: "Raise or lower the angle by 10°",
        },
        {
          keys: [["home"], ["end"]],
          text: "Go to the lowest or the highest angle, −45° or 45° at most",
        },
        { keys: [["0"]], text: "Straighten to 0°" },
      ]),
      p(
        'On a right-to-left page or with `dir="rtl"` on `Root`, left and right swap. Up and down stay the same. The ticks read the direction when they draw, so after a page flips its `dir` they follow at the next draw. A new `dir` on `Root` redraws them at once.'
      ),
      p("Escape during a drag cancels it and puts the angle back.")
    ),
    section(
      "API",
      part(
        "Dial",
        'Renders a `<div role="slider">` anywhere inside `Root`. Every part also takes `className`, `render` and the props of its element, see [composition](composition). `className` and `render` get `{ dragging }`.',
        props([
          {
            name: "aria-label",
            text: "Names the slider for screen readers. Development builds warn without it",
            type: "string",
          },
          {
            name: "format",
            text: 'How screen readers hear the angle, merged over the default `"5 degrees"`. An `aria-valuetext` of yours wins over it',
            type: "Intl.NumberFormatOptions",
          },
        ]),
        attrs([
          {
            name: "data-dragging",
            text: "While a pointer drags any `Dial` of this cropper, so a second copy lights up too",
          },
          {
            name: "data-snapped",
            text: "While the angle rests at exactly 0°, from the start too. The zero dot hides then. A drag through 0° leaves it as it was until you let go",
          },
        ]),
        variables([
          {
            name: "--zriz-line",
            text: "Paints the centre line, the zero dot and the major ticks. [Styling](styling) lists its light and dark values",
          },
          {
            name: "--zriz-accent",
            text: "Paints the centre line while you drag. [Styling](styling) lists its default",
          },
        ])
      ),
      part(
        "DialTicks",
        "Renders an `aria-hidden` `<div>` of `<span>` ticks inside `Dial`. `className` and `render` get `{ count }`.",
        props([
          {
            default: "41",
            name: "count",
            text: "How many ticks to draw, 2.25° apart. 41 spans 45° each way. Use an odd count so one tick sits at 0°",
            type: "number",
          },
        ]),
        attrs([
          {
            name: "data-major",
            text: "Every tenth tick from the centre: 0°, 22.5° and 45° each way",
          },
          { name: "data-zero", text: "The centre tick, at 0°" },
          {
            name: "data-fade",
            text: '`"0"`, `"1"` or `"2"` on the last three ticks at each end, outermost `"0"`',
          },
        ]),
        variables([
          {
            name: "--zriz-tick",
            text: "Paints the minor ticks. [Styling](styling) lists its light and dark values",
          },
          {
            name: "--zriz-tick-index",
            text: "On each tick, its index from the left, from 0 to `count` minus 1",
          },
        ])
      ),
      part(
        "DialValue",
        "Renders an `aria-hidden` `<span>` anywhere inside `Root`. zriz writes its text, so it takes no children, and neither does a `render` element.",
        props([
          {
            name: "format",
            text: "Turns the angle into the text shown. The default rounds it and adds no unit",
            type: "(angle: number) => string",
          },
        ])
      )
    ),
  ],
  lede: "The ruler that levels a tilted photo, up to 45° each way, like the one in iOS Photos.",
});

export { DIAL_PAGE };
