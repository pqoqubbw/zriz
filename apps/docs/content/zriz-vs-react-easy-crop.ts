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

const ZRIZ_VS_REACT_EASY_CROP_PAGE = defineDoc({
  blocks: [
    intro(
      p(
        "We make zriz, so read this page with that in mind. It compares `react-easy-crop` 6.2.5 with `@zriz/react` 0.2.0. If something here is wrong, [open an issue](https://github.com/pqoqubbw/zriz/issues) and we will fix it."
      ),
      p(
        "To move a project over, paste this into Claude Code, Cursor or another coding agent:"
      ),
      prompt(
        "Migrate this project from react-easy-crop to zriz. Read https://zriz.dev/docs/zriz-vs-react-easy-crop.md and follow its section on migrating. Keep the crop behaviour the same where zriz can, and list for me anything zriz has no equivalent for before you remove it."
      )
    ),
    section(
      "In short",
      p(
        'react-easy-crop describes itself in its [README](https://github.com/ValentinH/react-easy-crop) as "A React component to crop images/videos with easy interactions". It is one styled component. The photo or video moves under a fixed frame, and the component reports the crop as numbers. Your app holds the state and writes the code that makes the file. Wheel and pinch zoom are built in, and a zoom slider is the app\'s to draw.'
      ),
      p(
        "Pick react-easy-crop when you crop video, when the project runs React 16.4 to 18.1 or needs a CommonJS build, or when a fixed frame with pan and zoom is all the screen needs. Setup is one component. Its basic example adds about 7 kB to the bundle, against 26 to 34 kB for zriz. It has been on npm since 2018 and has over 5 million downloads a week. It also allows a crop that shows area outside the photo, takes any angle in one `rotation` prop and shows a remote image from a server without CORS headers. zriz does none of these."
      ),
      p(
        "Pick zriz when the user resizes the crop with handles or picks a free ratio, when a tilted crop must hold no empty corner in the saved value and the file, or when you want the library to make the file, a round PNG included. Its zoom slider, straighten dial, rotate and flip buttons come as parts with roles and keys. zriz is new and little used. Its first release was in November 2026, it has one maintainer and under a thousand downloads a week."
      )
    ),
    section(
      "Numbers",
      table({
        columns: [
          column("Fact", "prose", { width: 150 }),
          column("react-easy-crop", "prose"),
          column("zriz", "prose"),
        ],
        rows: [
          ["First release", "2018", "November 2026"],
          ["npm downloads a week", "5.5M+", "Under 1,000"],
          ["GitHub stars", "2.7k+", "Under 100"],
          ["Licence", "MIT", "MIT"],
          ["Dependencies", "One, `normalize-wheel`", "None"],
          ["React", "16.4 and newer", "18.2 and 19"],
          ["Size", "About 7 kB", "26 to 34 kB"],
        ],
      }),
      p(
        "Size is minified JavaScript and CSS, compressed with Brotli, without React. For react-easy-crop it is the basic example from its docs, built with esbuild. That number includes `normalize-wheel` and the component's CSS, which ships as a string inside the JavaScript. For zriz it depends on the parts you import: about 26 kB for `Root`, `Viewport`, `Image`, `Mask` and `Area`, and about 34 kB with every part. Up to 6 kB more loads later, for export, sharpening and SVG. We measured the zriz sets with Rolldown, and esbuild makes them up to about 16% larger. [Bundle size](bundle-size) has each set. `@zriz/react` needs `@zriz/core` and React as peers."
      )
    ),
    section(
      "Features",
      compare(
        ["react-easy-crop", "zriz"],
        [
          [
            "Crop box with handles",
            ["no", "The frame is fixed"],
            ["yes", "Four corners and four edges"],
          ],
          ["Photo moves under the frame", ["yes"], ["yes"]],
          [
            "Aspect ratio",
            ["partly", "Any number, no free ratio"],
            ["yes", "Free, original or any ratio"],
          ],
          [
            "Round crop",
            ["partly", "Round mask, the output stays a rectangle"],
            ["yes", "Mask and export"],
          ],
          [
            "Zoom",
            ["yes", "Wheel, pinch and the `zoom` prop"],
            ["yes", "Pinch, Ctrl + wheel, slider part, keys"],
          ],
          [
            "Straighten (free rotation)",
            ["yes", "Any angle, the app builds the control"],
            ["partly", "45° each way plus quarter turns"],
          ],
          [
            "Crop stays inside the photo at an angle",
            ["no", "The frame can show empty area"],
            ["yes", "The crop shrinks to fit"],
          ],
          [
            "Quarter turns and flip",
            ["partly", "Turns through `rotation`, no flip in output"],
            ["yes", "Animated"],
          ],
          [
            "Touch gestures",
            ["yes", "Pan, pinch, twist with `onRotationChange`"],
            ["yes", "Pan, pinch, twist, two handles at once"],
          ],
          [
            "Keyboard",
            ["partly", "Arrow keys move the photo"],
            ["yes", "Crop area, dial, zoom and ratio group; handles no"],
          ],
          [
            "Screen reader",
            ["no", "It sets no role or ARIA attribute"],
            ["partly", "Roles and live region; you write the labels"],
          ],
          [
            "Image export",
            ["no", "Crop numbers and a docs function"],
            ["yes", "JPEG, PNG or WebP blob"],
          ],
          [
            "Saved crop",
            ["yes", "Percentages, the app stores the angle"],
            ["yes", "Fractions of the photo, restores exactly"],
          ],
          [
            "Ready-made UI",
            ["partly", "Styled frame, mask and grid, no controls"],
            ["no", "Unstyled parts and an optional stylesheet"],
          ],
        ]
      ),
      p(
        "In zriz the crop area, the dial, the zoom slider and the ratio group take keys, and the handles do not. Alt + arrows on the crop area resize it about its centre."
      ),
      p(
        "An app can give react-easy-crop a role and a label through `cropperProps` and an `alt` through `mediaProps`. It crops video too, which this table has no row for."
      )
    ),
    section(
      "What you will notice",
      p(
        "Setup is shorter in react-easy-crop. One component with `image`, `crop`, `zoom` and their change handlers fills a parent that has a size and `position: relative`. zriz takes five parts for the same screen and seven with a zoom slider. `Viewport` needs a height, `Zoom` needs a width and a height, and you write every label."
      ),
      p(
        "A tilted crop behaves differently. react-easy-crop sizes the frame from the bounding box of the rotated photo, see [helpers.ts](https://github.com/ValentinH/react-easy-crop/blob/v6.2.5/src/helpers.ts), so the frame can reach past the photo. At 15° and zoom 1 in Chromium, with a 4:3 frame on a 3:2 photo in a 480 by 480 px container, 15% of the frame showed the background, and the reported crop was 2400 by 1800 px from a 2400 by 1600 px photo. Another container shape gives other numbers. See [issue 350](https://github.com/ValentinH/react-easy-crop/issues/350). zriz shrinks the crop about its centre until all four corners sit on the photo, so no corner is empty. In the same run, zriz at 15° shrank its full-photo crop to 74% of each side and showed no empty area. That holds for the saved value and the exported file. While a finger pulls the photo past an edge, the background shows until release."
      ),
      p(
        'The wheel does different things. In react-easy-crop every wheel event with a vertical delta zooms by default, with or without Ctrl. `zoomWithScroll={false}` turns that off, and `onWheelRequest` lets the app refuse one event. In zriz a plain wheel pans the photo and Ctrl + wheel zooms. `wheel="zoom"` on `Viewport` makes a plain wheel zoom in zriz too.'
      ),
      p(
        'Keyboard and screen reader support differ. react-easy-crop has one tab stop, the crop area. Arrow keys move the photo by 1 CSS pixel by default, set with `keyboardStep`, Shift makes the step 5 times smaller, and no key zooms or rotates. The crop area has no role and no name unless the app adds them. In zriz the crop area is `role="application"` with keys for move, resize, zoom and reset, and the dial and zoom parts are sliders. zriz ships no words, so the app writes each `aria-label`. axe reported no findings on either demo in Chromium.'
      ),
      p(
        "react-easy-crop hands you two rectangles, in percent and in pixels, and its docs give a `getCroppedImg` canvas function to copy into the app. The angle and the zoom are not in that data, so the app stores `rotation` next to it. `onCropComplete` also fires after the photo loads and on each change of `zoom` or `rotation`, see [Cropper.tsx](https://github.com/ValentinH/react-easy-crop/blob/v6.2.5/src/Cropper.tsx). zriz has `exportCrop`, which returns a JPEG, PNG or WebP blob, and one value that holds position, size, angle, quarter turns and flip. The export runs in a worker by default and falls back to the main thread where workers or OffscreenCanvas are missing or blocked."
      )
    ),
    section(
      "Migrate from react-easy-crop",
      p(
        "zriz has no equivalent for the `video` prop, for a crop that shows area outside the photo, for `cropSize`, `objectFit`, `zoomSpeed`, `onCropSizeChange` or `roundCropAreaPixels`. A crop outside the photo means `restrictPosition={false}`, a `minZoom` below 1, or a tilted crop with empty corners. zriz also needs React 18.2 or 19 and ships no CommonJS build. It fetches a URL in CORS mode, so a remote image from a server without CORS headers shows in react-easy-crop and fails to load in zriz. If the project depends on one of these, stop here."
      ),
      entries([
        {
          text: "`Root` with `Viewport`, `Image`, `Mask` and `Area` inside",
          title: "`<Cropper />`",
        },
        { text: "`src` on `Root`, a URL, `File` or `Blob`", title: "`image`" },
        { text: "No equivalent", title: "`video`" },
        {
          text: "No prop. The position is `value.center`, and `panBy()` moves it",
          title: "`crop`, `onCropChange`",
        },
        {
          text: "`zoom` on `Root` with `onValueChange`, or the `Zoom` part",
          title: "`zoom`, `onZoomChange`",
        },
        {
          text: "No equivalent. Zoom starts at 1, the largest crop that fits",
          title: "`minZoom`",
        },
        {
          text: "`maxZoom` on `Root`, default 15",
          title: "`maxZoom`, default 3",
        },
        {
          text: "`value.rotation` up to 45° each way plus `value.quarterTurns`, set by `Dial` and `Rotate`",
          title: "`rotation`, `onRotationChange`",
        },
        {
          text: '`aspect` on `Root`, a number, `"free"` or `"original"`',
          title: "`aspect`",
        },
        {
          text: '`shape="circle"`, which also rounds the export',
          title: '`cropShape="round"`',
        },
        { text: "No equivalent", title: "`cropSize`, `objectFit`" },
        {
          text: "No equivalent",
          title: "`zoomSpeed`, `onCropSizeChange`, `roundCropAreaPixels`",
        },
        { text: "No equivalent", title: "`restrictPosition={false}`" },
        { text: "The `Grid` part, shown during gestures", title: "`showGrid`" },
        {
          text: '`wheel` on `Viewport`, one of `"pan"`, `"zoom"` or `"none"`',
          title: "`zoomWithScroll`",
        },
        {
          text: '`wheel` on `Viewport`. `wheel="none"` leaves a plain wheel to the page and keeps Ctrl + wheel for zoom. `details.cancel()` in `onValueChange` rejects a change and does not scroll the page',
          title: "`onWheelRequest`",
        },
        {
          text: "`details.cancel()` in `onValueChange` rejects the change. It does not hand the touch back to the page, so a finger on the cropper never scrolls it",
          title: "`onTouchRequest`",
        },
        {
          text: "`gesturestart` and `gestureend` events on the cropper, or `data-interacting` on `Root`",
          title: "`onInteractionStart`, `onInteractionEnd`",
        },
        {
          text: "`onValueCommit`, with the pixel plan in `details.pixelCrop`. It does not fire for the first photo until the user changes the crop",
          title: "`onCropComplete`",
        },
        { text: "`onValueChange`", title: "`onCropAreaChange`" },
        { text: "`onLoad`", title: "`onMediaLoaded`" },
        {
          text: "`defaultValue` or `value`, after the conversion below",
          title: "`initialCroppedAreaPercentages`, `initialCroppedAreaPixels`",
        },
        {
          text: "Not needed. A zriz value restores itself",
          title:
            "`getInitialCropFromCroppedAreaPercentages`, `getInitialCropFromCroppedAreaPixels`",
        },
        {
          text: "A `ref` on the part",
          title: "`setImageRef`, `setVideoRef`, `setCropperRef`",
        },
        {
          text: "The `Flip` part and `value.mirrored`",
          title: "`transform` used for a flip",
        },
        {
          text: "`className` and `style` on each part",
          title: "`classes`, `style`",
        },
        { text: "Props on `Image`", title: "`mediaProps`" },
        {
          text: "Props on `Area`, such as `aria-label`",
          title: "`cropperProps`",
        },
        {
          text: "Not needed. zriz injects no `style` tag, and its stylesheet is an optional import",
          title: "`disableAutomaticStylesInjection`, `nonce`",
        },
        {
          text: "No prop. Arrows move the crop by 1% of its size, 10% with Shift",
          title: "`keyboardStep`",
        },
        {
          text: "`exportCrop(cropper, options)` from `@zriz/core/dom`",
          title: "`getCroppedImg` from the docs",
        },
      ]),
      p(
        "zriz has no importer for saved react-easy-crop data, so convert it once. A saved `zoom` or `crop` does not carry over, because the scales differ. Convert the area instead. For a crop saved at 0°, 90°, 180° or 270°, take the percentages from `croppedArea`: `center.x` is `(x + width / 2) / 100`, `center.y` is `(y + height / 2) / 100`, `size.width` is `width / 100`, `size.height` is `height / 100`, `quarterTurns` is the angle divided by 90, and `rotation` is 0."
      ),
      p(
        "For another angle, use `croppedAreaPixels` and the photo's natural size. Take the bounding box of the photo rotated by the saved angle. Measure the offset of the crop's centre from the centre of that box, in pixels. Set `quarterTurns` to the angle rounded to the nearest quarter turn, wrapped to a count from 0 to 3, and `rotation` to what is left. Divide the offset and the crop's width and height by the sides of the photo after its quarter turns, and add 0.5 to each offset to get `center`. Set `mirrored` to `false`, both `perspective` fields to 0 and `aspect` to your ratio. [Value](value) lists every field."
      ),
      p(
        "We ran the pixel conversion against `@zriz/core` 0.2.0 on a 2400 by 1600 px photo with one aspect and no flip. The percentage form for quarter turns follows from it, and we did not run it on its own. For seven crops that lie inside the photo, at 0°, 90°, 180°, 270°, 30°, -12° and 100°, zriz picked a source pixel within 0.5 px of react-easy-crop's for every crop corner, and the output size matched within 1 px. A crop that reaches outside the photo does not survive. A 10° crop of 2400 by 1800 px came back as 1753 by 1314 px. A flip made with `transform` is not in the react-easy-crop data, so carry it over by hand."
      ),
      p(
        "Install `@zriz/react` and `@zriz/core`. Replace `<Cropper />` with the parts below. Drop the `crop`, `zoom` and `rotation` state unless the app reads it elsewhere, because zriz works uncontrolled. Move the save code from `onCropComplete` and `getCroppedImg` to one `exportCrop` call. Convert the stored crops. Then remove `react-easy-crop` and the copied canvas function."
      ),
      code("zriz-vs-react-easy-crop/after.tsx"),
      p(
        'This is the basic react-easy-crop screen in zriz: a 4:3 frame with no handles, a photo that pans and zooms under it, a zoom slider and a save button. `wheel="zoom"` keeps the plain wheel on zoom. `maxZoom={3}` sets the same number as the react-easy-crop default, on the zriz zoom scale. `rotateGesture={false}` turns off the two-finger twist, which the old screen had only with `onRotationChange`. `exportCrop` returns a JPEG no larger than 1600 by 1200 px.'
      ),
      p(
        "The app still writes the paint for the `Zoom` track, the thumb and the button, the layout around the cropper, and every label. Add `Dial`, `Rotate` or `Flip` if the old screen had a rotation control, and remove `rotateGesture={false}` if it passed `onRotationChange`."
      )
    ),
    section(
      "How we checked",
      p(
        "We installed the published npm package at the version above and read its source and docs. Then we ran both libraries in headless Chromium with the same photo and the same script: tab order, keys, ARIA attributes, mouse, wheel, touch and a 15° turn. The export step ran for zriz alone, because react-easy-crop has no export call."
      ),
      p(
        "react-easy-crop lives in the [GitHub repo](https://github.com/ValentinH/react-easy-crop), its [docs](https://valentinh.github.io/react-easy-crop/) and its [npm page](https://www.npmjs.com/package/react-easy-crop)."
      )
    ),
    section(
      "More comparisons",
      entries([
        {
          text: "The other model: a box with handles that the user draws over a still image",
          title: "[zriz vs react-image-crop](zriz-vs-react-image-crop)",
        },
        {
          text: "Another fixed frame with the photo moving under it, drawn on one canvas",
          title: "[zriz vs react-avatar-editor](zriz-vs-react-avatar-editor)",
        },
        {
          text: "react-easy-crop inside an Ant Design modal, wired to the antd `Upload`",
          title: "[zriz vs antd-img-crop](zriz-vs-antd-img-crop)",
        },
      ]),
      p("Every comparison is on the [comparison](comparison) page.")
    ),
  ],
  lede: "react-easy-crop is one React component that moves a photo or video under a fixed frame and reports the crop as numbers. zriz is a set of unstyled parts with a resizable crop box, a straighten dial and a file export.",
});

export { ZRIZ_VS_REACT_EASY_CROP_PAGE };
