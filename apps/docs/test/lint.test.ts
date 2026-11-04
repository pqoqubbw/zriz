import { spawnSync } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import config from "../../../oxlint.config";
import style from "../lint/style.mjs";

type Node = Record<string, unknown>;
type Visitor = Record<string, (node: Node) => void>;
type Rule = {
  create: (context: {
    filename: string;
    report: (report: { message: string }) => void;
    sourceCode: { ast: { body: Node[] } };
  }) => Visitor;
};

type LintReport = {
  diagnostics: { code: string; filename: string }[];
  number_of_files: number;
};

const ROOT = path.resolve("../..");
const STYLE_RULES = [
  "@stylistic/padding-line-between-statements",
  "docs/constant-case",
  "docs/export-list",
  "docs/no-class-variable",
  "docs/props-type",
  "import/exports-last",
  "import/group-exports",
  "typescript/consistent-type-definitions",
];
const CONSTANT_VISITOR =
  "Program > VariableDeclaration[kind=const] > VariableDeclarator";
const STYLED_FILES = [
  "apps/docs/lib/fixture.ts",
  "packages/core/src/fixture.ts",
  "packages/core/test/fixture.ts",
  "packages/react/src/fixture.ts",
  "packages/react/test/fixture.ts",
];
const COMMANDS_FILE = "test/commands.ts";
const FIXTURES = [...STYLED_FILES, COMMANDS_FILE];
const UNSTYLED_SOURCE = `interface Fixture {
  name: string;
}
export const first = 1;
const edges = ["top"];
const classes = "flex gap-2 text-sm";
const Part = (props: { name: string }) => props.name;
export { classes, edges, Part };
export type { Fixture };
`;

const overridesWith = (rule: string) =>
  (config.overrides ?? []).filter((override) =>
    Object.keys(override.rules ?? {}).includes(rule)
  );

const declarator = (name: string, init: Node): Node => ({
  id: { name, type: "Identifier" },
  init,
  type: "VariableDeclarator",
});

const styleObject = (name: string): Node => ({
  ...declarator(name, {
    properties: [
      {
        type: "Property",
        value: { type: "Literal", value: "absolute" },
      },
    ],
    type: "ObjectExpression",
  }),
  id: {
    name,
    type: "Identifier",
    typeAnnotation: {
      typeAnnotation: { typeName: { name: "CSSProperties" } },
    },
  },
});

const reports = (ruleName: string, visitor: string, node: Node): string[] => {
  const messages: string[] = [];
  const rule = (style.rules as Record<string, Rule>)[ruleName];
  const visitors = rule?.create({
    filename: "packages/core/src/file.ts",
    report: ({ message }) => {
      messages.push(message);
    },
    sourceCode: { ast: { body: [] } },
  });

  visitors?.[visitor]?.(node);

  return messages;
};

const lintedConfig = (): string => {
  const { resolve } = createRequire(path.join(ROOT, "package.json"));
  const overrides = (config.overrides ?? []).map((override) =>
    override.jsPlugins
      ? {
          ...override,
          jsPlugins: override.jsPlugins.map((plugin) => resolve(plugin)),
        }
      : override
  );

  return `export default ${JSON.stringify({ ...config, options: {}, overrides })};`;
};

const isLintReport = (value: unknown): value is LintReport =>
  typeof value === "object" &&
  value !== null &&
  "diagnostics" in value &&
  "number_of_files" in value;

const lintFixtures = (folder: string): LintReport => {
  const { stdout } = spawnSync(
    path.join(ROOT, "node_modules/.bin/oxlint"),
    ["-c", "oxlint.config.mjs", "--format=json", ...FIXTURES],
    { cwd: folder, encoding: "utf-8" }
  );

  const parsed: unknown = JSON.parse(stdout);

  if (!isLintReport(parsed)) {
    throw new Error(`oxlint printed no report: ${stdout}`);
  }

  return parsed;
};

const sourcesIn = async (folder: string): Promise<string[]> => {
  const entries = await readdir(path.join(ROOT, folder), {
    recursive: true,
    withFileTypes: true,
  });

  return entries
    .filter(
      (entry) =>
        entry.isFile() &&
        /\.tsx?$/u.test(entry.name) &&
        !entry.parentPath.includes("node_modules")
    )
    .map((entry) =>
      path.relative(ROOT, path.join(entry.parentPath, entry.name))
    );
};

