import { code, column, defineDoc, p, section, table } from "@/lib/doc/define";

const VANILLA_JS_PAGE = defineDoc({
  blocks: [
    section(
      "install the core package",
      p(
        "add `@zriz/core` as in [exporting](exporting). it has no dependencies, not even react."
      )
    ),
    section(
      "write the markup",
      p(
        "give each element its `data-zriz-item`, so the stylesheet finds it, and give the viewport a width and a height. the binders set no role or name on the crop area, so write them in the markup:"
      ),
      code("vanilla-js/markup.html")
    ),
    section(
      "bind the parts",
      p(
        "create a cropper, bind each element, add the four corner handles, and attach the photo when the user picks a file:"
      ),
      code("vanilla-js/cropper.ts"),
      p(
        'each binder writes geometry inline and returns its cleanup. `bindHandle` also takes `"top"`, `"right"`, `"bottom"` and `"left"` for the edge bars. after you pick a file, the photo shows under a 4:3 crop. the handles have no layout until the next section places them.'
      ),
      p(
        "when a file does not open, `loadImage` rejects with a `ZrizError`, and [errors](errors) lists its codes."
      )
    ),
    section(
      "place the handles",
      p(
        "`bindHandle` wires the drag but leaves layout to you. this css centres a 44 px hit box on each corner and on the middle of each edge, and `--zriz-handle-size` on the area resizes it as on [crop area](crop-area):"
      ),
      code("vanilla-js/handles.css")
    ),
    section(
      "move the crop with keys",
      p(
        "`bindArea` moves the crop but listens to no keys. pass the area's events to `areaKeyHandlers`:"
      ),
      code("vanilla-js/keys.ts"),
      p("the keys are the ones on [crop area](crop-area).")
    ),
    section(
      "add the dial",
      p(
        "`bindDial` handles drags, keys and the slider's aria values. `bindDialTicks` fills the strip with 41 ticks and moves it:"
      ),
      code("vanilla-js/dial.ts"),
      p(
        'pass `{ dir: "rtl" }` as the third argument of `bindDial` to swap the arrows and the drag.'
      )
    ),
    section(
      "add a zoom slider",
      p(
        'zoom has no single binder. give the element `role="slider"`, `tabindex="0"`, an `aria-label`, a size, `position: relative` and `touch-action: none`, and draw the thumb yourself. the stylesheet paints nothing on zoom:'
      ),
      code("vanilla-js/zoom.html"),
      p("then hand its events to `zoomHandlers`:"),
      code("vanilla-js/zoom.ts"),
      p(
        "`zoomAria` keeps the slider's values current, and `bindZoomThumb` moves the thumb from 0% at 1× to 100% at the largest zoom."
      )
    ),
    section(
      "read the crop",
      p(
        "the `commit` event fires once per gesture with the crop value and the export plan, which is `null` until a photo loads:"
      ),
      code("vanilla-js/read.ts"),
      p(
        "to turn the crop into a file, pass the cropper to `exportCrop` as in [exporting](exporting). a photo nobody touches sends no `commit`, see [events](events)."
      )
    ),
    section(
      "connect the rest",
      table({
        columns: [column("part", "prose"), column("how to wire it", "prose")],
        rows: [
          [
            "dial value",
            "`bindDialValue(cropper, element, format)` writes the angle as text. without `format`, it writes whole degrees",
          ],
          [
            "grid",
            'no binder. `bindState` writes `data-grid` on the root as `"none"`, `"coarse"` or `"fine"`. draw the lines in css',
          ],
          [
            "buttons",
            "no binder. call `rotate90()`, `flip()`, `reset()` or `setAspect(1)` on the cropper from a click",
          ],
          [
            "your own img",
            "`bindImage(cropper, element)` sizes and moves an element of yours with the photo. you set its `src`",
          ],
          [
            "round crop",
            'pass `"circle"` as the third argument of `bindMask` and `{ shape: "circle" }` as the third argument of `bindArea`. set `aspect: 1` in `defaultValue`. the stylesheet hides the corner handles when the area has `data-shape="circle"`, which `bindArea` leaves to your markup',
          ],
          [
            "wheel and twist",
            'pass `{ wheel: "zoom", rotateGesture: false }` as the third argument of `bindViewport`. `wheel` also takes `"pan"` and `"none"`',
          ],
          [
            "motion",
            'call `viewOf(cropper).setOptions({ motion: "reduce", recentreDelay: 800 })`. `motion` also takes `"auto"` and `"always"`. each call replaces both options',
          ],
          [
            "live variables",
            "pass `{ liveVariables: true }` as the third argument of `bindArea`, see [crop area](crop-area)",
          ],
          [
            "announcements",
            'no binder. on `commit`, write your own text into an element with `role="status"`, and point the area\'s `aria-describedby` at your instructions',
          ],
        ],
      })
    ),
    section(
      "tear it down",
      p(
        "call every cleanup, detach the photo so its memory is freed, then destroy the cropper:"
      ),
      code("vanilla-js/teardown.ts"),
      p("`destroy()` also runs each plugin's `destroy`.")
    ),
  ],
  lede: "run the same cropper in plain javascript or any framework, with `createCropper` and the dom binders.",
});

export { VANILLA_JS_PAGE };
