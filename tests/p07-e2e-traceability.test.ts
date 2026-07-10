/**
 * P-07: E2E Traceability — payguard tests
 *
 * Tests:
 * 1. traceId safe displayed if present (source check)
 * 2. no PII/token in trace UI (forbidden keys not in DemoGuard response display)
 * 3. existing DemoGuard tests pass (import check)
 *
 * @copyright (c) 2026 Benjamin BARRERE / IA SOLUTION
 * Patents Pending FR2514274 | FR2514546
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const ROOT_DIR = path.resolve(__dirname, '..');

const DEMOGUARD_PAGE_FILE = path.join(ROOT_DIR, 'src', 'pages', 'DemoGuard.tsx');
const TYPES_FILE = path.join(ROOT_DIR, 'src', 'demoguard', 'types.ts');
const API_FILE = path.join(ROOT_DIR, 'src', 'demoguard', 'api.ts');

const DEMOGUARD_PAGE_SRC = fs.existsSync(DEMOGUARD_PAGE_FILE) ? fs.readFileSync(DEMOGUARD_PAGE_FILE, 'utf-8') : '';
const TYPES_SRC = fs.existsSync(TYPES_FILE) ? fs.readFileSync(TYPES_FILE, 'utf-8') : '';
const API_SRC = fs.existsSync(API_FILE) ? fs.readFileSync(API_FILE, 'utf-8') : '';

const FORBIDDEN_KEYS = [
  'selfie_b64', 'voice_b64', 'raw_audio', 'raw_image', 'raw_motion_trace',
  'raw_touch_trace', 'face_embedding', 'vocal_embedding', 'mfcc', 'mfcc_raw',
  'mfcc_summary', 'voiceprint', 'first_name', 'last_name', 'student_id',
  'email', 'phone', 'token', 'jwt', 'sessionToken', 'hcsResultToken',
  'hcsCode', 'components', 'breakdown', 'detail', 'debug', 'internal',
  'raw_trials', 'raw_sequence', 'sequence', 'tap_trace', 'raw_tap_trace',
  'cognitive_token', 'challenge_secret', 'expected_sequence',
  'internal_scoring', 'module_breakdown',
];

describe('P-07: E2E Traceability — payguard', () => {
  // 1. traceId safe displayed if present
  describe('traceId display', () => {
    it('DemoGuardSafeResponse type includes traceId', () => {
      expect(TYPES_SRC).toContain('traceId');
    });

    it('DemoGuard page renders traceId in response section', () => {
      expect(DEMOGUARD_PAGE_SRC).toContain('traceId');
      expect(DEMOGUARD_PAGE_SRC).toContain('Trace ID');
    });

    it('traceId is displayed only when present (conditional render)', () => {
      expect(DEMOGUARD_PAGE_SRC).toContain('response.traceId &&');
    });
  });

  // 2. no PII/token in trace UI
  describe('no forbidden data in DemoGuard response display', () => {
    it('response display section does not contain forbidden keys', () => {
      // Extract the response display section (between "Step 8" and "Error display")
      const match = DEMOGUARD_PAGE_SRC.match(/Step 8.*?Error display/s);
      if (match) {
        const responseSection = match[0];
        for (const key of FORBIDDEN_KEYS) {
          // Check that the key is not rendered as a label in the response section
          // We're looking for patterns like "selfie_b64:" or "{response.selfie_b64}"
          expect(responseSection).not.toContain(`response.${key}`);
        }
      }
    });

    it('DemoGuardSafeResponse type does not include forbidden keys', () => {
      const responseMatch = TYPES_SRC.match(/export interface DemoGuardSafeResponse \{[\s\S]*?\}/);
      if (responseMatch) {
        const interfaceBody = responseMatch[0];
        for (const key of FORBIDDEN_KEYS) {
          expect(interfaceBody).not.toContain(key);
        }
      }
    });

    it('API client does not expose forbidden keys', () => {
      for (const key of FORBIDDEN_KEYS) {
        expect(API_SRC).not.toContain(`response.${key}`);
        expect(API_SRC).not.toContain(`res.${key}`);
      }
    });
  });

  // 3. existing DemoGuard tests pass (import check)
  describe('existing DemoGuard structure intact', () => {
    it('DemoGuard page still exports DemoGuard component', () => {
      expect(DEMOGUARD_PAGE_SRC).toContain('export function DemoGuard');
    });

    it('DemoGuard page still has sessionPublicId input', () => {
      expect(DEMOGUARD_PAGE_SRC).toContain('sessionPublicId');
    });

    it('DemoGuard page still has submit handler', () => {
      expect(DEMOGUARD_PAGE_SRC).toContain('handleSubmit');
    });

    it('DemoGuard API client still exists', () => {
      expect(API_SRC).toContain('submitDemoGuard');
    });

    it('DemoGuard types still define DemoGuardSafeResponse', () => {
      expect(TYPES_SRC).toContain('DemoGuardSafeResponse');
    });
  });
});
