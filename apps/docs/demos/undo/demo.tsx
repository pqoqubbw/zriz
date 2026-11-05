"use client";

import type { CommitDetails, CropValue } from "@zriz/react";
import { CropperContext } from "@zriz/react";
import * as Cropper from "@zriz/react/cropper";
import { useContext, useState } from "react";

import { Icon } from "@/components/ui/icon";
import { useDemoPhoto } from "@/demos/shell/context";
import type { DemoPhoto } from "@/demos/shell/context";
import { DemoShell } from "@/demos/shell/demo-shell";
import { DialZone } from "@/demos/shell/dial-zone";
import { ghostVariants } from "@/demos/shell/ghost";

type History = {
  photo: string;
  stack: readonly CropValue[];
};

type UndoButtonProps = {
  history: History;
  onStep: (photo: string) => void;
};

const SKIPPED = new Set(["history", "coverage"]);

const LIMIT = 50;

const UndoButton = ({ history, onStep }: UndoButtonProps) => {
  const cropper = useContext(CropperContext);
  const photo = useDemoPhoto();
  const stack = history.photo === photo.key ? history.stack : [];
  const previous = stack.at(-1);

  return (
    <button
      aria-disabled={stack.length === 0}
      aria-label="Undo"
      className={ghostVariants()}
      onClick={() => {
        if (!previous || !cropper || cropper.getState().interacting) {
          return;
        }

        onStep(photo.key);
        cropper.setValue(previous, { reason: "history" });
      }}
      type="button"
    >
      <Icon className="size-5" name="undo" />
    </button>
  );
};

const UndoDemo = () => {
  const [history, setHistory] = useState<History>({ photo: "", stack: [] });

  const remember =
    (photo: string) =>
    (_: CropValue, details: CommitDetails): void => {
      if (SKIPPED.has(details.reason)) {
        return;
      }

      setHistory((last) => ({
        photo,
        stack: [
          ...(last.photo === photo ? last.stack : []),
          details.previous,
        ].slice(-LIMIT),
      }));
    };

  const step = (photo: string): void => {
    setHistory((last) =>
      last.photo === photo ? { photo, stack: last.stack.slice(0, -1) } : last
    );
  };

  return (
    <DemoShell
      name="undo"
      photoProps={(photo: DemoPhoto) => ({
        onValueCommit: remember(photo.key),
      })}
    >
      <DialZone
        end={
          <Cropper.Rotate aria-label="Rotate left" className={ghostVariants()}>
            <Icon className="size-5" name="rotate-left" />
          </Cropper.Rotate>
        }
        start={<UndoButton history={history} onStep={step} />}
      />
    </DemoShell>
  );
};

export default UndoDemo;
