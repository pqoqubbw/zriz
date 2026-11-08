type DemoPhotoName = "landscape";

type DemoPhotoCrop = {
  height: number;
  left: number;
  top: number;
  width: number;
};

type DemoPhotoSource = {
  author: string;
  created: string;
  crop: DemoPhotoCrop;
  fetched: string;
  file: string;
  height: number;
  page: string;
  rights: string;
  sha256: string;
  title: string;
  width: number;
};

type DemoPhoto = {
  alt: string;
  bytes: number;
  height: number;
  name: DemoPhotoName;
  sha256: string;
  source: DemoPhotoSource;
  url: string;
  width: number;
};

const DEMO_PHOTO_BUDGET = 520_000;

const DEMO_PHOTO_LONG_EDGE = 2400;

const DEMO_PHOTO_QUALITY = 80;

const DEMO_PHOTOS = {
  landscape: {
    alt: "An alpine lake at golden hour, snowy peaks and pines mirrored in still water, boulders in the foreground",
    bytes: 511_086,
    height: 1600,
    name: "landscape",
    sha256: "2590f6e1dbf342554375cd753dc21cacbd2a19daf30679564973f529b262cec9",
    source: {
      author: "Generated with GPT Image",
      created: "2026-11-08",
      crop: { height: 1024, left: 0, top: 0, width: 1536 },
      fetched: "2026-11-08",
      file: "",
      height: 1024,
      page: "",
      rights: "Generated, owned by the author",
      sha256:
        "a687834b9b6859a37154c275ee2dd4d5bf191f1260547e5563fa28b83b3071d1",
      title: "Golden Alpine Lake Reflection",
      width: 1536,
    },
    url: "/demo/landscape.webp",
    width: 2400,
  },
} as const satisfies Record<DemoPhotoName, DemoPhoto>;

export {
  DEMO_PHOTO_BUDGET,
  DEMO_PHOTO_LONG_EDGE,
  DEMO_PHOTO_QUALITY,
  DEMO_PHOTOS,
};
export type { DemoPhoto, DemoPhotoCrop, DemoPhotoName, DemoPhotoSource };
