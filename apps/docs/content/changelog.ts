import { RELEASES } from "@/content/releases";
import type { Release } from "@/content/releases";
import { defineDoc, p, section } from "@/lib/doc/define";
import type { Block } from "@/lib/doc/schema";

const DATE_FORMAT = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "long",
  timeZone: "UTC",
  year: "numeric",
});

const dayOf = (date: string): string =>
  DATE_FORMAT.format(new Date(`${date}T00:00:00Z`))
    .replace(",", "")
    .toLowerCase();

const toSection = (release: Release): Block =>
  section(
    `${release.version} ${release.bump}, ${dayOf(release.date)}`,
    ...release.notes.map((note) => p(note))
  );

const UNRELEASED = section(
  "0.0.0, not published yet",
  p(
    "the first version. nothing is on npm yet, so there is nothing to upgrade from. [introduction](introduction) lists what it does."
  )
);

const CHANGELOG_PAGE = defineDoc({
  blocks: RELEASES.length === 0 ? [UNRELEASED] : RELEASES.map(toSection),
  lede: "what changed in each published version of zriz, newest first.",
});

export { CHANGELOG_PAGE };
