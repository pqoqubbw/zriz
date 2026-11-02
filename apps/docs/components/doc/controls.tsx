"use client";

import { useState } from "react";

import { cn } from "@/lib/cn";
import type { Control } from "@/lib/doc/schema";

const Choice = ({
  control,
}: {
  control: Extract<Control, { type: "choice" }>;
}) => {
  const [value, setValue] = useState(control.value);
  return (
    <fieldset className="rounded-group bg-fill flex gap-0.5 p-0.5">
      <legend className="sr-only">{control.name}</legend>
      {control.options.map((option) => (
        <label
          className="rounded-item text-control text-faint has-checked:text-ink has-checked:shadow-raised has-focus-visible:outline-ink flex h-7 cursor-pointer items-center px-2.5 has-checked:bg-white has-checked:font-medium has-focus-visible:outline-2 has-focus-visible:outline-offset-1"
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

const Switch = ({
  control,
}: {
  control: Extract<Control, { type: "switch" }>;
}) => {
  const [on, setOn] = useState(control.on);
  return (
    <label className="-m-3.25 flex cursor-pointer p-3.25">
      <input
        aria-label={control.name}
        checked={on}
        className="bg-off checked:bg-ink relative m-0 h-4.5 w-7.5 cursor-pointer appearance-none rounded-full before:absolute before:top-0.5 before:left-0.5 before:size-3.5 before:rounded-full before:bg-white checked:before:left-3.5"
        onChange={(event) => {
          setOn(event.currentTarget.checked);
        }}
        role="switch"
        type="checkbox"
      />
    </label>
  );
};

const Range = ({
  control,
}: {
  control: Extract<Control, { type: "range" }>;
}) => {
  const [value, setValue] = useState(control.value);
  const percent = ((value - control.min) / (control.max - control.min)) * 100;
  return (
    <div className="flex w-full min-w-0 items-center gap-3 sm:w-auto">
      <input
        aria-label={control.name}
        aria-valuetext={`${value}${control.unit}`}
        className="track:h-0.5 track:rounded-full thumb:-mt-1.5 thumb:size-3.5 thumb:appearance-none thumb:rounded-full thumb:border-0 thumb:bg-ink -my-3.25 h-11 min-w-0 flex-1 cursor-pointer appearance-none bg-transparent sm:w-50 sm:flex-initial"
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
        className="text-cell-mono text-muted font-mono"
      >{`${value}${control.unit}`}</output>
    </div>
  );
};

export const Controls = ({
  className,
  controls,
}: {
  className: string;
  controls: readonly Control[];
}) => (
  <div
    className={cn("rounded-panel bg-surface flex flex-col px-4", className)}
    data-markdown-ignore=""
  >
    {controls.map((control, i) => (
      <div
        className={cn(
          "flex flex-col items-start gap-2 py-3 sm:min-h-13 sm:flex-row sm:items-center sm:gap-4 sm:py-0",
          i > 0 && "inset-shadow-rule"
        )}
        key={control.name}
      >
        <span className="text-cell-mono font-mono font-medium sm:w-50 sm:shrink-0">
          {control.name}
        </span>
        {control.type === "choice" && <Choice control={control} />}
        {control.type === "switch" && <Switch control={control} />}
        {control.type === "range" && <Range control={control} />}
      </div>
    ))}
  </div>
);
