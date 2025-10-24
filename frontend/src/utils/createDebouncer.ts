export type DebouncedRunner = ((fn: () => void) => void) & { cancel: () => void };

export function createDebouncer(delay = 1000): DebouncedRunner {
  let handle: number | null = null;

  const run = ((fn: () => void) => {
    if (handle !== null) {
      window.clearTimeout(handle);
    }
    handle = window.setTimeout(() => {
      fn();
      handle = null;
    }, delay);
  }) as DebouncedRunner;

  run.cancel = () => {
    if (handle !== null) {
      window.clearTimeout(handle);
      handle = null;
    }
  };

  return run;
}
