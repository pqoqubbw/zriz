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

const ZRIZ_VS_ANTD_IMG_CROP_PAGE = defineDoc({
  blocks: [
    intro(
      p(
        "We make zriz, so read this page with that in mind. It compares `antd-img-crop` 4.30.0 with `@zriz/react` 0.2.0. If something here is wrong, [open an issue](https://github.com/pqoqubbw/zriz/issues) and we will fix it."
      ),
      p(
        "To move a project over, paste this into Claude Code, Cursor or another coding agent:"
      ),
      prompt(
        "Migrate this project from antd-img-crop to zriz. Read https://zriz.dev/docs/zriz-vs-antd-img-crop.md and follow its section on migrating. Keep the crop behaviour the same where zriz can, and list for me anything zriz has no equivalent for before you remove it."
      )
    ),
    section(
      "In short",
      p(
        'antd-img-crop calls itself "An image cropper for Ant Design Upload" in its [README](https://github.com/nanxiaobei/antd-img-crop#readme). You wrap an antd `Upload` in `ImgCrop`. When a person picks a file, an antd modal opens with a react-easy-crop cropper inside, and OK sends the cropped file on to the upload. The [Ant Design Upload docs](https://ant.design/components/upload) use it in their crop demo.'
      ),
      p(
        "Pick antd-img-crop when the app is on Ant Design and the crop is a step before an upload. One wrapper gives the modal, the sliders, OK and Cancel as antd components, and the app writes no crop code. Its optional sliders turn the photo through 180° each way and change the aspect, from 0.5 to 2 by default, and zriz has neither as one control. It adds about 10 kB to an app that already uses antd's Modal, Upload, Button and Slider. Its peer range starts at React 16.8, and we ran it on React 19 alone. It has been on npm since 2018 and has over 100k downloads a week."
      ),
      p(
        "Pick zriz when the app has no antd, or the crop is not part of an upload. zriz opens a URL, a `File` or a `Blob`, has handles on the crop, quarter turns and flip, and gives the crop back as a value you can save and restore. A round crop can export as a round PNG. You write the dialog, the styles and every label, and zriz adds 26 to 34 kB. zriz had its first release in November 2026 and has under a thousand downloads a week. Each package has one maintainer on npm."
      )
    ),
    section(
      "Numbers",
      table({
        columns: [
          column("Fact", "prose", { width: 150 }),
          column("antd-img-crop", "prose"),
          column("zriz", "prose"),
        ],
        rows: [
          ["First release", "2018", "November 2026"],
          ["npm downloads a week", "100k+", "Under 1,000"],
          ["GitHub stars", "540+", "Under 100"],
          ["Licence", "MIT", "MIT"],
          [
            "Dependencies",
            "`react-easy-crop` and `tslib`, with `antd` as a peer",
            "None, with `@zriz/core` as a peer",
          ],
          [
            "React",
            "16.8 and newer by its peer range, we ran it on 19",
            "18.2 and 19",
          ],
          ["Size", "About 10 kB, on top of antd", "26 to 34 kB"],
        ],
      }),
      p(
        "Size is minified JavaScript and CSS, compressed with Brotli, without React. For antd-img-crop it is the basic example from its docs, built with esbuild. That number leaves out antd's modal, slider and buttons. With antd's Modal, Upload, Button and Slider counted the same example is about 111 kB, and an app pays for whichever of those four it does not use yet. For zriz it depends on the parts you import: about 26 kB for `Root`, `Viewport`, `Image`, `Mask` and `Area`, and about 34 kB with every part. Up to 6 kB more loads later, for export, sharpening and SVG. We measured the zriz sets with Rolldown, and esbuild makes them up to about 16% larger. [Bundle size](bundle-size) has each set. `@zriz/react` needs `@zriz/core` and React as peers."
      )
    ),
    section(
      "Features",
      compare(
        ["antd-img-crop", "zriz"],
        [
          [
            "Crop box with handles",
            ["no", "A fixed frame in the centre"],
            ["yes", "Four corners and four edges"],
          ],
          ["Photo moves under the frame", ["yes"], ["yes"]],
          [
            "Aspect ratio",
            ["yes", "One ratio or a slider, 0.5 to 2 by default"],
            ["yes", "Free, original or any ratio"],
          ],
          [
            "Round crop",
            ["partly", "Round mask, the file is a rectangle"],
            ["yes", "Mask and export"],
          ],
          [
            "Zoom",
            ["yes", "Wheel, pinch, slider and step buttons"],
            ["yes", "Pinch, Ctrl + wheel, slider part, keys"],
          ],
          [
            "Straighten (free rotation)",
            ["yes", "Optional slider, 180° each way"],
            ["partly", "45° each way plus quarter turns"],
          ],
          [
            "Crop stays inside the photo at an angle",
            [
              "no",
              "The frame can take in empty corners, which export in `fillColor`",
            ],
            ["yes", "The crop shrinks to fit"],
          ],
          [
            "Quarter turns and flip",
            ["partly", "90° on the optional rotation slider, no flip"],
            ["yes", "Animated"],
          ],
          [
            "Touch gestures",
            [
              "yes",
              "Pan, pinch, twist. The twist reaches the file only with `rotationSlider`",
            ],
            ["yes", "Pan, pinch, twist, two handles at once"],
          ],
          [
            "Keyboard",
            ["yes", "Arrows pan the photo, sliders, buttons"],
            ["yes", "Crop area, dial, zoom and ratio group; handles no"],
          ],
          [
            "Screen reader",
            ["partly", "Dialog and slider roles, sliders have no names"],
            ["partly", "Roles and live region; you write the labels"],
          ],
          [
            "Image export",
            ["yes", "A `File` labelled with the picked file's type"],
            ["yes", "JPEG, PNG or WebP blob"],
          ],
          [
            "Saved crop",
            ["partly", "Reads out a pixel rectangle through `cropperProps`"],
            ["yes", "Fractions of the photo, restores exactly"],
          ],
          [
            "Ready-made UI",
            ["yes", "Antd modal, sliders, OK and Cancel"],
            ["no", "Unstyled parts and an optional stylesheet"],
          ],
        ]
      ),
      p(
        "The rotation slider, the aspect slider and the Reset button in antd-img-crop are off by default. `rotationSlider`, `aspectSlider` and `showReset` turn them on."
      ),
      p(
        "antd-img-crop 4.30.0 installs react-easy-crop 5, which is the cropper inside the modal. What the [react-easy-crop](zriz-vs-react-easy-crop) page says about version 6 does not carry over."
      )
    ),
    section(
      "What you will notice",
      p(
        "antd-img-crop takes less code. The whole crop step is `ImgCrop` around an `Upload`. The modal, the sliders and the OK, Cancel and Reset buttons are antd's own components, OK and Cancel come from antd's locale, and the cropped file lands in the upload request. With zriz you build the dialog, the zoom slider, the buttons and the hand-off to the upload."
      ),
      p(
        "antd-img-crop has one way in and one way out. The photo is a file that passes through `beforeUpload` of the wrapped `Upload`, and the result is a new `File`. It has no `src` prop for a photo the app already has. zriz takes a URL, a `File` or a `Blob`, and returns a blob from `exportCrop` plus a value that reopens the same crop later."
      ),
      p(
        'A plain mouse wheel zooms in antd-img-crop, and in Chromium the page did not scroll while it did. In zriz a plain wheel pans the photo and Ctrl + wheel zooms. Set `wheel="zoom"` on `Viewport` to get the antd-img-crop behaviour.'
      ),
      p(
        "The antd-img-crop rotation slider runs through 180° each way. At an angle the frame can take in area outside the photo, and the [export code](https://github.com/nanxiaobei/antd-img-crop/blob/9ed87c0c7b5f161c89db82af53e5adb5b77c129c/src/ImgCrop.tsx#L112-L115) paints that area with `fillColor`, white by default. zriz stops the straighten at 45° each way and shrinks the crop so the saved value and the exported file hold no empty corner. Larger angles in zriz take a quarter turn plus a straighten."
      ),
      p(
        "antd-img-crop asks the browser for the picked file's type and labels the file with it, at the crop's full pixel size, with `quality` 0.4 unless you set it. A round crop there is a round mask, and the file is the rectangle around it. zriz defaults to JPEG at quality 0.9, or at the photo's own quality when a JPEG file's is lower. It has `type` and `maxSize` options, and exports a circle as a PNG with transparent corners when `type` is left out. zriz scales an export down above about 16.8 megapixels on a device with a touch screen and about 268 megapixels elsewhere."
      ),
      p(
        'In antd-img-crop the three sliders have `role="slider"` and no accessible name, the step buttons are named by their glyphs, and no prop sets either. The dialog role, the link from the dialog to its "Edit image" title and the focus trap come from antd. zriz ships no words, so every label is yours to write, and a development build warns when the crop area, dial or zoom has no name.'
      )
    ),
    section(
      "Migrate from antd-img-crop",
      p(
        "zriz has no equivalent for the wrapper itself. It has no modal, no title, no OK and Cancel, and no hook into antd `Upload`, so you write those. It has no single slider through 180° each way. It has no crop that reaches outside the photo and no `fillColor` for empty corners. It has no `minZoom`, because zoom starts at 1, the largest crop that fits. It needs React 18.2 or newer and has no CommonJS build."
      ),
      entries([
        {
          text: "Your own dialog with `Cropper.Root` inside, opened from `beforeUpload`",
          title: "`<ImgCrop>` around `Upload`",
        },
        {
          text: '`aspect` on `Root`, default `"free"`',
          title: "`aspect`, default 1",
        },
        {
          text: '`shape="circle"` on `Root`. The file is a round PNG when `exportCrop` gets no `type`, so drop `type` from the snippet',
          title: '`cropShape="round"`',
        },
        {
          text: "`Cropper.Grid` inside `Area`. It shows while the crop moves and hides at rest",
          title: "`showGrid`",
        },
        {
          text: '`Zoom` with `ZoomThumb`, two `ZoomStep` buttons, and `wheel="zoom"` on `Viewport`',
          title: "`zoomSlider`",
        },
        {
          text: "`maxZoom` on `Root`, default 15",
          title: "`maxZoom`, default 3",
        },
        { text: "No equivalent", title: "`minZoom`" },
        {
          text: "`Dial` for 45° each way, `Rotate` for quarter turns",
          title: "`rotationSlider`",
        },
        {
          text: "`aspect` on `Root` from a range input of your own, or `AspectGroup` presets",
          title: "`aspectSlider`, `minAspect`, `maxAspect`",
        },
        {
          text: "`Cropper.Reset` with your text. It also puts the position back",
          title: "`showReset`, `resetText`",
        },
        {
          text: "`quality` in `exportCrop`, default 0.9, or the photo's own for a JPEG file when that is lower",
          title: "`quality`, default 0.4",
        },
        {
          text: "No equivalent. A JPEG export paints clear pixels white",
          title: "`fillColor`",
        },
        { text: "Props on the zriz parts", title: "`cropperProps`" },
        {
          text: "Props of your own dialog",
          title:
            "`modalTitle`, `modalWidth`, `modalOk`, `modalCancel`, `modalClassName`, `modalProps`",
        },
        {
          text: "Your OK handler, after `exportCrop` resolves",
          title: "`onModalOk`",
        },
        { text: "Your cancel handler", title: "`onModalCancel`" },
        {
          text: "A check of your own before you open the dialog",
          title: "`beforeCrop`",
        },
        { text: "`actionsRef` on `Root`", title: "The forwarded `ref`" },
      ]),
      p(
        "antd-img-crop saves no crop. Its output is a re-encoded `File`, so most apps have nothing to convert. An app that kept `croppedAreaPixels` from `cropperProps.onCropAreaChange` has `{ x, y, width, height }` in source pixels from the top left of the photo. For a crop with no rotation, the zriz value is `center: { x: (x + width / 2) / W, y: (y + height / 2) / H }` and `size: { width: width / W, height: height / H }`, where W and H are the photo's pixel size. We checked the zriz side of that formula by running code. This page gives no conversion for a rotated crop. antd-img-crop has no prop or callback that reports the angle, and we did not check the formula above with rotation. zriz has no importer."
      ),
      p(
        "Install `@zriz/react` and `@zriz/core`. Take `ImgCrop` away from around `Upload`. Give `Upload` a `beforeUpload` that returns a promise, and keep the picked file and the promise's `resolve` in state. Render the dialog below while that state is set. Resolve with the cropped file from `onCrop`, and with `Upload.LIST_IGNORE` from `onCancel`. This is the same hand-off antd-img-crop does inside. Then add the sliders and buttons your `ImgCrop` props turned on, from the table above."
      ),
      code("zriz-vs-antd-img-crop/after.tsx"),
      p(
        "`CropDialog` follows the antd-img-crop defaults: a square frame with no handles, a zoom slider with two step buttons, zoom up to 3×, a wheel that zooms, Cancel and OK. `rotateGesture={false}` on `Viewport` stops a two-finger twist from turning the photo, because antd-img-crop leaves rotation out of the file while `rotationSlider` is off. Remove it when you add a `Dial`. Some behaviour differs. The step buttons zoom by a factor, where antd-img-crop steps by 0.1. On the crop area, arrows move the crop by 1% of its size where antd-img-crop moves the photo 1 px, Alt + arrows resize the frame, and `+`, `-` and `0` zoom and reset. The dialog has no visible title and no close button. OK exports the crop in the picked file's type when that is JPEG, PNG or WebP, and as JPEG otherwise, under the picked file's name. Read `type` on the result before you trust the file extension."
      ),
      p(
        "The app still writes the styles for the dialog, the zoom track and thumb and the buttons. An antd `Modal`, `Button` and theme tokens can do that work. The labels in the snippet are English, so translate them where the app has other languages. The default quality goes from 0.4 to 0.9, or to the photo's own quality for a JPEG file when that is lower. Pass `quality: 0.4` to `exportCrop` to keep the old setting."
      )
    ),
    section(
      "How we checked",
      p(
        "We installed the published npm package at the version above and read its source and docs. Then we ran both libraries in headless Chromium with the same photo and the same script: tab order, keys, ARIA attributes, mouse, wheel and touch. The package has no call that sets an angle or exports a file on demand, and the script did not press OK, so the statements about its rotation and its export come from its source. The run and the sizes used antd 6.7.0 and React 19, and we checked nothing on antd 4 or 5."
      ),
      p(
        "antd-img-crop has a [repo](https://github.com/nanxiaobei/antd-img-crop) whose README is its documentation, and an [npm page](https://www.npmjs.com/package/antd-img-crop). The [Ant Design Upload docs](https://ant.design/components/upload) show it in use."
      )
    ),
    section(
      "More comparisons",
      entries([
        {
          text: "The cropper inside antd-img-crop, used on its own without antd",
          title: "[zriz vs react-easy-crop](zriz-vs-react-easy-crop)",
        },
        {
          text: "Another cropper that is a step inside an upload flow",
          title: "[zriz vs Uppy image editor](zriz-vs-uppy-image-editor)",
        },
        {
          text: "A small avatar and profile picture component, with no antd",
          title: "[zriz vs react-avatar-editor](zriz-vs-react-avatar-editor)",
        },
      ]),
      p("Every comparison is on the [comparison](comparison) page.")
    ),
  ],
  lede: "antd-img-crop wraps an Ant Design `Upload` and opens a modal with a cropper before the file uploads. zriz is a set of unstyled cropper parts with no upload step and no modal.",
});

export { ZRIZ_VS_ANTD_IMG_CROP_PAGE };
