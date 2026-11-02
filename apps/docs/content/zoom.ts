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

export const zoom = defineDoc({
  blocks: [
    demo("zoom"),
    section(
      "anatomy",
      p("put `ZoomThumb` inside `Zoom`. the steps go anywhere inside `Root`:"),
      code("zoom/anatomy.jsx.tsx"),
      p(
        "zriz paints nothing here and gives these parts no size. give `Zoom` a width and a height, then style the track and the thumb. a press on the track jumps the zoom to that point. [full editor](full-editor) paints a track and a thumb you can copy."
      )
    ),
    section(
      "centre the thumb",
      p(
        "zriz sets the thumb's `inset-inline-start` on a log scale, so 2× sits 26% along a 15× track. this centres a round thumb on that point:"
      ),
      code("zoom/thumb.css"),
      p("in a right-to-left layout, use `translate: 50% 0`.")
    ),
    section(
      "stop the slider at 5×",
      p(
        "pass the same `max` to `Zoom` and `ZoomThumb`. pinch still reaches 15×:"
      ),
      code("zoom/max.jsx.tsx"),
      p(
        "to cap every way of zooming, set `maxZoom` on `Root` instead. both parts follow it."
      )
    ),
    section(
      "disable a step at the limit",
      p(
        "at 1× and at `maxZoom`, a press does nothing, but the button stays enabled. `useZoom` tells you where the zoom is. render this inside `Root`:"
      ),
      code("zoom/steps.tsx")
    ),
    section(
      "build your own slider",
      p(
        "`useZoom` hands a slider of your own the zoom and a commit callback. this one is a range input. render it inside `Root`:"
      ),
      code("zoom/slider.tsx"),
      p(
        "a range input moves in even steps, so 2× sits 7% along a 15× track. `Zoom` uses a log scale."
      ),
      p("[hooks](hooks) lists every field `useZoom` returns.")
    ),
    section(
      "keyboard",
      p("these keys work while `Zoom` has focus:"),
      keys([
        {
          keys: [["left"], ["right"]],
          text: "move 1/20 of the track. right zooms in, left in rtl",
        },
        {
          keys: [["up"], ["down"]],
          text: "move 1/20 of the track. up zooms in",
        },
        { keys: [["shift", "arrow"]], text: "move half the track" },
        { keys: [["page up"], ["page down"]], text: "move half the track" },
        { keys: [["home"], ["end"]], text: "go to 1× or to `max`" },
      ]),
      p(
        "each step multiplies the zoom by the same amount, about 1.14× on a 15× track."
      )
    ),
    section(
      "api",
      part(
        "Zoom",
        'renders a `<div role="slider">` anywhere inside `Root`. every part also takes `className`, `render` and the props of its element, see [composition](composition). `className` and `render` get `{ dragging }`.',
        props([
          {
            name: "aria-label",
            text: "names the slider for screen readers. development builds warn without it",
            type: "string",
          },
          {
            name: "max",
            text: "the zoom at the end of the track. defaults to `maxZoom` on `Root`",
            type: "number",
          },
          {
            name: "format",
            text: 'how screen readers hear the zoom. by default 2 reads as `"200%"`',
            type: "Intl.NumberFormatOptions",
          },
        ]),
        attrs([
          {
            name: "data-dragging",
            text: "while a pointer holds the track or a `useZoom` slider moves",
          },
        ])
      ),
      part(
        "ZoomThumb",
        "renders an `aria-hidden` `<div>` inside `Zoom`. zriz writes `position: absolute` and `inset-inline-start`, from 0% at 1× to 100% at `max`.",
        props([
          {
            name: "max",
            text: "the zoom at the end of the track. defaults to `maxZoom` on `Root`. keep it equal to `max` on `Zoom`",
            type: "number",
          },
        ])
      ),
      part(
        "ZoomStep",
        'renders a `<button type="button">` anywhere inside `Root`. each press jumps at once, with no animation and no grid.',
        props([
          {
            name: "factor",
            required: true,
            text: "multiplies the zoom on each press. below 1 zooms out, so 0.8 undoes 1.25",
            type: "number",
          },
        ])
      )
    ),
  ],
  lede: "a zoom slider and step buttons, for people with no wheel or pinch.",
});
