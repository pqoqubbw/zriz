export const serveUpload = (jpeg: Buffer) =>
  new Response(new Uint8Array(jpeg), {
    headers: {
      "content-type": "image/jpeg",
      "content-disposition": 'inline; filename="photo.jpg"',
      "content-security-policy": "default-src 'none'; sandbox",
      "x-content-type-options": "nosniff",
    },
  });
