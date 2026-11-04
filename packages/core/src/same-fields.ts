export const sameFields = <T extends object>(a: T, b: T): boolean => {
  for (const key in a) {
    if (a[key] !== b[key]) {
      return false;
    }
  }
  return true;
};
