"use client";

import { useCoverScale } from "@zriz/react";

export const Scale = () => {
  const scale = useCoverScale({
    image: { width: 4032, height: 3024 },
    crop: { width: 4032, height: 3024 },
    rotation: 5,
  });

  return <p>{scale.toFixed(4)}</p>;
};
