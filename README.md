# zriz

Headless image cropper for the web with the feel of iOS Photos. Straighten with a dial, and the photo zooms just enough that the crop never shows an empty corner. Let go, and the crop box springs back to the centre.

- No empty corners at any angle, on screen and in the exported file.
- Pinch, twist, wheel and trackpad zoom, with a rubber band at the edges.
- Unstyled parts you compose and style yourself, plus an optional stylesheet.
- Full keyboard control, screen reader labels and reduced motion.
- Export in a worker from the full-resolution photo, or crop on your server with sharp.
- Zero runtime dependencies. React 18.2 and 19 from one build, and a plain TypeScript API for everything else.

Docs, demos and the API live at [zriz.dev](https://zriz.dev).

## Install

```sh
pnpm add @zriz/react @zriz/core
```

```tsx
"use client";

import * as Cropper from "@zriz/react/cropper";

import "@zriz/react/styles.css";

export const PhotoCropper = ({ photo }: { photo: File }) => (
  <Cropper.Root
    src={photo}
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

[Quick start](https://zriz.dev/docs/quick-start) goes from here to a file picker and the crop in pixels.

## Packages

| Package |  |
| --- | --- |
| [`@zriz/react`](packages/react) | Unstyled React parts and hooks |
| [`@zriz/core`](packages/core) | Geometry, the coverage solver, DOM binders, export |

## Found a bug or want a feature

Open an [issue](https://github.com/pqoqubbw/zriz/issues/new/choose). I don't take pull requests. [CONTRIBUTING.md](.github/CONTRIBUTING.md) explains why and what helps most instead.

## License

MIT
