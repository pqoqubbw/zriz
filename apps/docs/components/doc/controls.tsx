"use client";

import { useState } from "react";

import { Panel } from "@/components/ui/panel";
import { cn } from "@/lib/cn";
import type { Control } from "@/lib/doc/schema";

type ControlProps<T extends Control["type"]> = {
  control: Extract<Control, { type: T }>;
};

type ControlRowProps = {
  control: Control;
  ruled: boolean;
};

type ControlsProps = {
  className: string;
  controls: readonly Control[];
};

const Choice = ({ control }: ControlProps<"choice">) => {
  const [value, setValue] = useState(control.value);

  return (
    <fieldset className="flex gap-0.5 rounded-group bg-fill p-0.5">
      <legend className="sr-only">{control.name}</legend>
      {control.options.map((option) => (
        <label
          className="flex h-7 cursor-pointer items-center rounded-item px-2.5 text-control text-faint has-checked:bg-white has-checked:font-medium has-checked:text-ink has-checked:shadow-raised has-focus-visible:corners"
          key={option}
        >
          <input
            checked={value === option}
            className="sr-only"
            name={control.name}
            onChange={() => {
              setValue(option);
            }}
            type="radio"
            value={option}
          />
          {option}
        </label>
      ))}
    </fieldset>
  );
};

const Switch = ({ control }: ControlProps<"switch">) => {
  const [on, setOn] = useState(control.on);

  return (
    <label className="-m-3.25 flex cursor-pointer p-3.25">
      <input
        aria-label={control.name}
        checked={on}
        className="relative m-0 h-4.5 w-7.5 cursor-pointer appearance-none rounded-full bg-off before:absolute before:top-0.5 before:left-0.5 before:size-3.5 before:rounded-full before:bg-white checked:bg-ink checked:before:left-3.5"
        onChange={(event) => {
          setOn(event.currentTarget.checked);
        }}
        role="switch"
        type="checkbox"
      />
    </label>
  );
};

const Range = ({ control }: ControlProps<"range">) => {
  const [value, setValue] = useState(control.value);
  const percent = ((value - control.min) / (control.max - control.min)) * 100;

  return (
    <div className="flex w-full min-w-0 items-center gap-3 sm:w-auto">
      <input
        aria-label={control.name}
        aria-valuetext={`${value}${control.unit}`}
        className="-my-3.25 h-11 min-w-0 flex-1 cursor-pointer appearance-none bg-transparent sm:w-50 sm:flex-initial thumb:-mt-1.5 thumb:size-3.5 thumb:appearance-none thumb:rounded-full thumb:border-0 thumb:bg-ink track:h-0.5 track:rounded-full"
        max={control.max}
        min={control.min}
        onChange={(event) => {
          setValue(Number(event.currentTarget.value));
        }}
        step={control.step}
        style={{
          background: `linear-gradient(to right, var(--color-ink) ${percent}%, var(--color-track) 0) center / 100% 2px no-repeat`,
        }}
        type="range"
        value={value}
      />
      <output
        aria-live="off"
        className="font-mono text-cell-mono text-muted"
      >{`${value}${control.unit}`}</output>
    </div>
  );
};

const ControlRow = ({ control, ruled }: ControlRowProps) => (
  <div
    className={cn(
      "flex flex-col items-start gap-2 py-3 sm:min-h-13 sm:flex-row sm:items-center sm:gap-4 sm:py-0",
      ruled && "inset-shadow-rule forced-colors:border-t"
    )}
  >
    <span className="font-mono text-cell-mono font-medium sm:w-50 sm:shrink-0">
      {control.name}
    </span>
    {control.type === "choice" && <Choice control={control} />}
    {control.type === "switch" && <Switch control={control} />}
    {control.type === "range" && <Range control={control} />}
  </div>
);

const Controls = ({ className, controls }: ControlsProps) => (
  <Panel className={className} data-markdown-ignore="" layout="list">
    {controls.map((control, i) => (
      <ControlRow control={control} key={control.name} ruled={i > 0} />
    ))}
  </Panel>
);

export { Controls };
