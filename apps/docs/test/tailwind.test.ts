import { readdir, readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

import { __unstable__loadDesignSystem } from "tailwindcss";
import {
  createSourceFile,
  forEachChild,
  isArrayLiteralExpression,
  isArrowFunction,
  isAsExpression,
  isBinaryExpression,
  isBlock,
  isCallExpression,
  isConditionalExpression,
  isElementAccessExpression,
  isExportDeclaration,
  isFunctionLike,
  isIdentifier,
  isImportDeclaration,
  isJsxAttribute,
  isJsxExpression,
  isNoSubstitutionTemplateLiteral,
  isObjectLiteralExpression,
  isParenthesizedExpression,
  isPropertyAssignment,
  isReturnStatement,
  isSatisfiesExpression,
  isStringLiteral,
  isVariableStatement,
  ScriptKind,
  ScriptTarget,
  SyntaxKind,
} from "typescript";
import type {
  AsExpression,
  CallExpression,
  ConciseBody,
  Expression,
  JsxExpression,
  Node,
  ObjectLiteralExpression,
  ParenthesizedExpression,
  SatisfiesExpression,
  SourceFile,
} from "typescript";
import { describe, expect, it } from "vitest";

type ClassToken = {
  strict: boolean;
  token: string;
  where: string;
};

const SOURCE_ROOTS = ["app", "components", "lib"];
const CLASS_ATTRIBUTES = new Set(["class", "className"]);
const CLASS_FUNCTIONS = new Set(["cn", "cva"]);
const MARKER_CLASSES = new Set(["group", "peer"]);
const ROOT_FONT_SIZE = 16;
const ALLOWED_ARBITRARY = [
  "grid-cols-[minmax(0,var(--container-page))]",
  "max-sm:[border-image-outset:0]",
  "md:grid-cols-[11rem_minmax(var(--container-page),50rem)]",
];

const require = createRequire(import.meta.url);

const loadStylesheet = async (id: string, base: string) => {
  const file =
    id === "tailwindcss"
      ? require.resolve("tailwindcss/index.css")
      : path.resolve(base, id);
  const content = await readFile(file, "utf-8");

  return { base: path.dirname(file), content, path: file };
};

const css = await readFile("app/globals.css", "utf-8");
const design = await __unstable__loadDesignSystem(css, {
  base: path.resolve("app"),
  loadStylesheet,
});

type Variant = ReturnType<
  typeof design.parseCandidate
>[number]["variants"][number];

const isKnown = (token: string) =>
  MARKER_CLASSES.has(token) || design.candidatesToCss([token])[0] !== null;

const isArbitraryVariant = (variant: Variant): boolean =>
  variant.kind === "arbitrary" ||
  (variant.kind === "functional" && variant.value?.kind === "arbitrary") ||
  (variant.kind === "compound" && isArbitraryVariant(variant.variant));

const isArbitrary = (token: string) =>
  design
    .parseCandidate(token)
    .some(
      (candidate) =>
        candidate.kind === "arbitrary" ||
        (candidate.kind === "functional" &&
          candidate.value?.kind === "arbitrary") ||
        candidate.variants.some(isArbitraryVariant)
    );

const isClassCall = (node: CallExpression) =>
  isIdentifier(node.expression) && CLASS_FUNCTIONS.has(node.expression.text);

const isWrapper = (
  node: Node
): node is
  | AsExpression
  | JsxExpression
  | ParenthesizedExpression
  | SatisfiesExpression =>
  isJsxExpression(node) ||
  isParenthesizedExpression(node) ||
  isAsExpression(node) ||
  isSatisfiesExpression(node);

const returnsOf = (body: ConciseBody): Expression[] => {
  if (!isBlock(body)) {
    return [body];
  }

  const found: Expression[] = [];

  const visit = (node: Node) => {
    if (isReturnStatement(node) && node.expression !== undefined) {
      found.push(node.expression);
    }

    if (!isFunctionLike(node)) {
      forEachChild(node, visit);
    }
  };

  forEachChild(body, visit);

  return found;
};

const valuesOf = (node: ObjectLiteralExpression, file: SourceFile) => {
  const properties = node.properties.filter(isPropertyAssignment);
  const own = properties.filter((property) =>
    CLASS_ATTRIBUTES.has(property.name.getText(file))
  );

  return (own.length > 0 ? own : properties)
    .filter((property) => property.name.getText(file) !== "defaultVariants")
    .map((property) => property.initializer);
};

const classChildrenOf = (
  node: Node,
  file: SourceFile,
  declarations: Map<string, Expression>
): (Node | undefined)[] => {
  if (isIdentifier(node)) {
    return [declarations.get(node.text)];
  }

  if (isConditionalExpression(node)) {
    return [node.whenTrue, node.whenFalse];
  }

  if (isBinaryExpression(node)) {
    const isGuard =
      node.operatorToken.kind === SyntaxKind.AmpersandAmpersandToken;

    return isGuard ? [node.right] : [node.left, node.right];
  }

  if (isCallExpression(node)) {
    return isClassCall(node) ? [...node.arguments] : [node.expression];
  }

  if (isObjectLiteralExpression(node)) {
    return valuesOf(node, file);
  }

  if (isArrayLiteralExpression(node)) {
    return [...node.elements];
  }

  if (isArrowFunction(node)) {
    return returnsOf(node.body);
  }

  if (isElementAccessExpression(node) || isWrapper(node)) {
    return [node.expression];
  }

  return [];
};

const classNodesOf = (file: SourceFile): Set<Node> => {
  const declarations = new Map<string, Expression>();

  for (const statement of file.statements.filter(isVariableStatement)) {
    for (const { initializer, name } of statement.declarationList
      .declarations) {
      if (isIdentifier(name) && initializer !== undefined) {
        declarations.set(name.text, initializer);
      }
    }
  }

  const strict = new Set<Node>();

  const mark = (node: Node | undefined): void => {
    if (node === undefined || strict.has(node)) {
      return;
    }

    strict.add(node);

    for (const child of classChildrenOf(node, file, declarations)) {
      mark(child);
    }
  };

  const visit = (node: Node) => {
    const isClassAttribute =
      isJsxAttribute(node) && CLASS_ATTRIBUTES.has(node.name.getText(file));

    if (isClassAttribute) {
      mark(node.initializer);
    }

    if (isCallExpression(node) && isClassCall(node)) {
      mark(node);
    }

    forEachChild(node, visit);
  };

  visit(file);

  return strict;
};

const tokensOf = (name: string, text: string): ClassToken[] => {
  const kind = name.endsWith(".tsx") ? ScriptKind.TSX : ScriptKind.TS;
  const file = createSourceFile(name, text, ScriptTarget.Latest, true, kind);
  const strict = classNodesOf(file);
  const tokens: ClassToken[] = [];

  const visit = (node: Node) => {
    if (isImportDeclaration(node) || isExportDeclaration(node)) {
      return;
    }

    const isString =
      isStringLiteral(node) || isNoSubstitutionTemplateLiteral(node);
    const isKey =
      isPropertyAssignment(node.parent) && node.parent.name === node;

    if (isString && !isKey) {
      const start = node.getStart(file) + 1;
      const found = [...node.text.matchAll(/\S+/gu)].map((match) => {
        const { line } = file.getLineAndCharacterOfPosition(
          start + match.index
        );

        return { token: match[0], where: `${name}:${line + 1}` };
      });
      const isClassLike =
        found.length > 0 &&
        found.every(({ token }) => isKnown(token)) &&
        found.some(({ token }) => /[-:[]/u.test(token));

      if (strict.has(node) || isClassLike) {
        tokens.push(
          ...found.map((item) => ({ ...item, strict: strict.has(node) }))
        );
      }
    }

    forEachChild(node, visit);
  };

  forEachChild(file, visit);

  return tokens;
};

const filesOf = async (root: string) => {
  const entries = await readdir(root, { recursive: true });

  return entries
    .filter((entry) => /\.tsx?$/u.test(entry))
    .map((entry) => `${root}/${entry}`);
};

const nested = await Promise.all(SOURCE_ROOTS.map(filesOf));
const lists = await Promise.all(
  nested
    .flat()
    .map(async (name) => tokensOf(name, await readFile(name, "utf-8")))
);
const tokens = lists.flat();

describe("tailwind classes", () => {
  it("draws the styling recipe's frame in forced colours", async () => {
    const recipe = await readFile(
      path.join(process.cwd(), "snippets/styling/tailwind.jsx.tsx"),
      "utf-8"
    );
    const classes = /<Cropper\.Area[^>]*?className="(?<list>[^"]*)"/su.exec(
      recipe
    )?.groups?.list;
    const rules = design.candidatesToCss(classes?.split(" ") ?? []);
    const forced = rules.find(
      (rule) => rule?.includes("forced-colors: active") === true
    );

    expect(forced).toContain("border");
  });

  it("finds the class lists", () => {
    expect(tokens.length).toBeGreaterThan(300);
  });

  it("knows every class", () => {
    const unknown = tokens
      .filter(({ strict, token }) => strict && !isKnown(token))
      .map(({ token, where }) => `${where} ${token}`);

    expect(unknown).toStrictEqual([]);
  });

  it("writes every class in its canonical form", () => {
    const rewritten = tokens.flatMap(({ token, where }) => {
      const [canonical] = design.canonicalizeCandidates([token], {
        rem: ROOT_FONT_SIZE,
      });

      return canonical === token ? [] : [`${where} ${token} -> ${canonical}`];
    });

    expect(rewritten).toStrictEqual([]);
  });

  it("keeps arbitrary values to the approved list", () => {
    const arbitrary = new Set(
      tokens.map(({ token }) => token).filter((token) => isArbitrary(token))
    );

    expect([...arbitrary].toSorted()).toStrictEqual(ALLOWED_ARBITRARY);
  });
});
