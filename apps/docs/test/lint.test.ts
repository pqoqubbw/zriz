import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

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
  it.each(STYLE_RULES)("%s covers the docs and both packages", (rule) => {
    const files = overridesWith(rule).flatMap((override) => override.files);

    expect(files).toStrictEqual(
      expect.arrayContaining([
        "apps/docs/**",
        "packages/*/src/**",
        "packages/*/test/**",
      ])
    );
  });

  it("keeps the next rules to the docs", () => {
    const next = overridesWith("nextjs/no-html-link-for-pages");

    expect(next.flatMap((override) => override.files)).toStrictEqual([
      "apps/docs/**",
    ]);
  });

  it("leaves test/commands.ts out of the type rule so its module augmentation can merge", () => {
    const files = overridesWith(
      "typescript/consistent-type-definitions"
    ).flatMap((override) => override.files);

    expect(files).not.toContain("test/**");
    expect(files).not.toContain("**");
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
