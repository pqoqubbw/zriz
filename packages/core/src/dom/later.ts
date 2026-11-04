const afterPaint = (load: () => Promise<unknown>): void => {
  const run = (): void => {
    setTimeout(() => {
      load().catch(() => null);
    }, 0);
  };

  if (typeof requestAnimationFrame === "function") {
    requestAnimationFrame(run);
  } else {
    run();
  }
};

export { afterPaint };
