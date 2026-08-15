import { describe, it, expect } from 'vitest';
import { SAMPLE_PROGRAMS, DEFAULT_SAMPLE } from '../services/samplePrograms';

/**
 * サンプルプログラム定義モジュールの単体テスト
 */
describe('samplePrograms モジュールテスト', () => {
  it('プリセットサンプルプログラムが 3 種類以上定義されていること', () => {
    expect(SAMPLE_PROGRAMS.length).toBeGreaterThanOrEqual(3);
  });

  it('デフォルトサンプルプログラムが定義されており、seq であること', () => {
    expect(DEFAULT_SAMPLE).toBeDefined();
    expect(DEFAULT_SAMPLE.id).toBe('seq');
  });

  it('全サンプルに必須プロパティ (id, name, description, code) が含まれること', () => {
    SAMPLE_PROGRAMS.forEach((sample) => {
      expect(sample.id).toBeTypeOf('string');
      expect(sample.name).toBeTypeOf('string');
      expect(sample.description).toBeTypeOf('string');
      expect(sample.code).toBeTypeOf('string');
      expect(sample.code.length).toBeGreaterThan(0);
    });
  });

  it('各サンプルプログラムのコードが要求仕様のパターンを含んでいること', () => {
    const sample1 = SAMPLE_PROGRAMS.find((s) => s.id === 'seq');
    const sample2 = SAMPLE_PROGRAMS.find((s) => s.id === 'branch');
    const sample3 = SAMPLE_PROGRAMS.find((s) => s.id === 'loop');

    expect(sample1?.code).toContain('x = 5');
    expect(sample1?.code).toContain('total = x + y');

    expect(sample2?.code).toContain('if score >= 80:');
    expect(sample2?.code).toContain('elif score >= 60:');

    expect(sample3?.code).toContain('def add(a, b):');
    expect(sample3?.code).toContain('for i in range(1, 4):');
  });
});
