type Padding = {
  blankLine: "always" | "any";
  next: string | string[];
  prev: string | string[];
};

declare const PADDING: ["error", ...Padding[]];

export { PADDING };
