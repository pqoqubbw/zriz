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

const ZRIZ_VS_REACT_AVATAR_EDITOR_PAGE = defineDoc({
  blocks: [
    intro(
      p(
        "We make zriz, so read this page with that in mind. It compares `react-avatar-editor` 16.0.0 with `@zriz/react` 0.2.0. If something here is wrong, [open an issue](https://github.com/pqoqubbw/zriz/issues) and we will fix it."
      ),
      p(
        "To move a project over, paste this into Claude Code, Cursor or another coding agent:"
      ),
      prompt(
        "Migrate this project from react-avatar-editor to zriz. Read https://zriz.dev/docs/zriz-vs-react-avatar-editor.md and follow its section on migrating. Keep the crop behaviour the same where zriz can, and list for me anything zriz has no equivalent for before you remove it."
      )
    ),
    section(
      "In short",
      p(
        'react-avatar-editor describes itself as an "Avatar / profile picture cropping component for React. Resize, crop and rotate your uploaded image using a simple and clean user interface." It is one component that paints the photo and a mask on a `<canvas>`. The frame has the size you pass as props, and the visitor moves the photo under it. Its docs are the [README](https://github.com/mosch/react-avatar-editor#readme).'
      ),
      p(
        "Pick react-avatar-editor when the job is a fixed-frame avatar picker and weight matters. It adds about 5 kB to the bundle, against 26 to 34 kB for zriz. It has been on npm since 2014 and has over 980,000 downloads a week. Its README names React 17, 18 and 19. It ships a CommonJS build next to ESM, and zriz is ESM only. It can zoom out below the fit and fill the rest with a colour. `rotate` takes any angle, `borderRadius` takes any radius, and `getImage()` returns a canvas synchronously. The canvas comes with a label for screen readers and paints a pulsing fill while a photo loads."
      ),
      p(
        "Pick zriz when the visitor resizes the crop or picks a ratio, when a straightened photo must fill the frame, or when the saved file must be round. zriz keeps the zoom itself, takes your labels for screen readers and returns a JPEG, PNG or WebP blob. It is new. Its first release was in November 2026, it has one maintainer and under a thousand downloads a week."
      )
    ),
    section(
      "Numbers",
      table({
        columns: [
          column("Fact", "prose", { width: 150 }),
          column("react-avatar-editor", "prose"),
          column("zriz", "prose"),
        ],
        rows: [
          ["First release", "2014", "November 2026"],
          ["npm downloads a week", "980k+", "Under 1,000"],
          ["GitHub stars", "2.5k+", "Under 100"],
          ["Licence", "MIT", "MIT"],
          [
            "Dependencies",
            "None, React and React DOM are peers",
            "None, `@zriz/core` and React are peers",
          ],
          ["React", "17, 18 and 19 per its README", "18.2 and 19"],
          ["Size", "About 5 kB", "26 to 34 kB"],
        ],
      }),
      p(
        "Size is minified JavaScript and CSS, compressed with Brotli, without React. For react-avatar-editor it is the basic example from its docs, built with esbuild. That already holds `getImage()` and `getImageScaledToCanvas()`, and with a range input, wheel zoom and a `toBlob` save it stays at about 5 kB. react-avatar-editor has no CSS. For zriz it depends on the parts you import: about 26 kB for `Root`, `Viewport`, `Image`, `Mask` and `Area`, and about 34 kB with every part. Up to 6 kB more loads later, for export, sharpening and SVG. We measured the zriz sets with Rolldown, and esbuild makes them up to about 16% larger. [Bundle size](bundle-size) has each set. `@zriz/react` needs `@zriz/core` and React as peers."
      ),
      p(
        "The peer range of react-avatar-editor also lists React 0.14 and 16. Its code imports hooks, and its README names 17, 18 and 19."
      )
    ),
    section(
      "Features",
      compare(
        ["react-avatar-editor", "zriz"],
        [
          [
            "Crop box with handles",
            ["no", "Props set the frame size"],
            ["yes", "Four corners and four edges"],
          ],
          ["Photo moves under the frame", ["yes"], ["yes"]],
          [
            "Aspect ratio",
            ["partly", "Fixed by the `width` and `height` props"],
            ["yes", "Free, original or any ratio"],
          ],
          [
            "Round crop",
            ["partly", "Round mask, rectangular export"],
            ["yes", "Mask and export"],
          ],
          [
            "Zoom",
            ["yes", "Pinch, opt-in wheel, keys; app stores `scale`"],
            ["yes", "Pinch, Ctrl + wheel, slider part, keys"],
          ],
          [
            "Straighten (free rotation)",
            ["yes", "Any angle through the `rotate` prop"],
            ["partly", "45° each way plus quarter turns"],
          ],
          [
            "Crop stays inside the photo at an angle",
            ["partly", "Pan is limited; low zoom leaves empty corners"],
            ["yes", "The crop shrinks to fit"],
          ],
          [
            "Quarter turns and flip",
            ["partly", "Turns through `rotate`, no flip"],
            ["yes", "Animated"],
          ],
          [
            "Touch gestures",
            ["partly", "Pan and pinch, no twist"],
            ["yes", "Pan, pinch, twist, two handles at once"],
          ],
          [
            "Keyboard",
            ["yes", "Arrows pan, plus and minus ask for zoom"],
            ["yes", "Crop area, dial, zoom and ratio group; handles no"],
          ],
          [
            "Screen reader",
            ["partly", "Role and fixed English label, no live region"],
            ["partly", "Roles and live region; you write the labels"],
          ],
          [
            "Image export",
            ["partly", "Returns a canvas, the app encodes it"],
            ["yes", "JPEG, PNG or WebP blob"],
          ],
          [
            "Saved crop",
            ["partly", "The app stores `position`, `scale` and `rotate`"],
            ["yes", "Fractions of the photo, restores exactly"],
          ],
          [
            "Ready-made UI",
            ["partly", "Canvas with mask and grid, no controls"],
            ["no", "Unstyled parts and an optional stylesheet"],
          ],
        ]
      ),
      p(
        "We also ran the rows on touch, keyboard, zoom and export in Chromium. A two-finger twist changed the `scale` request there and left `rotate` at 0."
      ),
      p(
        "The flip row rests on a search of the 16.0.0 source for `flip`, `mirror`, `scaleX` and `scale(-1`, which found nothing."
      )
    ),
    section(
      "What you will notice",
      p(
        "react-avatar-editor is smaller and has less to wire for a plain avatar picker. One component, no stylesheet, and `getImage()` returns a canvas at source resolution synchronously. zriz needs five parts for the same picker, and `exportCrop` is async."
      ),
      p(
        "Zoom is a request in react-avatar-editor. A pinch, the `+` and `-` keys and, with `enableWheelZoom`, the wheel call `onRequestScaleChange` with a number, and nothing moves until the app stores it and passes it back as `scale`. The library floors a request at 0.1 and sets no upper limit, so the app writes that too. See [the handlers at 16.0.0](https://github.com/mosch/react-avatar-editor/blob/v16.0.0/packages/lib/src/index.ts). zriz holds the zoom itself and stops at `maxZoom`, 15 by default."
      ),
      p(
        "`rotate` takes any number of degrees, which zriz cannot do with one value. The library does not change the zoom at an angle. Since 16.0.0 it limits the pan and centres the photo when the turned crop does not fit, as its [changelog](https://github.com/mosch/react-avatar-editor/blob/v16.0.0/CHANGELOG.md) says. In Chromium, at `rotate` 15 and `scale` 1 on a 3:2 photo, the canvas from `getImage()` had two transparent corners. In the zriz full editor, with the crop on the whole of the same photo, a 15° turn shrank the crop to 74% of each side and the file had no empty corner. That run used a 3:2 crop and not a square one."
      ),
      p(
        '`borderRadius` rounds the hole in the mask. `getImage()` and `getImageScaledToCanvas()` return a rectangle and do not read it, see [the core at 16.0.0](https://github.com/mosch/react-avatar-editor/blob/v16.0.0/packages/core/src/AvatarEditor.ts). The app rounds the result with CSS or on its own canvas. In zriz `shape="circle"` rounds the mask and the exported PNG. A rounded rectangle with a radius between the two is something react-avatar-editor draws and zriz does not.'
      ),
      p(
        "The canvas comes with a label, `Image editor. Use arrow keys to reposition the image.`, so a screen reader has a name for it with no work from you. The text is fixed English, and the component drops unknown props, so an app cannot pass its own `aria-label`. zriz ships no words: you write each label, in your language. The arrow keys also run the other way. ArrowLeft moves the photo left in react-avatar-editor, and moves the crop left in zriz."
      )
    ),
    section(
      "Migrate from react-avatar-editor",
      p(
        "zriz has no equivalent for these: a `scale` below 1 with the whole photo inside the frame on a `backgroundColor`, `disableBoundaryChecks`, a single angle past 45°, a crop with empty corners, a `borderRadius` between square and circle, a synchronous canvas result, a CommonJS build, and React 17. If the project needs one of them, stay."
      ),
      entries([
        {
          text: "`Root` with `Viewport`, `Image`, `Mask` and `Area` inside",
          title: "`<AvatarEditor>`",
        },
        { text: "`src` on `Root`, a string or a `Blob`", title: "`image`" },
        {
          text: "`aspect` on `Root` and a CSS size on `Viewport`",
          title: "`width`, `height`",
        },
        { text: "CSS `padding` on `Viewport`", title: "`border`" },
        {
          text: '`shape="circle"` on `Root`',
          title: "`borderRadius` at half the width",
        },
        { text: "`--zriz-scrim`", title: "`color`" },
        { text: "`--zriz-frame`", title: "`borderColor`" },
        {
          text: "The `Grid` part and `--zriz-grid`. It shows during a gesture",
          title: "`showGrid`, `gridColor`",
        },
        {
          text: "Nothing to wire. `Zoom` for a slider, `maxZoom` for the limit, `zoom` to control it",
          title: "`scale`, `onRequestScaleChange`",
        },
        { text: '`wheel="zoom"` on `Viewport`', title: "`enableWheelZoom`" },
        {
          text: "`quarterTurns` and `rotation` in the value. `Rotate` and `Dial` as controls",
          title: "`rotate`",
        },
        {
          text: "`center` in the value, with `defaultValue` or `value` and `onValueChange`",
          title: "`position`, `onPositionChange`",
        },
        { text: "`crossOrigin` on `Root`", title: "`crossOrigin`" },
        { text: "`style` and `className` on every part", title: "`style`" },
        { text: "`onLoad`", title: "`onLoadSuccess`, `onImageReady`" },
        { text: "`onError`, with a typed error", title: "`onLoadFailure`" },
        { text: "`onValueChange`", title: "`onImageChange`, `onMouseMove`" },
        { text: "`onValueCommit`", title: "`onMouseUp`" },
        {
          text: "`actionsRef`, `useCropper()`",
          title: "`ref`, `useAvatarEditor()`",
        },
        {
          text: "`getValue()` for fractions, `getPixelCrop().pixelRect` for pixels, `null` at an angle",
          title: "`getCroppingRect()`",
        },
        { text: "`exportCrop(cropper)`, a blob", title: "`getImage()`" },
        {
          text: "`exportCrop(cropper, { maxSize })`. It never scales up",
          title: "`getImageScaledToCanvas()`",
        },
        {
          text: "No prop. Arrows move 1% of the crop, 10% with Shift",
          title: "`keyboardStep`",
        },
        { text: "No equivalent", title: "`onLoadStart`" },
        {
          text: "No prop. `previewEdge` on `Root` caps the preview size",
          title: "`disableHiDPIScaling`",
        },
        {
          text: "No prop. A quarter turn turns a numeric aspect with it",
          title: "`disableCanvasRotation`",
        },
        {
          text: "No equivalent",
          title: "`backgroundColor`, `disableBoundaryChecks`",
        },
      ]),
      p(
        "Saved crops: an app keeps either the three props or the result of `getCroppingRect()`. `position` is the centre of the crop as fractions of the photo, `scale` is 1 at the fit, and `rotate` is degrees clockwise. The rectangle is `{ x, y, width, height }` as fractions of the unturned photo, with the top-left corner as `x` and `y`, and it does not hold the angle. zriz has no importer for either, and we did not check a conversion by running both libraries, so we give none here. The [value](value) page defines every field of a zriz `CropValue` if you write one. Test it on crops with a `rotate` other than 0, and expect zriz to shrink or move any crop that had an empty corner."
      ),
      p(
        "Steps: install `@zriz/react` and `@zriz/core`. Replace `<AvatarEditor>` with the parts below and move `width / height` to `aspect`. Delete the `scale` state and the `onRequestScaleChange` handler. Replace the slider that set `scale` with `Zoom`. Replace `getImage().toBlob(...)` with `exportCrop`. Move the mask colours from props to CSS variables. Write an `aria-label` for `Area` and `Zoom`. Then remove `react-avatar-editor`."
      ),
      code("zriz-vs-react-avatar-editor/after.tsx"),
      p(
        'This is a 250 px square frame with a 50 px border, a zoom slider that ends at 5× and a save button. `Area` has no handles, so the visitor moves and zooms the photo. Alt with an arrow key still resizes the crop. On a touch screen a two-finger twist also straightens the photo, and `rotateGesture={false}` on `Viewport` turns that off. `exportCrop` returns a JPEG at most 500 px wide. For a round avatar set `shape="circle"` on `Root`, and the file becomes a round PNG. Still yours to write: the layout, the look of the button, the file input, the wording of each label and a loading state. react-avatar-editor paints a pulsing fill while a photo loads, and zriz paints nothing for that. The slider styles here are the ones from the zriz docs.'
      )
    ),
    section(
      "How we checked",
      p(
        "We installed the published npm package at the version above and read its source and docs. Then we ran both libraries in headless Chromium with the same photo and the same script: tab order, keys, ARIA attributes, mouse, wheel, touch and a 15° turn. The script could not measure the empty share of the frame on its canvas, so the 15° result comes from the corners of the exported file."
      ),
      p(
        "Sources: the [repository](https://github.com/mosch/react-avatar-editor), the [README](https://github.com/mosch/react-avatar-editor#readme), the [changelog](https://github.com/mosch/react-avatar-editor/blob/v16.0.0/CHANGELOG.md) and the [npm page](https://www.npmjs.com/package/react-avatar-editor)."
      )
    ),
    section(
      "More comparisons",
      entries([
        {
          text: "Also moves the photo under a fixed frame, with `zoom` and `rotation` as props",
          title: "[zriz vs react-easy-crop](zriz-vs-react-easy-crop)",
        },
        {
          text: "A fixed viewport with a built-in zoom slider, without React",
          title: "[zriz vs Croppie](zriz-vs-croppie)",
        },
        {
          text: "A ready crop modal for the Ant Design upload",
          title: "[zriz vs antd-img-crop](zriz-vs-antd-img-crop)",
        },
      ]),
      p("Every comparison is on the [comparison](comparison) page.")
    ),
  ],
  lede: "react-avatar-editor is one React component that draws a fixed crop frame on a canvas and moves the photo under it. zriz is a set of unstyled parts with a resizable crop, a straighten dial and a file export.",
});

export { ZRIZ_VS_REACT_AVATAR_EDITOR_PAGE };
