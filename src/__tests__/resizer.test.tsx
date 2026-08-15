import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { RightPanel } from '../components/RightPanel';
import { renderHook, act } from '@testing-library/react';
import { useVerticalResize } from '../hooks/useVerticalResize';

describe('RightPanel ドラッグリサイズ機能の検証', () => {
  it('RightPanel にリサイザーバー（role="separator"）が正常に描画されること', () => {
    render(<RightPanel />);
    const resizer = screen.getByTestId('right-panel-resizer');
    expect(resizer).toBeDefined();
    expect(resizer.getAttribute('role')).toBe('separator');
  });

  it('useVerticalResize フックが初期比率とクランプ範囲内で正しく動作すること', () => {
    const { result } = renderHook(() =>
      useVerticalResize({ initialRatio: 0.6, minRatio: 0.2, maxRatio: 0.8 })
    );

    expect(result.current.topRatio).toBe(0.6);
    expect(result.current.isDragging).toBe(false);

    // ドラッグ開始
    act(() => {
      result.current.handlePointerDown({
        preventDefault: () => {},
      } as unknown as React.PointerEvent);
    });

    expect(result.current.isDragging).toBe(true);

    // ドラッグ終了
    act(() => {
      window.dispatchEvent(new Event('pointerup'));
    });

    expect(result.current.isDragging).toBe(false);
  });

  it('ホバー時にリサイザーの背景色が変更されること', () => {
    render(<RightPanel />);
    const resizer = screen.getByTestId('right-panel-resizer');

    fireEvent.mouseEnter(resizer);
    expect(resizer.style.backgroundColor).toBe('rgb(59, 130, 246)');

    fireEvent.mouseLeave(resizer);
    expect(resizer.style.backgroundColor).toBe('rgb(226, 232, 240)');
  });
});
