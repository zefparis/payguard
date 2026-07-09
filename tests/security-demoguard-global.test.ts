/**
 * DG-9: Global DemoGuard security regression — PayGuard repo
 *
 * Verifies across the entire payguard repo:
 * - No API keys in client code (HV_API_KEY, HCS_API_KEY, X-API-Key)
 * - No sessionToken usage in DemoGuard client
 * - No direct hybrid-vector-api calls from client
 * - Client calls only /api/demoguard/verify
 * - Proxy sanitizes logs and response
 * - Proxy forces tenant_id/source server-side
 * - No CORS wildcard
 * - No sensitive payload in localStorage
 * - All 26 global forbidden fields covered in sanitizer
 * - Malicious nested payload fully sanitized
 *
 * @copyright (c) 2026 Benjamin BARRERE / IA SOLUTION
 * Patents Pending FR2514274 | FR2514546
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { sanitizeValue, sanitizeResponse } from '../api/_lib/demoguardSanitize';

const ROOT = path.resolve(__dirname, '..');
const SRC_DIR = path.join(ROOT, 'src');
const API_DIR = path.join(ROOT, 'api');

function readAllFiles(dir: string, exts: string[], results: { relPath: string; content: string }[] = []): { relPath: string; content: string }[] {
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      readAllFiles(fullPath, exts, results);
    } else if (exts.some((ext) => entry.name.endsWith(ext))) {
      results.push({
        relPath: path.relative(ROOT, fullPath),
        content: fs.readFileSync(fullPath, 'utf-8'),
      });
    }
  }
  return results;
}

const ALL_SRC_FILES = readAllFiles(SRC_DIR, ['.ts', '.tsx']);
const ALL_API_FILES = readAllFiles(API_DIR, ['.ts']);

const GLOBAL_FORBIDDEN_FIELDS = [
  'selfie_b64',
  'voice_b64',
  'raw_audio',
  'raw_image',
  'raw_motion_trace',
  'raw_touch_trace',
  'face_embedding',
  'vocal_embedding',
  'mfcc',
  'mfcc_raw',
  'mfcc_summary',
  'voiceprint',
  'first_name',
  'last_name',
  'student_id',
  'email',
  'phone',
  'token',
  'jwt',
  'sessionToken',
  'hcsResultToken',
  'hcsCode',
  'components',
  'breakdown',
  'detail',
  'debug',
  'internal',
];

// ─── 1. No API keys in client code ─────────────────────────────────

describe('DG-9 PayGuard: No API keys in client code', () => {
  it('no src/ file contains HV_API_KEY', () => {
    for (const f of ALL_SRC_FILES) {
      expect(f.content).not.toContain('HV_API_KEY');
    }
  });

  it('no src/ file contains HCS_API_KEY', () => {
    for (const f of ALL_SRC_FILES) {
      expect(f.content).not.toContain('HCS_API_KEY');
    }
  });

  it('no src/ file contains X-API-Key', () => {
    for (const f of ALL_SRC_FILES) {
      expect(f.content).not.toContain('X-API-Key');
    }
  });

  it('no src/ file contains process.env.HV', () => {
    for (const f of ALL_SRC_FILES) {
      expect(f.content).not.toContain('process.env.HV');
    }
  });
});

// ─── 2. No sessionToken in DemoGuard client ────────────────────────

describe('DG-9 PayGuard: No sessionToken in DemoGuard client', () => {
  it('no src/demoguard/ file contains sessionToken', () => {
    const dgFiles = ALL_SRC_FILES.filter((f) => f.relPath.includes('demoguard'));
    for (const f of dgFiles) {
      expect(f.content).not.toContain('sessionToken');
    }
  });

  it('no src/demoguard/ file contains hcsCode', () => {
    const dgFiles = ALL_SRC_FILES.filter((f) => f.relPath.includes('demoguard'));
    for (const f of dgFiles) {
      expect(f.content).not.toContain('hcsCode');
    }
  });

  it('no src/demoguard/ file contains hcsResultToken', () => {
    const dgFiles = ALL_SRC_FILES.filter((f) => f.relPath.includes('demoguard'));
    for (const f of dgFiles) {
      expect(f.content).not.toContain('hcsResultToken');
    }
  });
});

// ─── 3. No direct hybrid-vector-api calls from client ──────────────

describe('DG-9 PayGuard: No direct hybrid-vector-api calls', () => {
  it('client api.ts does not reference hybrid-vector-api', () => {
    const apiFile = ALL_SRC_FILES.find((f) => f.relPath.replace(/\\/g, '/').endsWith('demoguard/api.ts'));
    expect(apiFile).toBeDefined();
    expect(apiFile!.content).not.toContain('hybrid-vector-api');
    expect(apiFile!.content).not.toContain('onrender.com');
    expect(apiFile!.content).not.toContain('render.com');
  });

  it('no src/ file references hybrid-vector-api URL', () => {
    for (const f of ALL_SRC_FILES) {
      expect(f.content).not.toContain('hybrid-vector-api-m5xt');
    }
  });
});

// ─── 4. Client calls only /api/demoguard/verify ────────────────────

describe('DG-9 PayGuard: Client calls only proxy', () => {
  it('client api.ts calls /api/demoguard/verify', () => {
    const apiFile = ALL_SRC_FILES.find((f) => f.relPath.replace(/\\/g, '/').endsWith('demoguard/api.ts'));
    expect(apiFile).toBeDefined();
    expect(apiFile!.content).toContain('/api/demoguard/verify');
  });

  it('client constants.ts defines DEMOGUARD_API_PATH as /api/demoguard/verify', () => {
    const constantsFile = ALL_SRC_FILES.find((f) => f.relPath.replace(/\\/g, '/').endsWith('demoguard/constants.ts'));
    expect(constantsFile).toBeDefined();
    expect(constantsFile!.content).toContain("'/api/demoguard/verify'");
  });
});

// ─── 5. Proxy sanitizes logs and response ──────────────────────────

describe('DG-9 PayGuard: Proxy sanitizes logs and response', () => {
  it('proxy handler imports sanitizeResponse', () => {
    const verifyFile = ALL_API_FILES.find((f) => f.relPath.replace(/\\/g, '/').endsWith('demoguard/verify.ts'));
    expect(verifyFile).toBeDefined();
    expect(verifyFile!.content).toContain('sanitizeResponse');
  });

  it('proxy logs do not include body or payload fields', () => {
    const verifyFile = ALL_API_FILES.find((f) => f.relPath.replace(/\\/g, '/').endsWith('demoguard/verify.ts'));
    expect(verifyFile).toBeDefined();
    const content = verifyFile!.content;
    // Logs should only contain msg, status, durationMs, origin, ip — never body
    const logMatches = content.match(/safeLog\([^)]+\{[^}]+\}\)/g) ?? [];
    for (const logMatch of logMatches) {
      expect(logMatch).not.toContain('body');
      expect(logMatch).not.toContain('payload');
      expect(logMatch).not.toContain('selfie');
      expect(logMatch).not.toContain('voice_b64');
    }
  });

  it('sanitizer covers all 27 global forbidden fields', () => {
    const sanitizeFile = ALL_API_FILES.find((f) => f.relPath.replace(/\\/g, '/').endsWith('_lib/demoguardSanitize.ts'));
    expect(sanitizeFile).toBeDefined();
    const content = sanitizeFile!.content;
    for (const field of GLOBAL_FORBIDDEN_FIELDS) {
      expect(content).toContain(`'${field}'`);
    }
  });
});

// ─── 6. Proxy forces tenant_id/source server-side ──────────────────

describe('DG-9 PayGuard: Proxy forces server-side values', () => {
  it('proxy forces source to demoguard_mobile', () => {
    const verifyFile = ALL_API_FILES.find((f) => f.relPath.replace(/\\/g, '/').endsWith('demoguard/verify.ts'));
    expect(verifyFile!.content).toContain("body.source = 'demoguard_mobile'");
  });

  it('proxy forces tenant_id from env', () => {
    const verifyFile = ALL_API_FILES.find((f) => f.relPath.replace(/\\/g, '/').endsWith('demoguard/verify.ts'));
    expect(verifyFile!.content).toContain('body.tenant_id = getTenantId()');
  });
});

// ─── 7. No CORS wildcard ───────────────────────────────────────────

describe('DG-9 PayGuard: No CORS wildcard', () => {
  it('proxy does not set Access-Control-Allow-Origin to *', () => {
    const verifyFile = ALL_API_FILES.find((f) => f.relPath.replace(/\\/g, '/').endsWith('demoguard/verify.ts'));
    expect(verifyFile!.content).not.toContain("'Access-Control-Allow-Origin', '*'");
    expect(verifyFile!.content).not.toContain('Access-Control-Allow-Origin", "*"');
  });

  it('proxy uses origin allowlist', () => {
    const verifyFile = ALL_API_FILES.find((f) => f.relPath.replace(/\\/g, '/').endsWith('demoguard/verify.ts'));
    expect(verifyFile!.content).toContain('getAllowedOrigins');
    expect(verifyFile!.content).toContain('allowed.has(origin)');
  });
});

// ─── 8. No sensitive payload in localStorage ───────────────────────

describe('DG-9 PayGuard: No sensitive payload in localStorage', () => {
  it('no src/ file stores sensitive data in localStorage', () => {
    for (const f of ALL_SRC_FILES) {
      if (f.content.includes('localStorage')) {
        // If localStorage is used, it must not store selfie, voice, token, etc.
        const lines = f.content.split('\n');
        for (const line of lines) {
          if (line.includes('localStorage') && line.includes('setItem')) {
            expect(line.toLowerCase()).not.toContain('selfie');
            expect(line.toLowerCase()).not.toContain('voice_b64');
            expect(line.toLowerCase()).not.toContain('token');
            expect(line.toLowerCase()).not.toContain('embedding');
            expect(line.toLowerCase()).not.toContain('mfcc');
          }
        }
      }
    }
  });
});

// ─── 9. Sanitizer runtime tests with malicious nested payload ──────

describe('DG-9 PayGuard: Sanitizer runtime — malicious nested payload', () => {
  const maliciousPayload = {
    ok: true,
    source: 'demoguard_mobile',
    status: 'submitted',
    sessionPublicId: 'hcs_sess_abc123',
    selfie_b64: 'base64image',
    voice_b64: 'base64audio',
    raw_audio: 'rawaudio',
    raw_image: 'rawimage',
    raw_motion_trace: [{ x: 1, y: 2 }],
    raw_touch_trace: [{ x: 1, y: 2 }],
    face_embedding: [0.1, 0.2],
    vocal_embedding: [0.3, 0.4],
    mfcc: [[1, 2, 3]],
    mfcc_raw: [[4, 5, 6]],
    mfcc_summary: { mean: 1.5 },
    voiceprint: 'uniqueprint',
    first_name: 'John',
    last_name: 'Doe',
    student_id: '123456',
    email: 'john@test.com',
    phone: '+1234567890',
    token: 'jwt-token',
    jwt: 'jwt-value',
    sessionToken: 'session-tok',
    hcsResultToken: 'hcs-result',
    hcsCode: 'hcs-code',
    components: { hcs: 'passed' },
    breakdown: { facial: 0.9 },
    detail: { internal: 'secret' },
    debug: { log: 'secret' },
    internal: { secret: 'secret' },
    nested: {
      safe: 'ok',
      voice_b64: 'secretaudio',
      first_name: 'Jane',
      deep: {
        token: 'leak',
        face_embedding: [0.5],
      },
    },
    items: [
      { safe: 'a', selfie_b64: 'leak' },
      { safe: 'b', email: 'leak@test.com' },
    ],
  };

  const sanitized = sanitizeResponse(maliciousPayload) as Record<string, unknown>;
  const sanitizedStr = JSON.stringify(sanitized);

  it('removes all forbidden fields at top level', () => {
    for (const field of GLOBAL_FORBIDDEN_FIELDS) {
      expect(sanitized).not.toHaveProperty(field);
    }
  });

  it('removes forbidden fields from nested objects', () => {
    const nested = sanitized.nested as Record<string, unknown>;
    expect(nested.safe).toBe('ok');
    expect(nested).not.toHaveProperty('voice_b64');
    expect(nested).not.toHaveProperty('first_name');
    const deep = nested.deep as Record<string, unknown>;
    expect(deep).not.toHaveProperty('token');
    expect(deep).not.toHaveProperty('face_embedding');
  });

  it('removes forbidden fields from array elements', () => {
    const items = sanitized.items as Record<string, unknown>[];
    expect(items[0].safe).toBe('a');
    expect(items[0]).not.toHaveProperty('selfie_b64');
    expect(items[1].safe).toBe('b');
    expect(items[1]).not.toHaveProperty('email');
  });

  it('JSON string contains no forbidden values', () => {
    expect(sanitizedStr).not.toContain('base64image');
    expect(sanitizedStr).not.toContain('base64audio');
    expect(sanitizedStr).not.toContain('John');
    expect(sanitizedStr).not.toContain('Jane');
    expect(sanitizedStr).not.toContain('jwt-token');
    expect(sanitizedStr).not.toContain('session-tok');
    expect(sanitizedStr).not.toContain('hcs-code');
    expect(sanitizedStr).not.toContain('leak@test.com');
  });

  it('preserves safe fields', () => {
    expect(sanitized.ok).toBe(true);
    expect(sanitized.source).toBe('demoguard_mobile');
    expect(sanitized.status).toBe('submitted');
    expect(sanitized.sessionPublicId).toBe('hcs_sess_abc123');
  });
});

// ─── 10. No hybrid-vector-frontend references ──────────────────────

describe('DG-9 PayGuard: No hybrid-vector-frontend references', () => {
  it('no src/ file references hybrid-vector-frontend', () => {
    for (const f of ALL_SRC_FILES) {
      expect(f.content).not.toContain('hybrid-vector-frontend');
    }
  });

  it('no api/ file references hybrid-vector-frontend', () => {
    for (const f of ALL_API_FILES) {
      expect(f.content).not.toContain('hybrid-vector-frontend');
    }
  });
});
