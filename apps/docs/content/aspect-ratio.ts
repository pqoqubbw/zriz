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
      "Anatomy",
      p(
        "The group and the orientation button go anywhere inside `Root`. Each item names one ratio:"
      ),
      code("aspect-ratio/anatomy.jsx.tsx"),
      p(
        '`value` is width divided by height, so `4 / 5` is 4:5. `"free"` drops the lock and `"original"` uses the photo\'s own ratio. Picking an item springs the crop to it, with `data-transition="morph"` on `Root`.'
      ),
      p(
        'On a round crop every item but `value={1}` is disabled. zriz ships these parts bare. The demo above adds `"original"`, turns its labels with the orientation as the ratios further down do, and uses the styles from the zriz site.'
      )
    ),
    section(
      "Lock one ratio with no buttons",
      p(
        "Pass `aspect` to `Root` and leave out the group. The crop keeps that ratio, and `Reset` returns to it:"
      ),
      code("aspect-ratio/fixed.jsx.tsx")
    ),
    section(
      "Use an item outside a group",
      p(
        "Outside `AspectGroup`, an item is a plain button with `aria-pressed` instead of a radio:"
      ),
      code("aspect-ratio/square.jsx.tsx")
    ),
    section(
      "Turn the orientation icon",
      p(
        "`Orientation` says which way the crop faces in `data-orientation`. This turns its icon for portrait:"
      ),
      code("aspect-ratio/icon.css"),
      p(
        "A press swaps the ratio for its inverse, so 4:5 becomes 5:4. It springs like an item pick, and `onValueChange` gets the reason `orientation`."
      )
    ),
    section(
      "Follow the orientation in the labels",
      p(
        "After a swap the crop is 5:4, so a 4:5 item is no longer checked. To keep one item per ratio, flip the values and labels with the orientation. Render it inside `Root`:"
      ),
      code("aspect-ratio/ratios.tsx")
    ),
    section(
      "Keyboard",
      p(
        "The group is one tab stop. Tab lands on the checked item, or on the first one when none is checked. The arrows move and select at once:"
      ),
      keys([
        { keys: [["right"], ["down"]], text: "Select the next ratio" },
        { keys: [["left"], ["up"]], text: "Select the previous ratio" },
        {
          keys: [["home"], ["end"]],
          text: "Select the first or the last ratio",
        },
      ]),
      p(
        'The arrows wrap around at the ends and skip disabled items. On a right-to-left page or with `dir="rtl"` on `Root`, left and right swap.'
      )
    ),
    section(
      "API",
      part(
        "AspectGroup",
        'Renders a `<div role="radiogroup">` anywhere inside `Root`. Every part also takes `className`, `render` and the props of its element, see [composition](composition). `className` and `render` get `{ aspect }`.',
        props([
          {
            name: "aria-label",
            text: "Names the group for screen readers",
            type: "string",
          },
        ])
      ),
      part(
        "AspectItem",
        'Renders a `<button type="button">`, with `role="radio"` inside `AspectGroup`. `className` and `render` get `{ checked, disabled }`.',
        props([
          {
            name: "value",
            required: true,
            text: "The ratio this item picks, as width / height",
            type: '"free" | "original" | number',
          },
        ]),
        attrs([
          { name: "data-checked", text: "While this ratio is the current one" },
          {
            name: "data-disabled",
            text: "On a round crop for every value but 1, or when you pass `disabled` to the item",
          },
        ])
      ),
      part(
        "Orientation",
        'Renders a `<button type="button">` anywhere inside `Root`. It has no props of its own. It is `disabled` while the aspect is 1, `"free"` or `"original"`. `className` and `render` get `{ orientation }`.',
        attrs([
          {
            name: "data-orientation",
            text: '`"landscape"` above 1, `"portrait"` below 1, `"square"` at 1 and while the aspect is `"free"` or `"original"`',
          },
          {
            name: "data-disabled",
            text: 'While the aspect is 1, `"free"` or `"original"`',
          },
        ])
      )
    ),
  ],
  lede: "Buttons that lock the crop to a ratio such as 1:1 or 4:5, and one that swaps portrait and landscape.",
});

export { ASPECT_RATIO_PAGE };
