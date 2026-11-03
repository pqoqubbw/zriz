import process from "node:process";

import { RELEASES } from "../apps/docs/content/releases.ts";

const version = process.argv.at(2);
const release = RELEASES.find((entry) => entry.version === version);

if (release === undefined) {
  process.stderr.write(`no changelog entry for ${version}\n`);
  process.exit(1);
}

const lines = release.notes.map((note) => `- ${note}`);

process.stdout.write(
  `${lines.join("\n")}\n\n[changelog](https://zriz.dev/docs/changelog)\n`
);
