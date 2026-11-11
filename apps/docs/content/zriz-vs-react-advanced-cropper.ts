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

const ZRIZ_VS_REACT_ADVANCED_CROPPER_PAGE = defineDoc({
  blocks: [
    intro(
      p(
        "We make zriz, so read this page with that in mind. It compares react-advanced-cropper 0.20.1 with `@zriz/react` 0.2.0. If something here is wrong, [open an issue](https://github.com/pqoqubbw/zriz/issues) and we will fix it."
      ),
      p(
        "To move a project over, paste this into Claude Code, Cursor or another coding agent:"
      ),
      prompt(
        "Migrate this project from react-advanced-cropper to zriz. Read https://zriz.dev/docs/zriz-vs-react-advanced-cropper.md and follow its section on migrating. Keep the crop behaviour the same where zriz can, and list for me anything zriz has no equivalent for before you remove it."
      )
    ),
    section(
      "In short",
      p(
        `react-advanced-cropper is a styled React cropper whose parts and algorithms you can replace. Its README calls it "the advanced library that gives you opportunity to create your own croppers suited for any website design". The state lives in a core without a framework, \`advanced-cropper\`. The [docs](https://advanced-cropper.github.io/react-advanced-cropper/) are for the React package, and their tutorials use the core's extensions.`
      ),
      p(
        "Pick react-advanced-cropper when the visitor should drag a selection box over a still photo, when the crop needs a range of aspect ratios, a largest size in pixels or room past the edge of the photo with a fill colour, or when you want your own stencil shape and your own resize rules. It runs on React 16.8 and newer, ships five themes, a preview part and a CommonJS build, and returns a canvas you can draw on. It is about 24 kB against 26 to 34 kB for zriz. It has been on npm since 2021 and has over 250k downloads a week."
      ),
      p(
        "Pick zriz when the cropper has to work from the keyboard and with a screen reader, when visitors straighten photos and no corner of the saved crop may be empty, or when you want parts for the dial, zoom slider, aspect picker, rotate and flip buttons instead of building them. zriz takes a `File` as `src` and returns a JPEG, PNG or WebP blob. It is new. Its first release was in November 2026, it has one maintainer and under a thousand downloads a week."
      )
    ),
    section(
      "Numbers",
      table({
        columns: [
          column("Fact", "prose", { width: 150 }),
          column("react-advanced-cropper", "prose"),
          column("zriz", "prose"),
        ],
        rows: [
          ["First release", "2021", "November 2026"],
          ["npm downloads a week", "250k+", "Under 1,000"],
          ["GitHub stars", "880+", "Under 100"],
          ["Licence", "MIT", "MIT"],
          [
            "Dependencies",
            "3: `advanced-cropper`, `classnames`, `tslib`",
            "None",
          ],
          ["React", "16.8 and newer", "18.2 and 19"],
          ["Size", "About 24 kB", "26 to 34 kB"],
        ],
      }),
      p(
        "Size is minified JavaScript and CSS, compressed with Brotli, without React. For react-advanced-cropper it is the basic example from its docs, built with esbuild. That example reads a canvas on every change, and its stylesheet is about 1 kB of the total. For zriz it depends on the parts you import: about 26 kB for `Root`, `Viewport`, `Image`, `Mask` and `Area`, and about 34 kB with every part. Up to 6 kB more loads later, for export, sharpening and SVG. We measured the zriz sets with Rolldown, and esbuild makes them up to about 16% larger. [Bundle size](bundle-size) has each set. `@zriz/react` needs `@zriz/core` and React as peers."
      )
    ),
    section(
      "Features",
      compare(
        ["react-advanced-cropper", "zriz"],
        [
          [
            "Crop box with handles",
            ["yes", "Four corners and four edges"],
            ["yes", "Four corners and four edges"],
          ],
          [
            "Photo moves under the frame",
            ["yes", "Drag outside the box, or `FixedCropper`"],
            ["yes"],
          ],
          [
            "Aspect ratio",
            ["yes", "Free, one ratio or a range"],
            ["yes", "Free, original or any ratio"],
          ],
          [
            "Round crop",
            ["partly", "Round mask, the canvas stays square"],
            ["yes", "Mask and export"],
          ],
          [
            "Zoom",
            ["yes", "Wheel, pinch and `zoomImage`"],
            ["yes", "Pinch, Ctrl + wheel, slider part, keys"],
          ],
          [
            "Straighten (free rotation)",
            ["yes", "Any angle, no dial part"],
            ["partly", "45° each way plus quarter turns"],
          ],
          [
            "Crop stays inside the photo at an angle",
            [
              "partly",
              "Not by default. The core's `fitStencilToImage`, passed as `postProcess`, does it",
            ],
            ["yes", "The crop shrinks to fit"],
          ],
          [
            "Quarter turns and flip",
            ["yes", "Animated, through ref methods"],
            ["yes", "Animated"],
          ],
          [
            "Touch gestures",
            ["yes", "Pan, pinch, handles, twist when enabled"],
            ["yes", "Pan, pinch, twist, two handles at once"],
          ],
          [
            "Keyboard",
            ["no"],
            ["yes", "Crop area, dial, zoom and ratio group; handles no"],
          ],
          [
            "Screen reader",
            ["no"],
            ["partly", "Roles and live region; you write the labels"],
          ],
          [
            "Image export",
            ["partly", "A canvas, you call `toBlob`"],
            ["yes", "JPEG, PNG or WebP blob"],
          ],
          [
            "Saved crop",
            ["yes", "Pixel coordinates and transforms through default props"],
            ["yes", "Fractions of the photo, restores exactly"],
          ],
          [
            "Ready-made UI",
            ["partly", "Styled crop surface and five themes"],
            ["no", "Unstyled parts and an optional stylesheet"],
          ],
        ]
      ),
      p(
        "The `No` cells for keyboard and screen reader come from a search of the published 0.20.1 bundle and both source trees for `tabIndex`, key handlers, `focus`, `role`, `aria-` and `alt`. None of them matched. In Chromium, Tab reached no element inside the cropper."
      ),
      p(
        "For zriz, the crop stays inside the photo in the saved value and the exported file. While a finger pulls the photo past an edge, the background shows until release."
      )
    ),
    section(
      "What you will notice",
      p(
        "A drag does different things. By its source, in react-advanced-cropper a drag that starts inside the box moves the box, and a drag that starts outside it pans the photo, because the stencil [stops the event](https://github.com/advanced-cropper/react-advanced-cropper/blob/4dd2822/src/components/service/DraggableElement.tsx) before the background sees it. In zriz every drag on the photo pans it under the crop. After a handle drag the crop moves back to the centre 300 ms after release. If your design is a selection box on a still photo, react-advanced-cropper does that by default and zriz has no mode for it."
      ),
      p(
        "A free angle can leave empty corners in react-advanced-cropper. Its limits measure against the [bounding box of the rotated photo](https://github.com/advanced-cropper/advanced-cropper/blob/b1a9186/src/defaults/defaultPositionRestrictions.ts), so the box can cover the triangles between that box and the photo. In Chromium, at 15° with the default box, two corners of its exported PNG were transparent. At the same angle zriz shrank the crop to 74% of the photo's width and height, about 55% of its area, and all four corners of its exported JPEG held photo pixels. Its docs [recommend multiples of 90](https://advanced-cropper.github.io/react-advanced-cropper/docs/guides/advanced-recipes/). The core does ship `fitStencilToImage` in `advanced-cropper/showcase/mobile`, built on its `fit-to-image` helpers. Passed as `postProcess` it keeps the crop inside, and the same author's `react-mobile-cropper` does that. zriz shrinks the crop to fit at every angle, and its straighten angle stops at 45° each way."
      ),
      p(
        'The wheel zooms in one and pans in the other. In react-advanced-cropper each wheel event zooms by a fixed 10%, with or without Ctrl. Its handler calls `preventDefault`, so the page does not scroll while the pointer is over the cropper, which its docs [describe](https://advanced-cropper.github.io/react-advanced-cropper/docs/guides/advanced-recipes/). In zriz a plain wheel pans the photo and Ctrl + wheel zooms. `wheel="zoom"` on `Viewport` makes every wheel event zoom.'
      ),
      p(
        "The two libraries ship different halves of an editor. react-advanced-cropper ships a painted crop surface that works after one CSS import, with five themes and a `CropperPreview` part. Your app writes the zoom slider, rotate and flip buttons, any angle dial and the aspect picker. zriz ships those controls as unstyled parts with roles and keys, plus an optional stylesheet of about 1 kB for the frame, handles, grid and dial. Your app writes the layout, the slider and button styles and every label."
      ),
      p(
        "Export hands you different things. `getCanvas()` runs on the main thread and returns an `HTMLCanvasElement` at once, or `null` before the image loads. You call `toBlob` on it or draw on it yourself. `exportCrop` is async, takes a `type`, a `quality` and a `maxSize`, and resolves an object with the blob. It runs in a worker by default and falls back to the main thread where workers or `OffscreenCanvas` are missing or blocked. zriz gives you no canvas."
      )
    ),
    section(
      "Migrate from react-advanced-cropper",
      p(
        "zriz has no equivalent for a selection box that moves over a still photo, aspect ratio ranges, a largest crop size or size limits as a function, crops that extend past the photo with a fill colour, custom stencil components, replaceable move, resize and transform algorithms, a frame size in screen pixels as in `FixedCropper`, a view that zooms apart from the crop, the coordinates-only mode its docs describe for images from a server without CORS headers, a preview part, a CommonJS or script tag build, browsers older than the zriz [FAQ](faq) lists, or React 16.8 and 17. If the project depends on one of these, stay."
      ),
      entries([
        {
          text: "`Root src` with `Viewport`, `Image`, `Mask` and `Area` inside",
          title: "`<Cropper src>`",
        },
        {
          text: "`@zriz/react/styles.css`, optional",
          title: "`react-advanced-cropper/dist/style.css`",
        },
        {
          text: '`shape="circle"` on `Root`',
          title: "`stencilComponent={CircleStencil}`",
        },
        {
          text: "`aspect` on `Root`",
          title: "`stencilProps.aspectRatio` as a number",
        },
        {
          text: "Render the `Handle` parts you want",
          title: "`stencilProps.handlers`",
        },
        { text: "`Grid` inside `Area`", title: "`stencilProps.grid`" },
        {
          text: "No equivalent, a drag pans the photo",
          title: "`stencilProps.movable`",
        },
        { text: "`minSize` on `Root`", title: "`minWidth`, `minHeight`" },
        {
          text: "`defaultValue` on `Root`",
          title: "`defaultCoordinates`, `defaultTransforms`",
        },
        {
          text: '`wheel` on `Viewport`: `"pan"`, `"zoom"` or `"none"`',
          title: "`backgroundWrapperProps.scaleImage.wheel`",
        },
        {
          text: "`rotateGesture` on `Viewport`, on by default",
          title: "`backgroundWrapperProps.rotateImage`",
        },
        { text: "`actionsRef` on `Root`", title: "`ref` with `CropperRef`" },
        {
          text: "`getPixelCrop()?.pixelRect`, in the upright original, `null` at a straighten angle",
          title: "`getCoordinates()`",
        },
        {
          text: "`rotation`, `quarterTurns` and `mirrored` on the value",
          title: "`getTransforms()`",
        },
        {
          text: "`getValue()`, `setValue()` or the `value` prop",
          title: "`getState()`, `setState()`",
        },
        {
          text: "`exportCrop(cropper, { type, quality, maxSize })`",
          title: "`getCanvas()` then `toBlob`",
        },
        {
          text: "`setZoom(getZoom() * factor)` or `Zoom`",
          title: "`zoomImage(factor)`",
        },
        {
          text: '`rotate90("cw")`, `rotate90()`',
          title: "`rotateImage(90)`, `rotateImage(-90)`",
        },
        {
          text: "`setRotation(getValue().rotation + angle)` within 45° each way, or `Dial`",
          title: "`rotateImage(angle)` at a free angle",
        },
        {
          text: '`flip()`, `flip("y")`',
          title: "`flipImage(true, false)`, `flipImage(false, true)`",
        },
        { text: "`reset()` or `Reset`", title: "`reset()`" },
        { text: "Nothing to call", title: "`refresh()`" },
        { text: "`onValueChange`", title: "`onChange`" },
        {
          text: "`onValueCommit`",
          title: "`onInteractionEnd`, `onMoveEnd`, `onResizeEnd`",
        },
        { text: "`onLoad`, `onError`", title: "`onReady`, `onError`" },
        { text: "`disabled`", title: "`disabled`" },
      ]),
      p(
        'Apps usually store `getCoordinates()` and `getTransforms()`. That is a rectangle in pixels of the natural image, measured from the top left of the bounding box of the rotated image, plus `rotate` in degrees clockwise and two flip booleans. zriz ships no importer, so the app converts once. Add 180 to `rotate` when the vertical flip is on. The nearest multiple of 90 becomes the quarter turns and the remainder becomes the straighten angle. The mirror is on when exactly one of the two flips is on. The crop centre is `left + width / 2` and `top + height / 2`, minus half the bounding box. Build a state of `{ image, turns, angle, flip, crop: { x, y, width, height }, aspect, perspective }`, where `image` is the natural size and `crop` holds that centre. Our script set `aspect` to `null` and `perspective` to `{ horizontal: 0, vertical: 0, focal: 1733 }` for its 2400 by 1600 test photo. `stateToValue` does not copy `focal` into the value. `stateToValue(state, "free")` from `@zriz/core` turns it into a `CropValue`.'
      ),
      p(
        'We ran this conversion in a Node script against both published cores for 10 angles and the 4 flip combinations. In all 40 cases the four crop corners landed on the same source pixels. We compared no exported files in a browser. It holds for crops that sit inside the photo and for photos without an EXIF turn. react-advanced-cropper puts an EXIF orientation into its starting `rotate` and `flip`. We did not run this conversion on a photo with an EXIF turn, so check those crops by eye. A crop saved at a free angle or with `imageRestriction="none"` can include area outside the photo, and zriz shrinks or moves it. See [value](value) for the format.'
      ),
      p(
        "Install `@zriz/react` and `@zriz/core`. Replace `<Cropper>` with the parts below and swap the stylesheet import. Move the ref to `actionsRef`, replace the `getCanvas()` and `toBlob` pair with `exportCrop`, and rename the callbacks from the table. Callbacks in zriz receive the value and a details object, not the cropper. Convert stored crops, then remove `react-advanced-cropper` and its theme imports."
      ),
      code("zriz-vs-react-advanced-cropper/after.tsx"),
      p(
        'This is the default `Cropper` rebuilt: a free crop box with eight handles over a photo from a URL, and a save button that hands `onSave` a JPEG. `wheel="zoom"` keeps the wheel zooming and `rotateGesture={false}` keeps the two-finger twist off, as in react-advanced-cropper\'s defaults. A drag inside the box still pans the photo. The app writes the size of the viewport, the button styles, the two messages and the label on `Area`. To add a zoom slider, a dial or rotate buttons, see [full editor](full-editor).'
      )
    ),
    section(
      "How we checked",
      p(
        "We installed the published npm package at the version above and read its source and docs, plus the source of `react-mobile-cropper` for the one sentence about it. Then we ran both libraries in headless Chromium with the same photo and the same script: tab order, keys, ARIA attributes, mouse, wheel, touch and a 15° turn. We turned on `backgroundWrapperProps.rotateImage`, which is off by default, to test the twist."
      ),
      p(
        "Sources: the [repository](https://github.com/advanced-cropper/react-advanced-cropper), the [core repository](https://github.com/advanced-cropper/advanced-cropper), the [docs](https://advanced-cropper.github.io/react-advanced-cropper/) and the [npm page](https://www.npmjs.com/package/react-advanced-cropper)."
      )
    ),
    section(
      "More comparisons",
      entries([
        {
          text: "Unstyled parts on a state machine, with a box that moves over the photo",
          title: "[zriz vs Ark UI](zriz-vs-ark-ui)",
        },
        {
          text: "A box over a still image, with over 4 million downloads a week",
          title: "[zriz vs react-image-crop](zriz-vs-react-image-crop)",
        },
        {
          text: "Web components that run without React, with over 2 million downloads a week",
          title: "[zriz vs Cropper.js](zriz-vs-cropperjs)",
        },
      ]),
      p("Every comparison is on the [comparison](comparison) page.")
    ),
  ],
  lede: "react-advanced-cropper is a styled React cropper with replaceable parts and algorithms, where a selection box moves over the photo. zriz is a set of unstyled parts where the photo moves under the crop and the saved crop stays inside the photo at any straighten angle.",
});

export { ZRIZ_VS_REACT_ADVANCED_CROPPER_PAGE };
