import * as Cropper from "@zriz/react/cropper";

declare const src: string;

export const example = (
  <Cropper.Root
    src={src}
    onValueChange={(_, d) => console.log(d.reason, d.phase)}
    onValueCommit={(_, d) => console.log(d.reason, "commit")}
  />
);
