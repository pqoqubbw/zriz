"use client";

import { useId } from "react";

import { trackLabel } from "@/demos/registry";
import { useDemoDim } from "@/demos/shell/context";
import { Zone } from "@/demos/shell/layout";
import { Track, trackItemVariants } from "@/demos/shell/track";

type TrackZoneProps<Value extends string> = {
  items: readonly Value[];
  label: string;
  onChange: (value: Value) => void;
  value: Value;
};

const TrackZone = <Value extends string>({
  items,
  label,
  onChange,
  value,
}: TrackZoneProps<Value>) => {
  const dim = useDemoDim();
  const name = useId();

  return (
    <Zone data-dim={dim ? "" : undefined} kind="track">
      <Track aria-label={label} role="radiogroup">
        {items.map((item) => (
          <label
            className={trackItemVariants({ live: "radio" })}
            data-checked={item === value ? "" : undefined}
            key={item}
          >
            <input
              checked={item === value}
              className="sr-only"
              name={name}
              onChange={() => {
                onChange(item);
              }}
              type="radio"
              value={item}
            />
            {trackLabel(item)}
          </label>
        ))}
      </Track>
    </Zone>
  );
};

export type { TrackZoneProps };
export { TrackZone };
