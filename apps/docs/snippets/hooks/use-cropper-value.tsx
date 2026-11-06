"use client";

import { useCropperValue } from "@zriz/react";

export const Angle = () => {
  const value = useCropperValue();

  return <p>{value.rotation.toFixed(1)}°</p>;
};
