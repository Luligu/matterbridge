import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useClickOrDoubleClick } from '../src/utils/useClickOrDoubleClick';

describe('useClickOrDoubleClick', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('runs the single click handler once the default delay has passed', () => {
    const onSingle = vi.fn();
    const onDouble = vi.fn();
    const { result } = renderHook(() => useClickOrDoubleClick(onSingle, onDouble));

    result.current('item').onClick();
    vi.advanceTimersByTime(249);
    expect(onSingle).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);

    expect(onSingle).toHaveBeenCalledExactlyOnceWith('item');
    expect(onDouble).not.toHaveBeenCalled();
  });

  it('runs only the double click handler on a double click', () => {
    const onSingle = vi.fn();
    const onDouble = vi.fn();
    const { result } = renderHook(() => useClickOrDoubleClick(onSingle, onDouble, 100));

    // A browser double click fires click, click, dblclick
    const handlers = result.current('item');
    handlers.onClick();
    handlers.onClick();
    handlers.onDoubleClick();
    vi.advanceTimersByTime(1000);

    expect(onDouble).toHaveBeenCalledExactlyOnceWith('item');
    expect(onSingle).not.toHaveBeenCalled();
  });

  it('cancels a pending single click on unmount', () => {
    const onSingle = vi.fn();
    const { result, unmount } = renderHook(() => useClickOrDoubleClick(onSingle, vi.fn()));

    result.current('item').onClick();
    unmount();
    vi.advanceTimersByTime(1000);

    expect(onSingle).not.toHaveBeenCalled();
  });
});
