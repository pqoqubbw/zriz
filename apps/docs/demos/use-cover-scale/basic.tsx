"use client";

import { useCoverScale } from "@zriz/react";
import { useState } from "react";

const image = { height: 900, width: 1200 };

const Basic = () => {
  const [rotation, setRotation] = useState(7);
  const scale = useCoverScale({ crop: image, image, rotation });
  return (
    <div className="cover-demo">
      <div className="cover-frame">
        <div
          className="cover-photo"
          style={{ transform: `rotate(${rotation}deg) scale(${scale})` }}
        />
      </div>
      <label>
        <span>Rotation {rotation}°</span>
        <input
          max={45}
          min={-45}
          onChange={(event) => {
            setRotation(Number(event.target.value));
          }}
          type="range"
          value={rotation}
        />
      </label>
      <output>Scale {scale.toFixed(3)}</output>
    </div>
  );
};

export default Basic;
