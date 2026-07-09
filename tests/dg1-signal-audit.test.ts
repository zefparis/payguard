/**
 * DG-1: Static audit tests for PayGuard mobile signal layer
 *
 * Proves via static analysis that:
 * 1. No HV_API_KEY or X-API-Key in client-side code
 * 2. No sessionToken / cognitiveSessionToken sent from PayGuard mobile
 * 3. No PII (first_name, last_name, student_id, selfie_b64) in pay-verify response type
 * 4. hcs_session_public_id stays optional in payload
 * 5. No hcsCode / hcsResultToken / JWT in client code
 * 6. No DeviceMotion / DeviceOrientation / touch dynamics collected (confirms missing signals)
 * 7. No navigator.connection / Network Information API used
 *
 * @copyright (c) 2026 Benjamin BARRERE / IA SOLUTION
 * Patents Pending FR2514274 | FR2514546
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const SRC_DIR = path.resolve(__dirname, '..', 'src');
const API_FILE = path.join(SRC_DIR, 'lib', 'api.ts');
const CONFIG_FILE = path.join(SRC_DIR, 'constants', 'config.ts');
const FLOW_TYPES_FILE = path.join(SRC_DIR, 'types', 'flow.ts');

function readFile(filePath: string): string {
  return fs.readFileSync(filePath, 'utf-8');
}

function readAllSrcFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...readAllSrcFiles(fullPath));
    } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
      results.push(readFile(fullPath));
    }
  }
  return results;
}

describe('DG-1: Static audit — no API key client-side', () => {
  it('api.ts does not contain HV_API_KEY', () => {
    const source = readFile(API_FILE);
    expect(source).not.toContain('HV_API_KEY');
  });

  it('api.ts does not contain X-API-Key header', () => {
    const source = readFile(API_FILE);
    expect(source).not.toContain('X-API-Key');
  });

  it('api.ts does not contain Authorization header', () => {
    const source = readFile(API_FILE);
    expect(source).not.toContain('Authorization');
    expect(source).not.toContain('Bearer ');
  });

  it('config.ts does not contain API key references', () => {
    const source = readFile(CONFIG_FILE);
    expect(source).not.toContain('HV_API_KEY');
    expect(source).not.toContain('API_KEY');
    expect(source).not.toContain('X-API-Key');
  });

  it('no src file contains NEXT_PUBLIC_ secrets', () => {
    const files = readAllSrcFiles(SRC_DIR);
    for (const content of files) {
      expect(content).not.toContain('NEXT_PUBLIC_');
    }
  });

  it('no src file contains hardcoded API keys or secret patterns', () => {
    const files = readAllSrcFiles(SRC_DIR);
    const secretPatterns = [
      /sk_[a-zA-Z0-9]{20}/,
      /pk_[a-zA-Z0-9]{20}/,
      /x-api-key/i,
    ];
    for (const content of files) {
      for (const pattern of secretPatterns) {
        expect(content).not.toMatch(pattern);
      }
    }
  });
});

describe('DG-1: Static audit — no sessionToken / hcsCode / JWT sent', () => {
  it('no src file contains sessionToken', () => {
    const files = readAllSrcFiles(SRC_DIR);
    for (const content of files) {
      expect(content).not.toContain('sessionToken');
    }
  });

  it('no src file contains cognitiveSessionToken', () => {
    const files = readAllSrcFiles(SRC_DIR);
    for (const content of files) {
      expect(content).not.toContain('cognitiveSessionToken');
    }
  });

  it('no src file contains hcsCode', () => {
    const files = readAllSrcFiles(SRC_DIR);
    for (const content of files) {
      expect(content).not.toContain('hcsCode');
    }
  });

  it('no src file contains hcsResultToken', () => {
    const files = readAllSrcFiles(SRC_DIR);
    for (const content of files) {
      expect(content).not.toContain('hcsResultToken');
    }
  });

  it('no src file contains JWT or jsonwebtoken', () => {
    const files = readAllSrcFiles(SRC_DIR);
    for (const content of files) {
      expect(content).not.toMatch(/\bjwt\b/i);
      expect(content).not.toContain('jsonwebtoken');
    }
  });
});

describe('DG-1: Static audit — no PII in pay-verify response', () => {
  it('payVerify return type does not include first_name', () => {
    const source = readFile(API_FILE);
    const payVerifyMatch = source.match(/payVerify[\s\S]*?Promise<(\{[\s\S]*?\})>/);
    expect(payVerifyMatch).toBeDefined();
    const returnType = payVerifyMatch![1];
    expect(returnType).not.toContain('first_name');
    expect(returnType).not.toContain('last_name');
    expect(returnType).not.toContain('student_id');
    expect(returnType).not.toContain('selfie_b64');
    expect(returnType).not.toContain('vocal_embedding');
  });

  it('payVerify return type includes only safe fields', () => {
    const source = readFile(API_FILE);
    const payVerifyMatch = source.match(/payVerify[\s\S]*?Promise<(\{[\s\S]*?\})>/);
    expect(payVerifyMatch).toBeDefined();
    const returnType = payVerifyMatch![1];
    expect(returnType).toContain('decision');
    expect(returnType).toContain('trust_score');
    expect(returnType).toContain('verified');
    expect(returnType).toContain('similarity');
  });
});

describe('DG-1: Static audit — hcs_session_public_id optional', () => {
  it('hcs_session_public_id is optional in payVerify payload type', () => {
    const source = readFile(API_FILE);
    const payloadMatch = source.match(/payVerify\(payload:\s*\{[\s\S]*?\}\)/);
    expect(payloadMatch).toBeDefined();
    const payloadType = payloadMatch![0];
    expect(payloadType).toContain('hcs_session_public_id?');
  });

  it('FlowState hcsSessionPublicId is nullable', () => {
    const source = readFile(FLOW_TYPES_FILE);
    expect(source).toContain('hcsSessionPublicId: string | null');
  });

  it('initialFlowState has hcsSessionPublicId as null', () => {
    const reducerSource = readFile(path.join(SRC_DIR, 'state', 'flowReducer.ts'));
    expect(reducerSource).toContain('hcsSessionPublicId: null');
  });
});

describe('DG-1: Static audit — missing signals confirmation (PayGuard, excluding DemoGuard)', () => {
  function readNonDgFiles(): string[] {
    const dgFiles = readAllSrcFiles(path.join(SRC_DIR, 'demoguard'));
    return readAllSrcFiles(SRC_DIR).filter(
      (content) => !dgFiles.includes(content),
    );
  }

  it('no PayGuard src file uses DeviceMotionEvent (excluding demoguard)', () => {
    const files = readNonDgFiles();
    for (const content of files) {
      expect(content).not.toContain('DeviceMotionEvent');
      expect(content).not.toContain('devicemotion');
    }
  });

  it('no PayGuard src file uses DeviceOrientationEvent (excluding demoguard)', () => {
    const files = readNonDgFiles();
    for (const content of files) {
      expect(content).not.toContain('DeviceOrientationEvent');
      expect(content).not.toContain('deviceorientation');
    }
  });

  it('no PayGuard src file uses touchstart / pointerdown / pointermove (excluding demoguard)', () => {
    const files = readNonDgFiles();
    for (const content of files) {
      expect(content).not.toContain('touchstart');
      expect(content).not.toContain('pointerdown');
      expect(content).not.toContain('pointermove');
    }
  });

  it('no PayGuard src file uses visibilitychange (excluding demoguard)', () => {
    const files = readNonDgFiles();
    for (const content of files) {
      expect(content).not.toContain('visibilitychange');
    }
  });

  it('no PayGuard src file uses navigator.connection (excluding demoguard)', () => {
    const files = readNonDgFiles();
    for (const content of files) {
      expect(content).not.toContain('navigator.connection');
      expect(content).not.toContain('effectiveType');
    }
  });

  it('no src file (excluding demoguard) uses navigator.permissions', () => {
    const files = readAllSrcFiles(path.join(SRC_DIR, 'demoguard'));
    const nonDgFiles = readAllSrcFiles(SRC_DIR).filter(
      (content) => !files.includes(content),
    );
    for (const content of nonDgFiles) {
      expect(content).not.toContain('navigator.permissions');
    }
  });
});

describe('DG-1: Static audit — tenant override is server-side', () => {
  it('client config.ts exposes TENANT_ID but proxy overrides it', () => {
    const configSource = readFile(CONFIG_FILE);
    expect(configSource).toContain('TENANT_ID');

    const proxySource = readFile(path.resolve(__dirname, '..', 'api', '_lib', 'proxy.ts'));
    expect(proxySource).toContain('PAYGUARD_TENANT_ID');
    expect(proxySource).toContain('applyTenantOverride');
  });
});
