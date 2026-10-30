import { useEffect, useRef } from 'react';

export interface ClickOrDoubleClickHandlers {
  onClick: () => void;
  onDoubleClick: () => void;
}

/**
 * Distinguish a single click from a double click on the same element.
 * The single click handler runs only once the delay has passed without a double click, so a double click never triggers it.
 * This lets a single click open a modal dialog whose backdrop would otherwise swallow the second click of a double click.
 * A pending single click is cancelled when the component unmounts.
 * @param {(arg: T) => void} onSingle - Called with the argument after a single click, once the delay has passed.
 * @param {(arg: T) => void} onDouble - Called with the argument on a double click.
 * @param {number} [delay] - How long to wait for a double click before running the single click handler, in milliseconds. Defaults to 250.
 * @returns {(arg: T) => ClickOrDoubleClickHandlers} A function that returns the onClick and onDoubleClick props for the given argument.
 */
export function useClickOrDoubleClick<T>(onSingle: (arg: T) => void, onDouble: (arg: T) => void, delay = 250): (arg: T) => ClickOrDoubleClickHandlers {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancel = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  return (arg: T) => ({
    onClick: () => {
      // The second click of a double click also lands here: restart the delay so onDoubleClick can cancel it
      cancel();
      timer.current = setTimeout(() => {
        timer.current = null;
        onSingle(arg);
      }, delay);
    },
    onDoubleClick: () => {
      cancel();
      onDouble(arg);
    },
  });
}
