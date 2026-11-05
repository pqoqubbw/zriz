"use client";

import { Fragment, useEffect, useRef } from "react";

import { codePieces, jsonPieces, jsonText } from "@/demos/playground/code";
import type { Painted } from "@/demos/playground/code";
import { playground } from "@/demos/playground/store";
import { usePlayground } from "@/demos/playground/use-playground";
import START_VALUE from "@/snippets/playground/value.json";

type LiveCodeProps = {
  feed: "code" | "value";
};

type LinesProps = {
  lines: Painted;
};

const START_LINES = jsonPieces(jsonText(START_VALUE));

const paint = (target: HTMLElement, lines: Painted): void => {
  const out = document.createDocumentFragment();

  for (const [i, pieces] of lines.entries()) {
    if (i > 0) {
      out.append("\n");
    }

    for (const [part, name] of pieces) {
      if (name === "") {
        out.append(part);
      } else {
        const span = document.createElement("span");

        span.className = name;
        span.textContent = part;
        out.append(span);
      }
    }
  }

  target.replaceChildren(out);
};

const Lines = ({ lines }: LinesProps) =>
  lines.map((pieces, i) => (
    <Fragment key={`${i}-${pieces.length}`}>
      {i > 0 ? "\n" : null}
      {pieces.map(([part, name], j) =>
        name === "" ? (
          <Fragment key={`${j}-${part}`}>{part}</Fragment>
        ) : (
          <span className={name} key={`${j}-${part}`}>
            {part}
          </span>
        )
      )}
    </Fragment>
  ));

const LiveProps = () => {
  const knobs = usePlayground((state) => state.knobs);

  return (
    <code className="block w-max p-4" data-copy-text="">
      <Lines lines={codePieces(knobs)} />
    </code>
  );
};

const LiveValue = () => {
  const box = useRef<HTMLElement>(null);

  useEffect(
    () =>
      playground.subscribeValue((value) => {
        if (box.current) {
          paint(
            box.current,
            value === null ? START_LINES : jsonPieces(jsonText(value))
          );
        }
      }),
    []
  );

  return (
    <code className="block w-max p-4" data-copy-text="" ref={box}>
      <Lines lines={START_LINES} />
    </code>
  );
};

const LiveCode = ({ feed }: LiveCodeProps) =>
  feed === "code" ? <LiveProps /> : <LiveValue />;

export { LiveCode };
