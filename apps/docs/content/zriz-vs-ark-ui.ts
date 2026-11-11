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

const ZRIZ_VS_ARK_UI_PAGE = defineDoc({
  blocks: [
    intro(
      p(
        "We make zriz, so read this page with that in mind. It compares `@ark-ui/react` 5.40.0 with `@zag-js/image-cropper` 1.47.0 with `@zriz/react` 0.2.0. If something here is wrong, [open an issue](https://github.com/pqoqubbw/zriz/issues) and we will fix it."
      ),
      p(
        "To move a project over, paste this into Claude Code, Cursor or another coding agent:"
      ),
      prompt(
        "Migrate this project from the Ark UI Image Cropper in @ark-ui/react to zriz. Read https://zriz.dev/docs/zriz-vs-ark-ui.md and follow its section on migrating. Keep the crop behaviour the same where zriz can, and list for me anything zriz has no equivalent for before you remove it."
      )
    ),
    section(
      "In short",
      p(
        'Ark UI describes its Image Cropper as "Crop and transform images with zoom, rotation, and aspect ratio controls." It is a set of unstyled parts in `@ark-ui/react` on top of the `@zag-js/image-cropper` state machine, and the [Ark UI docs](https://ark-ui.com/docs/components/image-cropper) mark it "preview". The machine first shipped in October 2025.'
      ),
      p(
        "Pick Ark UI when the app already uses Ark UI or Chakra UI 3, because `@chakra-ui/react` 3.38.0 depends on `@ark-ui/react` and the cropper is already installed. Pick it for Solid, Vue or Svelte, where Ark UI ships the same component, or for React 18.0 or 18.1 or a CommonJS build. Pick it when the user drags a frame across a still photo, when a rotated crop may keep clear corners, or when you want English screen reader labels without writing them. Pick it for one angle past 45°, a maximum crop size, key steps in pixels or a data URL from the export call. Pick it when size comes first, at about 16 kB against 26 to 34 kB for zriz."
      ),
      p(
        "Pick zriz when the saved crop and the file must stay inside the photo, because zriz shrinks the crop to fit when the photo tilts. Pick it when you want a straighten dial, a two-finger twist, a zoom slider and rotate, flip and reset buttons as parts, a round file, or a saved crop that restores in a viewport of any size. zriz is new and little used. Its first release was in November 2026. It has one maintainer, versions at 0.x and under a thousand downloads a week, against over 1 million for `@ark-ui/react`."
      )
    ),
    section(
      "Numbers",
      table({
        columns: [
          column("Fact", "prose", { width: 150 }),
          column("Ark UI", "prose"),
          column("zriz", "prose"),
        ],
        rows: [
          [
            "First release",
            "October 2025, as `@zag-js/image-cropper`",
            "November 2026",
          ],
          [
            "npm downloads a week",
            "1.4M+, all of `@ark-ui/react`",
            "Under 1,000",
          ],
          ["GitHub stars", "5.4k+, the Ark UI repo", "Under 100"],
          ["Licence", "MIT", "MIT"],
          [
            "Dependencies",
            "69 direct, 89 packages installed",
            "None, `@zriz/core` and React are peers",
          ],
          ["React", "18.0 and newer", "18.2 and 19"],
          ["Size", "About 16 kB", "26 to 34 kB"],
        ],
      }),
      p(
        "Size is minified JavaScript and CSS, compressed with Brotli, without React. For Ark UI it is the basic example from its docs, built with esbuild. Ark UI ships no CSS, so its number counts the stylesheet that the example imports, about 1 kB of the total. For zriz it depends on the parts you import: about 26 kB for `Root`, `Viewport`, `Image`, `Mask` and `Area`, and about 34 kB with every part. Up to 6 kB more loads later, for export, sharpening and SVG. We measured the zriz sets with Rolldown, and esbuild makes them up to about 16% larger. [Bundle size](bundle-size) has each set. `@zriz/react` needs `@zriz/core` and React as peers."
      ),
      p(
        "The download count is for the whole `@ark-ui/react` package, which holds every Ark UI component. It does not say how many projects render the cropper. The 89 packages are the tree of all of `@ark-ui/react`, most of them for other components. The machine with `@zag-js/react` alone installs 10, and the Size row shows what reaches the browser."
      )
    ),
    section(
      "Features",
      compare(
        ["Ark UI", "zriz"],
        [
          [
            "Crop box with handles",
            ["yes", "Four corners and four edges"],
            ["yes", "Four corners and four edges"],
          ],
          [
            "Photo moves under the frame",
            ["yes", "Once zoomed or rotated, or with `fixedCropArea`"],
            ["yes"],
          ],
          [
            "Aspect ratio",
            ["yes", "Free or any ratio"],
            ["yes", "Free, original or any ratio"],
          ],
          [
            "Round crop",
            [
              "partly",
              "A square frame you round with CSS; the file is a rectangle",
            ],
            ["yes", "Mask and export"],
          ],
          [
            "Zoom",
            ["yes", "Wheel, pinch, keys and API"],
            ["yes", "Pinch, Ctrl + wheel, slider part, keys"],
          ],
          [
            "Straighten (free rotation)",
            ["partly", "Any angle by prop or API"],
            ["partly", "45° each way plus quarter turns"],
          ],
          [
            "Crop stays inside the photo at an angle",
            ["no", "The export had clear corners at 15°"],
            ["yes", "The crop shrinks to fit"],
          ],
          [
            "Quarter turns and flip",
            ["partly", "By API; the box keeps its shape"],
            ["yes", "Animated"],
          ],
          [
            "Touch gestures",
            ["partly", "Pan and pinch; no twist"],
            ["yes", "Pan, pinch, twist, two handles at once"],
          ],
          [
            "Keyboard",
            ["yes", "Move, resize and zoom; handles no"],
            ["yes", "Crop area, dial, zoom and ratio group; handles no"],
          ],
          [
            "Screen reader",
            ["yes", "Roles, live region and English labels"],
            ["partly", "Roles and live region; you write the labels"],
          ],
          [
            "Image export",
            ["yes", "Blob or data URL, PNG by default"],
            ["yes", "JPEG, PNG or WebP blob"],
          ],
          [
            "Saved crop",
            ["partly", "In viewport pixels; nothing sets the pan"],
            ["yes", "Fractions of the photo, restores exactly"],
          ],
          [
            "Ready-made UI",
            ["no", "Unstyled parts and no stylesheet"],
            ["no", "Unstyled parts and an optional stylesheet"],
          ],
        ]
      ),
      p(
        "Rotation in Ark UI is a number. No part, gesture or key changes it, so the app builds the control and calls `setRotation` or `rotateBy`. We ran neither library with a screen reader for this page, so the two screen reader cells describe the markup."
      )
    ),
    section(
      "What you will notice",
      p(
        "A drag inside the frame does different things. In Ark UI it moves the frame across the photo. The photo moves by a drag on the viewport outside the frame, once the user zooms, because at zoom 1 with no rotation there is nowhere to pan. In zriz the same drag moves the photo under the frame, the handles resize the frame, and 300 ms after the gesture the crop returns to the centre of the viewport. Ark UI's `fixedCropArea` gives a fixed frame over a moving photo and turns the handles off."
      ),
      p(
        'The wheel zooms in Ark UI and pans in zriz. Ark UI turns each wheel event over the viewport into one `zoomStep`, 0.1 by default, and calls `preventDefault()` on it, see [image-cropper.machine.ts](https://github.com/chakra-ui/zag/blob/@zag-js/image-cropper@1.47.0/packages/machines/image-cropper/src/image-cropper.machine.ts). No prop turns that off, so the page does not scroll while the pointer is over the viewport. zriz pans on a plain wheel and zooms on Ctrl + wheel, and it also keeps the wheel from the page while it pans or zooms. `wheel="zoom"` on `Viewport` makes a plain wheel zoom as it does in Ark UI, and `wheel="none"` leaves a plain wheel to the page.'
      ),
      p(
        "A tilt leaves the frame alone in Ark UI. The photo turns about its centre and the selection keeps its place, so part of it can fall outside the photo. In Chromium, a 15° turn with the default selection gave a PNG with two transparent corners. zriz shrinks the crop until all four corners sit on the photo and stops at 45° each way. If you want clear corners in the file, Ark UI does that and zriz cannot."
      ),
      p(
        'Ark UI names its parts for a screen reader and zriz leaves the words to you. The Ark UI selection is one tab stop with the label "Crop selection area (rectangle)", a value text with its position and size, and a description of the keys, all in English and all replaceable through `translations`. zriz ships no words, so the app writes each `aria-label`, the `Instructions` text and what `Announcer` says. axe reported no findings for either setup in Chromium.'
      ),
      p(
        "Ark UI stretches the image to its box. The machine sets `object-fit: fill` inline on the image, see [image-cropper.connect.ts](https://github.com/chakra-ui/zag/blob/@zag-js/image-cropper@1.47.0/packages/machines/image-cropper/src/image-cropper.connect.ts), so the app gives the viewport the photo's own aspect ratio. zriz measures the photo, and its `Viewport` needs a height and can have another shape."
      )
    ),
    section(
      "Migrate from Ark UI",
      p(
        "zriz has no equivalent for these, so check them first. It needs React 18.2 or newer and ships ES modules with no CommonJS build, where Ark UI takes React 18.0 and ships both. It has no Solid, Vue or Svelte components. It cannot hold a crop with empty area, such as a rotated photo with clear corners. It has no single angle past 45°, where Ark UI's `rotation` prop takes any number. A pointer cannot drag the frame across a still photo. It has no `maxWidth` or `maxHeight`, no key steps in pixels like `nudgeStep`, no `zoomStep`, no default labels and no data URL from the export call."
      ),
      entries([
        {
          text: "`Cropper.Root`, which takes `src`",
          title: "`ImageCropper.Root`",
        },
        {
          text: "`Cropper.Viewport`, with a height",
          title: "`ImageCropper.Viewport`",
        },
        {
          text: "`Cropper.Image`, `src` on `Root`; a `File` or `Blob` goes in as it is",
          title: "`ImageCropper.Image` with `src`",
        },
        {
          text: "`Cropper.Area` plus `Cropper.Mask` for the dimmed overlay",
          title: "`ImageCropper.Selection`",
        },
        {
          text: '`Cropper.Handle position="top-left"`; `n` is `top`, `e` is `right`',
          title: '`ImageCropper.Handle position="nw"`',
        },
        { text: "One `Cropper.Grid`", title: "Two `ImageCropper.Grid` parts" },
        {
          text: "`Cropper.Root cropper={useCropper()}`",
          title: "`RootProvider` with `useImageCropper`",
        },
        {
          text: "`actionsRef` on `Root`, or the hooks from `@zriz/react`",
          title: "`ImageCropper.Context`, `useImageCropperContext`",
        },
        {
          text: '`aspect`, also `"free"` and `"original"`',
          title: "`aspectRatio`",
        },
        {
          text: '`shape="circle"`, which also rounds the file',
          title: '`cropShape="circle"`',
        },
        {
          text: "No prop. Leave out `Handle`; Alt + arrows still resize",
          title: "`fixedCropArea`",
        },
        {
          text: "`defaultValue`. `initialCrop` is in viewport pixels, so read `getCropData()` for it and convert as below",
          title: "`initialCrop`",
        },
        {
          text: "`minSize` in source pixels",
          title: "`minWidth`, `minHeight` in viewport pixels",
        },
        { text: "None. zriz zoom starts at 1", title: "`minZoom`" },
        {
          text: "`maxZoom`, default 15, counted from the largest crop and not from the image scale",
          title: "`maxZoom`, default 5",
        },
        { text: "`zoom`, `onValueChange`", title: "`zoom`, `onZoomChange`" },
        {
          text: "`rotation` up to 45° each way, `quarterTurns` in the value for the rest",
          title: "`rotation`, `onRotationChange`",
        },
        {
          text: "`mirrored` in the value; a vertical flip is `mirrored` with two quarter turns",
          title: "`flip`, `onFlipChange`",
        },
        {
          text: "`onValueChange`, and `onValueCommit` when a gesture ends",
          title: "`onCropChange`",
        },
        {
          text: "`aria-label` on each part, `Cropper.Instructions`, `Cropper.Announcer`",
          title: "`translations`",
        },
        { text: "`cropper.setZoom`", title: "`api.setZoom`, `api.zoomBy`" },
        {
          text: '`cropper.setRotation`, `cropper.rotate90("cw")`',
          title: "`api.setRotation`, `api.rotateBy(90)`",
        },
        {
          text: '`cropper.flip()`, `cropper.flip("y")`',
          title: "`api.flipHorizontally`, `api.flipVertically`",
        },
        { text: "`cropper.setValue`", title: "`api.setCrop`" },
        {
          text: "`cropper.reset`, or the `Cropper.Reset` part",
          title: "`api.reset`",
        },
        {
          text: "`cropper.getValue`, `cropper.getPixelCrop`",
          title: "`api.getCropData`",
        },
        {
          text: "`exportCrop` from `@zriz/core/dom`, which rejects where Ark UI resolves `null`",
          title: "`api.getCroppedImage`",
        },
        {
          text: "`Cropper.Zoom`, `Cropper.Dial`, `Cropper.Rotate`, `Cropper.Flip`, `Cropper.AspectGroup`",
          title: "Your buttons for zoom, rotate, flip and aspect",
        },
      ]),
      p(
        "Saved crops need a conversion, and zriz has no importer. If the app stored the result of `api.getCropData()`, a zriz `CropValue` comes from its `corners`, `rotate`, `flipX` and `flipY` and the photo's natural size `W` by `H`. Set `total = rotate + (flipY ? 180 : 0)`, `steps = Math.round(total / 90)`, `quarterTurns = ((steps % 4) + 4) % 4`, `rotation = total - steps * 90` and `mirrored = flipX !== flipY`. Take `m`, the mean of the four corners minus `{ x: W / 2, y: H / 2 }`, and negate `m.x` when `mirrored`. Turn `m` by `total` degrees: `c.x = cos * m.x - sin * m.y` and `c.y = sin * m.x + cos * m.y`. With `w` the distance from `topLeft` to `topRight`, `h` the distance from `topLeft` to `bottomLeft`, and `Wt` by `Ht` the photo's size, swapped when `quarterTurns` is odd, the value has `center: { x: 0.5 + c.x / Wt, y: 0.5 + c.y / Ht }` and `size: { width: w / Wt, height: h / Ht }`."
      ),
      p(
        "We checked this by running code on eight states with zoom, pan, flips and angles of 10°, 20°, 100°, 200° and 280°. zriz kept each value unchanged, and the source corners of its export plan matched Ark UI's `corners` within 0.5 px. It holds when the image box had the photo's aspect ratio at the time of saving and the crop lies inside the photo. zriz moves or shrinks a crop that reaches outside. `aspect` is not in Ark UI's data, so take it from your `aspectRatio` prop. If the app stored `api.crop`, `api.zoom` and `api.offset`, the crop and the offset are viewport pixels, and they need the viewport size they were saved with."
      ),
      p(
        "Run `pnpm add @zriz/react @zriz/core` and import `@zriz/react/styles.css`. Swap the parts by the table and move `src` from the image to `Root`. Delete the CSS that gave the viewport the photo's aspect ratio and the code that made an object URL for a picked file. Replace `getCroppedImage` with `exportCrop`, and catch its error where the old code tested for `null`. Write an `aria-label` for each part. Remove `@ark-ui/react` when no other component uses it."
      ),
      code("zriz-vs-ark-ui/after.tsx"),
      p(
        "This is Ark UI's Basic example in zriz: a crop with eight handles and a grid, `wheel=\"zoom\"` so the wheel still zooms, `maxZoom={5}`, and a PNG at the crop's size in source pixels, as `getCroppedImage` gives by default. Past zriz's export size limit the file comes out scaled down with `scaled: true`. The 5 is the same number as Ark UI's default, but the scales differ. Ark UI scales the image under a frame that can still shrink, and zriz counts from the largest crop and stops the handles there too. Raise it or leave it out if users crop small details. The stylesheet paints the mask, frame, handles and grid. The app still writes the layout, the styles for the button and for any zoom slider or rotate buttons it adds, and every label."
      )
    ),
    section(
      "How we checked",
      p(
        "We installed the published npm packages at the versions above and read their source and the Ark UI and Zag docs. We took the counts and dates from the npm registry and GitHub. Then we ran both libraries in headless Chromium with the same photo and the same script: tab order, keys, ARIA attributes, mouse, wheel, touch and a 15° turn."
      ),
      p(
        "Ark UI: [repo](https://github.com/chakra-ui/ark), [docs](https://ark-ui.com/docs/components/image-cropper), [npm](https://www.npmjs.com/package/@ark-ui/react). The machine under it: [Zag repo](https://github.com/chakra-ui/zag), [Zag docs](https://zagjs.com/components/react/image-cropper), [npm](https://www.npmjs.com/package/@zag-js/image-cropper)."
      )
    ),
    section(
      "More comparisons",
      entries([
        {
          text: "Over 4 million downloads a week",
          title: "[zriz vs react-image-crop](zriz-vs-react-image-crop)",
        },
        {
          text: "Another cropper whose export had transparent corners at 15°",
          title:
            "[zriz vs react-advanced-cropper](zriz-vs-react-advanced-cropper)",
        },
        {
          text: "The most downloaded cropper for React, over 5 million a week",
          title: "[zriz vs react-easy-crop](zriz-vs-react-easy-crop)",
        },
      ]),
      p("Every comparison is on the [comparison](comparison) page.")
    ),
  ],
  lede: "Ark UI Image Cropper is a set of unstyled React parts on the Zag state machine, with a frame the user drags over the photo. zriz moves the photo under the frame and keeps the crop inside the photo when it tilts.",
});

export { ZRIZ_VS_ARK_UI_PAGE };
