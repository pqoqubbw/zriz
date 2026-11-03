type Release = {
  bump: "major" | "minor" | "patch";
  date: string;
  notes: readonly string[];
  version: string;
};

const RELEASES: readonly Release[] = [];

export type { Release };
export { RELEASES };
