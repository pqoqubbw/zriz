import type { IconName } from "@/components/ui/icon";
import type { DemoPhotoName } from "@/lib/demo-photos";

const DEMO_NAMES = [
  "aspect-ratio",
  "avatar",
  "buttons",
  "crop-area",
  "dial",
  "exporting",
  "full-editor",
  "introduction",
  "playground",
  "quick-start",
  "root",
  "saving-state",
  "server-crop",
  "styling",
  "undo",
  "viewport",
  "zoom",
] as const;

type DemoName = (typeof DEMO_NAMES)[number];

type DemoPhotoKind = DemoPhotoName;

type DialZoneSpec = {
  end: IconName | null;
  kind: "dial";
  start: IconName | null;
  value: boolean;
};

type ZoomZoneSpec = {
  kind: "zoom";
};

type TrackZoneSpec = {
  end: IconName | null;
  items: readonly string[];
  kind: "aspect" | "track";
  selected: string;
};

type RowZoneSpec = {
  icons: readonly IconName[];
  kind: "row";
};

type ZoneSpec = DialZoneSpec | RowZoneSpec | TrackZoneSpec | ZoomZoneSpec;

type DemoAction = {
  done: string;
  icon: IconName;
  label: string;
};

type SnippetInput = "callback" | "flag" | "photo" | "text";

type DemoSnippet = {
  differences: readonly string[];
  export: string;
  file: string;
  inputs: Readonly<Record<string, SnippetInput>>;
  kind: "component" | "fragment" | "parts";
};

type DemoSpec = {
  action: DemoAction;
  below: boolean;
  photo: DemoPhotoKind;
  shape: "circle" | "rect";
  snippet: DemoSnippet | null;
  summary: string;
  zones: readonly ZoneSpec[];
};

const DOWNLOAD: DemoAction = {
  done: "saved",
  icon: "download",
  label: "download",
};

const SEND: DemoAction = { done: "sent", icon: "upload", label: "send" };

const EDITOR_ZONE: DialZoneSpec = {
  end: "flip-horizontal",
  kind: "dial",
  start: "rotate-left",
  value: true,
};

const ASPECT_ZONE: TrackZoneSpec = {
  end: "square",
  items: ["free", "original", "1:1", "4:5", "16:9"],
  kind: "aspect",
  selected: "free",
};

