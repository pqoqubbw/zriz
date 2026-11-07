# @zriz/core

The framework-agnostic core of [zriz](https://zriz.dev), the image cropper with the feel of iOS Photos. It holds the crop geometry, the solver that keeps a rotated photo free of empty corners, the DOM binders behind every React part, image loading and export. It has no dependencies.

Most React apps want [`@zriz/react`](https://www.npmjs.com/package/@zriz/react). Use this package on its own for plain TypeScript, another framework, or maths on the server.

## Install

```sh
pnpm add @zriz/core
```

## Bind a cropper to your own markup

```ts
import { createCropper } from "@zriz/core";
import {
  attachImage,
  bindArea,
  bindMask,
  bindPhoto,
  bindViewport,
  loadImage,
} from "@zriz/core/dom";

import "@zriz/core/styles.css";

const byId = (id: string) => document.getElementById(id) as HTMLElement;

const cropper = createCropper({ defaultValue: { aspect: 4 / 3 } });

bindViewport(cropper, byId("viewport"));
bindPhoto(cropper, byId("photo"));
bindMask(cropper, byId("mask"));
bindArea(cropper, byId("area"));

attachImage(cropper, await loadImage("/photo.jpg"));
```

Every `bind*` call returns a cleanup function. [Vanilla JS](https://zriz.dev/docs/vanilla-js) shows the markup, handles, the dial, keys and teardown.

## Just the maths

```ts
import { coverScale } from "@zriz/core";

const scale = coverScale(
  { width: 4032, height: 3024 },
  { width: 1200, height: 900 },
  (7 * Math.PI) / 180
);
```

`coverScale` returns the smallest zoom at which a photo rotated by the angle still covers a crop centred on it.

## Issues

Bugs and ideas go to [GitHub issues](https://github.com/pqoqubbw/zriz/issues/new/choose). I don't take pull requests, see [CONTRIBUTING.md](https://github.com/pqoqubbw/zriz/blob/main/.github/CONTRIBUTING.md).

## License

MIT
