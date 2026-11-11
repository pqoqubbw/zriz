import {
  code,
  column,
  compare,
  defineDoc,
  entries,
  intro,
  p,
  prompt,
  section,
  table,
} from "@/lib/doc/define";

const ZRIZ_VS_CROPPERJS_PAGE = defineDoc({
  blocks: [
    intro(
      p(
        "We make zriz, so read this page with that in mind. It compares `cropperjs` 2.3.1 with `@zriz/react` 0.2.1. If something here is wrong, [open an issue](https://github.com/pqoqubbw/zriz/issues) and we will fix it."
      ),
      p(
        "To move a project over, paste this into Claude Code, Cursor or another coding agent:"
      ),
      prompt(
        "Migrate this project from cropperjs to zriz. Read https://zriz.dev/docs/zriz-vs-cropperjs.md and follow its section on migrating. Keep the crop behaviour the same where zriz can, and list for me anything zriz has no equivalent for before you remove it."
      )
    ),
    section(
      "In short",
      p(
        '[Cropper.js](https://fengyuanchen.github.io/cropperjs/) calls itself a "JavaScript image cropper", and its guide says "Cropper.js 2.0 is a series of web components for image cropping". The npm name `cropperjs` holds two products. Version 2 is the set of custom elements this page covers. Version 1 is an imperative class, and npm\'s per-version counts put over 80% of the weekly downloads on it. The [react-cropper](zriz-vs-react-cropper) page covers version 1.'
      ),
      p(
        "Pick Cropper.js when the page has no React or the cropper has to load from one script tag. It has been on npm since 2015 and has over 2 million downloads a week. Its basic example is about 13 kB, against 22 to 30 kB for zriz. It paints its own crop box and turns the photo to any angle. It keeps several selections on one photo, lets the user draw a box with a drag and rounds the output to any radius."
      ),
      p(
        'Pick zriz when the app is React with server rendering and a drag should move the photo under the crop by default. In Cropper.js the photo moves under a fixed box once the canvas handle has `action="move"` and the selection drops `movable`. The saved crop stays on the photo at every angle zriz allows. The crop area, dial and zoom slider take focus and keys, and the export is a JPEG, PNG or WebP blob. zriz is new. Its first release was in November 2026, it has one maintainer and under a thousand downloads a week.'
      )
    ),
    section(
      "Numbers",
      table({
        columns: [
          column("Fact", "prose", { width: 150 }),
          column("Cropper.js", "prose"),
          column("zriz", "prose"),
        ],
        rows: [
          ["First release", "2015", "November 2026"],
          ["npm downloads a week", "2.5M+", "Under 1,000"],
          ["GitHub stars", "13k+", "Under 100"],
          ["Licence", "MIT", "MIT"],
          [
            "Dependencies",
            "`@cropper/elements` and `@cropper/utils`, same author",
            "None, `@zriz/core` and React are peers",
          ],
          ["React", "Not needed, no React code", "18.2 and 19"],
          ["Size", "About 13 kB", "22 to 30 kB"],
        ],
      }),
      p(
        'Size is minified JavaScript and CSS, compressed with Brotli, without React. For Cropper.js it is the basic example from its docs, built with esbuild. That example is `new Cropper("#image")` with the built-in template and has no CSS file. For zriz it depends on the parts you import: about 22 kB for `Root`, `Viewport`, `Image`, `Mask` and `Area`, and about 29 kB with every part. Up to 11 kB more loads later, for reading the file, export, sharpening and SVG. We measured the zriz sets with Rolldown. Built with esbuild as one file, the way the other example was, zriz comes to about 33 kB for those five parts and about 41 kB with every part, because the code that loads later is then in that file. [Bundle size](bundle-size) has each set. `@zriz/react` needs `@zriz/core` and React as peers.'
      ),
      p(
        "The first stable 2.0.0 came out in March 2025. The download count covers both versions of Cropper.js."
      )
    ),
    section(
      "Features",
      compare(
        ["Cropper.js", "zriz"],
        [
          [
            "Crop box with handles",
            ["yes", "Eight handles in the default template"],
            ["yes", "Four corners and four edges"],
          ],
          [
            "Photo moves under the frame",
            ["yes", 'With `action="move"` on the canvas handle'],
            ["yes"],
          ],
          [
            "Aspect ratio",
            ["yes", "Free or any ratio"],
            ["yes", "Free, original or any ratio"],
          ],
          [
            "Round crop",
            ["yes", "Mask and export, any border radius"],
            ["yes", "Mask and export"],
          ],
          [
            "Zoom",
            ["yes", "Wheel, pinch and the `$zoom()` method"],
            ["yes", "Pinch, Ctrl + wheel, slider part, keys"],
          ],
          [
            "Straighten (free rotation)",
            ["yes", "Any angle by method or two fingers"],
            ["partly", "45° each way plus quarter turns"],
          ],
          [
            "Crop stays inside the photo at an angle",
            [
              "no",
              "Insets test boxes against the canvas, not the turned photo's edges",
            ],
            ["yes", "The crop shrinks to fit"],
          ],
          [
            "Quarter turns and flip",
            ["yes", "By method, without animation"],
            ["yes", "Animated"],
          ],
          [
            "Touch gestures",
            ["yes", "Pinch, twist and handles"],
            ["yes", "Pan, pinch, twist, two handles at once"],
          ],
          [
            "Keyboard",
            ["partly", "Opt-in arrows, `+`, `-` and Delete"],
            ["yes", "Crop area, dial, zoom and ratio group; handles no"],
          ],
          [
            "Screen reader",
            ["partly", "Photo alt text; the box has no role"],
            ["partly", "Roles and live region; you write the labels"],
          ],
          [
            "Image export",
            ["partly", "A canvas; the app makes the file"],
            ["yes", "JPEG, PNG or WebP blob"],
          ],
          [
            "Saved crop",
            ["yes", "Canvas CSS px plus a matrix"],
            ["yes", "Fractions of the photo, restores exactly"],
          ],
          [
            "Ready-made UI",
            ["partly", "Painted crop box and grid; no controls"],
            ["no", "Unstyled parts and an optional stylesheet"],
          ],
        ]
      ),
      p(
        "`$toCanvas()` returns a canvas at the size of the box on screen unless the app passes `width` or `height`. In Chromium a 240 by 160 px box that covered 1200 by 800 px of a 2400 by 1600 px photo exported a 240 by 160 px canvas. By the source, `{ width: 1200 }` on the same call gives 1200 by 800 px. We did not run that case in Chromium. zriz cuts from the source pixels by default. Its crop of 0.738 of each side at 15° exported 1772 by 1181 px."
      ),
      p(
        "The Cropper.js box sits in canvas space, so it can cover the area beside a turned photo, and the export leaves that area transparent. At 15° with the default box, which is half the photo's width and height, the Chromium run found no empty area on screen or in the file."
      )
    ),
    section(
      "What you will notice",
      p(
        "Cropper.js needs less code to show a cropper. `new Cropper(image)` writes the canvas, grid, crosshair, eight handles and a hidden shade into the page and paints them from each element's shadow root. Its basic example is also smaller than zriz, see the numbers above. With zriz the app writes each part as JSX and gives `Viewport` a height. The optional stylesheet paints the mask, frame, handles, grid and dial, and nothing else."
      ),
      p(
        "Importing `cropperjs` on a server throws `ReferenceError: HTMLElement is not defined` in Node 24, because the [base class extends `HTMLElement`](https://github.com/fengyuanchen/cropperjs/blob/v2.3.1/packages/element/src/index.ts) when the module loads. A server-rendered app has to load it in the browser, as the Cropper.js docs site does with `ClientOnly`. The package has no JSX types, so `<cropper-canvas>` in TSX fails with TS2339 until the app declares the elements. zriz parts render to HTML on the server and are client components."
      ),
      p(
        'Cropper.js [cancels every wheel event over the canvas](https://github.com/fengyuanchen/cropperjs/blob/v2.3.1/packages/element-canvas/src/index.ts) and zooms by one `scale-step`, 0.1 by default. So the page does not scroll while the pointer is over the cropper, and `disabled` on the canvas is the one switch for it. That comes from the source. We did not measure page scroll in the Chromium run. In zriz a plain wheel pans the photo and Ctrl + wheel zooms. A wheel that starts with the photo already at its edge scrolls the page. `wheel="zoom"` on `Viewport` makes a plain wheel zoom, as in Cropper.js.'
      ),
      p(
        "Rotation works differently. In Cropper.js `$rotate()` takes any angle, two fingers turn the photo, and the box does not change. In zriz the dial stops at 45° each way and quarter turns cover the rest, so 60° is one quarter turn and -30°. At an angle zriz shrinks the crop until its four corners are on the photo. At 15° a full-photo crop of the 2400 by 1600 px test photo became 0.738 of each side. That holds for the saved value and the exported file. While a finger pulls the photo past an edge, the background shows until release."
      ),
      p(
        'In Chromium the Cropper.js demo had no tab stop inside the cropper. Its `keyboard` attribute is off by default and [listens on `document`](https://github.com/fengyuanchen/cropperjs/blob/v2.3.1/packages/element-selection/src/index.ts). Arrows move the box 1 px wherever focus is, unless focus is in an input, a textarea or editable text. `+` grows it by 10% and `-` undoes one such step when the selection has `zoomable`, and Delete clears it. The listener stays until `keyboard` is set to false. The zriz demo was the full editor from its docs and had six tab stops: the crop area, the dial, the zoom slider, two buttons and the ratio group. The component below has one inside the cropper, the crop area. The crop area is a focusable `role="application"`, the dial and zoom are sliders, and the handles take no keys. zriz ships no words, so the app writes each label.'
      )
    ),
    section(
      "Migrate from Cropper.js",
      p(
        "zriz has no equivalent for several selections on one photo, a box the user draws with a drag, a box that moves over a still photo, or a state with no box. It has no crop that reaches outside the photo, no single angle past 45°, no non-uniform scale and no skew. It has no `beforeDraw` canvas hook, no canvas result and no rounded-rectangle output, and `Root` cuts a circle, not an ellipse. It has no script-tag build and no web components, though a plain TypeScript core with DOM binders exists, see [vanilla JS](vanilla-js). If the project needs one of these, stay on Cropper.js."
      ),
      entries([
        {
          text: "`Root` with `src`, then `Viewport`, `Image`, `Mask`, `Area`",
          title: "`new Cropper(image, { container })`",
        },
        {
          text: "`Handle` with `position`",
          title: "`cropper-handle` with a `*-resize` action",
        },
        { text: "`Grid`", title: "`cropper-grid`" },
        { text: "`Mask`", title: "`cropper-shade`" },
        {
          text: "`aspect` on `Root`, `setAspect()`, `AspectGroup`",
          title: "`aspect-ratio` on the selection",
        },
        {
          text: "`defaultValue`",
          title: "`initial-coverage`, `x`, `y`, `width`, `height`",
        },
        {
          text: '`shape="circle"`, a circle and no other radius',
          title: "`border-radius`",
        },
        {
          text: "No setting. zriz keeps the saved crop on the photo, not inside the canvas",
          title: "`min-inset`, `max-inset`",
        },
        {
          text: '`wheel="zoom"` on `Viewport`',
          title: "Wheel zoom with `scale-step`",
        },
        {
          text: "`setZoom()`, `Zoom`, `maxZoom`. 1 is the largest crop that fits",
          title: "`$zoom()`, `$scale()`",
        },
        {
          text: "`setRotation()` up to 45° each way, `rotate90()`, `Dial`, `Rotate`",
          title: "`$rotate()`",
        },
        {
          text: '`flip()`, `flip("y")`, `Flip`',
          title: "`$scale(-1, 1)`, `$scale(1, -1)`",
        },
        {
          text: "`panBy()`, in fractions of the photo",
          title: "`$move()`, `$moveTo()`",
        },
        { text: "`onValueChange`", title: "`change` on the selection" },
        { text: "`onValueCommit`", title: "`actionend` on the canvas" },
        {
          text: "`details.cancel()` in `onValueChange`",
          title: "`transform` event with `preventDefault()`",
        },
        {
          text: "`getValue()`, or the value in `onValueCommit`",
          title: "Selection `x`, `y`, `width`, `height` and `$getTransform()`",
        },
        {
          text: "`exportCrop()`, which resolves to an object with a `blob`",
          title: "`$toCanvas()`",
        },
        {
          text: "`useCropperFrame`, or `exportCrop` with a small `maxSize`",
          title: "`cropper-viewer`",
        },
        { text: "Keys on `Area` while it has focus", title: "`keyboard`" },
        { text: "`disabled` on `Root`", title: "`disabled` on the canvas" },
        {
          text: "`reset()`, `Reset`",
          title: "`$resetTransform()`, `$reset()`",
        },
        { text: "Unmount `Root`", title: "`destroy()`" },
      ]),
      p(
        "A saved Cropper.js crop is the selection's `x`, `y`, `width` and `height` in CSS px of the canvas, plus the matrix `[a, b, c, d, e, f]` from `$getTransform()`. zriz has no importer, so convert each one. The conversion below holds for a uniform scale, no skew and a crop that lies inside the photo, where `W` and `H` are the photo's natural size."
      ),
      p(
        "Take `s = Math.hypot(a, b)` and `mirrored = a * d - b * c < 0`. The total angle is `Math.atan2(-b, -a)` when mirrored and `Math.atan2(b, a)` when not, turned from radians into degrees. With `q = Math.round(total / 90)`, `rotation = total - 90 * q` and `quarterTurns` is `q` modulo 4. `tw` and `th` are `W` and `H` for an even `quarterTurns`, and `H` and `W` for an odd one. Then `center.x = (x + width / 2 - W / 2 - e) / s / tw + 0.5`, `center.y = (y + height / 2 - H / 2 - f) / s / th + 0.5`, `size.width = width / s / tw` and `size.height = height / s / th`."
      ),
      p(
        "We checked this conversion in Node against zriz 0.2.0 for six crops. The check used a rewrite of the Cropper.js drawing maths, not Cropper.js in a browser, so test it on a few of your own crops first. A crop that reaches outside the photo does not convert exactly, because zriz moves it back onto the photo."
      ),
      p(
        "The steps: install `@zriz/react` and `@zriz/core`, and remove `cropperjs` with its client-only import and any element type declarations. Replace the template with zriz parts. Move each method call and event to its row in the table. Replace `$toCanvas()` and `toBlob()` with `exportCrop()`. Convert saved crops with the maths above and pass them as `value` or `defaultValue`. Delete the `keyboard = false` cleanup if the project has one."
      ),
      code("zriz-vs-cropperjs/after.tsx"),
      p(
        "This component is the nearest zriz match for `new Cropper(image)` with the default template: a crop box with eight handles and a grid, a wheel that zooms, and a start crop of half the photo on each side. A drag pans the photo under the box. It does not draw a new box or move the box over a still photo. `save` exports a JPEG of at most 2048 by 2048 px and hands it to `onSave`. The app still writes the layout, the button styles and the words. A zoom slider, rotate and flip buttons and an aspect picker are parts the app adds and paints, see [full editor](full-editor). Blocks for shadcn/ui are on the [shadcn](shadcn) page."
      )
    ),
    section(
      "How we checked",
      p(
        "We installed the published npm package at the version above and read its source and docs. Then we ran both libraries in headless Chromium with the same photo and the same script: tab order, keys, ARIA attributes, mouse, wheel, touch and a 15° turn. Cropper.js ran as its default template with `keyboard` added, and zriz ran as the full editor from its docs. The script presses keys on each tab stop. Cropper.js had none, so its key behaviour comes from the source, and we pressed no keys on it."
      ),
      p(
        "Cropper.js: [repository](https://github.com/fengyuanchen/cropperjs), [docs](https://fengyuanchen.github.io/cropperjs/), [npm](https://www.npmjs.com/package/cropperjs). Its [migration guide](https://fengyuanchen.github.io/cropperjs/migration.html) maps version 1 options to version 2."
      )
    ),
    section(
      "More comparisons",
      entries([
        {
          text: "The React wrapper around Cropper.js version 1",
          title: "[zriz vs react-cropper](zriz-vs-react-cropper)",
        },
        {
          text: "Cropper.js version 1 inside an upload dashboard with buttons",
          title: "[zriz vs Uppy image editor](zriz-vs-uppy-image-editor)",
        },
        {
          text: "A React cropper with a box, handles and any rotation angle",
          title:
            "[zriz vs react-advanced-cropper](zriz-vs-react-advanced-cropper)",
        },
      ]),
      p("Every comparison is on the [comparison](comparison) page.")
    ),
  ],
  lede: "Cropper.js is a JavaScript image cropper made of web components that runs without a framework. zriz is a set of React parts where a drag moves the photo under the crop by default and the saved crop stays on the photo.",
});

export { ZRIZ_VS_CROPPERJS_PAGE };