describe("lint scope", () => {
  let folder = "";
  let report: LintReport = { diagnostics: [], number_of_files: 0 };

  const firing = (file: string): string[] => {
    const codes = new Set(
      report.diagnostics
        .filter((diagnostic) => diagnostic.filename === file)
        .map((diagnostic) =>
          diagnostic.code.replace(
            /^(?<plugin>.+)\((?<rule>.+)\)$/u,
            "$<plugin>/$<rule>"
          )
        )
    );

    return STYLE_RULES.filter((rule) => codes.has(rule));
  };

  beforeAll(async () => {
    folder = await realpath(await mkdtemp(path.join(tmpdir(), "zriz-lint-")));

    await writeFile(path.join(folder, "oxlint.config.mjs"), lintedConfig());

    await Promise.all(
      FIXTURES.map(async (file) => {
        const target = path.join(folder, file);

        await mkdir(path.dirname(target), { recursive: true });
        await writeFile(target, UNSTYLED_SOURCE);
      })
    );

    report = lintFixtures(folder);
  });

  afterAll(async () => {
    await rm(folder, { force: true, recursive: true });
  });

  it("lints every fixture", () => {
    expect(report.number_of_files).toBe(FIXTURES.length);
  });

  it.each(STYLED_FILES)("%s gets every style rule", (file) => {
    expect(firing(file)).toStrictEqual(STYLE_RULES);
  });

  it("keeps the next rules to the docs", () => {
    const next = overridesWith("nextjs/no-html-link-for-pages");

    expect(next.flatMap((override) => override.files)).toStrictEqual([
      "apps/docs/**",
    ]);
  });

  it("leaves test/commands.ts out of the type rule so its module augmentation can merge", () => {
    expect(firing(COMMANDS_FILE)).not.toContain(
      "typescript/consistent-type-definitions"
    );
  });

  it("declares the browser commands once, in test/commands.ts", async () => {
    const files = [
      ...(await sourcesIn("packages/core/test")),
      ...(await sourcesIn("packages/react/test")),
      "test/commands.ts",
    ];
    const contents = await Promise.all(
      files.map(async (file) => await readFile(path.join(ROOT, file), "utf-8"))
    );
    const declaring = files.filter(
      (_, index) =>
        contents[index]?.includes('declare module "vitest/browser"') === true
    );

    expect(declaring).toStrictEqual(["test/commands.ts"]);
  });
});

describe("style rules", () => {
  it("reads an attribute selector as a plain string, not as classes", () => {
    const node = declarator("itemSelector", {
      type: "Literal",
      value: '[data-zriz-item="aspect-item"]',
    });

    expect(
      reports("no-class-variable", "VariableDeclarator", node)
    ).toStrictEqual([]);
  });

  it("reads a value typed CSSProperties as a style, not as classes", () => {
    expect(
      reports("no-class-variable", "VariableDeclarator", styleObject("frame"))
    ).toStrictEqual([]);
  });

  it("still flags an arbitrary property and a utility list as classes", () => {
    const arbitrary = declarator("frame", {
      type: "Literal",
      value: "[mask:none]",
    });
    const utilities = declarator("frame", {
      type: "Literal",
      value: "flex gap-2 text-sm",
    });

    expect(
      reports("no-class-variable", "VariableDeclarator", arbitrary)
    ).toHaveLength(1);

    expect(
      reports("no-class-variable", "VariableDeclarator", utilities)
    ).toHaveLength(1);
  });

  it.each([
    ["array", { elements: [], type: "ArrayExpression" }],
    ["object", { properties: [], type: "ObjectExpression" }],
  ])("lets an empty %s keep a lowercase name", (_, init) => {
    const node = declarator("expected", init);

    expect(reports("constant-case", CONSTANT_VISITOR, node)).toStrictEqual([]);
  });

  it("asks a module constant typed CSSProperties for an upper case name", () => {
    expect(
      reports("constant-case", CONSTANT_VISITOR, styleObject("square"))
    ).toHaveLength(1);

    expect(
      reports("constant-case", CONSTANT_VISITOR, styleObject("SQUARE"))
    ).toStrictEqual([]);
  });

  it("still asks a literal table for an upper case name", () => {
    const node = declarator("edges", {
      elements: [{ type: "Literal", value: "top" }],
      type: "ArrayExpression",
    });

    expect(reports("constant-case", CONSTANT_VISITOR, node)).toHaveLength(1);
  });
});
