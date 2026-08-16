import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useHorizontalResize } from '../hooks/useHorizontalResize';

describe('useHorizontalResize カスタムフック単体テスト', () => {
  it('初期比率と min/max 比率のクランプが正常に機能すること', () => {
    const { result } = renderHook(() =>
      useHorizontalResize({
        initialRatio: 0.5,
        minRatio: 0.2,
        maxRatio: 0.8,
      })
    );

    expect(result.current.leftRatio).toBe(0.5);
    expect(result.current.isDragging).toBe(false);

    // Mock container
    const mockElement = document.createElement('div');
    mockElement.getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      width: 1000,
      height: 600,
      right: 1000,
      bottom: 600,
      x: 0,
      y: 0,
      toJSON: () => {},
    });
    result.current.containerRef.current = mockElement;

    // PointerDown
    act(() => {
      result.current.handlePointerDown({ preventDefault: () => {} } as any);
    });
    expect(result.current.isDragging).toBe(true);

    // PointerMove - 300px (30%)
    act(() => {
      const event = new Event('pointermove');
      Object.assign(event, { clientX: 300 });
      window.dispatchEvent(event);
    });
    expect(result.current.leftRatio).toBe(0.3);

    // PointerMove - 100px (10% -> clamped to 20%)
    act(() => {
      const event = new Event('pointermove');
      Object.assign(event, { clientX: 100 });
      window.dispatchEvent(event);
    });
    expect(result.current.leftRatio).toBe(0.2);

    // PointerMove - 900px (90% -> clamped to 80%)
    act(() => {
      const event = new Event('pointermove');
      Object.assign(event, { clientX: 900 });
      window.dispatchEvent(event);
    });
    expect(result.current.leftRatio).toBe(0.8);

    // PointerUp
    act(() => {
      window.dispatchEvent(new Event('pointerup'));
    });
    expect(result.current.isDragging).toBe(false);
  });
});
