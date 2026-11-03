import { ACCESSIBILITY_PAGE } from "@/content/accessibility";
import { ASPECT_RATIO_PAGE } from "@/content/aspect-ratio";
import { AVATAR_PAGE } from "@/content/avatar";
import { BUNDLE_SIZE_PAGE } from "@/content/bundle-size";
import { BUTTONS_PAGE } from "@/content/buttons";
import { CHANGELOG_PAGE } from "@/content/changelog";
import { COMPOSITION_PAGE } from "@/content/composition";
import { CROP_AREA_PAGE } from "@/content/crop-area";
import { CROPPER_PAGE } from "@/content/cropper";
import { DIAL_PAGE } from "@/content/dial";
import { ERRORS_PAGE } from "@/content/errors";
import { EVENTS_PAGE } from "@/content/events";
import { EXPORTING_PAGE } from "@/content/exporting";
import { FAQ_PAGE } from "@/content/faq";
import { FULL_EDITOR_PAGE } from "@/content/full-editor";
import { HOOKS_PAGE } from "@/content/hooks";
import { INTRODUCTION_PAGE } from "@/content/introduction";
import { LOADING_IMAGES_PAGE } from "@/content/loading-images";
import { PLAYGROUND_PAGE } from "@/content/playground";
import { QUICK_START_PAGE } from "@/content/quick-start";
import { ROOT_PAGE } from "@/content/root";
import { SAVING_STATE_PAGE } from "@/content/saving-state";
import { SERVER_CROP_PAGE } from "@/content/server-crop";
import { STYLING_PAGE } from "@/content/styling";
import { UNDO_PAGE } from "@/content/undo";
import { VALUE_PAGE } from "@/content/value";
import { VANILLA_JS_PAGE } from "@/content/vanilla-js";
import { VIEWPORT_PAGE } from "@/content/viewport";
import { ZOOM_PAGE } from "@/content/zoom";
import type { Doc } from "@/lib/doc/schema";
import type { Slug } from "@/lib/nav";

const DOCS: Record<Slug, Doc> = {
  accessibility: ACCESSIBILITY_PAGE,
  "aspect-ratio": ASPECT_RATIO_PAGE,
  avatar: AVATAR_PAGE,
  "bundle-size": BUNDLE_SIZE_PAGE,
  buttons: BUTTONS_PAGE,
  changelog: CHANGELOG_PAGE,
  composition: COMPOSITION_PAGE,
  "crop-area": CROP_AREA_PAGE,
  cropper: CROPPER_PAGE,
  dial: DIAL_PAGE,
  errors: ERRORS_PAGE,
  events: EVENTS_PAGE,
  exporting: EXPORTING_PAGE,
  faq: FAQ_PAGE,
  "full-editor": FULL_EDITOR_PAGE,
  hooks: HOOKS_PAGE,
  introduction: INTRODUCTION_PAGE,
  "loading-images": LOADING_IMAGES_PAGE,
  playground: PLAYGROUND_PAGE,
  "quick-start": QUICK_START_PAGE,
  root: ROOT_PAGE,
  "saving-state": SAVING_STATE_PAGE,
  "server-crop": SERVER_CROP_PAGE,
  styling: STYLING_PAGE,
  undo: UNDO_PAGE,
  value: VALUE_PAGE,
  "vanilla-js": VANILLA_JS_PAGE,
  viewport: VIEWPORT_PAGE,
  zoom: ZOOM_PAGE,
};

export { DOCS };
