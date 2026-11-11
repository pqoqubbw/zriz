"use client";

import { useState } from "react";

import { describeFile, PHOTO } from "@/registry/demos/photo";
import { ImageEditor } from "@/registry/new-york/blocks/image-editor";

const ImageEditorDemo = () => {
  const [file, setFile] = useState<File | null>(null);

  return (
    <div className="flex w-full flex-col items-center gap-3">
      <ImageEditor image={PHOTO} onSave={setFile} />
      {file === null ? null : (
        <p className="text-xs text-muted-foreground">{describeFile(file)}</p>
      )}
    </div>
  );
};

export default ImageEditorDemo;
