const noop = (): void => undefined;

export const deferred = <T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
} => {
  let done: (value: T) => void = noop;
  const promise = new Promise<T>((resolve) => {
    done = resolve;
  });
  return {
    promise,
    resolve: (value: T) => {
      done(value);
    },
  };
};
