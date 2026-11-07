const noop = (): void => undefined;

const deferred = <T>(): {
  promise: Promise<T>;
  reject: (reason: unknown) => void;
  resolve: (value: T) => void;
} => {
  let yes: (value: T) => void = noop;
  let no: (reason: unknown) => void = noop;
  const promise = new Promise<T>((resolve, reject) => {
    yes = resolve;
    no = reject;
  });

  return {
    promise,
    reject: (reason: unknown) => {
      no(reason);
    },
    resolve: (value: T) => {
      yes(value);
    },
  };
};

export { deferred };
