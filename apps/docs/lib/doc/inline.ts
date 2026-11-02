import { isSlug, pathOf } from "@/lib/nav";
import type { Slug } from "@/lib/nav";

export type Piece =
  | { kind: "code"; text: string }
  | { anchor: string; kind: "link"; slug: Slug; text: string }
  | { kind: "text"; text: string };

const syntax =
  /`(?<code>[^`]+)`|\[(?<label>[^\]]+)\]\((?<slug>[a-z0-9-]+)(?:#(?<anchor>[a-z0-9-]+))?\)/gu;

const unit =
  /(?<=\d) (?=(?:px|ms|mm|kB|B|s|megapixels|degrees)(?![\w-]))|(?<=\d) (?=(?:×|by) \d)|(?<=\d (?:×|by)) (?=\d)/gu;

export const linkTarget = (slug: string): Slug => {
  if (!isSlug(slug)) {
    throw new Error(`no page ${slug}`);
  }
  return slug;
};

export const hrefOf = (piece: Extract<Piece, { kind: "link" }>): string =>
  piece.anchor === ""
    ? pathOf(piece.slug)
    : `${pathOf(piece.slug)}#${piece.anchor}`;

export const piecesOf = (source: string): Piece[] => {
  const pieces: Piece[] = [];
  let at = 0;
  for (const match of source.matchAll(syntax)) {
    if (match.index > at) {
      pieces.push({ kind: "text", text: source.slice(at, match.index) });
    }
    const { anchor, code, label, slug } = match.groups ?? {};
    if (code === undefined) {
      pieces.push({
        anchor: anchor ?? "",
        kind: "link",
        slug: linkTarget(slug ?? ""),
        text: label ?? "",
      });
    } else {
      pieces.push({ kind: "code", text: code });
    }
    at = match.index + match[0].length;
  }
  if (at < source.length) {
    pieces.push({ kind: "text", text: source.slice(at) });
  }
  return pieces;
};

const keepUnits = (pieces: Piece[]): Piece[] =>
  pieces.map((piece) =>
    piece.kind === "code"
      ? piece
      : { ...piece, text: piece.text.replaceAll(unit, "\u00A0") }
  );

export interface Typeset {
  lead: Piece[];
  tail: Piece[];
}

const splitLastPair = (pieces: Piece[]): Typeset => {
  let spaces = 0;
  for (let i = pieces.length - 1; i >= 0; i -= 1) {
    const piece = pieces[i];
    if (piece?.kind === "link") {
      spaces += piece.text.split(" ").length - 1;
      if (spaces >= 2) {
        return { lead: pieces.slice(0, i), tail: pieces.slice(i) };
      }
    } else if (piece?.kind === "text") {
      let at = piece.text.length;
      while (at > 0) {
        at = piece.text.lastIndexOf(" ", at - 1);
        if (at === -1) {
          break;
        }
        spaces += 1;
        if (spaces === 2) {
          const head = { ...piece, text: piece.text.slice(0, at + 1) };
          const rest = { ...piece, text: piece.text.slice(at + 1) };
          return {
            lead: [...pieces.slice(0, i), head],
            tail: [rest, ...pieces.slice(i + 1)],
          };
        }
      }
    }
  }
  return { lead: [], tail: pieces };
};

export const typeset = (source: string): Typeset =>
  splitLastPair(keepUnits(piecesOf(source)));

export const plain = (source: string): string =>
  piecesOf(source)
    .map((piece) => piece.text)
    .join("");

export const withoutStop = (text: string): string =>
  text.endsWith(".") && !text.endsWith("..") ? text.slice(0, -1) : text;
