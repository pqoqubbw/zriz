const PADDING = [
  "error",
  { blankLine: "always", next: "return", prev: "*" },
  { blankLine: "always", next: "*", prev: ["const", "let"] },
  { blankLine: "any", next: ["const", "let"], prev: ["const", "let"] },
  {
    blankLine: "always",
    next: "*",
    prev: ["block-like", "multiline-expression"],
  },
  {
    blankLine: "always",
    next: ["block-like", "multiline-expression"],
    prev: "*",
  },
  { blankLine: "always", next: "*", prev: "directive" },
];

export { PADDING };
