const BRACKET_PAIRS: Record<string, string> = {
  "(": ")",
  "<": ">",
  "[": "]",
  "{": "}",
};

const typeTokens = (type: string, commas = false): string[] => {
  const tokens: string[] = [];
  const open: string[] = [];
  let current = "";

  for (let i = 0; i < type.length; i += 1) {
    const char = type.charAt(i);
    const closing = BRACKET_PAIRS[char];

    if (closing !== undefined) {
      open.push(closing);
    } else if (char === open.at(-1)) {
      open.pop();
    }

    if (open.length === 0 && type.startsWith(" | ", i)) {
      tokens.push(current);
      current = "|";
      i += 1;
    } else if (commas && open.length === 0 && type.startsWith(", ", i)) {
      tokens.push(`${current},`);
      current = "";
      i += 1;
    } else {
      current += char;
    }
  }

  tokens.push(current);

  return tokens;
};

export { typeTokens };
