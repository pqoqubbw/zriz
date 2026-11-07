type Release = {
  bump: "major" | "minor" | "patch";
  date: string;
  notes: readonly string[];
  version: string;
};

const RELEASES: readonly Release[] = [
  {
    bump: "patch",
    date: "2026-11-07",
    notes: [
      "The full editor is 138 B smaller and the avatar set 47 B smaller, with the same behaviour and API.",
    ],
    version: "0.1.1",
  },
  {
    bump: "minor",
    date: "2026-11-07",
    notes: ["The first version."],
    version: "0.1.0",
  },
];

export type { Release };
export { RELEASES };
