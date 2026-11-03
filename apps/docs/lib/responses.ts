type TextType = "text/markdown" | "text/plain";

type TextInit = {
  headers?: Record<string, string>;
  status?: number;
};

const textResponse = (
  body: string,
  contentType: TextType,
  init: TextInit = {}
): Response =>
  new Response(body, {
    ...init,
    headers: {
      "Content-Type": `${contentType}; charset=utf-8`,
      ...init.headers,
    },
  });

export { textResponse };
