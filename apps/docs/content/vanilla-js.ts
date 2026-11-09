import { code, column, defineDoc, p, section, table } from "@/lib/doc/define";

const VANILLA_JS_PAGE = defineDoc({
  blocks: [
    section(
      "Install the core package",
      p(
        "Add `@zriz/core` as in [exporting](exporting). It has no dependencies, not even React."
      )
    ),
    section(
      "Write the markup",
      p(
        "Give each element its `data-zriz-item`, so the stylesheet finds it, and give the viewport a width and a height. The binders set no role or name on the crop area, so write them in the markup:"
      ),
      code("vanilla-js/markup.html")
    ),
    section(
      "Bind the parts",
      p(
        "Create a cropper, bind each element, add the four corner handles, and attach the photo when the user picks a file. Save this as `cropper.ts`. The snippets below import `cropper` and `cleanups` from it:"
      ),
      code("vanilla-js/cropper.ts"),
      p(
        'Each binder writes geometry inline and returns its cleanup. `bindHandle` also takes `"top"`, `"right"`, `"bottom"` and `"left"` for the edge bars. After you pick a file, the photo shows under a 4:3 crop. The handles have no layout until the next section places them.'
      ),
      p(
        "Each pick aborts the load before it, so a slow file never replaces a newer one, and clears the old message. A cleanup aborts the last load and removes the listener. When a file does not open, `loadImage` rejects with a `ZrizError`, and [errors](errors) lists its codes."
      )
    ),
    section(
      "Place the handles",
      p(
        "`bindHandle` wires the drag but leaves layout to you. This CSS centres a 44 px hit box on each corner and on the middle of each edge, and `--zriz-handle-size` on the area resizes it as on [crop area](crop-area):"
      ),
      code("vanilla-js/handles.css")
    ),
    section(
      "Move the crop with keys",
      p(
        "`bindArea` moves the crop but listens to no keys. Pass the area's events to `areaKeyHandlers`:"
      ),
      code("vanilla-js/keys.ts"),
      p(
        "The keys are the ones on [crop area](crop-area). Call `keys.release()` when you unbind, so a key held at that moment does not lock the cropper. `zoomHandlers` and `handleHandlers` have the same `release`. `handleHandlers` also takes a fourth argument, a function that gets `true` when its handle is pressed and `false` when it lets go."
      )
    ),
    section(
      "Add the dial",
      p(
        "`bindDial` handles drags, keys and the slider's ARIA values. `bindDialTicks` fills the strip with 41 ticks and moves it:"
      ),
      code("vanilla-js/dial.ts"),
      p(
        'On a right-to-left page, the arrows and the drag swap. Pass `{ dir: "rtl" }` or `{ dir: "ltr" }` as the third argument of `bindDial` to set it yourself.'
      ),
      p(
        "The same argument takes `locale` and `format` for the spoken angle, and `ownText: true` to keep an `aria-valuetext` of yours, which `bindDial` overwrites otherwise. It also takes `gain`, the pixels of drag per degree, 4 by default, `slop`, the pixels a drag travels before the dial moves, 10 by default, and `tau`, the time constant of a flick in ms, 95 by default."
      ),
      p(
        "After a flick, the speed falls to about a third every `tau` ms, and the glide stops once it drops under 0.5° a second. It ends about the flick's speed times `tau` past where you let go, so a flick at 100° a second glides about 9.5°."
      ),
      p(
        "`locale`, `format` and `ownText` belong to that element. `dir`, `gain`, `slop` and `tau` belong to the cropper: a second `bindDial` merges its values over the first, and both dials follow them. `bindDialTicks` spaces the ticks `gain` times 2.25 px apart, so it redraws when `gain` changes. When the last dial unbinds, the defaults come back."
      ),
      p(
        "`bindDialTicks(cropper, strip, count)` makes 41 ticks by default, and uses the children when the strip already has some."
      )
    ),
    section(
      "Add a zoom slider",
      p(
        'Zoom has no single binder. Give the element `role="slider"`, `tabindex="0"`, an `aria-label`, a size, `position: relative`, `touch-action: none` and `user-select: none`, and draw the thumb yourself. The stylesheet paints nothing on zoom:'
      ),
      code("vanilla-js/zoom.html"),
      p(
        "Forced colours mode drops the colour on the thumb. Add this rule to your stylesheet to paint it in `CanvasText`. Keep it in a CSS file, because a strict `style-src` refuses a `<style>` element. The thumb's colour is inline, so the rule needs `!important`:"
      ),
      code("vanilla-js/zoom.css"),
      p("Then hand its events to `zoomHandlers`:"),
      code("vanilla-js/zoom.ts"),
      p(
        "`zoomAria` keeps the slider's values current, and `bindZoomThumb` moves the thumb from 0% at 1× to 100% at the largest zoom. To end the track early, pass the same `max` to all three: `zoomHandlers(cropper, { max, dir })`, `zoomAria(cropper, zoom, { max, locale, format, ownText })` and `bindZoomThumb(cropper, thumb, { max })`. Without `ownText: true`, `zoomAria` overwrites your `aria-valuetext`."
      )
    ),
    section(
      "Read the crop",
      p(
        "The `commit` event fires once per gesture with the crop value and the export plan, which is `null` until a photo loads:"
      ),
      code("vanilla-js/read.ts"),
      p(
        "To turn the crop into a file, pass the cropper to `exportCrop` as in [exporting](exporting). The first photo sends no `commit` until someone touches it, and a later photo sends one only when it has to refit the crop, see [events](events)."
      )
    ),
    section(
      "Connect the rest",
      table({
        columns: [column("Part", "prose"), column("How to wire it", "prose")],
        rows: [
          [
            "Dial value",
            "`bindDialValue(cropper, element, format)` writes the angle as text. Without `format`, it writes whole degrees",
          ],
          [
            "Grid",
            'No binder. `bindState` writes `data-grid` on the root as `"none"`, `"coarse"` or `"fine"`. Draw the lines in CSS. The stylesheet keeps `data-zriz-item="grid"` at opacity 0 without `data-visible`, and no binder sets it, so set `opacity` from `[data-grid]` on the root or leave that attribute off the element',
          ],
          [
            "State attributes",
            "`bindState` writes every attribute [root](root) lists on your element, except `data-shape`. Set that one in your markup. Only the React parts write `data-interacting` on the area, `data-active` on a handle, `data-ready` on the image, `data-dragging` on zoom and `data-shape` on the area and mask. Leave out the fade rule on [viewport](viewport), which would keep the photo hidden here",
          ],
          [
            "Buttons",
            "No binder. Call `rotate90()`, `flip()`, `reset()` or `setAspect(1)` on the cropper from a click",
          ],
          [
            "Your own img",
            "`bindImage(cropper, element)` sizes and moves an element of yours with the photo. You set its `src`",
          ],
          [
            "Round crop",
            'Pass `"circle"` as the third argument of `bindMask` and `{ shape: "circle" }` as the third argument of `bindArea`. Set `aspect: 1` in `defaultValue`. The stylesheet hides the corner handles when the area has `data-shape="circle"`, which `bindArea` leaves to your markup',
          ],
          [
            "Wheel and twist",
            'Pass `{ wheel: "zoom", rotateGesture: false }` as the third argument of `bindViewport`. `wheel` also takes `"pan"` and `"none"`',
          ],
          [
            "Motion",
            'Call `viewOf(cropper).setOptions({ motion: "reduce", recenterDelay: 800 })`. `motion` also takes `"auto"` and `"always"`. Each call replaces both options',
          ],
          [
            "Live variables",
            "Pass `{ liveVariables: true }` as the third argument of `bindArea`, see [crop area](crop-area)",
          ],
          [
            "Announcements",
            'No binder. On `commit`, write your own text into an element with `role="status"`, and point the area\'s `aria-describedby` at your instructions',
          ],
        ],
      })
    ),
    section(
      "Tear it down",
      p(
        "Call every cleanup, detach the photo so its memory is freed, then destroy the cropper:"
      ),
      code("vanilla-js/teardown.ts"),
      p("`destroy()` also runs each plugin's `destroy`.")
    ),
  ],
  lede: "Run the same cropper in plain JavaScript or any framework, with `createCropper` and the DOM binders.",
});

export { VANILLA_JS_PAGE };
