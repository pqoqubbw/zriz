# @zriz/core

The framework-agnostic core of [zriz](https://zriz.dev): crop geometry and the coverage solver that keeps a rotated photo free of empty corners.

```ts
import { coverScale } from "@zriz/core";

const scale = coverScale(
  { width: 4032, height: 3024 },
  { width: 1200, height: 900 },
  (7 * Math.PI) / 180
);
```

Most apps want [`@zriz/react`](https://www.npmjs.com/package/@zriz/react) instead.
