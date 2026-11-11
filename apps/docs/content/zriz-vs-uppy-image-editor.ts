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

const ZRIZ_VS_UPPY_IMAGE_EDITOR_PAGE = defineDoc({
  blocks: [
    intro(
      p(
        "We make zriz, so read this page with that in mind. It compares `@uppy/image-editor` 5.0.1 with `@zriz/react` 0.2.0. If something here is wrong, [open an issue](https://github.com/pqoqubbw/zriz/issues) and we will fix it."
      ),
      p(
        "To move a project over, paste this into Claude Code, Cursor or another coding agent:"
      ),
      prompt(
        "Migrate this project from @uppy/image-editor to zriz. Read https://zriz.dev/docs/zriz-vs-uppy-image-editor.md and follow its section on migrating. Keep the crop behaviour the same where zriz can, and list for me anything zriz has no equivalent for before you remove it."
      )
    ),
    section(
      "In short",
      p(
        'The [Uppy docs](https://uppy.io/docs/image-editor/) describe it as "Image editor. Designed to be used with the Dashboard UI." It is a plugin of the Uppy file uploader, it edits files that are already in the Uppy queue, and it wraps Cropper.js 1. A fresh install gives Cropper.js 1.7.0. Its README marks it as in beta.'
      ),
      p(
        "Pick Uppy Image Editor when the app uploads with Uppy or needs an uploader. Two `use()` calls give a toolbar with icons, Save, Cancel and English labels that the `locale` option or some locale packs replace, and the edited file takes the original's place in the upload queue. An app that already loads Uppy and the Dashboard adds about 17 kB for it. The `useImageEditor` hook in `@uppy/react` runs the editor under your own toolbar, without the Dashboard. Uppy has Dashboard components for React, Vue, Svelte and Angular. Through Cropper.js it can draw a new crop box with a drag, take a `fillColor` for any exported area outside the photo and run a `beforeDraw` hook on the export. The package has been on npm since 2020 and has over 270,000 downloads a week."
      ),
      p(
        "Pick zriz when the page needs a cropper on its own, such as an avatar or cover field in a form. zriz adds 26 to 34 kB to the bundle, against about 89 kB for Uppy's documented setup with its uploader and Dashboard, or about 36 kB for Uppy's `useImageEditor` hook without the Dashboard. The crop is a value you can save and restore, the crop area takes keys, and the photo moves under the frame with a pinch and a two-finger twist. You write the layout, the styles and every label. zriz had its first release in November 2026, has one maintainer and under a thousand downloads a week."
      )
    ),
    section(
      "Numbers",
      table({
        columns: [
          column("Fact", "prose", { width: 150 }),
          column("Uppy Image Editor", "prose"),
          column("zriz", "prose"),
        ],
        rows: [
          ["First release", "2020", "November 2026"],
          ["npm downloads a week", "270k+", "Under 1,000"],
          ["GitHub stars", "31k+, the whole Uppy repo", "Under 100"],
          ["Licence", "MIT", "MIT"],
          [
            "Dependencies",
            "Cropper.js and Preact, `@uppy/core` as a peer",
            "None, `@zriz/core` and React as peers",
          ],
          ["React", "Not needed, `@uppy/react` takes 18 and 19", "18.2 and 19"],
          ["Size", "About 89 kB, about 17 kB as a plugin", "26 to 34 kB"],
        ],
      }),
      p(
        "Size is minified JavaScript and CSS, compressed with Brotli, without React. For Uppy Image Editor it is the basic example from its docs, built with esbuild. It holds `@uppy/core`, the Dashboard with its file picker, Cropper.js and the Save code, and in an app that already loads Uppy and the Dashboard the plugin adds about 17 kB. The `useImageEditor` hook in `@uppy/react` runs the editor without the Dashboard, at about 36 kB with its stylesheet. The uppy.io pages we read do not describe it. The documented Uppy setup installs 22 packages, or 28 with `@uppy/react`. For zriz it depends on the parts you import: about 26 kB for `Root`, `Viewport`, `Image`, `Mask` and `Area`, and about 34 kB with every part. Up to 6 kB more loads later, for export, sharpening and SVG. We measured the zriz sets with Rolldown, and esbuild makes them up to about 16% larger. [Bundle size](bundle-size) has each set. `@zriz/react` needs `@zriz/core` and React as peers."
      )
    ),
    section(
      "Features",
      compare(
        ["Uppy Image Editor", "zriz"],
        [
          [
            "Crop box with handles",
            ["yes", "Four corners and four edges"],
            ["yes", "Four corners and four edges"],
          ],
          [
            "Photo moves under the frame",
            ["partly", "After a double click or by option"],
            ["yes"],
          ],
          [
            "Aspect ratio",
            ["yes", "Three ratio buttons, any ratio by option"],
            ["yes", "Free, original or any ratio"],
          ],
          [
            "Round crop",
            [
              "partly",
              "Cropper.js `borderRadius`, mask on screen not verified",
            ],
            ["yes", "Mask and export"],
          ],
          [
            "Zoom",
            ["yes", "Wheel, pinch and two toolbar buttons"],
            ["yes", "Pinch, Ctrl + wheel, slider part, keys"],
          ],
          [
            "Straighten (free rotation)",
            ["partly", "Slider 45° each way plus quarter turns"],
            ["partly", "45° each way plus quarter turns"],
          ],
          [
            "Crop stays inside the photo at an angle",
            ["partly", "Default box filled at 15° in Chromium"],
            ["yes", "The crop shrinks to fit"],
          ],
          [
            "Quarter turns and flip",
            ["yes", "Counter-clockwise turn, horizontal flip, not animated"],
            ["yes", "Animated"],
          ],
          [
            "Touch gestures",
            ["partly", "Box drag and pinch, no twist"],
            ["yes", "Pan, pinch, twist, two handles at once"],
          ],
          [
            "Keyboard",
            ["partly", "Toolbar buttons and slider; crop box no"],
            ["yes", "Crop area, dial, zoom and ratio group; handles no"],
          ],
          [
            "Screen reader",
            ["partly", "Labelled buttons; crop box has no role"],
            ["partly", "Roles and live region; you write the labels"],
          ],
          [
            "Image export",
            ["yes", "A `File`, asks for the source format"],
            ["yes", "JPEG, PNG or WebP blob"],
          ],
          [
            "Saved crop",
            ["partly", "Through Cropper.js `getData()` and `data`"],
            ["yes", "Fractions of the photo, restores exactly"],
          ],
          [
            "Ready-made UI",
            ["yes", "Toolbar, Save and Cancel in the Dashboard"],
            ["no", "Unstyled parts and an optional stylesheet"],
          ],
        ]
      ),
      p(
        "With the default box at 15°, the file Uppy exported in Chromium had no empty corner. Uppy runs Cropper.js in view mode 0 and pulls the box back inside the bounding box of the turned photo when a drag ends. That bounding box includes empty corner triangles, so the code suggests a dragged box can reach one. None of our runs showed it. In zriz the saved value and the exported file stay inside the photo. While a finger pulls the photo past an edge, the background shows until release."
      ),
      p(
        "The round crop row rests on Cropper.js 1.7.0, which cuts the exported canvas to `borderRadius`. Uppy has no option of its own for it, and a lockfile that pins Cropper.js 1.6 has none. The saved crop row rests on `plugin.cropper`, a public property that the docs page does not list. Its `getData()` returns the crop rectangle, and `cropperOptions.data` sets a starting crop. Save replaces the file, so the editor cannot reopen the original with the old crop."
      )
    ),
    section(
      "What you will notice",
      p(
        "Uppy does the whole job around the crop. The Dashboard picks the file, the editor opens on the edit button or with `autoOpen: 'imageEditor'`, and Save puts the edited file into the upload queue with no app code. zriz has no file picker, no uploader, no icons and no words. The app writes all of that."
      ),
      p(
        "The crop model differs. In Uppy a box moves and resizes over a still photo, and a drag outside the box draws a new one. A wheel turn over the editor zooms in 10% steps, at most one step per 50 ms, and the page does not scroll. In zriz a drag moves the photo under the frame, a plain wheel pans it and Ctrl + wheel zooms."
      ),
      p(
        "Straighten zooms the photo in both. Uppy takes the factor from the photo and the angle and ignores the crop box, so a small crop zooms as much as a full one. A 2400 by 1600 photo at 15° scaled by 1.354 in Chromium. The function is in [getScaleFactorThatRemovesDarkCorners.ts](https://github.com/transloadit/uppy/blob/%40uppy/image-editor%405.0.1/packages/%40uppy/image-editor/src/utils/getScaleFactorThatRemovesDarkCorners.ts). zriz shrinks the crop by the least that keeps its four corners on the photo. A quarter turn in Uppy sets the slider back to 0 and the crop box back to the whole image, see `rotateBy` in [ImageEditor.tsx](https://github.com/transloadit/uppy/blob/%40uppy/image-editor%405.0.1/packages/%40uppy/image-editor/src/ImageEditor.tsx). In zriz the crop turns with the photo."
      ),
      p(
        "From the keyboard, Uppy's toolbar works as native buttons and one range input, and the Dashboard keeps Tab inside the open editor. The crop box is not a tab stop and takes no keys. The straighten slider and the quarter turn button share the label Rotate 90°. Nothing announces a crop change. In zriz the crop area is one tab stop with arrow, zoom and reset keys, and a live region can speak each change. The handles take no keys, and the app writes every label."
      ),
      p(
        "Save in Uppy replaces the file with the cropped image. It asks the browser for the source format at quality 0.8, which Chromium gave for a WebP photo, and it runs on the main thread. We did not run GIF or BMP. The editor keeps no crop, so opening it again starts from the cropped result. zriz keeps the original and hands back a value. It makes a file when you call `exportCrop`, in a worker by default, with a fallback to the main thread where workers or OffscreenCanvas are missing or blocked."
      )
    ),
    section(
      "Migrate from Uppy Image Editor",
      p(
        "zriz has no equivalent for the uploader, so it replaces the editor and not Uppy. It has no finished toolbar and no language packs. It has no official Vue, Svelte or Angular components. A crop cannot extend past the photo, so there is no `fillColor`. The export has no `beforeDraw` hook, no rounded rectangle or ellipse, and no scaling up to an exact `width` and `height`. The zriz docs describe no way to draw a new crop box with a drag."
      ),
      entries([
        {
          text: "`Cropper.Root` with `src={file}` and `Viewport`, `Image`, `Mask`, `Area`, `Handle`",
          title: "`uppy.use(ImageEditor)` inside the Dashboard",
        },
        {
          text: "Render the cropper when your state holds a file",
          title: "Dashboard `autoOpen: 'imageEditor'`",
        },
        { text: "`Cropper.Reset`", title: "`actions.revert`" },
        {
          text: "`Cropper.Rotate`, counter-clockwise by default",
          title: "`actions.rotate`",
        },
        {
          text: "`Cropper.Dial`, same range",
          title: "`actions.granularRotate`",
        },
        { text: "`Cropper.Flip`", title: "`actions.flip`" },
        {
          text: "`Cropper.ZoomStep` with a `factor`, or `Cropper.Zoom`",
          title: "`actions.zoomIn`, `actions.zoomOut`",
        },
        {
          text: "`Cropper.AspectItem` with `value={1}`, `{16 / 9}`, `{9 / 16}`",
          title:
            "`actions.cropSquare`, `cropWidescreen`, `cropWidescreenVertical`",
        },
        { text: "`quality` in the `exportCrop` options", title: "`quality`" },
        { text: "`aspect` on `Root`", title: "`cropperOptions.aspectRatio`" },
        {
          text: "No prop for it. `defaultValue` on `Root` with a `size` sets the first crop and leaves the ratio free",
          title: "`cropperOptions.initialAspectRatio`",
        },
        {
          text: "`minSize` on `Root`, source pixels",
          title:
            "`cropperOptions.minCropBoxWidth`, `minCropBoxHeight`, page pixels",
        },
        {
          text: "`wheel` on `Viewport`",
          title: "`cropperOptions.zoomOnWheel`",
        },
        {
          text: '`shape="circle"` on `Root`, a circle and no other shape',
          title: "`cropperOptions.borderRadius`",
        },
        {
          text: "`value` or `defaultValue` on `Root`",
          title: "`cropperOptions.data`",
        },
        {
          text: "`onValueChange`, `onValueCommit`",
          title: "`cropperOptions.crop`, `cropend`",
        },
        {
          text: "`maxSize` in the `exportCrop` options",
          title: "`croppedCanvasOptions.maxWidth`, `maxHeight`",
        },
        {
          text: "The render of your cropper. `onLoad` on `Root` fires later, when the photo is ready",
          title: "`file-editor:start`",
        },
        {
          text: "Your button that calls `exportCrop`",
          title: "Save, `file-editor:complete`",
        },
        { text: "Your button", title: "Cancel, `file-editor:cancel`" },
        {
          text: "`aria-label` and children on each part",
          title: "`locale.strings`",
        },
        { text: "`getValue()`", title: "`plugin.cropper.getData()`" },
      ]),
      p(
        "Uppy saves no crop, so most apps have nothing to convert. An app that stored the result of `plugin.cropper.getData()` has a rectangle in pixels plus `rotate`, `scaleX` and `scaleY`. zriz has no importer for it. With `rotate` at 0 and both scales at 1 the rectangle is in source pixels, and [value](value) describes the fractions zriz stores. We did not check the conversion with a rotation or a flip."
      ),
      p(
        "Take the file from your own input or from Uppy and pass it to `Root` as `src`. Build the toolbar from the parts in the table. Call `exportCrop` in your Save button. To keep Uppy as the uploader, write the result back the way the plugin does. Call `uppy.setFileState(id, { data: file, size: file.size, preview: undefined })`, then `uppy.emit('thumbnail:request', uppy.getFile(id))`. Remove `@uppy/image-editor` and its stylesheet last."
      ),
      code("zriz-vs-uppy-image-editor/after.tsx"),
      p(
        "The component has the same controls as Uppy's toolbar, with Uppy's default English labels on the buttons. Three controls differ. It adds a Free ratio button, where Uppy returns to free through Reset. `Reset` stays hidden until the crop changes. The dial has the label Straighten. A plain wheel zooms, as in Uppy, and the step size is zriz's own. Save returns a `File` with the old name at quality 0.8. JPEG and PNG keep their format, WebP keeps it where the browser can write WebP, and any other type comes out as JPEG, so rename the file when the type changes. The app still writes the layout, the styles for every button and the ratio group, icons if it wants them, and translations. Blocks for shadcn/ui are on the [shadcn](shadcn) page."
      )
    ),
    section(
      "How we checked",
      p(
        "We installed the published npm package at the version above and read its source and docs. Then we ran both libraries in headless Chromium with the same photo and the same script: tab order, keys, ARIA attributes, mouse, wheel, touch and a 15° turn. Uppy ran inside an inline Dashboard through `@uppy/react` 6.1.1 with `@uppy/core` 6.3.1 and `@uppy/dashboard` 6.0.3."
      ),
      p(
        "Uppy: [repository](https://github.com/transloadit/uppy), [image editor docs](https://uppy.io/docs/image-editor/), [npm page](https://www.npmjs.com/package/@uppy/image-editor)."
      )
    ),
    section(
      "More comparisons",
      entries([
        {
          text: "Cropper.js 2, the rewrite of the library Uppy's editor wraps in version 1",
          title: "[zriz vs Cropper.js](zriz-vs-cropperjs)",
        },
        {
          text: "Cropper.js 1.7.0, the version Uppy's editor wraps, as a React component with no uploader",
          title: "[zriz vs react-cropper](zriz-vs-react-cropper)",
        },
        {
          text: "Another cropper that opens from an upload component, for Ant Design",
          title: "[zriz vs antd-img-crop](zriz-vs-antd-img-crop)",
        },
      ]),
      p("Every comparison is on the [comparison](comparison) page.")
    ),
  ],
  lede: "Uppy Image Editor is a plugin of the Uppy file uploader that crops files in its Dashboard with a ready toolbar. zriz is a set of unstyled React parts for a cropper that you lay out and label yourself.",
});

export { ZRIZ_VS_UPPY_IMAGE_EDITOR_PAGE };
