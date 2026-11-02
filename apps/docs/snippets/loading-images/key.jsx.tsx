import * as Cropper from "@zriz/react/cropper";
import type { ReactNode } from "react";

declare const file: Blob | null;
declare const src: string;
declare const picks: number;
declare const children: ReactNode;

export const example = (
  <Cropper.Root key={picks} src={file}>
    {children}
  </Cropper.Root>
);
