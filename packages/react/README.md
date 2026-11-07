# @zriz/react

Headless image cropper for React with the feel of iOS Photos. A dial straightens the photo, the photo zooms just enough that the crop never shows an empty corner, and the crop box springs back to the centre when you let go.

Docs and live demos: [zriz.dev](https://zriz.dev).

## Install

```sh
pnpm add @zriz/react @zriz/core
```

React 18.2 or newer, 19 included. Both packages ship their types.

## Render a cropper

```tsx
"use client";

import * as Cropper from "@zriz/react/cropper";

import "@zriz/react/styles.css";

export const PhotoCropper = ({ photo }: { photo: File | null }) => (
  <Cropper.Root
    src={photo}
    onError={(error) => console.error(error.code)}
    onValueCommit={(value, details) => console.log(details.pixelCrop)}
  >
    <Cropper.Viewport style={{ maxWidth: 400, height: 300, padding: 24 }}>
      <Cropper.Image />
      <Cropper.Mask />
      <Cropper.Area aria-label="Crop area">
        <Cropper.Handle position="top-left" />
        <Cropper.Handle position="top-right" />
        <Cropper.Handle position="bottom-right" />
        <Cropper.Handle position="bottom-left" />
      </Cropper.Area>
    </Cropper.Viewport>
    <Cropper.Dial aria-label="Straighten" style={{ maxWidth: 361 }}>
      <Cropper.DialTicks />
    </Cropper.Dial>
  </Cropper.Root>
);
```

`src` takes a URL, a `File` or a `Blob`. `onValueCommit` fires once when a gesture ends. `value` is the crop as fractions of the photo, ready to save and load back, and `details.pixelCrop` is the same crop in source pixels for your server.

The stylesheet is optional. Every rule sits in `:where()` inside a cascade layer, so any class of yours wins.

## What else is in the box

- Parts for zoom, aspect ratio, flip, quarter turns, reset and a live angle readout.
- `useCropper` and `actionsRef` to drive the cropper from your own buttons.
- Export to a `Blob` in a worker, from the full-resolution photo.
- Keyboard control, screen reader labels and reduced motion for every part.

[Full editor](https://zriz.dev/docs/full-editor) puts every part in one component, and [playground](https://zriz.dev/docs/playground) changes the main props live.

## Without a bundler

The parts import their dev-only warnings from `@zriz/react/warn`. An import map needs an entry for it next to `@zriz/react/cropper`, `@zriz/core`, `@zriz/core/dom`, `react` and `react/jsx-runtime`:

```json
{
  "imports": {
    "@zriz/react/warn": "/node_modules/@zriz/react/dist/warn-off.js"
  }
}
```

Point it at `dist/warn.js` during development to keep the warnings, and run `window.process = { env: {} }` before the modules load. Without a `process` global, `dist/warn.js` stays silent too.

## Issues

Bugs and ideas go to [GitHub issues](https://github.com/pqoqubbw/zriz/issues/new/choose). I don't take pull requests, see [CONTRIBUTING.md](https://github.com/pqoqubbw/zriz/blob/main/.github/CONTRIBUTING.md).

## License

MIT
