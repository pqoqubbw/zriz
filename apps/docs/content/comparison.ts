import {
  defineDoc,
  entries,
  intro,
  p,
  prompt,
  section,
} from "@/lib/doc/define";

const COMPARISON_PAGE = defineDoc({
  blocks: [
    intro(
      p(
        "We make zriz, so read these pages with that in mind. Each page names the versions it compares. If something is wrong, [open an issue](https://github.com/pqoqubbw/zriz/issues) and we will fix it."
      ),
      p(
        "To move a project to zriz, paste this into Claude Code, Cursor or another coding agent:"
      ),
      prompt(
        "Migrate this project's image cropper to zriz. Read https://zriz.dev/migrate.md and follow it. Keep the crop behaviour the same where zriz can, and list for me anything zriz has no equivalent for before you remove it."
      )
    ),
    section(
      "Where zriz stands",
      p(
        "zriz is new. Its first release was in November 2026, it has one maintainer and under a thousand downloads a week. Every library below is older and has far more."
      ),
      p(
        "It is also larger than most of them. zriz adds 22 to 30 kB of Brotli, by the parts you import, see [bundle size](bundle-size). The basic examples of react-easy-crop, react-avatar-editor and react-image-crop add about 7, 5 and 5 kB. react-advanced-cropper is about 24 kB. Uppy Image Editor with its uploader and Dashboard is about 89 kB, and about 35 kB through its `useImageEditor` hook."
      ),
      p(
        "What zriz has for that size is on each page: a straighten dial, a crop that stays inside the photo at an angle, and a saved value that restores exactly. Some of the others also have handles with a moving photo or export to a file, and each page says which."
      )
    ),
    section(
      "Libraries",
      entries([
        {
          meta: "5.5M+",
          text: "A styled React component. The photo moves under a fixed frame.",
          title: "[react-easy-crop](zriz-vs-react-easy-crop)",
        },
        {
          meta: "4.3M+",
          text: "A crop box you drag over a still image, with no zoom or rotation.",
          title: "[react-image-crop](zriz-vs-react-image-crop)",
        },
        {
          meta: "2.5M+",
          text: "Plain JavaScript. Version 2 is web components, version 1 is a class.",
          title: "[Cropper.js](zriz-vs-cropperjs)",
        },
        {
          meta: "1.4M+",
          text: "Unstyled parts on a Zag.js state machine, for React, Solid, Vue and Svelte.",
          title: "[Ark UI Image Cropper](zriz-vs-ark-ui)",
        },
        {
          meta: "980k+",
          text: "A canvas component with a fixed frame, made for avatars.",
          title: "[react-avatar-editor](zriz-vs-react-avatar-editor)",
        },
        {
          meta: "640k+",
          text: "A React wrapper around Cropper.js 1.",
          title: "[react-cropper](zriz-vs-react-cropper)",
        },
        {
          meta: "270k+",
          text: "A plugin of the Uppy uploader, built on Cropper.js 1.",
          title: "[Uppy Image Editor](zriz-vs-uppy-image-editor)",
        },
        {
          meta: "250k+",
          text: "A box that moves over a photo that also moves, with custom stencils.",
          title: "[react-advanced-cropper](zriz-vs-react-advanced-cropper)",
        },
        {
          meta: "120k+",
          text: "Plain JavaScript with a fixed frame and a zoom slider. Its last release was in 2020.",
          title: "[Croppie](zriz-vs-croppie)",
        },
        {
          meta: "100k+",
          text: "A crop dialog for the Upload of Ant Design, built on react-easy-crop.",
          title: "[antd-img-crop](zriz-vs-antd-img-crop)",
        },
      ]),
      p(
        "The numbers are npm downloads a week, rounded down. The Ark UI number is for `@zag-js/image-cropper`, which every install of Ark UI brings with it, and Chakra UI 3 depends on Ark UI. So it counts those installs, not the projects that use the cropper."
      )
    ),
    section(
      "Pick by need",
      entries([
        {
          text: "react-image-crop or react-avatar-editor. Each adds about 5 kB, against 22 to 30 kB for zriz.",
          title: "The smallest bundle",
        },
        {
          text: "react-image-crop. It has no dependencies, and keys on the box and each of its eight handles.",
          title: "A box over a still image and nothing more",
        },
        {
          text: "Ark UI Image Cropper. It has official components for each. Cropper.js and Croppie are plain JavaScript, and Uppy has Vue and Svelte components. zriz has React parts and a plain TypeScript core.",
          title: "Vue, Solid or Svelte",
        },
        {
          text: "react-easy-crop from 16.4, react-image-crop from 16.13.1, react-advanced-cropper from 16.8 and react-cropper from 17.0.2. Cropper.js and Croppie need no React. zriz starts at 18.2.",
          title: "React 16 or 17",
        },
        {
          text: "react-easy-crop. It crops video. zriz can read one still frame through `loadImage`.",
          title: "Video",
        },
        {
          text: "antd-img-crop or Uppy Image Editor. Each fits its kit with a few lines.",
          title: "A crop step inside Ant Design or Uppy",
        },
        {
          text: "react-avatar-editor, react-image-crop, Cropper.js or react-easy-crop. Their first releases were in 2014, 2015, 2015 and 2018.",
          title: "Years of use in production",
        },
        {
          text: "zriz, Uppy Image Editor or antd-img-crop. zriz has a dial part with 45° each way, and the crop shrinks to stay inside the photo. Uppy has a slider with the same range that zooms the photo. antd-img-crop has an optional slider with 180° each way, and its frame can take in empty corners.",
          title: "A straighten control",
        },
        {
          text: "zriz, Ark UI Image Cropper or Croppie. Each returns a blob in a format you pick. Uppy Image Editor and antd-img-crop return a file too, and react-image-crop returns a PNG as an object URL. zriz also has `toSharp`, which plans the same cut on a server.",
          title: "A file, not only coordinates",
        },
        {
          text: "zriz, react-advanced-cropper, Cropper.js, react-cropper, Uppy Image Editor or Ark UI Image Cropper. Each resizes the box and pans or zooms the photo under it.",
          title: "Handles and a moving photo together",
        },
      ])
    ),
    section(
      "How we checked",
      p(
        "We took the most downloaded npm packages that put a crop UI in a React app in the browser, have open source code and are not marked deprecated. For each one we installed the published package at the version its page names and read its source and docs. Then we ran every library and zriz in headless Chromium with the same photo and the same script, which records tab order, keys, ARIA attributes, mouse, wheel, touch and a 15° turn."
      ),
      p(
        "In the feature tables, No means we searched the code and the feature is not there."
      ),
      p(
        "We left out vue-advanced-cropper and ngx-image-cropper, which have no React component, and Pintura, which is paid and closed source, so we could not read its code. `@wordpress/image-cropper` would be seventh by downloads, but its maintainers deprecated it in their repository in November 2026. The npm release does not say so yet. Filerobot Image Editor is a full image editor with filters and annotations. We also left out, without a full check, React Native pickers, and uploaders, file managers and text editors that carry a crop step, such as Filestack, Uploadcare, Flmngr and Jodit."
      )
    ),
  ],
  lede: "How zriz compares with the most downloaded image croppers that work in a React app, and what each one does better.",
});

export { COMPARISON_PAGE };
