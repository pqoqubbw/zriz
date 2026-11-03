const PASCAL_CASE = /^[A-Z][A-Za-z0-9]*$/u;
const CONSTANT_CASE = /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/u;
const UTILITY =
  /^(?:(?:\[[^\]]+\]|[\w*-]+(?:-\[[^\]]+\])?):)*!?-?(?:\[[^\]]+\]|(?:flex|grid|block|inline|hidden|contents|sr-only|absolute|relative|sticky|p[xytrbl]?|m[xytrbl]?|gap|size|w|h|min|max|text|font|bg|rounded|shadow|inset|col|row|items|justify|self|overflow|overscroll|cursor|opacity|z|top|left|right|bottom|whitespace|shrink|grow|group|decoration|underline)(?:-\S*)?)$/u;
const INLINE_SEGMENT_CONFIG = new Set([
  "dynamic",
  "dynamicParams",
  "fetchCache",
  "maxDuration",
  "preferredRegion",
  "revalidate",
  "runtime",
]);
const NEXT_EXPORTS = new Set([
  "dynamic",
  "dynamicParams",
  "experimental_ppr",
  "fetchCache",
  "maxDuration",
  "metadata",
  "preferredRegion",
  "revalidate",
  "runtime",
  "viewport",
]);

const unwrap = (node) =>
  node &&
  (node.type === "TSAsExpression" || node.type === "TSSatisfiesExpression")
    ? unwrap(node.expression)
    : node;

const isScalar = (node) => {
  const value = unwrap(node);

  if (!value) {
    return false;
  }

  if (value.type === "Literal") {
    return value.value !== null || value.regex !== undefined;
  }

  if (value.type === "TemplateLiteral") {
    return value.expressions.length === 0;
  }

  return value.type === "UnaryExpression" && isScalar(value.argument);
};

const isLiteralData = (node) => {
  const value = unwrap(node);

  if (!value) {
    return false;
  }

  if (isScalar(value)) {
    return true;
  }

  if (value.type === "ArrayExpression") {
    return value.elements.every((element) => element && isLiteralData(element));
  }

  if (value.type === "ObjectExpression") {
    return value.properties.every(
      (property) =>
        property.type === "Property" && isLiteralData(property.value)
    );
  }

  return false;
};

const isConstant = (node) => {
  const value = unwrap(node);

  if (!value) {
    return false;
  }

  if (
    value.type === "NewExpression" &&
    value.callee.type === "Identifier" &&
    ["Map", "Set"].includes(value.callee.name)
  ) {
    return value.arguments.length === 1 && isLiteralData(value.arguments[0]);
  }

  return isLiteralData(value);
};

const stringOf = (node) => {
  const value = unwrap(node);

  if (value?.type === "Literal" && typeof value.value === "string") {
    return value.value;
  }

  if (value?.type === "TemplateLiteral" && value.expressions.length === 0) {
    return value.quasis[0].value.cooked;
  }

  return null;
};

const looksLikeClasses = (text) => {
  const tokens = text.trim().split(/\s+/u);

  return (
    tokens.length > 0 &&
    tokens.filter((token) => UTILITY.test(token)).length >=
      Math.ceil(tokens.length / 2)
  );
};

const holdsClasses = (node) => {
  const value = unwrap(node);

  if (!value) {
    return false;
  }

  const text = stringOf(value);

  if (text !== null) {
    return looksLikeClasses(text);
  }

  if (
    value.type === "CallExpression" &&
    value.callee.type === "Identifier" &&
    value.callee.name === "cn"
  ) {
    return true;
  }

  if (value.type === "ObjectExpression") {
    return (
      value.properties.length > 0 &&
      value.properties.every(
        (property) =>
          property.type === "Property" && holdsClasses(property.value)
      )
    );
  }

  return false;
};

const isTypeLiteral = (annotation) =>
  annotation?.type === "TSTypeLiteral" ||
  (annotation?.type === "TSIntersectionType" &&
    annotation.types.some(isTypeLiteral));

const isInlineSegmentConfig = (declaration) =>
  declaration.type === "VariableDeclaration" &&
  declaration.declarations.every(
    (declarator) =>
      declarator.id.type === "Identifier" &&
      INLINE_SEGMENT_CONFIG.has(declarator.id.name)
  );

const exportList = {
  create: (context) => ({
    ExportDefaultDeclaration: (node) => {
      if (node.declaration.type !== "Identifier") {
        context.report({
          message:
            "Declare the value, then `export default Name` at the bottom.",
          node,
        });
      }
    },
    ExportNamedDeclaration: (node) => {
      if (node.declaration && !isInlineSegmentConfig(node.declaration)) {
        context.report({
          message:
            "Export through one `export { ... }` list at the bottom of the file.",
          node,
        });
      }
    },
  }),
};

const propsType = {
  create: (context) => ({
    VariableDeclarator: (node) => {
      if (node.id.type !== "Identifier" || !PASCAL_CASE.test(node.id.name)) {
        return;
      }

      const fn = unwrap(node.init);

      if (fn?.type !== "ArrowFunctionExpression") {
        return;
      }

      const [props] = fn.params;

      if (isTypeLiteral(props?.typeAnnotation?.typeAnnotation)) {
        context.report({
          message: `Declare \`type ${node.id.name}Props\` above the component.`,
          node: props,
        });
      }
    },
  }),
};

const defaultExportOf = (program) =>
  program.body.find(
    (statement) =>
      statement.type === "ExportDefaultDeclaration" &&
      statement.declaration.type === "Identifier"
  )?.declaration.name;

const constantCase = {
  create: (context) => ({
    "Program > VariableDeclaration[kind=const] > VariableDeclarator": (
      node
    ) => {
      if (
        node.id.type === "Identifier" &&
        !CONSTANT_CASE.test(node.id.name) &&
        !NEXT_EXPORTS.has(node.id.name) &&
        node.id.name !== defaultExportOf(context.sourceCode.ast) &&
        isConstant(node.init) &&
        !holdsClasses(node.init)
      ) {
        context.report({
          message: `Name the module constant \`${node.id.name}\` in UPPER_SNAKE_CASE.`,
          node: node.id,
        });
      }
    },
  }),
};

const noClassVariable = {
  create: (context) => ({
    VariableDeclarator: (node) => {
      if (holdsClasses(node.init)) {
        context.report({
          message:
            "Move these classes into a primitive (cva variants) or inline them in className.",
          node: node.id,
        });
      }
    },
  }),
};

const outsideSnippets = (rule) => ({
  create: (context) =>
    context.filename.includes("/snippets/") ? {} : rule.create(context),
});

const plugin = {
  meta: { name: "docs" },
  rules: {
    "constant-case": outsideSnippets(constantCase),
    "export-list": outsideSnippets(exportList),
    "no-class-variable": outsideSnippets(noClassVariable),
    "props-type": outsideSnippets(propsType),
  },
};

export default plugin;
