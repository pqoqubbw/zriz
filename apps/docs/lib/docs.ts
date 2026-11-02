import { accessibility } from "@/content/accessibility";
import { aspectRatio } from "@/content/aspect-ratio";
import { avatar } from "@/content/avatar";
import { bundleSize } from "@/content/bundle-size";
import { buttons } from "@/content/buttons";
import { changelog } from "@/content/changelog";
import { composition } from "@/content/composition";
import { cropArea } from "@/content/crop-area";
import { cropper } from "@/content/cropper";
import { dial } from "@/content/dial";
import { errors } from "@/content/errors";
import { events } from "@/content/events";
import { exporting } from "@/content/exporting";
import { faq } from "@/content/faq";
import { fullEditor } from "@/content/full-editor";
import { hooks } from "@/content/hooks";
import { introduction } from "@/content/introduction";
import { loadingImages } from "@/content/loading-images";
import { playground } from "@/content/playground";
import { quickStart } from "@/content/quick-start";
import { root } from "@/content/root";
import { savingState } from "@/content/saving-state";
import { serverCrop } from "@/content/server-crop";
import { styling } from "@/content/styling";
import { undo } from "@/content/undo";
import { value } from "@/content/value";
import { vanillaJs } from "@/content/vanilla-js";
import { viewport } from "@/content/viewport";
import { zoom } from "@/content/zoom";
import type { Doc } from "@/lib/doc/schema";
import type { Slug } from "@/lib/nav";

export const docs: Record<Slug, Doc> = {
  accessibility,
  "aspect-ratio": aspectRatio,
  avatar,
  "bundle-size": bundleSize,
  buttons,
  changelog,
  composition,
  "crop-area": cropArea,
  cropper,
  dial,
  errors,
  events,
  exporting,
  faq,
  "full-editor": fullEditor,
  hooks,
  introduction,
  "loading-images": loadingImages,
  playground,
  "quick-start": quickStart,
  root,
  "saving-state": savingState,
  "server-crop": serverCrop,
  styling,
  undo,
  value,
  "vanilla-js": vanillaJs,
  viewport,
  zoom,
};
