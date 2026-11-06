type DemoPhotoName = "landscape" | "portrait";

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

const DEMO_PHOTO_BUDGET = 220_000;

const DEMO_PHOTO_LONG_EDGE = 2400;

const DEMO_PHOTO_QUALITY = 80;

const DEMO_PHOTOS = {
  landscape: {
    alt: "The sun low over Lake Superior, its light on the water and a wave on the sand",
    bytes: 212_194,
    height: 1600,
    name: "landscape",
    sha256: "365e7c8ba8c25e43c5b2819cdfefafe36b8f618a19a16d7b0f93041e113ac3d6",
    source: {
      author: "NPS",
      created: "2015-09-04",
      crop: { height: 2808, left: 0, top: 150, width: 4212 },
      fetched: "2026-11-05",
      file: "https://npgallery.nps.gov/GetAsset/1c8fd902-d138-4e43-b6aa-851491dfbbaf/original.jpg",
      height: 3648,
      page: "https://npgallery.nps.gov/AssetDetail/1c8fd902-d138-4e43-b6aa-851491dfbbaf",
      rights: "Public domain:Full Granting Rights",
      sha256:
        "e30ec16662762b757172124c11c910c08252b1a2f5700d6d119047d9c3607f11",
      title: "Summer Sunset at Miners Beach",
      width: 4212,
    },
    url: "/demo/landscape.webp",
    width: 2400,
  },
  portrait: {
    alt: "A tall pine above Lake Superior, with the Grand Sable Dunes along the far shore under clouds",
    bytes: 133_784,
    height: 2400,
    name: "portrait",
    sha256: "88854135d89382cc5dc4aa47147529829344281ddf8c839e4b142204fe6651fd",
    source: {
      author: "NPS",
      created: "2016-07-24",
      crop: { height: 3024, left: 605, top: 0, width: 2016 },
      fetched: "2026-11-05",
      file: "https://npgallery.nps.gov/GetAsset/143ddaf3-5383-4828-8ef5-1ef61532c617/original.jpg",
      height: 3024,
      page: "https://npgallery.nps.gov/AssetDetail/143ddaf3-5383-4828-8ef5-1ef61532c617",
      rights: "Public domain:Full Granting Rights",
      sha256:
        "87bd656faf57a988aad5df7998259831753d600510d3e3bd03da55c5cb0d1050",
      title: "Grand Sable Dunes as seen from Au Sable Lighthouse",
      width: 4032,
    },
    url: "/demo/portrait.webp",
    width: 1600,
  },
} as const satisfies Record<DemoPhotoName, DemoPhoto>;

export {
  DEMO_PHOTO_BUDGET,
  DEMO_PHOTO_LONG_EDGE,
  DEMO_PHOTO_QUALITY,
  DEMO_PHOTOS,
};
export type { DemoPhoto, DemoPhotoCrop, DemoPhotoName, DemoPhotoSource };
