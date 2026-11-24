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
        "zriz ships them bare, with no paint and no icons. The demo above adds a right turn and a vertical flip, and uses the icons and styles from the zriz site. With the vertical flip beside it, both of its flips leave out `toggle`."
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
        'While a move runs, `Root` carries `data-transition`: `"rotate"`, `"flip"` or `"morph"` for `Reset`. A `Reset` across a quarter turn runs as `"rotate"`, and so does a `Flip` or `Reset` pressed while a rotate still runs. During `"rotate"` the photo turns under the crop, the crop frame changes shape to the new side ratio, and the frame, its handles and the photo outside the crop stay visible, as during a flip. The photo moves through the Web Animations API, so it stays smooth when the browser slows `requestAnimationFrame`, as Safari does in Low Power Mode. While the move runs, the `<img>` inside `Image` has one entry in `getAnimations()`. [Accessibility](accessibility) lists how long each move takes, with and without reduced motion.'
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
        'Renders a `<button type="button">` anywhere inside `Root`. It is a plain button by default. With `toggle` and `axis="x"` it is a toggle with `aria-pressed`, which is `true` while the photo is mirrored. Use `toggle` when the editor has one flip action named without an axis, such as "Flip", even if a second toolbar repeats it. A vertical flip is a mirror and a 180° turn, so a toggle beside a vertical flip button, or in an app that calls `flip("y")`, would read as pressed after a vertical flip. Leave both buttons plain then, say the result with `Announcer`, and never set `aria-pressed` on them yourself. `className` and `render` get `{ mirrored }`. Without `toggle` the button has no on state, so do not draw one from `mirrored`.',
        props([
          {
            default: '"x"',
            name: "axis",
            text: '`"x"` swaps left and right, `"y"` swaps top and bottom',
            type: '"x" | "y"',
          },
          {
            default: "false",
            name: "toggle",
            text: 'Sets `aria-pressed` to whether the photo is mirrored. Has no effect with `axis="y"`',
            type: "boolean",
          },
        ]),
        attrs([
          {
            name: "data-mirrored",
            text: 'With `toggle`, while the photo is mirrored, with `aria-pressed="true"`. `Root` carries `data-mirrored` too, for styling the photo, never a plain flip button',
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
