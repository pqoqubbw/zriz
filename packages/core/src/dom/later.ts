const ignore = (): null => null;

export const afterPaint = (load: () => Promise<unknown>): void => {
  const run = (): void => {
    setTimeout(() => {
      load().catch(ignore);
    }, 0);
  };
  if (typeof requestAnimationFrame === "function") {
    requestAnimationFrame(run);
  } else {
    run();
  }
};
