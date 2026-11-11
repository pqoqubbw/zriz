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

const ZRIZ_VS_REACT_IMAGE_CROP_PAGE = defineDoc({
  blocks: [
    intro(
      p(
        "We make zriz, so read this page with that in mind. It compares react-image-crop 11.1.2 with `@zriz/react` 0.2.0. If something here is wrong, [open an issue](https://github.com/pqoqubbw/zriz/issues) and we will fix it."
      ),
      p(
        "To move a project over, paste this into Claude Code, Cursor or another coding agent:"
      ),
      prompt(
        "Migrate this project from react-image-crop to zriz. Read https://zriz.dev/docs/zriz-vs-react-image-crop.md and follow its section on migrating. Keep the crop behaviour the same where zriz can, and list for me anything zriz has no equivalent for before you remove it."
      )
    ),
    section(
      "In short",
      p(
        'react-image-crop is, in the words of [its README](https://github.com/dominictobias/react-image-crop#readme), "An image cropping tool for React with no dependencies." It is one styled component. You put your own `<img>` or any other element inside it, and it draws a crop box with eight handles on top. The element under the box stays still.'
      ),
      p(
        "Pick react-image-crop when size decides, because it is about 5 kB against 26 to 34 kB for zriz. Pick it when the app runs React 17 or React 16 from 16.13.1, or needs a UMD build. Pick it when the crop goes over a video or another element that is not a photo, when the user should start with no crop and draw one, when the crop needs a largest size or an oval shape, or when a keyboard user must move one edge at a time. It ships nine English labels for the box and its handles. It has been on npm since 2015 and has over 4 million downloads a week."
      ),
      p(
        "Pick zriz when the photo should move under the crop, with a pinch or Ctrl + wheel to zoom. Pick it when you need a straighten dial, quarter turns or a flip, when you want the file back as a JPEG, PNG or WebP blob with a size cap, or when you cut the original on a server and want `toSharp`, a helper that turns the crop into a recipe for sharp. It is new. Its first release was in November 2026, it has one maintainer and under a thousand downloads a week."
      )
    ),
    section(
      "Numbers",
      table({
        columns: [
          column("Fact", "prose", { width: 150 }),
          column("react-image-crop", "prose"),
          column("zriz", "prose"),
        ],
        rows: [
          ["First release", "2015", "November 2026"],
          ["npm downloads a week", "4.3M+", "Under 1,000"],
          ["GitHub stars", "4.1k+", "Under 100"],
          ["Licence", "ISC", "MIT"],
          ["Dependencies", "None", "None, `@zriz/core` and React are peers"],
          ["React", "16.13.1 and newer", "18.2 and 19"],
          ["Size", "About 5 kB", "26 to 34 kB"],
        ],
      }),
      p(
        "Size is minified JavaScript and CSS, compressed with Brotli, without React. For react-image-crop it is the basic example from its docs, built with esbuild. For zriz it depends on the parts you import: about 26 kB for `Root`, `Viewport`, `Image`, `Mask` and `Area`, and about 34 kB with every part. Up to 6 kB more loads later, for export, sharpening and SVG. We measured the zriz sets with Rolldown, and esbuild makes them up to about 16% larger. [Bundle size](bundle-size) has each set. `@zriz/react` needs `@zriz/core` and React as peers."
      )
    ),
    section(
      "Features",
      compare(
        ["react-image-crop", "zriz"],
        [
          [
            "Crop box with handles",
            ["yes", "Four corners and four edges"],
            ["yes", "Four corners and four edges"],
          ],
          ["Photo moves under the frame", ["no"], ["yes"]],
          [
            "Aspect ratio",
            ["yes", "Free or any ratio"],
            ["yes", "Free, original or any ratio"],
          ],
          [
            "Round crop",
            ["partly", "Mask on screen and a rectangular file"],
            ["yes", "Mask and export"],
          ],
          ["Zoom", ["no"], ["yes", "Pinch, Ctrl + wheel, slider part, keys"]],
          [
            "Straighten (free rotation)",
            ["no"],
            ["partly", "45° each way plus quarter turns"],
          ],
          [
            "Crop stays inside the photo at an angle",
            ["no", "Nothing checks the crop against a rotation"],
            ["yes", "The crop shrinks to fit"],
          ],
          ["Quarter turns and flip", ["no"], ["yes", "Animated"]],
          [
            "Touch gestures",
            ["partly", "One finger draws, moves and resizes"],
            ["yes", "Pan, pinch, twist, two handles at once"],
          ],
          [
            "Keyboard",
            ["yes", "The box and each handle, eight with a free aspect"],
            ["yes", "Crop area, dial, zoom and ratio group; handles no"],
          ],
          [
            "Screen reader",
            ["partly", "Nine default labels and no live region"],
            ["partly", "Roles and live region; you write the labels"],
          ],
          [
            "Image export",
            ["yes", "PNG as an object URL or canvas"],
            ["yes", "JPEG, PNG or WebP blob"],
          ],
          [
            "Saved crop",
            ["yes", "Pixels or percent of the rendered image"],
            ["yes", "Fractions of the photo"],
          ],
          [
            "Ready-made UI",
            ["partly", "Styled box and handles, no controls"],
            ["no", "Unstyled parts and an optional stylesheet"],
          ],
        ]
      ),
      p(
        "With `aspect` set, the react-image-crop stylesheet hides the four edge handles and the corners remain. It does the same on a device with a coarse pointer, such as a phone, where the corner handles grow from 12 px to 24 px. A new `aspect` applies to the next drag or key press. The component does not reshape the crop that is already there, so the app recomputes it, as the maintainer's [demo](https://github.com/dominictobias/react-image-crop/blob/11.1.2/src/demo/Demo.tsx) does. The README asks the app to keep a crop it sets in bounds and correct to the aspect ratio."
      ),
      p(
        "The export helpers `cropToCanvas` and `cropToImg` arrived in 11.1.0 in June 2026. The release notes say to use 11.1.2. An article from before that release that says the library has no export is out of date."
      )
    ),
    section(
      "What you will notice",
      p(
        "The two libraries move different things. In react-image-crop the photo stays still and the box travels over it. The page can start with no crop, the user drags on the photo to draw one, and a press outside the box starts a new one. zriz always has a crop. A drag on the photo pans it under the frame, and 300 ms after a handle drag the crop springs back to the centre of the viewport."
      ),
      p(
        "react-image-crop has no zoom and no rotation. Version 10.0.0 removed the `zoom` and `spin` props outright. It also removed `scale` and `rotate` as props, because the app now renders its own `<img>` and can set both in CSS, as the [10.0.0-beta.0 release notes](https://github.com/dominictobias/react-image-crop/releases/tag/10.0.0-beta.0) explain. The maintainer's [demo](https://github.com/dominictobias/react-image-crop/blob/11.1.2/src/demo/Demo.tsx) scales and rotates its own `<img>` with a CSS `transform`, and the [export helpers](https://github.com/dominictobias/react-image-crop/blob/11.1.2/src/addons/browserCrop.ts) take matching `scale` and `rotate` numbers. Nothing checks the box against the rotated image, and the helper leaves the canvas unpainted where the box reaches past it. In zriz the dial turns the photo up to 45° each way and the crop shrinks to stay on the photo. In Chromium, a zriz export at 15° had four painted corners. The react-image-crop statement comes from reading the helper, and we ran no rotated export for it."
      ),
      p(
        "The keyboard reaches further in react-image-crop. Once a crop exists, the box and each of its eight handles is a tab stop, nine in Chromium with a free aspect. With `aspect` set, or on a coarse pointer, its stylesheet hides the four edge handles and five stops remain. With no crop nothing takes focus, and no key draws the first one. Arrow keys move the focused box or handle by 1 px on screen, by 10 px with Shift and by 100 px with Ctrl, or Cmd on a Mac. A keyboard user can move one edge while the opposite edge stays put. zriz handles take no keys. Alt + arrow keys on the crop area resize it about its centre, and arrows move it by 1% of its own size."
      ),
      p(
        "react-image-crop ships nine English labels, and the `ariaLabels` prop replaces them. Its markup has no live region, so nothing in it announces a move or a resize. We ran no screen reader for this page. The default labels of the left and right edge handles say to use the up and down arrow keys, see [the source](https://github.com/dominictobias/react-image-crop/blob/11.1.2/src/ReactCrop.tsx#L106-L118). In Chromium those two handles answered to left and right. zriz ships no words. The app writes every label and the text for the `Announcer` live region, see [accessibility](accessibility)."
      ),
      p(
        "The output differs. `onChange` hands back the crop in CSS pixels of the rendered image and in percent. `cropToImg` resolves to an object URL of a PNG at source size times the device pixel ratio, with no format, quality or size option, and each call revokes the URL from the call before. In Chromium at a device pixel ratio of 1, half the width and height of a 2400 by 1600 photo came out as a 1200 by 800 PNG. `circularCrop` masks the screen and the file stays a rectangle. `exportCrop` in zriz returns a blob, JPEG by default, with `type`, `quality` and `maxSize`. It runs in a worker by default and falls back to the main thread where workers or OffscreenCanvas are missing or blocked."
      )
    ),
    section(
      "Migrate from react-image-crop",
      p(
        "zriz has no equivalent for a crop over a video, a canvas or any element that is not a photo. It has no empty state, so the user cannot draw a crop from nothing or clear it with a press outside. It has no `maxWidth` or `maxHeight`, no oval crop, no `locked` prop and no keys on single handles. It needs React 18.2 or newer and ships ES modules with no CommonJS or UMD build. If the app depends on one of these, stay on react-image-crop."
      ),
      entries([
        {
          text: "`Cropper.Root` with `src`, then `Viewport`, `Image`, `Mask`, `Area` and `Handle`",
          title: "`<ReactCrop>` around your `<img>`",
        },
        {
          text: "`value` controlled, or `defaultValue` uncontrolled",
          title: "`crop` with a required `onChange`, controlled only",
        },
        { text: "`onValueChange(value, details)`", title: "`onChange`" },
        {
          text: "`onValueCommit(value, details)`, source pixels in `details.pixelCrop.pixelRect` while the crop is not straightened",
          title: "`onComplete`",
        },
        {
          text: "`details.phase` in `onValueChange`",
          title: "`onDragStart`, `onDragEnd`",
        },
        {
          text: '`aspect` on `Root`, a number, `"free"` or `"original"`',
          title: "`aspect`, a number or undefined",
        },
        {
          text: "`defaultValue={{ aspect: 16 / 9 }}`, zriz centres the largest crop of that shape",
          title: "`centerCrop` and `makeAspectCrop` in `onLoad`",
        },
        {
          text: "`minSize` in source pixels",
          title: "`minWidth`, `minHeight` in rendered pixels",
        },
        { text: "No equivalent", title: "`maxWidth`, `maxHeight`" },
        {
          text: '`shape="circle"`, always 1:1 and exported round',
          title: "`circularCrop`",
        },
        {
          text: "`Cropper.Grid`, shown while the crop moves",
          title: "`ruleOfThirds`, shown whenever there is a crop",
        },
        { text: "`disabled` on `Root`", title: "`disabled`" },
        { text: "No equivalent", title: "`locked`" },
        {
          text: "Not needed, there is always a crop",
          title: "`keepSelection`",
        },
        {
          text: "`aria-label` on each part, plus `Instructions` and `Announcer`",
          title: "`ariaLabels`",
        },
        {
          text: "`@zriz/react/styles.css`, optional, `--zriz-*` variables",
          title: "`ReactCrop.css`, required, `--rc-*` variables",
        },
        {
          text: "`exportCrop(cropper, options)` from `@zriz/core/dom`",
          title: "`cropToCanvas`, `cropToImg`",
        },
        {
          text: "Fixed, 1% of the crop and 10% with Shift",
          title: "Key steps of 1, 10 and 100 px",
        },
        {
          text: "`Zoom`, `Dial`, `Rotate` and `Flip` parts",
          title: "Your own CSS `transform` for scale and rotate",
        },
      ]),
      p(
        'A saved react-image-crop crop is `{ x, y, width, height, unit }`, measured from the top left of the rendered image. With `unit` `%` the numbers run from 0 to 100, and that crop converts to a zriz value. `center.x` is `(x + width / 2) / 100`, `center.y` is `(y + height / 2) / 100`, `size.width` is `width / 100` and `size.height` is `height / 100`. Set `rotation` and `quarterTurns` to 0 and `mirrored` to `false`. A controlled `value` needs every field, so there also set `perspective` to `{ vertical: 0, horizontal: 0 }` and `aspect` to `"free"` or your ratio. We checked this by running `@zriz/core` 0.2.0 on a 2400 by 1600 photo, where percent 10, 20, 30, 40 gave the same rectangle back in source pixels. It holds for a crop made over one `<img>` with no CSS scale or rotation.'
      ),
      p(
        "A crop saved with `unit` `px` is in pixels of the image as it was rendered, so it needs that rendered width and height first. `convertToPercentCrop` from react-image-crop does that step. Skip a crop with zero width or height, which meant no crop. zriz grows a crop that is smaller than its `maxZoom` of 15 allows. In the same run, a crop of 2% by 2% came back as 160 by 106 px where 48 by 32 px was saved, so raise `maxZoom` on `Root` before you load crops that small. There is no formula here for a crop made over a scaled or rotated image."
      ),
      p(
        "Install `@zriz/react` and `@zriz/core`. Replace `<ReactCrop>` and its `<img>` with the parts below and pass the photo's URL, `File` or `Blob` to `src`. Drop the crop state unless the app reads it, and move the work in `onComplete` to `onValueCommit`. Convert saved crops with the formula above and pass each one as `defaultValue` or `value`. Replace `cropToImg` with `exportCrop`. Then remove `react-image-crop` and its stylesheet import."
      ),
      code("zriz-vs-react-image-crop/after.tsx"),
      p(
        "`ImageCrop` shows the photo with a free crop and eight handles, logs the crop in source pixels on each commit and hands `onSave` a PNG blob, the format `cropToImg` made. Leave out `type` for a JPEG. The stylesheet paints the mask, the frame and the handles. The app still writes the layout, the button styles and every label. For zoom, turns or a dial, add those parts and style them, see [full editor](full-editor)."
      )
    ),
    section(
      "How we checked",
      p(
        "We installed the published npm package at the version above and read its source and docs. Then we ran both libraries in headless Chromium with the same photo and the same script. The script covers tab order, keys, ARIA attributes, mouse, wheel and touch. The 15° turn ran for zriz alone, because react-image-crop has no rotation to set."
      ),
      p(
        "react-image-crop has its [repository](https://github.com/dominictobias/react-image-crop) on GitHub, where the [README](https://github.com/dominictobias/react-image-crop#readme) is the documentation, and its package on [npm](https://www.npmjs.com/package/react-image-crop)."
      )
    ),
    section(
      "More comparisons",
      entries([
        {
          text: "The React cropper with the most downloads. Its photo moves under a fixed frame",
          title: "[zriz vs react-easy-crop](zriz-vs-react-easy-crop)",
        },
        {
          text: "A styled React cropper with parts and algorithms you can replace",
          title:
            "[zriz vs react-advanced-cropper](zriz-vs-react-advanced-cropper)",
        },
        {
          text: "Headless parts too, with a crop box that moves over the image by default",
          title: "[zriz vs Ark UI](zriz-vs-ark-ui)",
        },
      ]),
      p("Every comparison is on the [comparison](comparison) page.")
    ),
  ],
  lede: "react-image-crop draws a crop box over an image that stays still. zriz moves the photo under the crop and has zoom and a straighten dial.",
});

export { ZRIZ_VS_REACT_IMAGE_CROP_PAGE };
