# @zriz/react

Headless image cropper for React with the feel of iOS Photos: a straighten dial, no empty corners, a crop box that springs back to centre.

Work in progress. Docs: [zriz.dev](https://zriz.dev).

```tsx
import { useCoverScale } from "@zriz/react";

const scale = useCoverScale({
  image: { width: 4032, height: 3024 },
  crop: { width: 1200, height: 900 },
  rotation: 7,
});
```

## Without a bundler

The parts import their dev-only accessibility warning from `@zriz/react/warn`. An import map needs an entry for it next to `@zriz/react/cropper`, `@zriz/core` and `@zriz/core/dom`:

```json
{
  "imports": {
    "@zriz/react/warn": "/node_modules/@zriz/react/dist/warn-off.js"
  }
}
```

Point it at `dist/warn.js` during development to keep the warning.
