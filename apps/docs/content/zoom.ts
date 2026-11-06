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

const ZOOM_PAGE = defineDoc({
  blocks: [
    demo("zoom"),
    section(
      "Anatomy",
      p("Put `ZoomThumb` inside `Zoom`. The steps go anywhere inside `Root`:"),
      code("zoom/anatomy.jsx.tsx"),
      p(
        "zriz paints nothing here and gives these parts no size. Give `Zoom` a width and a height, then style the track and the thumb. A press on the track jumps the zoom to that point. [Full editor](full-editor) paints a track and a thumb you can copy."
      ),
      p(
        "The demo above stops the zoom at 3× with `maxZoom` on `Root`, marks a step at the limit as shown below and uses the styles from the zriz site."
      )
    ),
    section(
      "Centre the thumb",
      p(
        "zriz sets the thumb's `inset-inline-start` on a log scale, so 2× sits 26% along a 15× track. This centres a round thumb on that point:"
      ),
      code("zoom/thumb.css"),
      p(
        "In a right-to-left layout, use `translate: 50% 0`. Forced colours mode drops a plain background, so the second rule paints the thumb in `CanvasText`."
      )
    ),
    section(
      "Stop the slider at 5×",
      p(
        "Pass the same `max` to `Zoom` and `ZoomThumb`. Pinch still reaches 15×:"
      ),
      code("zoom/max.jsx.tsx"),
      p(
        "To cap every way of zooming, set `maxZoom` on `Root` instead. Both parts follow it."
      )
    ),
    section(
      "Mark a step at the limit",
      p(
        "At 1× and at `maxZoom`, a press does nothing, but the button stays enabled. A large `minSize` can stop the zoom below `maxZoom`, and `useZoom` does not report that stop, so this recipe does not mark it. `useZoom` tells you where the zoom is. Use `aria-disabled` for this, because `disabled` drops keyboard focus from the button at the limit. Render this inside `Root`:"
      ),
      code("zoom/steps.tsx"),
      p("The browser dims only `disabled`, so paint the off state yourself:"),
      code("zoom/steps.css")
    ),
    section(
      "Build your own slider",
      p(
        "`useZoom` hands a slider of your own the zoom and a commit callback. This one is a range input. Render it inside `Root`:"
      ),
      code("zoom/slider.tsx"),
      p(
        "A range input moves in even steps, so 2× sits 7% along a 15× track. `Zoom` uses a log scale."
      ),
      p("[Hooks](hooks) lists every field `useZoom` returns.")
    ),
    section(
      "Keyboard",
      p("These keys work while `Zoom` has focus:"),
      keys([
        {
          keys: [["left"], ["right"]],
          text: "Move 1/20 of the track. Right zooms in, left in RTL",
        },
        {
          keys: [["up"], ["down"]],
          text: "Move 1/20 of the track. Up zooms in",
        },
        { keys: [["shift", "arrow keys"]], text: "Move half the track" },
        {
          keys: [["page up"], ["page down"]],
          text: "The same as Shift and an arrow key",
        },
        { keys: [["home"], ["end"]], text: "Go to 1× or to `max`" },
      ]),
      p(
        "Each step multiplies the zoom by the same amount, about 1.14× on a 15× track."
      ),
      p("Escape during a drag cancels it and puts the zoom back.")
    ),
    section(
      "API",
      part(
        "Zoom",
        'Renders a `<div role="slider">` anywhere inside `Root`. Every part also takes `className`, `render` and the props of its element, see [composition](composition). `className` and `render` get `{ dragging }`.',
        props([
          {
            name: "aria-label",
            text: "Names the slider for screen readers. Development builds warn without it",
            type: "string",
          },
          {
            name: "max",
            text: "The zoom at the end of the track. Defaults to `maxZoom` on `Root`",
            type: "number",
          },
          {
            name: "format",
            text: 'How screen readers hear the zoom. By default 2 reads as `"200%"`. An `aria-valuetext` of yours wins over it',
            type: "Intl.NumberFormatOptions",
          },
        ]),
        attrs([
          {
            name: "data-dragging",
            text: "While a pointer holds any `Zoom` track of this cropper or a `useZoom` slider moves, so a second copy lights up too",
          },
        ])
      ),
      part(
        "ZoomThumb",
        "Renders an `aria-hidden` `<div>` inside `Zoom`. zriz writes `position: absolute` and `inset-inline-start`, from 0% at 1× to 100% at `max`.",
        props([
          {
            name: "max",
            text: "The zoom at the end of the track. Defaults to `maxZoom` on `Root`. Keep it equal to `max` on `Zoom`",
            type: "number",
          },
        ])
      ),
      part(
        "ZoomStep",
        'Renders a `<button type="button">` anywhere inside `Root`. Each press jumps at once, with no animation and no grid.',
        props([
          {
            name: "factor",
            required: true,
            text: "Multiplies the zoom on each press. Below 1 zooms out, so 0.8 undoes 1.25",
            type: "number",
          },
        ])
      )
    ),
  ],
  lede: "A zoom slider and step buttons, for people with no wheel or pinch.",
});

export { ZOOM_PAGE };
