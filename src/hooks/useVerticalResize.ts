import { useState, useCallback, useRef, useEffect } from 'react';

interface UseVerticalResizeOptions {
  /** 初期の分割比率 (0.0〜1.0) */
  initialRatio?: number;
  /** 最小比率 (0.0〜1.0) */
  minRatio?: number;
  /** 最大比率 (0.0〜1.0) */
  maxRatio?: number;
}

/**
 * 垂直方向（上下）のドラッグリサイズを管理するカスタムフック
 * @param options リサイズ設定オプション
 * @returns containerRef, topRatio, isDragging, handlePointerDown
 */
export const useVerticalResize = (options: UseVerticalResizeOptions = {}) => {
  const { initialRatio = 0.6, minRatio = 0.2, maxRatio = 0.8 } = options;
  const [topRatio, setTopRatio] = useState<number>(initialRatio);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    const handlePointerMove = (e: PointerEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const relativeY = e.clientY - rect.top;
      const newRatio = relativeY / rect.height;
      const clampedRatio = Math.min(Math.max(newRatio, minRatio), maxRatio);
      setTopRatio(clampedRatio);
    };

    const handlePointerUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [isDragging, minRatio, maxRatio]);

  return { containerRef, topRatio, isDragging, handlePointerDown };
};