const DEMO_SPECS: Record<DemoName, DemoSpec> = {
  "aspect-ratio": {
    action: DOWNLOAD,
    below: false,
    photo: "landscape",
    shape: "rect",
    snippet: {
      differences: [
        "+Announcer",
        "+Area",
        "+Grid",
        "+Handle",
        "+Image",
        "+Instructions",
        "+Mask",
        "+Reset",
        "+Viewport",
      ],
      export: "example",
      file: "aspect-ratio/anatomy.jsx.tsx",
      inputs: {},
      kind: "parts",
    },
    summary:
      "a 3:2 photo, a track of free, original, 1:1, 4:5 and 16:9 with an orientation button, and open, reset and download in the corners",
    zones: [ASPECT_ZONE],
  },
  avatar: {
    action: DOWNLOAD,
    below: false,
    photo: "portrait",
    shape: "circle",
    snippet: {
      differences: [
        "+Announcer",
        "+Instructions",
        "+Reset",
        "+Zoom",
        "+ZoomStep",
        "+ZoomThumb",
        "Root.maxZoom",
      ],
      export: "AvatarPicker",
      file: "avatar/avatar-picker.tsx",
      inputs: { onSave: "callback" },
      kind: "component",
    },
    summary:
      "a 2:3 photo under a round crop, a zoom slider with zoom out and zoom in, and open, reset and download in the corners",
    zones: [{ kind: "zoom" }],
  },
  buttons: {
    action: DOWNLOAD,
    below: false,
    photo: "landscape",
    shape: "rect",
    snippet: {
      differences: [
        "+Announcer",
        "+Area",
        "+Grid",
        "+Handle",
        "+Image",
        "+Instructions",
        "+Mask",
        "+Viewport",
        "Flip.aria-label",
        "Flip.axis",
        "Reset.aria-label",
        "Rotate.aria-label",
        "Rotate.direction",
      ],
      export: "example",
      file: "buttons/anatomy.jsx.tsx",
      inputs: {},
      kind: "parts",
    },
    summary:
      "a 3:2 photo, rotate left, rotate right, flip and flip vertical buttons, and open, reset and download in the corners",
    zones: [
      {
        icons: [
          "rotate-left",
          "rotate-right",
          "flip-horizontal",
          "flip-vertical",
        ],
        kind: "row",
      },
    ],
  },
  "crop-area": {
    action: DOWNLOAD,
    below: false,
    photo: "landscape",
    shape: "rect",
    snippet: {
      differences: [
        "+Announcer",
        "+Image",
        "+Instructions",
        "+Mask",
        "+Reset",
        "+Viewport",
      ],
      export: "example",
      file: "crop-area/anatomy.jsx.tsx",
      inputs: {},
      kind: "parts",
    },
    summary:
      "a 3:2 photo with eight handles and a grid on the crop, and open, reset and download in the corners",
    zones: [],
  },
  dial: {
    action: DOWNLOAD,
    below: false,
    photo: "landscape",
    shape: "rect",
    snippet: {
      differences: [
        "+Announcer",
        "+Area",
        "+Grid",
        "+Handle",
        "+Image",
        "+Instructions",
        "+Mask",
        "+Reset",
        "+Viewport",
        "DialValue.format",
      ],
      export: "example",
      file: "dial/anatomy.jsx.tsx",
      inputs: {},
      kind: "parts",
    },
    summary:
      "a 3:2 photo, the straighten dial with its value, and open, reset and download in the corners",
    zones: [{ end: null, kind: "dial", start: null, value: true }],
  },
  exporting: {
    action: DOWNLOAD,
    below: false,
    photo: "landscape",
    shape: "rect",
    snippet: {
      differences: [
        "+Announcer",
        "+Grid",
        "+Handle",
        "+Instructions",
        "+Reset",
      ],
      export: "SaveCrop",
      file: "exporting/save-crop.tsx",
      inputs: { file: "photo" },
      kind: "component",
    },
    summary:
      "a 3:2 photo, a track of jpeg, png and webp, and open, reset and download in the corners",
    zones: [
      {
        end: null,
        items: ["jpeg", "png", "webp"],
        kind: "track",
        selected: "jpeg",
      },
    ],
  },
  "full-editor": {
    action: DOWNLOAD,
    below: false,
    photo: "landscape",
    shape: "rect",
    snippet: {
      differences: [
        "-Zoom",
        "-ZoomThumb",
        "Flip.aria-label",
        "Orientation.aria-label",
        "Reset.aria-label",
        "Rotate.aria-label",
      ],
      export: "Editor",
      file: "full-editor/editor.tsx",
      inputs: { onSave: "callback", src: "photo" },
      kind: "component",
    },
    summary:
      "a 3:2 photo, the straighten dial with rotate and flip, the aspect ratio track, and open, reset and download in the corners",
    zones: [EDITOR_ZONE, ASPECT_ZONE],
  },
  introduction: {
    action: DOWNLOAD,
    below: false,
    photo: "landscape",
    shape: "rect",
    snippet: {
      differences: [
        "+Announcer",
        "+Flip",
        "+Grid",
        "+Handle",
        "+Instructions",
        "+Reset",
        "+Rotate",
        "DialValue.format",
      ],
      export: "example",
      file: "introduction/parts.jsx.tsx",
      inputs: { photo: "photo", save: "callback" },
      kind: "fragment",
    },
    summary:
      "a 3:2 photo, the straighten dial with rotate and flip, and open, reset and download in the corners",
    zones: [EDITOR_ZONE],
  },
  playground: {
    action: DOWNLOAD,
    below: false,
    photo: "landscape",
    shape: "rect",
    snippet: {
      differences: [
        "+Announcer",
        "+Grid",
        "+Handle",
        "+Instructions",
        "+Reset",
        "DialValue.format",
        "Root.onValueChange",
        "Root.onValueCommit",
      ],
      export: "example",
      file: "playground/root.jsx.tsx",
      inputs: { photo: "photo" },
      kind: "fragment",
    },
    summary:
      "a 3:2 photo, the straighten dial with rotate and flip, and open, reset and download in the corners. the controls under it change its props",
    zones: [EDITOR_ZONE],
  },
  "quick-start": {
    action: DOWNLOAD,
    below: true,
    photo: "landscape",
    shape: "rect",
    snippet: {
      differences: ["+Announcer", "+Instructions", "+Reset"],
      export: "PhotoCropper",
      file: "quick-start/pick.tsx",
      inputs: {},
      kind: "component",
    },
    summary:
      "a 3:2 photo with four corner handles, the straighten dial, and open, reset and download in the corners",
    zones: [{ end: null, kind: "dial", start: null, value: false }],
  },
  root: {
    action: DOWNLOAD,
    below: false,
    photo: "landscape",
    shape: "rect",
    snippet: {
      differences: [
        "+Announcer",
        "+Grid",
        "+Handle",
        "+Instructions",
        "+Reset",
      ],
      export: "example",
      file: "root/disabled.jsx.tsx",
      inputs: { photo: "photo", saving: "flag" },
      kind: "fragment",
    },
    summary:
      "a 3:2 photo on a bare cropper, and open, reset and download in the corners. download locks the cropper while it saves",
    zones: [],
  },
  "saving-state": {
    action: DOWNLOAD,
    below: false,
    photo: "landscape",
    shape: "rect",
    snippet: null,
    summary:
      "a 3:2 photo, the straighten dial with rotate and flip, and open, reset and download in the corners. the crop is kept in local storage",
    zones: [EDITOR_ZONE],
  },
  "server-crop": {
    action: SEND,
    below: false,
    photo: "landscape",
    shape: "rect",
    snippet: null,
    summary:
      "a 3:2 photo, the straighten dial with rotate and flip, and open, reset and send in the corners. send shows the value and the sharp plan",
    zones: [EDITOR_ZONE],
  },
  styling: {
    action: DOWNLOAD,
    below: true,
    photo: "landscape",
    shape: "rect",
    snippet: null,
    summary:
      "a 3:2 photo, the straighten dial with its value, a track of default, ink and soft colours, and open, reset and download in the corners",
    zones: [
      { end: null, kind: "dial", start: null, value: true },
      {
        end: null,
        items: ["default", "ink", "soft"],
        kind: "track",
        selected: "default",
      },
    ],
  },
  undo: {
    action: DOWNLOAD,
    below: false,
    photo: "landscape",
    shape: "rect",
    snippet: null,
    summary:
      "a 3:2 photo, the straighten dial with undo and rotate, and open, reset and download in the corners",
    zones: [{ end: "rotate-left", kind: "dial", start: "undo", value: true }],
  },
  viewport: {
    action: DOWNLOAD,
    below: false,
    photo: "landscape",
    shape: "rect",
    snippet: {
      differences: [
        "+Announcer",
        "+Grid",
        "+Handle",
        "+Instructions",
        "+Reset",
        "Viewport.wheel",
      ],
      export: "example",
      file: "viewport/anatomy.jsx.tsx",
      inputs: {},
      kind: "parts",
    },
    summary:
      "a 3:2 photo, a track that sets the wheel to pan or zoom, and open, reset and download in the corners",
    zones: [
      { end: null, items: ["pan", "zoom"], kind: "track", selected: "pan" },
    ],
  },
  zoom: {
    action: DOWNLOAD,
    below: false,
    photo: "landscape",
    shape: "rect",
    snippet: {
      differences: [
        "+Announcer",
        "+Area",
        "+Grid",
        "+Handle",
        "+Image",
        "+Instructions",
        "+Mask",
        "+Reset",
        "+Viewport",
        "Root.maxZoom",
        "ZoomStep.aria-disabled",
      ],
      export: "example",
      file: "zoom/anatomy.jsx.tsx",
      inputs: {},
      kind: "parts",
    },
    summary:
      "a 3:2 photo, a zoom slider up to 3× with zoom out and zoom in, and open, reset and download in the corners",
    zones: [{ kind: "zoom" }],
  },
};

export type {
  DemoAction,
  DemoName,
  DemoPhotoKind,
  DemoSnippet,
  DemoSpec,
  DialZoneSpec,
  RowZoneSpec,
  SnippetInput,
  TrackZoneSpec,
  ZoneSpec,
  ZoomZoneSpec,
};
export { DEMO_NAMES, DEMO_SPECS };
