import type { ThemeRegistration } from "shiki";

export const roles = {
  attr: "a",
  comment: "c",
  keyword: "k",
  number: "n",
  plain: "",
  punct: "p",
  string: "s",
  tag: "t",
} as const;

export type Role = keyof typeof roles;

const marks = {
  attr: "#000005",
  comment: "#000001",
  keyword: "#000002",
  number: "#000006",
  plain: "#000000",
  punct: "#000007",
  string: "#000003",
  tag: "#000004",
} as const satisfies Record<Role, string>;

const names: readonly Role[] = [
  "attr",
  "comment",
  "keyword",
  "number",
  "plain",
  "punct",
  "string",
  "tag",
];

export const roleOfMark = new Map<string, Role>(
  names.map((role) => [marks[role], role])
);

const rule = (scope: string[], role: Role) => ({
  scope,
  settings: { foreground: marks[role] },
});

export const theme: ThemeRegistration = {
  colors: { "editor.background": "#ffffff", "editor.foreground": marks.plain },
  name: "zriz",
  settings: [
    { settings: { foreground: marks.plain } },
    rule(["comment", "punctuation.definition.comment"], "comment"),
    rule(["string", "punctuation.definition.string"], "string"),
    rule(
      [
        "keyword",
        "storage",
        "keyword.operator.new",
        "keyword.operator.expression",
        "constant.language.null",
        "constant.language.undefined",
      ],
      "keyword"
    ),
    rule(
      [
        "keyword.operator",
        "punctuation",
        "meta.brace",
        "storage.type.function.arrow",
        "constant.language.import-export-all",
        "meta.tag punctuation.definition.string",
        "text.html punctuation.definition.string",
      ],
      "punct"
    ),
    rule(
      [
        "meta.embedded.expression punctuation.definition.string",
        "meta.embedded.expression string",
      ],
      "string"
    ),
    rule(
      [
        "meta.template.expression",
        "string.unquoted.argument.shell",
        "source.css meta.property-value",
        "meta.object-literal.key string",
      ],
      "plain"
    ),
    rule(
      [
        "meta.template.expression punctuation.definition.template-expression",
        "meta.template.expression punctuation",
        "meta.template.expression keyword.operator",
        "meta.template.expression meta.brace",
      ],
      "punct"
    ),
    rule(["meta.template.expression entity.name.function"], "tag"),
    rule(
      [
        "meta.type.declaration string",
        "meta.type.annotation string",
        "meta.type entity.name.function",
        "meta.type.annotation entity.name.function",
        "meta.field.declaration entity.name.function",
      ],
      "plain"
    ),
    rule(
      [
        "meta.attribute-selector",
        "meta.attribute-selector string",
        "meta.attribute-selector punctuation",
        "meta.attribute-selector keyword",
        "meta.attribute-selector entity",
      ],
      "tag"
    ),
    rule(
      [
        "constant.numeric",
        "constant.language.boolean",
        "meta.delimiter.decimal",
      ],
      "number"
    ),
    rule(
      [
        "entity.name.function",
        "entity.name.tag",
        "support.class.component",
        "meta.selector",
        "support.function.misc.css",
        "entity.name.command",
      ],
      "tag"
    ),
    rule(
      [
        "entity.other.attribute-name",
        "support.type.property-name",
        "variable.css",
      ],
      "attr"
    ),
    rule(
      [
        "meta.selector entity.other.attribute-name",
        "meta.selector punctuation",
        "meta.selector string",
        "meta.selector keyword",
      ],
      "tag"
    ),
    rule(
      [
        "entity.name.type",
        "support.type",
        "meta.object-literal.key",
        "meta.object-literal.key entity.name.function",
        "source.css constant.numeric",
        "source.css keyword.other.unit",
        "source.css constant.other.color",
        "source.css punctuation.definition.constant",
        "source.css support.constant",
        "variable.argument.css",
      ],
      "plain"
    ),
    rule(["source.css support.type.property-name"], "attr"),
  ],
  type: "light",
};
