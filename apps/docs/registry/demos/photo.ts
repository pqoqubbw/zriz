import { DEMO_PHOTOS } from "@/lib/demo-photos";

const PHOTO = DEMO_PHOTOS.landscape.url;

const describeFile = (file: File): string =>
  `${file.name}, ${Math.max(1, Math.round(file.size / 1024))} KB`;

export { describeFile, PHOTO };
