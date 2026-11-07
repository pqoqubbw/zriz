type Release = {
  bump: "major" | "minor" | "patch";
  date: string;
  notes: readonly string[];
  version: string;
};

const RELEASES: readonly Release[] = [
  {
    bump: "minor",
    date: "2026-11-07",
    notes: ["The first version."],
    version: "0.1.0",
  },
];

export type { Release };
export { RELEASES };
