import type { DemoPhotoKind } from "@/demos/registry";
import { DEMO_PHOTOS } from "@/lib/demo-photos";

const photoUrl = (kind: DemoPhotoKind): string => DEMO_PHOTOS[kind].url;

export { photoUrl };
