import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Header } from '../components/Header';

describe('トレース準備ボタン配置調整の検証 (Issue #16)', () => {
  it('ステータスバッジの右隣に「トレース準備」ボタンが描画されること', () => {
    const onRun = vi.fn();
    render(<Header statusText="準備完了 (ready)" onRun={onRun} isCodeDirty={false} />);

    const runBtn = screen.getByTestId('btn-run') as HTMLButtonElement;
    expect(runBtn).toBeDefined();
    expect(runBtn.textContent).toBe('トレース準備');
    expect(runBtn.disabled).toBe(true); // コードが変更されていない場合はdisabled
  });

  it('コード変更時（isCodeDirty = true）にボタンが有効化され、クリックでonRunが呼び出されること', () => {
    const onRun = vi.fn();
    render(<Header statusText="コードが変更されました" onRun={onRun} isCodeDirty={true} />);

    const runBtn = screen.getByTestId('btn-run') as HTMLButtonElement;
    expect(runBtn.disabled).toBe(false);

    fireEvent.click(runBtn);
    expect(onRun).toHaveBeenCalledTimes(1);
  });

  it('トレース実行中（isTracing = true）に「準備中...」と表示され無効化されること', () => {
    const onRun = vi.fn();
    render(<Header statusText="トレース実行中..." onRun={onRun} isTracing={true} isCodeDirty={true} />);

    const runBtn = screen.getByTestId('btn-run') as HTMLButtonElement;
    expect(runBtn.textContent).toBe('準備中...');
    expect(runBtn.disabled).toBe(true);
  });

  it('ナビゲーション領域には「最初」「前へ」「次へ」「最後」ボタンが配置されていること', () => {
    render(<Header currentStep={1} totalSteps={5} onRun={vi.fn()} />);

    expect(screen.getByTestId('btn-first')).toBeDefined();
    expect(screen.getByTestId('btn-prev')).toBeDefined();
    expect(screen.getByTestId('btn-next')).toBeDefined();
    expect(screen.getByTestId('btn-last')).toBeDefined();
  });
});
