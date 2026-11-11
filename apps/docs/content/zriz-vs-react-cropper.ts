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

const ZRIZ_VS_REACT_CROPPER_PAGE = defineDoc({
  blocks: [
    intro(
      p(
        "We make zriz, so read this page with that in mind. It compares `react-cropper` 2.3.3 on Cropper.js 1.7.0 with `@zriz/react` 0.2.0. If something here is wrong, [open an issue](https://github.com/pqoqubbw/zriz/issues) and we will fix it."
      ),
      p(
        "To move a project over, paste this into Claude Code, Cursor or another coding agent:"
      ),
      prompt(
        "Migrate this project from react-cropper to zriz. Read https://zriz.dev/docs/zriz-vs-react-cropper.md and follow its section on migrating. Keep the crop behaviour the same where zriz can, and list for me anything zriz has no equivalent for before you remove it."
      )
    ),
    section(
      "In short",
      p(
        'react-cropper describes itself as "Cropperjs as React component". It renders an `<img>`, starts Cropper.js 1.x on it and passes your props on as Cropper.js options. Its [README](https://github.com/react-cropper/react-cropper#readme) covers the React side, and the options and methods are in the [Cropper.js v1 docs](https://github.com/fengyuanchen/cropperjs/blob/v1/README.md). Its last release, 2.3.3, came out in April 2023, and the Cropper.js 1.x line it runs on released 1.7.0 in October 2026.'
      ),
      p(
        "Pick react-cropper when you want one component and one stylesheet that draw a working crop box, a bundle of about 15 kB against 26 to 34 kB for zriz, or a peer range that allows React 17. It has been on npm since 2015 and has over 640,000 downloads a week. Cropper.js also does things zriz does not: a crop that runs past the photo with a fill colour, a photo turned to any angle with one value and kept whole with empty corners, a new box drawn by a drag, a live preview in any element and a canvas returned in the same tick. It ships a CommonJS build."
      ),
      p(
        "Pick zriz when people must be able to crop with keys, when you want a straighten dial that shrinks the crop so the saved value and the file have no empty corner, or when the crop should be a React value in fractions of the photo. It has roles and a live region for screen readers. It takes a `File` as the source and exports a JPEG, PNG or WebP blob. Weigh that against its age: zriz had its first release in November 2026, has one maintainer and under a thousand downloads a week, and you write the layout and every label."
      )
    ),
    section(
      "Numbers",
      table({
        columns: [
          column("Fact", "prose", { width: 150 }),
          column("react-cropper", "prose"),
          column("zriz", "prose"),
        ],
        rows: [
          ["First release", "2015", "November 2026"],
          ["npm downloads a week", "640k+", "Under 1,000"],
          ["GitHub stars", "2k+", "Under 100"],
          ["Licence", "MIT", "MIT"],
          [
            "Dependencies",
            "One, `cropperjs` 1.x",
            "None; `@zriz/core` is a required peer",
          ],
          ["React, by peer range", "17.0.2 and newer", "18.2 and 19"],
          ["Size", "About 15 kB", "26 to 34 kB"],
        ],
      }),
      p(
        "Size is minified JavaScript and CSS, compressed with Brotli, without React. For react-cropper it is the basic example from its docs, built with esbuild. It holds all of Cropper.js, with its zoom, rotate and flip methods. For zriz it depends on the parts you import: about 26 kB for `Root`, `Viewport`, `Image`, `Mask` and `Area`, and about 34 kB with every part. Up to 6 kB more loads later, for export, sharpening and SVG. We measured the zriz sets with Rolldown, and esbuild makes them up to about 16% larger. [Bundle size](bundle-size) has each set. `@zriz/react` needs `@zriz/core` and React as peers."
      )
    ),
    section(
      "Features",
      compare(
        ["react-cropper", "zriz"],
        [
          [
            "Crop box with handles",
            ["yes", "Eight handles and four edges"],
            ["yes", "Four corners and four edges"],
          ],
          [
            "Photo moves under the frame",
            ["yes", "In move mode or after a double click"],
            ["yes"],
          ],
          [
            "Aspect ratio",
            ["yes", "Fixed or free; the prop is read once"],
            ["yes", "Free, original or any ratio"],
          ],
          [
            "Round crop",
            ["yes", "`borderRadius` on Cropper.js 1.7.0"],
            ["yes", "Mask and export"],
          ],
          [
            "Zoom",
            ["yes", "Wheel, pinch, methods and a `zoomTo` prop"],
            ["yes", "Pinch, Ctrl + wheel, slider part, keys"],
          ],
          [
            "Straighten (free rotation)",
            ["yes", "Any angle by method call"],
            ["partly", "45° each way plus quarter turns"],
          ],
          [
            "Crop stays inside the photo at an angle",
            ["no", "The box can include empty area"],
            ["yes", "The crop shrinks to fit"],
          ],
          [
            "Quarter turns and flip",
            ["yes", "By method call, with no animation"],
            ["yes", "Animated"],
          ],
          [
            "Touch gestures",
            ["partly", "Pan, pinch and handles; no twist"],
            ["yes", "Pan, pinch, twist, two handles at once"],
          ],
          [
            "Keyboard",
            ["no"],
            ["yes", "Crop area, dial, zoom and ratio group; handles no"],
          ],
          [
            "Screen reader",
            ["no", "Alt text on the image"],
            ["partly", "Roles and live region; you write the labels"],
          ],
          [
            "Image export",
            ["yes", "A canvas that the app encodes"],
            ["yes", "JPEG, PNG or WebP blob"],
          ],
          [
            "Saved crop",
            ["yes", "Source pixels, `getData()` and `setData()`"],
            ["yes", "Fractions of the photo, restores exactly"],
          ],
          [
            "Ready-made UI",
            ["partly", "A styled crop box; no controls"],
            ["no", "Unstyled parts and an optional stylesheet"],
          ],
        ]
      ),
      p(
        "The round crop needs Cropper.js 1.7.0, which a fresh install resolves to. react-cropper 2.3.3 does not know the `borderRadius` option, so it also puts it on the `<img>` and React logs an unknown prop warning in development. A lockfile that holds an older Cropper.js has no round crop."
      ),
      p(
        "In Chromium, at 15° with the default crop box, the exported file had photo pixels in all four corners for both libraries. Cropper.js does not shrink the box when the photo turns, so a larger box or a larger angle can take in area outside the photo. That area exports in `fillColor`, which is transparent by default."
      )
    ),
    section(
      "What you will notice",
      p(
        'The wheel does different things. With `zoomOnWheel` on, which is the default, Cropper.js cancels every wheel event while it is enabled and zooms by 10% at most once every 50 ms, so the page does not scroll while the pointer is over the cropper. It has no separate branch for Ctrl + wheel, see [handlers.js](https://github.com/fengyuanchen/cropperjs/blob/v1.7.0/src/js/handlers.js). In zriz a plain wheel pans the photo and Ctrl + wheel or a trackpad pinch zooms. `wheel="zoom"` on `Viewport` makes the plain wheel zoom.'
      ),
      p(
        "A drag does different things too. With the default `dragMode`, a drag on the photo outside the crop box draws a new box, a drag inside it moves the box, and a double click switches to moving the photo. zriz has one mode. A drag on the photo moves the photo and a drag on a handle resizes the crop. zriz has no way to draw a box or to start without one."
      ),
      p(
        "Rotation has a wider range in Cropper.js. `rotateTo()` takes any angle and keeps the whole photo, with empty corners around it that the crop box may cover. There is no rotate control or gesture, so the app adds one. In Chromium a two-finger twist zoomed and the angle stayed at 0. zriz has a dial part and a twist gesture, stops at 45° each way and shrinks the crop so the saved value and the file hold no empty corner. Angles past 45° need a quarter turn plus a straighten."
      ),
      p(
        "react-cropper has no keyboard or ARIA code. In Chromium the Tab key found no stop inside it, so there was nothing focused to send keys to. The search of both packages found no key listener, no `tabindex`, no role and no `aria-` attribute. Under the same script the zriz full editor demo had six tab stops: the crop area, the dial, the zoom slider, two buttons and the ratio group. We did not run the component below under the script. By its source it has two, the crop area and the save button. The handles take no keys, and the app writes every label."
      ),
      p(
        "react-cropper reads most props once, when it creates the Cropper.js instance, see [react-cropper.tsx](https://github.com/react-cropper/react-cropper/blob/v2.3.3/src/react-cropper.tsx). A new `src` and a new `zoomTo` apply after mount. A new `aspectRatio` does not, so the app calls `cropper.setAspectRatio()` on the instance. zriz takes `value`, `aspect`, `rotation` and `zoom` as controlled props. An open issue reports a crash under [StrictMode](https://github.com/react-cropper/react-cropper/issues/1149). We did not test that for this page."
      )
    ),
    section(
      "Migrate from react-cropper",
      p(
        "zriz has no equivalent for a crop that runs past the photo, which is `viewMode: 0`, the Cropper.js default, with `fillColor`, or for a rotated photo exported whole with empty corners. It has no scale other than a mirror, no box drawn by a drag, no `autoCrop: false` or `clear()`, no corner radius other than a circle, and no live `preview` element. `getCroppedCanvas()` and `beforeDraw` have no equivalent, because `exportCrop` is async and resolves to an object that holds a blob. zriz needs React 18.2 or newer and has no CommonJS build. If the project depends on one of these, stay on react-cropper."
      ),
      entries([
        {
          text: "`src` on `Root`, which also takes a `File` or a `Blob`",
          title: "`src` as a URL string",
        },
        {
          text: "A height on `Viewport`",
          title: "`style` or `className` that sizes the wrapper",
        },
        {
          text: '`import "@zriz/react/styles.css"`, optional',
          title: '`import "cropperjs/dist/cropper.css"`',
        },
        {
          text: "`actionsRef` on `Root`, or `useCropper()`",
          title: "`ref.current.cropper`, `onInitialized`",
        },
        {
          text: "`aspect` on `Root`, `setAspect()`, `AspectGroup`",
          title: "`aspectRatio`, `setAspectRatio()`",
        },
        {
          text: "`size` in `defaultValue`",
          title: "`initialAspectRatio`, `autoCropArea`",
        },
        {
          text: "`defaultValue`, `value`, `setValue()`",
          title: "`data`, `setData()`",
        },
        {
          text: "`getValue()` to save, `getPixelCrop()` for source pixels",
          title: "`getData()`",
        },
        { text: "`onValueChange`", title: "`crop` event" },
        { text: "`onValueCommit`", title: "`cropend` event" },
        { text: "`onLoad`", title: "`ready`" },
        {
          text: "`zoom` on `Root`, `setZoom()`, the `Zoom` part",
          title: "`zoomTo` prop, `zoom()`, `zoomTo()`",
        },
        {
          text: '`wheel="zoom"`, `"pan"` or `"none"` on `Viewport`',
          title: "`zoomOnWheel`",
        },
        {
          text: "`rotation` up to 45° each way, the `Dial` part, `rotate90()`",
          title: "`rotateTo` prop, `rotate()`, `rotateTo()`",
        },
        {
          text: '`flip()`, `flip("y")`, the `Flip` part',
          title: "`scaleX(-1)`, `scaleY(-1)`",
        },
        { text: "`disabled` on `Root`", title: "`enable` prop, `disable()`" },
        {
          text: "The default, a drag pans the photo",
          title: '`dragMode: "move"`',
        },
        {
          text: "Always on, the crop stays inside the photo",
          title: "`viewMode` 1 to 3",
        },
        {
          text: "`minSize` on `Root` in source pixels",
          title: "`minCropBoxWidth` in page pixels",
        },
        { text: "The `Grid` and `Mask` parts", title: "`guides`, `modal`" },
        { text: '`shape="circle"` on `Root`', title: '`borderRadius: "50%"`' },
        {
          text: "`exportCrop()` from `@zriz/core/dom`",
          title: "`getCroppedCanvas().toBlob()`",
        },
        {
          text: "No live preview element; `useCropperFrame`, or `exportCrop()` with a small `maxSize`",
          title: "`preview`",
        },
        { text: "`reset()`, a new `src`", title: "`reset()`, `replace(url)`" },
        { text: "`crossOrigin` on `Root`", title: "`crossOrigin`" },
      ]),
      p(
        "Zoom changes unit. In Cropper.js a zoom of 1 is the photo at its natural size. In zriz 1 is the largest crop that fits, so a stored zoom number does not carry over."
      ),
      p(
        "Saved crops do not carry over as they are. `getData()` returns `x`, `y`, `width` and `height` in pixels of the source photo, plus `rotate`, `scaleX` and `scaleY`. For a JPEG with an EXIF orientation, `rotate` starts at the EXIF angle. zriz stores the centre and size as fractions of the photo the browser shows, a straighten angle, a quarter turn count and a mirror flag, see [value](value). zriz has no importer, and this page gives no formula because we did not check one by running both libraries on the same crops. A crop that leaves the photo or uses a scale other than 1 or a mirror has no zriz value."
      ),
      p(
        "Install `@zriz/react` and `@zriz/core`, then remove `react-cropper` and the `cropper.css` import. Replace `<Cropper>` with `Root`, `Viewport`, `Image`, `Mask` and `Area`, and add a `Handle` for each handle you want. Move calls on `ref.current.cropper` to the cropper from `actionsRef`. Swap `getCroppedCanvas()` for `exportCrop()` and await it. Then delete the CSS overrides on `.cropper-` classes and style the zriz parts."
      ),
      code("zriz-vs-react-cropper/after.tsx"),
      p(
        "This component follows the react-cropper README example, with a save button like the one in the repo's example app where the README logs on every crop event. It loads a photo from a URL, shows a free crop box with eight handles that starts at 16:9, and the button produces a PNG. `onLoad` sets the first box to 80% of the largest 16:9 box that fits, as `autoCropArea` does. `exportCrop` hands `onSave` a `Blob` where the README logs a data URL. A photo on another domain needs CORS headers, because zriz loads it with `fetch`."
      ),
      p(
        "You still write the button styles and the words. Zoom, rotate and flip controls are parts you add inside `Root`. The stylesheet paints the mask, the crop frame and the handles."
      )
    ),
    section(
      "How we checked",
      p(
        "We installed the published npm package at the version above and read its source and docs, and did the same for Cropper.js 1.7.0, the copy that react-cropper installs. Then we ran both libraries in headless Chromium with the same photo and the same script: tab order, keys, ARIA attributes, mouse, wheel, touch and a 15° turn."
      ),
      p(
        "The sources are the [react-cropper repo](https://github.com/react-cropper/react-cropper) and its README, which is its documentation, the [Cropper.js v1 docs](https://github.com/fengyuanchen/cropperjs/blob/v1/README.md) and the [npm page](https://www.npmjs.com/package/react-cropper)."
      )
    ),
    section(
      "More comparisons",
      entries([
        {
          text: "The engine itself, in its current 2.x version, which react-cropper does not run on",
          title: "[zriz vs Cropper.js](zriz-vs-cropperjs)",
        },
        {
          text: "Cropper.js inside the Uppy Dashboard, an upload UI",
          title: "[zriz vs Uppy image editor](zriz-vs-uppy-image-editor)",
        },
        {
          text: "A React cropper for photos and video, with over 2,700 GitHub stars",
          title: "[zriz vs react-easy-crop](zriz-vs-react-easy-crop)",
        },
      ]),
      p("Every comparison is on the [comparison](comparison) page.")
    ),
  ],
  lede: "react-cropper is a React component around Cropper.js 1.x. It draws a styled crop box with handles, and you drive it through the Cropper.js instance. zriz is a set of unstyled React parts with a straighten dial, keyboard control and a crop value you hold in React state.",
});

export { ZRIZ_VS_REACT_CROPPER_PAGE };
