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
} from "@/lib/doc/define";

const BUTTONS_PAGE = defineDoc({
  blocks: [
    demo("buttons"),
    section(
      "Anatomy",
      p(
        "Each one is a button that goes anywhere inside `Root`. Put an icon or a word inside, and give an icon-only button an `aria-label`:"
      ),
      code("buttons/anatomy.jsx.tsx"),
      p(
        "zriz ships them bare, with no paint and no icons. The demo above adds a right turn and a vertical flip, and uses the icons and styles from the zriz site."
      )
    ),
    section(
      "See what each button moves",
      table({
        columns: [
          column("Part", "mono", { width: 200 }),
          column("What it does", "prose"),
        ],
        rows: [
          [
            "Rotate",
            "Turns the photo 90° with a spring. A 3:2 crop becomes 2:3",
          ],
          [
            "Flip",
            "Mirrors the photo, left to right by default, with a spring",
          ],
          [
            "Reset",
            "Springs back to where the crop started: `defaultValue` and the starting `aspect`, `rotation` and `zoom`, or the full photo",
          ],
        ],
      }),
      p(
        "Every button part sets `touch-action: manipulation` and `user-select: none` inline, so a double tap on a phone never zooms the page and a long press never selects the label and loses the click."
      ),
      p(
        "While `Root` is disabled, a press does nothing, and before the photo loads only `Reset` acts. The buttons stay natively enabled and report `aria-disabled`, so style them from `data-disabled` on `Root`, as [root](root) shows."
      ),
      p(
        'While a move runs, `Root` carries `data-transition`: `"rotate"`, `"flip"` or `"morph"` for `Reset`. A `Reset` across a quarter turn runs as `"rotate"`, and so does a `Flip` or `Reset` pressed while a rotate still runs. During `"rotate"` the crop turns whole with the photo, with no photo outside it, and the stylesheet hides `Area` and its handles. [Accessibility](accessibility) lists how long each move takes, with and without reduced motion.'
      )
    ),
    section(
      "Rotate both ways",
      p('`Rotate` turns left, like iOS Photos. `direction="cw"` turns right:'),
      code("buttons/both.jsx.tsx")
    ),
    section(
      "Keep reset hidden",
      p(
        "`Reset` hides with the `hidden` attribute while nothing has changed. If a class sets `display` on it, add this rule:"
      ),
      code("buttons/hidden.css")
    ),
    section(
      "API",
      part(
        "Rotate",
        'Renders a `<button type="button">` anywhere inside `Root`. Every part also takes `className`, `render` and the props of its element, see [composition](composition).',
        props([
          {
            default: '"ccw"',
            name: "direction",
            text: '`"ccw"` turns left, `"cw"` turns right',
            type: '"ccw" | "cw"',
          },
        ])
      ),
      part(
        "Flip",
        'Renders a `<button type="button">` with `aria-pressed` anywhere inside `Root`. `className` and `render` get `{ mirrored }`.',
        props([
          {
            default: '"x"',
            name: "axis",
            text: '`"x"` swaps left and right, `"y"` swaps top and bottom',
            type: '"x" | "y"',
          },
        ]),
        attrs([
          {
            name: "data-mirrored",
            text: 'While the photo is mirrored, with `aria-pressed="true"`',
          },
        ])
      ),
      part(
        "Reset",
        'Renders a `<button type="button">` anywhere inside `Root`. It has no props of its own. `className` and `render` get `{ pristine }`.',
        attrs([
          {
            name: "data-pristine",
            text: "While nothing has changed. The button is `hidden` then",
          },
        ])
      )
    ),
  ],
  lede: "`Rotate` turns the photo a quarter turn, `Flip` mirrors it and `Reset` undoes every change.",
});

export { BUTTONS_PAGE };
