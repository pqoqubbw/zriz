import { ImageCropField } from "@/components/image-crop-field";

type Props = { action: (data: FormData) => Promise<void> };

export const PostForm = ({ action }: Props) => (
  <form action={action}>
    <ImageCropField
      name="cover"
      label="Cover image"
      aspect={16 / 9}
    />
    <button type="submit">Publish</button>
  </form>
);
