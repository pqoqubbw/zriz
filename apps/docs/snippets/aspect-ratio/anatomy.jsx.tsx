import * as Cropper from "@zriz/react/cropper";

export const example = (
  <>
    <Cropper.AspectGroup aria-label="Aspect ratio">
      <Cropper.AspectItem value="free">free</Cropper.AspectItem>
      <Cropper.AspectItem value={1}>1:1</Cropper.AspectItem>
      <Cropper.AspectItem value={4 / 5}>4:5</Cropper.AspectItem>
      <Cropper.AspectItem value={16 / 9}>16:9</Cropper.AspectItem>
    </Cropper.AspectGroup>
    <Cropper.Orientation aria-label="Swap orientation">
      <svg
        aria-hidden="true"
        width={20}
        height={20}
        viewBox="0 0 20 20"
      >
        <path
          d="M3 6h14v8H3z"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
        />
      </svg>
    </Cropper.Orientation>
  </>
);
