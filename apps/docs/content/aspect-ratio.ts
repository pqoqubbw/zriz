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
} from "@/lib/doc/define";

const ASPECT_RATIO_PAGE = defineDoc({
  blocks: [
    demo("aspect-ratio"),
    section(
      "anatomy",
      p(
        "the group and the orientation button go anywhere inside `Root`. each item names one ratio:"
      ),
      code("aspect-ratio/anatomy.jsx.tsx"),
      p(
        '`value` is width divided by height, so `4 / 5` is 4:5. `"free"` drops the lock and `"original"` uses the photo\'s own ratio. picking an item springs the crop to it, with `data-transition="morph"` on `Root`.'
      ),
      p(
        "on a round crop every item but `value={1}` is disabled. zriz ships these parts bare. the demo above uses the styles from the zriz site."
      )
    ),
    section(
      "lock one ratio with no buttons",
      p(
        "pass `aspect` to `Root` and leave out the group. the crop keeps that ratio, and `Reset` returns to it:"
      ),
      code("aspect-ratio/fixed.jsx.tsx")
    ),
    section(
      "use an item outside a group",
      p(
        "outside `AspectGroup`, an item is a plain button with `aria-pressed` instead of a radio:"
      ),
      code("aspect-ratio/square.jsx.tsx")
    ),
    section(
      "turn the orientation icon",
      p(
        "`Orientation` says which way the crop faces in `data-orientation`. this turns its icon for portrait:"
      ),
      code("aspect-ratio/icon.css"),
      p(
        "a press swaps the ratio for its inverse, so 4:5 becomes 5:4. it springs like an item pick, and `onValueChange` gets the reason `orientation`."
      )
    ),
    section(
      "follow the orientation in the labels",
      p(
        "after a swap the crop is 5:4, so a 4:5 item is no longer checked. to keep one item per ratio, flip the values and labels with the orientation. render it inside `Root`:"
      ),
      code("aspect-ratio/ratios.tsx")
    ),
    section(
      "keyboard",
      p(
        "the group is one tab stop. tab lands on the checked item, or on the first one when none is checked. the arrows move and select at once:"
      ),
      keys([
        { keys: [["right"], ["down"]], text: "select the next ratio" },
        { keys: [["left"], ["up"]], text: "select the previous ratio" },
        {
          keys: [["home"], ["end"]],
          text: "select the first or the last ratio",
        },
      ]),
      p(
        'the arrows wrap around at the ends and skip disabled items. on a right-to-left page or with `dir="rtl"` on `Root`, left and right swap.'
      )
    ),
    section(
      "api",
      part(
        "AspectGroup",
        'renders a `<div role="radiogroup">` anywhere inside `Root`. every part also takes `className`, `render` and the props of its element, see [composition](composition). `className` and `render` get `{ aspect }`.',
        props([
          {
            name: "aria-label",
            text: "names the group for screen readers",
            type: "string",
          },
        ])
      ),
      part(
        "AspectItem",
        'renders a `<button type="button">`, with `role="radio"` inside `AspectGroup`. `className` and `render` get `{ checked, disabled }`.',
        props([
          {
            name: "value",
            required: true,
            text: "the ratio this item picks, as width / height",
            type: '"free" | "original" | number',
          },
        ]),
        attrs([
          { name: "data-checked", text: "while this ratio is the current one" },
          {
            name: "data-disabled",
            text: "on a round crop, for every value but 1",
          },
        ])
      ),
      part(
        "Orientation",
        'renders a `<button type="button">` anywhere inside `Root`. it has no props of its own. it is `disabled` while the aspect is 1, `"free"` or `"original"`. `className` and `render` get `{ orientation }`.',
        attrs([
          {
            name: "data-orientation",
            text: '`"landscape"` above 1, `"portrait"` below 1, `"square"` at 1 and while the aspect is `"free"` or `"original"`',
          },
        ])
      )
    ),
  ],
  lede: "buttons that lock the crop to a ratio such as 1:1 or 4:5, and one that swaps portrait and landscape.",
});

export { ASPECT_RATIO_PAGE };
