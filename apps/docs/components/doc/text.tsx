import Link from "next/link";

import { cn } from "@/lib/cn";
import { typeset } from "@/lib/doc/inline";
import type { Piece } from "@/lib/doc/inline";
import { pagePath } from "@/lib/nav";

type TextProps = {
  source: string;
};

const LONG_CODE = 28;
const WRAPPING_CODE = 44;

const renderPieces = (pieces: Piece[], prefix: string) =>
  pieces.map((piece, i) => {
    const key = `${prefix}${i}`;

    if (piece.kind === "code") {
      return (
        <code
          className={cn(
            "chip",
            piece.text.length > LONG_CODE &&
              "max-sm:inline max-sm:box-decoration-clone",
            piece.text.length > WRAPPING_CODE && "inline box-decoration-clone"
          )}
          key={key}
        >
          {piece.text}
        </code>
      );
    }

    if (piece.kind === "external") {
      return (
        <a className="link" href={piece.href} key={key} rel="noreferrer">
          {piece.text}
        </a>
      );
    }

    if (piece.kind === "link") {
      return (
        <Link
          className="link"
          href={pagePath(piece.slug, piece.anchor)}
          key={key}
          prefetch={false}
        >
          {piece.text}
        </Link>
      );
    }

    return piece.text;
  });

const Text = ({ source }: TextProps) => {
  const { lead, tail } = typeset(source);

  return (
    <>
      {renderPieces(lead, "l")}
      <span className="inline-block max-w-full">{renderPieces(tail, "t")}</span>
    </>
  );
};

export { Text };
