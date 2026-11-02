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

export const buttons = defineDoc({
  blocks: [
    demo("buttons"),
    section(
      "anatomy",
      p(
        "each one is a button that goes anywhere inside `Root`. put an icon or a word inside, and give an icon-only button an `aria-label`:"
      ),
      code("buttons/anatomy.jsx.tsx"),
      p(
        "zriz ships them bare, with no paint and no icons. the demo above uses the icons and styles from the zriz site."
      )
    ),
    section(
      "see what each button moves",
      table({
        columns: [
          column("part", "mono", { width: 200 }),
          column("what it does", "prose"),
        ],
        rows: [
          ["Rotate", "turns the photo 90°, easing out. a 3:2 crop becomes 2:3"],
          [
            "Flip",
            "mirrors the photo, left to right by default, with a spring",
          ],
          [
            "Reset",
            "springs back to where the crop started: `defaultValue` and the starting `aspect` and `rotation`, or the full photo",
          ],
        ],
      }),
      p(
        "while `Root` is disabled, a press does nothing, and before the photo loads only `Reset` acts. the buttons stay enabled, so style them from `data-disabled` on `Root`, as [root](root) shows."
      ),
      p(
        'while a move runs, `Root` carries `data-transition`: `"rotate"`, `"flip"` or `"morph"` for `Reset`. [accessibility](accessibility) lists how long each move takes, with and without reduced motion.'
      )
    ),
    section(
      "rotate both ways",
      p('`Rotate` turns left, like ios photos. `direction="cw"` turns right:'),
      code("buttons/both.jsx.tsx")
    ),
    section(
      "keep reset hidden",
      p(
        "`Reset` hides with the `hidden` attribute while nothing has changed. if a class sets `display` on it, add this rule:"
      ),
      code("buttons/hidden.css")
    ),
    section(
      "api",
      part(
        "Rotate",
        'renders a `<button type="button">` anywhere inside `Root`. every part also takes `className`, `render` and the props of its element, see [composition](composition).',
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
        'renders a `<button type="button">` with `aria-pressed` anywhere inside `Root`. `className` and `render` get `{ mirrored }`.',
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
            text: 'while the photo is mirrored, with `aria-pressed="true"`',
          },
        ])
      ),
      part(
        "Reset",
        'renders a `<button type="button">` anywhere inside `Root`. it has no props of its own. `className` and `render` get `{ pristine }`.',
        attrs([
          {
            name: "data-pristine",
            text: "while nothing has changed. the button is `hidden` then",
          },
        ])
      )
    ),
  ],
  lede: "`Rotate` turns the photo a quarter turn, `Flip` mirrors it and `Reset` undoes every change.",
});
