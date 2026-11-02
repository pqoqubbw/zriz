import * as Cropper from "@zriz/react/cropper";

export const example = (
  <>
    <Cropper.Rotate aria-label="Rotate left">
      <svg
        aria-hidden="true"
        width={20}
        height={20}
        viewBox="0 0 20 20"
      >
        <path
          d="M4 4v4h4M4.5 8a6 6 0 1 1 1.5 6.5"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
        />
      </svg>
    </Cropper.Rotate>
    <Cropper.Flip aria-label="Flip">
      <svg
        aria-hidden="true"
        width={20}
        height={20}
        viewBox="0 0 20 20"
      >
        <path
          d="M10 3v14M7 5l-4 10h4zM13 5l4 10h-4z"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
        />
      </svg>
    </Cropper.Flip>
    <Cropper.Reset>reset</Cropper.Reset>
  </>
);
