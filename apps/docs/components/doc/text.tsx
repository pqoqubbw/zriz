import Link from "next/link";

import { cn } from "@/lib/cn";
import { hrefOf, typeset } from "@/lib/doc/inline";
import type { Piece } from "@/lib/doc/inline";

const long = 28;

const render = (pieces: Piece[], prefix: string) =>
  pieces.map((piece, i) => {
    const key = `${prefix}${i}`;
    if (piece.kind === "code") {
      return (
        <code
          className={cn(
            "chip",
            piece.text.length > long &&
              "max-sm:inline max-sm:[box-decoration-break:clone] max-sm:[overflow-wrap:anywhere] max-sm:whitespace-pre-wrap"
          )}
          key={key}
        >
          {piece.text}
        </code>
      );
    }
    if (piece.kind === "link") {
      return (
        <Link className="link" href={hrefOf(piece)} key={key} prefetch={false}>
          {piece.text}
        </Link>
      );
    }
    return piece.text;
  });

export const Text = ({ source }: { source: string }) => {
  const { lead, tail } = typeset(source);
  return (
    <>
      {render(lead, "l")}
      <span className="inline-block max-w-full">{render(tail, "t")}</span>
    </>
  );
};
