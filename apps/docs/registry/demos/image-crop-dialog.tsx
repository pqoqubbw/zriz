"use client";

import { useState } from "react";

import { describeFile, PHOTO } from "@/registry/demos/photo";
import { ImageCropDialog } from "@/registry/new-york/blocks/image-crop-dialog";
import { Button } from "@/registry/new-york/ui/button";

const ImageCropDialogDemo = () => {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  return (
    <div className="flex flex-wrap items-center justify-center gap-3">
      <Button
        onClick={() => {
          setOpen(true);
        }}
        type="button"
        variant="outline"
      >
        Crop image
      </Button>
      {file === null ? null : (
        <p className="text-xs text-muted-foreground">{describeFile(file)}</p>
      )}
      <ImageCropDialog
        image={PHOTO}
        onCrop={setFile}
        onOpenChange={setOpen}
        open={open}
      />
    </div>
  );
};

export default ImageCropDialogDemo;
