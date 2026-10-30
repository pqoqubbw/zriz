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
