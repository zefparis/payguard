/**
 * P-10: PayGuard DemoGuard Query Param Tests
 *
 * Tests:
 * 1. DemoGuard reads sessionPublicId from URL query param
 * 2. DemoGuard does not auto-submit on query param
 * 3. DemoGuard validates sessionPublicId format (hcs_sess_ prefix)
 * 4. Invalid query param is ignored
 *
 * @copyright (c) 2026 Benjamin BARRERE / IA SOLUTION
 * Patents Pending FR2514274 | FR2514546
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const ROOT_DIR = path.resolve(__dirname, '..');
const DEMOGUARD_FILE = path.join(ROOT_DIR, 'src', 'pages', 'DemoGuard.tsx');

function readFileSafe(filePath: string): string {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return '';
  }
}

describe('P-10 PayGuard DemoGuard Query Param', () => {
  const source = readFileSafe(DEMOGUARD_FILE);

  it('DemoGuard file exists and has content', () => {
    expect(source.length).toBeGreaterThan(0);
  });

  it('imports useSearchParams from react-router-dom', () => {
    expect(source).toContain('useSearchParams');
  });

  it('reads sessionPublicId from URL query param', () => {
    expect(source).toContain("searchParams.get('sessionPublicId')");
  });

  it('validates sessionPublicId format (hcs_sess_ prefix)', () => {
    expect(source).toContain('hcs_sess_');
    expect(source).toMatch(/test\(querySession\)/);
  });

  it('does not auto-submit on query param (no handleSubmit in useEffect block)', () => {
    const lines = source.split('\n');
    const queryParamLine = lines.findIndex((l) => l.includes("searchParams.get('sessionPublicId')"));
    expect(queryParamLine).toBeGreaterThan(-1);
    const block = lines.slice(queryParamLine, queryParamLine + 10).join('\n');
    expect(block).not.toContain('handleSubmit');
    expect(block).not.toContain("setPhase('device')");
  });
});
