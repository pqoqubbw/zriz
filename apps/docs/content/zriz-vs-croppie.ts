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

const ZRIZ_VS_CROPPIE_PAGE = defineDoc({
  blocks: [
    intro(
      p(
        "We make zriz, so read this page with that in mind. It compares `croppie` 2.6.5 with `@zriz/react` 0.2.1. If something here is wrong, [open an issue](https://github.com/pqoqubbw/zriz/issues) and we will fix it."
      ),
      p(
        "To move a project over, paste this into Claude Code, Cursor or another coding agent:"
      ),
      prompt(
        "Migrate this project from croppie to zriz. Read https://zriz.dev/docs/zriz-vs-croppie.md and follow its section on migrating. Keep the crop behaviour the same where zriz can, and list for me anything zriz has no equivalent for before you remove it."
      )
    ),
    section(
      "In short",
      p(
        'Croppie is a plain JavaScript class, `new Croppie(element, options)`, with an optional jQuery plugin. Its [docs](https://foliotek.github.io/Croppie/) call it "a fast, easy to use image cropping plugin with tons of configuration options". A frame of fixed pixel size sits in the middle of a box, the photo moves and zooms under it, and a styled zoom slider sits below.'
      ),
      p(
        "Pick Croppie when the page has no React or no bundler, or runs on jQuery. It is one script and one stylesheet, about 8 kB together as measured below, and it loads from a CDN. It paints its own frame and zoom slider, so a square or round avatar cropper needs no CSS from you. It has been on npm since 2015 and has over 120k downloads a week. It returns a data URL, a canvas or an exact output size, and with `enforceBoundary: false` the crop can run past the photo. Its docs list browsers back to IE 10 and Safari 4."
      ),
      p(
        "Pick zriz when the app is React and the user needs to resize or straighten the crop. It is a set of React parts with bundled types, it renders on the server, and `src` takes a `File` or a `Blob`. It has eight resize handles, ratios you change at runtime, a dial that turns the photo up to 45° each way, and rotate and flip buttons. zriz is new. Its first release was in November 2026, and it has one maintainer, versions at 0.x and under a thousand downloads a week."
      )
    ),
    section(
      "Numbers",
      table({
        columns: [
          column("Fact", "prose", { width: 150 }),
          column("Croppie", "prose"),
          column("zriz", "prose"),
        ],
        rows: [
          ["First release", "2015", "November 2026"],
          ["npm downloads a week", "120k+", "Under 1,000"],
          ["GitHub stars", "2.6k+", "Under 100"],
          ["Licence", "MIT", "MIT"],
          ["Dependencies", "None", "None, `@zriz/core` and React as peers"],
          [
            "React",
            "Not needed, its README lists no React wrapper",
            "18.2 and 19",
          ],
          ["Size", "About 8 kB", "22 to 30 kB"],
        ],
      }),
      p(
        "Size is minified JavaScript and CSS, compressed with Brotli, without React. For Croppie it is the basic example from its docs, built with esbuild. Croppie's one script holds its export code, so its number includes export. For zriz it depends on the parts you import: about 22 kB for `Root`, `Viewport`, `Image`, `Mask` and `Area`, and about 29 kB with every part. Up to 11 kB more loads later, for reading the file, export, sharpening and SVG. We measured the zriz sets with Rolldown. Built with esbuild as one file, the way the other example was, zriz comes to about 33 kB for those five parts and about 41 kB with every part, because the code that loads later is then in that file. [Bundle size](bundle-size) has each set. `@zriz/react` needs `@zriz/core` and React as peers."
      )
    ),
    section(
      "Features",
      compare(
        ["Croppie", "zriz"],
        [
          [
            "Crop box with handles",
            ["partly", "Two edge handles with `enableResize`"],
            ["yes", "Four corners and four edges"],
          ],
          ["Photo moves under the frame", ["yes"], ["yes"]],
          [
            "Aspect ratio",
            ["partly", "Set once by the frame's width and height"],
            ["yes", "Free, original or any ratio"],
          ],
          [
            "Round crop",
            ["yes", "Mask and export"],
            ["yes", "Mask and export"],
          ],
          [
            "Zoom",
            ["yes", "Wheel, pinch, built-in slider, keys"],
            ["yes", "Pinch, Ctrl + wheel, slider part, keys"],
          ],
          [
            "Straighten (free rotation)",
            ["no", "`rotate()` takes multiples of 90°"],
            ["partly", "45° each way plus quarter turns"],
          ],
          [
            "Crop stays inside the photo at an angle",
            ["no", "It has no free rotation"],
            ["yes", "The crop shrinks to fit"],
          ],
          [
            "Quarter turns and flip",
            ["partly", "A `rotate()` method; flip through `bind`"],
            ["yes", "Animated"],
          ],
          [
            "Touch gestures",
            ["partly", "Pan and pinch, no twist"],
            ["yes", "Pan, pinch, twist, two handles at once"],
          ],
          [
            "Keyboard",
            ["yes", "Frame and zoom slider; resize handles no"],
            ["yes", "Crop area, dial, zoom and ratio group; handles no"],
          ],
          [
            "Screen reader",
            ["partly", "The slider has a name; frame has none"],
            ["partly", "Roles and live region; you write the labels"],
          ],
          [
            "Image export",
            ["yes", "PNG, JPEG or WebP; blob, data URL, canvas"],
            ["yes", "JPEG, PNG or WebP blob"],
          ],
          [
            "Saved crop",
            ["yes", "Corner points in whole image pixels"],
            ["yes", "Fractions of the photo, restores exactly"],
          ],
          [
            "Ready-made UI",
            ["yes", "Styled frame and zoom slider"],
            ["no", "Unstyled parts and an optional stylesheet"],
          ],
        ]
      ),
      p(
        "Croppie's two handles sit on the right and bottom edges and are off by default. Each one changes one dimension, and nothing locks the ratio. The frame's size comes from `viewport.width` and `viewport.height` in the constructor, and no public method changes it later."
      ),
      p(
        "With `enforceBoundary` on, which is Croppie's default, the photo covered the whole frame in Chromium. A restore through `bind({ points })` takes its scale from the frame's width and the width of the points, and does not use their height. The frame needs the width to height ratio it had when you saved. The restore is exact to one image pixel because `get()` rounds."
      )
    ),
    section(
      "What you will notice",
      p(
        'Croppie works once its stylesheet is on the page. The frame, the dimmed surround and the zoom slider come painted, and the slider carries `aria-label="zoom"`. In zriz the `Zoom` slider and every button paint nothing until you style them, and you write every label. axe found no issues in either demo in Chromium.'
      ),
      p(
        "A plain mouse wheel zooms in Croppie by default, and `mouseWheelZoom: 'ctrl'` limits that to Ctrl + wheel and leaves a plain wheel to the page. In zriz a plain wheel pans the photo and Ctrl + wheel zooms. `wheel=\"zoom\"` on `Viewport` gives you Croppie's default, and `wheel=\"none\"` gives you its `'ctrl'` mode."
      ),
      p(
        "Croppie turns the photo in 90° steps through `rotate()`. That method needs `enableOrientation: true` and [throws without it](https://github.com/Foliotek/Croppie/blob/v2.6.5/croppie.js#L1464-L1484). Croppie ships no rotate or flip control, and a mirror goes through `bind` with an EXIF orientation number. zriz has `Rotate` and `Flip` parts and a `Dial` that straightens up to 45° each way. At an angle zriz shrinks the crop, so the saved value and the exported file hold no empty corner."
      ),
      p(
        'Both take keys. In Croppie the frame is a tab stop, and each arrow press moves the photo 1 CSS px. Shift + Up and Shift + Down change the zoom by [0.0001 per press](https://github.com/Foliotek/Croppie/blob/v2.6.5/croppie.js#L832-L886). The frame has no role and no name, and `croppie.css` [removes the slider\'s focus outline](https://github.com/Foliotek/Croppie/blob/v2.6.5/croppie.css#L161-L190) and gives it a 1 px white one in Firefox. In zriz the arrows move the crop by 1% of its size, or 10% with Shift. The crop area has `role="application"`, and you write its name. The zriz handles take no keys, and Alt + arrows on the crop area resize it about its centre.'
      ),
      p(
        "Croppie's latest release, 2.6.5, came out in June 2020, and its repo has over 250 open issues. One of its two authors wrote about the project's status in [issue 716](https://github.com/Foliotek/Croppie/issues/716). zriz had its first release in November 2026 and has one maintainer. It has under a thousand downloads a week, where Croppie has over 120k."
      )
    ),
    section(
      "Migrate from Croppie",
      p(
        "zriz has no equivalent for a script tag or a jQuery plugin. It ships ES modules, with no UMD or CommonJS build. It has no `enforceBoundary: false`, so a crop cannot run past the photo or take a background colour. `exportCrop` resolves a blob and has no data URL, canvas or HTML result, and its `maxSize` scales down and never up. zriz has no frame option in screen pixels. You size the frame with CSS on `Viewport`, and the export does not follow that size. Croppie's docs list Firefox 10, Chrome 12, IE 10, Edge, Safari 4 and Opera 15 and newer, plus iOS and Android. zriz lists the latest two versions of Chrome, Edge and Firefox, Safari and iOS Safari 18 and newer, and Chrome and Samsung Internet on Android."
      ),
      entries([
        {
          text: "`Root` with `Viewport`, `Image`, `Mask` and `Area`. Without React, see [vanilla JS](vanilla-js)",
          title: "`new Croppie(el, options)`, `$(el).croppie(options)`",
        },
        {
          text: "`aspect` on `Root`. The crop fits inside the padding of `Viewport`",
          title: "`viewport: { width, height }`",
        },
        {
          text: '`shape="circle"` on `Root`',
          title: "`viewport.type: 'circle'`",
        },
        {
          text: "CSS width and height of `Viewport`",
          title: "`boundary: { width, height }`",
        },
        {
          text: "`Zoom` with `ZoomThumb`, which you style",
          title: "`showZoomer`",
        },
        {
          text: "No switch. `maxZoom={1}` on `Root` looks closest, and we did not check it",
          title: "`enableZoom: false`",
        },
        {
          text: '`wheel="zoom"` on `Viewport`',
          title: "`mouseWheelZoom: true`",
        },
        {
          text: '`wheel="none"` on `Viewport`. The zriz default also pans on a plain wheel',
          title: "`mouseWheelZoom: 'ctrl'`",
        },
        {
          text: 'No exact equivalent. `wheel="none"` is closest, and Ctrl + wheel still zooms',
          title: "`mouseWheelZoom: false`",
        },
        { text: "Always on", title: "`enforceBoundary: true`" },
        { text: "No equivalent", title: "`enforceBoundary: false`" },
        { text: "`Handle` parts, up to eight", title: "`enableResize`" },
        {
          text: "`Rotate`, or `rotate90()` on the cropper",
          title: "`enableOrientation` and `rotate(90)`",
        },
        {
          text: "`Flip` with `axis`, or `flip()` on the cropper. 5 and 7 also need a quarter turn, which we did not check",
          title: "`bind({ orientation })` with 2 or 4",
        },
        {
          text: "Not needed for a JPEG. The browser's decoder applies the orientation",
          title: "`enableExif` with exif-js",
        },
        { text: "`className` on any part", title: "`customClass`" },
        {
          text: "`maxZoom` on `Root`, on another scale, or `minSize` in source pixels",
          title: "`maxZoom`",
        },
        {
          text: "No equivalent. Croppie uses it only with `enforceBoundary: false`. zriz does not zoom out below the largest crop that fits",
          title: "`minZoom`",
        },
        {
          text: "`src` on `Root`, which also takes a `File` or a `Blob`",
          title: "`bind({ url })`",
        },
        {
          text: "`defaultValue` or `value` on `Root`, converted as below",
          title: "`bind({ points })`",
        },
        {
          text: "`getValue()`, or `getPixelCrop().pixelRect` for pixels",
          title: "`get()`",
        },
        {
          text: "`onValueChange` during a gesture, `onValueCommit` once at its end",
          title: "`update` event and option",
        },
        {
          text: "`exportCrop(cropper, { type, quality })` from `@zriz/core/dom`",
          title: "`result({ type: 'blob', format, quality })`",
        },
        {
          text: "The default, with no `maxSize`",
          title: "`result({ size: 'original' })`",
        },
        {
          text: "`maxSize`, which scales down and never up",
          title: "`result({ size: 'viewport' })`, `size: { width, height }`",
        },
        {
          text: "`shape` in the export options",
          title: "`result({ circle })`",
        },
        {
          text: "Read the blob yourself, for example with `FileReader`",
          title: "`result` types `'base64'` and `'canvas'`",
        },
        {
          text: "No equivalent",
          title: "`result` types `'rawcanvas'` and `'html'`, `backgroundColor`",
        },
        {
          text: "`setZoom(zoom)`, on another scale",
          title: "`setZoom(value)`",
        },
        { text: "Unmount the component", title: "`destroy()`" },
        {
          text: "The zriz docs say the crop fits again when `Viewport` changes size. We did not check a hidden container",
          title: "`bind()` again after a hidden container shows",
        },
      ]),
      p(
        'The two zoom scales differ. In Croppie 1 is one image pixel per CSS pixel. In zriz 1 is the largest crop that fits. From orientation 1, Croppie\'s `rotate(90)` gives EXIF orientation 8. Its docs call 8 counter-clockwise, and the same docs label the `rotate(90)` button "Rotate Right". `Rotate` in zriz turns counter-clockwise by default, and `direction="cw"` turns it the other way. We did not measure Croppie\'s direction on screen, so check it in your app.'
      ),
      p(
        "Croppie saves `points` as four whole-number strings, `[x1, y1, x2, y2]`, in pixels of the photo from its top-left corner. zriz has no importer for them. For a crop saved with orientation 1, turn the strings into numbers, take the photo's width `W` and height `H`, and build a `CropValue`: `center.x` is `(x1 + x2) / 2 / W`, `center.y` is `(y1 + y2) / 2 / H`, `size.width` is `(x2 - x1) / W` and `size.height` is `(y2 - y1) / H`. Pass it as `defaultValue`. We checked the zriz half of that formula by running code. The Croppie half comes from its source and one crop we measured. We checked nothing for the other seven orientations or for crops saved with `relative: true`, so test those against pixels before you convert them. Croppie's saved `zoom` is not needed, see [value](value)."
      ),
      p(
        "Run `pnpm add @zriz/react @zriz/core`. Replace the element, the effect that calls `new Croppie` and `destroy()`, and the `bind` call with the component below. Convert saved points as above. Replace each `result()` call with `exportCrop`. Then remove `croppie`, `@types/croppie`, the `croppie.css` import and, if nothing else uses it, exif-js."
      ),
      code("zriz-vs-croppie/after.tsx"),
      p(
        "The component keeps Croppie's model: a square frame of 200 px in a 300 px box, a photo that moves under it, a zoom slider and a wheel that zooms. `src` takes the URL you passed to `bind`, or the `File` itself. Croppie's default result is a PNG data URL at the frame's size on screen, border included, so `save` asks for a PNG blob of at most 200 by 200 px. Without `maxSize` the file has the crop's size in the photo's own pixels, up to the export size limit on the [loading images](loading-images) page, and without `type` it is a JPEG."
      ),
      p(
        'You still write the styles for the zoom track, its thumb and the save button, and you write the labels in your own language. The export runs in a worker by default and on the main thread where workers or `OffscreenCanvas` are missing or blocked. For a round crop, add `shape="circle"` to `Root`, see [avatar](avatar).'
      )
    ),
    section(
      "How we checked",
      p(
        "We installed the published npm package at the version above, read its source and docs, and took the counts from the npm registry and GitHub. Then we ran both libraries in headless Chromium with the same photo and the same script: tab order, keys, ARIA attributes, mouse, wheel and touch. The 15° turn ran for zriz and not for Croppie, which has no free rotation."
      ),
      p(
        "Croppie's [repo](https://github.com/Foliotek/Croppie), [docs](https://foliotek.github.io/Croppie/) and [npm page](https://www.npmjs.com/package/croppie)."
      )
    ),
    section(
      "More comparisons",
      entries([
        {
          text: "A React component for avatars and profile pictures",
          title: "[zriz vs react-avatar-editor](zriz-vs-react-avatar-editor)",
        },
        {
          text: "The most downloaded cropper for React, over 5 million a week",
          title: "[zriz vs react-easy-crop](zriz-vs-react-easy-crop)",
        },
        {
          text: "Another plain JavaScript cropper, with over 13,000 GitHub stars",
          title: "[zriz vs Cropper.js](zriz-vs-cropperjs)",
        },
      ]),
      p("Every comparison is on the [comparison](comparison) page.")
    ),
  ],
  lede: "Croppie is a plain JavaScript cropper with an optional jQuery plugin: a fixed frame, a photo that moves under it and a built-in zoom slider. zriz is a set of unstyled React parts with resize handles and a straighten dial.",
});

export { ZRIZ_VS_CROPPIE_PAGE };
