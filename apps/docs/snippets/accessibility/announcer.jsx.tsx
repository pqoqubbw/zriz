import * as Cropper from "@zriz/react/cropper";

export const example = (
  <Cropper.Announcer
    announce={({ center, size }, details) => {
      if (details.reason !== "keyboard") return null;
      const x = Math.round(center.x * 100);
      const y = Math.round(center.y * 100);
      const width = Math.round(size.width * 100);
      return `Crop at ${x}%, ${y}%, ${width}% wide`;
    }}
  />
);
