"use client";

import { useCropperFrame } from "@zriz/react";
import { useRef } from "react";

export const LiveAngle = () => {
  const label = useRef<HTMLOutputElement>(null);
  useCropperFrame(({ value }) => {
    const angle = value.rotation.toFixed(1);
    if (label.current) label.current.textContent = `${angle}°`;
  });
  return <output ref={label} />;
};
