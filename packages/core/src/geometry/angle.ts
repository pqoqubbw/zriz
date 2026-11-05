import type { QuarterTurns } from "./types";

const QUARTER_TURNS: readonly QuarterTurns[] = [0, 1, 2, 3];

const toQuarterTurns = (turns: number): QuarterTurns =>
  QUARTER_TURNS[((turns % 4) + 4) % 4] ?? 0;

const rotateByQuarters = (
  sin: number,
  cos: number,
  turns: number
): { sin: number; cos: number } => {
  const quarter = toQuarterTurns(turns);

  if (quarter === 0) {
    return { cos, sin };
  }

  if (quarter === 1) {
    return { cos: -sin, sin: cos };
  }

  if (quarter === 2) {
    return { cos: -cos, sin: -sin };
  }

  return { cos: sin, sin: -cos };
};

const sinCosDegrees = (degrees: number): { sin: number; cos: number } => {
  const turns = Math.round(degrees / 90);
  const rest = degrees - 90 * turns;

  if (rest === -45) {
    return rotateByQuarters(-Math.SQRT1_2, Math.SQRT1_2, turns);
  }

  const radians = (rest * Math.PI) / 180;

  return rotateByQuarters(Math.sin(radians), Math.cos(radians), turns);
};

const positiveZero = (value: number): number => value + 0;

export { positiveZero, sinCosDegrees, toQuarterTurns };
