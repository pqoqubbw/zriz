import { createCropper, parse, serialize } from "@zriz/core";

const cropper = createCropper();
const text = serialize(cropper.getValue());
const saved = parse(text);
