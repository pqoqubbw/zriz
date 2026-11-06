import { DEMO_SPECS } from "@/demos/registry";
import type {
  DemoName,
  DialZoneSpec,
  RowZoneSpec,
  TrackZoneSpec,
  ZoneSpec,
} from "@/demos/registry";
import { ChipContent, chipVariants } from "@/demos/shell/chip";
import { ghostVariants } from "@/demos/shell/ghost";
import { Icon } from "@/demos/shell/icon";
import type { IconName } from "@/demos/shell/icon";
import {
  Corner,
  Ruler,
  Scale,
  Stage,
  StageContent,
  StageEdge,
  Value,
  Zone,
  ZoneRow,
} from "@/demos/shell/layout";
import { Track, trackItemVariants } from "@/demos/shell/track";

type FrameProps = {
  name: DemoName;
};

type StaticZoneProps = {
  zone: ZoneSpec;
};

type StaticGhostProps = {
  disabled?: boolean;
  icon: IconName;
};

type StaticDialProps = {
  zone: DialZoneSpec;
};

type StaticTrackProps = {
  zone: TrackZoneSpec;
};

type StaticRowProps = {
  zone: RowZoneSpec;
};

const StaticGhost = ({ disabled = false, icon }: StaticGhostProps) => (
  <span
    aria-disabled={disabled || undefined}
    className={ghostVariants({ live: false })}
    data-slot="ghost"
  >
    <Icon className="size-5" name={icon} />
  </span>
);

const StaticDialStrip = () => (
  <div className="absolute inset-x-0 top-2.25">
    <div className="dial-frame" data-slot="dial">
      <div data-slot="dial-ticks" />
    </div>
  </div>
);

const StaticDial = ({ zone }: StaticDialProps) => {
  const ruler = (
    <Ruler>
      <StaticDialStrip />
    </Ruler>
  );

  return (
    <Zone kind={zone.value ? "dial" : "strip"}>
      <ZoneRow dial>
        {zone.start ? <StaticGhost icon={zone.start} /> : null}
        {zone.value ? (
          <Scale value={<Value unit="°">0.0</Value>}>{ruler}</Scale>
        ) : (
          ruler
        )}
        {zone.end ? (
          <StaticGhost disabled={zone.end === "undo"} icon={zone.end} />
        ) : null}
      </ZoneRow>
    </Zone>
  );
};

const StaticZoom = () => (
  <Zone kind="zoom">
    <ZoneRow>
      <StaticGhost disabled icon="zoom-out" />
      <Scale value={<Value unit="×">1.0</Value>}>
        <Ruler width="zoom">
          <span className="absolute inset-x-2 top-3.5 h-1 rounded-full bg-rail" />
          <span className="absolute top-2 left-2 size-4 rounded-full bg-white shadow-raised" />
        </Ruler>
      </Scale>
      <StaticGhost icon="zoom-in" />
    </ZoneRow>
  </Zone>
);

const StaticTrack = ({ zone }: StaticTrackProps) => (
  <Zone kind={zone.kind}>
    <div className="flex gap-1.5">
      <Track>
        {zone.items.map((item) => (
          <span
            className={trackItemVariants({ live: false })}
            data-checked={item === zone.selected ? "" : undefined}
            key={item}
          >
            {item}
          </span>
        ))}
      </Track>
      {zone.end ? (
        <StaticGhost disabled={zone.end === "square"} icon={zone.end} />
      ) : null}
    </div>
  </Zone>
);

const StaticRow = ({ zone }: StaticRowProps) => (
  <Zone kind="row">
    <ZoneRow>
      {zone.icons.map((icon) => (
        <StaticGhost icon={icon} key={icon} />
      ))}
    </ZoneRow>
  </Zone>
);

const StaticZone = ({ zone }: StaticZoneProps) => {
  if (zone.kind === "dial") {
    return <StaticDial zone={zone} />;
  }

  if (zone.kind === "zoom") {
    return <StaticZoom />;
  }

  if (zone.kind === "row") {
    return <StaticRow zone={zone} />;
  }

  return <StaticTrack zone={zone} />;
};

const Frame = ({ name }: FrameProps) => {
  const spec = DEMO_SPECS[name];

  return (
    <div
      className="flex w-full flex-col items-center"
      data-slot="demo-frame"
      inert
    >
      <Stage>
        <Corner side="start">
          <span className={chipVariants({ live: false })}>
            <ChipContent icon="open-image" label="open" />
          </span>
        </Corner>
        <Corner side="end">
          <span className={chipVariants({ live: false, size: "fixed" })}>
            <ChipContent
              collapse
              icon={spec.action.icon}
              label={spec.action.label}
            />
          </span>
        </Corner>
        <StageContent />
        <StageEdge />
      </Stage>
      {spec.zones.map((zone) => (
        <StaticZone key={zone.kind} zone={zone} />
      ))}
    </div>
  );
};

export { Frame };
