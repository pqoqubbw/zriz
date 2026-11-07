import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
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
    ["-c", "oxlint.config.mjs", "--format=json", ...STYLED_FILES],
    { cwd: folder, encoding: "utf-8" }
  );

  const parsed: unknown = JSON.parse(stdout);

  if (!isLintReport(parsed)) {
    throw new Error(`oxlint printed no report: ${stdout}`);
  }

  return parsed;
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
      STYLED_FILES.map(async (file) => {
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

  it("gives every package every style rule", () => {
    expect(report.number_of_files).toBe(STYLED_FILES.length);

    expect(
      Object.fromEntries(STYLED_FILES.map((file) => [file, firing(file)]))
    ).toStrictEqual(
      Object.fromEntries(STYLED_FILES.map((file) => [file, STYLE_RULES]))
    );
  });
});

describe("style rules", () => {
  it("tells classes from selectors and styles", () => {
    const selector = declarator("itemSelector", {
      type: "Literal",
      value: '[data-zriz-item="aspect-item"]',
    });
    const arbitrary = declarator("frame", {
      type: "Literal",
      value: "[mask:none]",
    });
    const utilities = declarator("frame", {
      type: "Literal",
      value: "flex gap-2 text-sm",
    });

    expect(
      reports("no-class-variable", "VariableDeclarator", selector)
    ).toStrictEqual([]);

    expect(
      reports("no-class-variable", "VariableDeclarator", styleObject("frame"))
    ).toStrictEqual([]);

    expect(
      reports("no-class-variable", "VariableDeclarator", arbitrary)
    ).toHaveLength(1);

    expect(
      reports("no-class-variable", "VariableDeclarator", utilities)
    ).toHaveLength(1);
  });

  it("asks only tables and styles for an upper case name", () => {
    const table = declarator("edges", {
      elements: [{ type: "Literal", value: "top" }],
      type: "ArrayExpression",
    });
    const emptyArray = declarator("expected", {
      elements: [],
      type: "ArrayExpression",
    });
    const emptyObject = declarator("expected", {
      properties: [],
      type: "ObjectExpression",
    });

    expect(
      reports("constant-case", CONSTANT_VISITOR, emptyArray)
    ).toStrictEqual([]);

    expect(
      reports("constant-case", CONSTANT_VISITOR, emptyObject)
    ).toStrictEqual([]);

    expect(reports("constant-case", CONSTANT_VISITOR, table)).toHaveLength(1);

    expect(
      reports("constant-case", CONSTANT_VISITOR, styleObject("square"))
    ).toHaveLength(1);

    expect(
      reports("constant-case", CONSTANT_VISITOR, styleObject("SQUARE"))
    ).toStrictEqual([]);
  });
});
