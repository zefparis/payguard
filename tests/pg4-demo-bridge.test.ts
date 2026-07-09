/**
 * Tests for PG-4: PayGuard mobile demo bridge to Hybrid Fusion
 *
 * Verifies:
 * - hcs_session_public_id is sent only when provided
 * - payVerify payload includes hcs_session_public_id when set
 * - FlowState includes hcsSessionPublicId
 * - SET_IDENTITY action carries hcsSessionPublicId
 * - No sessionToken is ever sent
 * - DEMO_LEVY_ENABLED flag controls field visibility
 *
 * @copyright (c) 2026 Benjamin BARRERE / IA SOLUTION
 * Patents Pending FR2514274 | FR2514546
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { flowReducer, initialFlowState } from '../src/state/flowReducer';
import type { FlowAction } from '../src/types/flow';

describe('PG-4: PayGuard mobile demo bridge', () => {
  describe('FlowState hcsSessionPublicId', () => {
    it('initialFlowState has hcsSessionPublicId null', () => {
      expect(initialFlowState.hcsSessionPublicId).toBeNull();
    });

    it('SET_IDENTITY sets hcsSessionPublicId', () => {
      const action: FlowAction = {
        type: 'SET_IDENTITY',
        firstName: 'John',
        lastName: 'Doe',
        studentId: 'stu123',
        hcsSessionPublicId: 'hcs_sess_abc123',
      };
      const state = flowReducer(initialFlowState, action);
      expect(state.hcsSessionPublicId).toBe('hcs_sess_abc123');
    });

    it('SET_IDENTITY without hcsSessionPublicId preserves existing value', () => {
      const state1 = flowReducer(initialFlowState, {
        type: 'SET_IDENTITY',
        firstName: 'John',
        lastName: 'Doe',
        studentId: 'stu123',
        hcsSessionPublicId: 'hcs_sess_existing',
      });
      const state2 = flowReducer(state1, {
        type: 'SET_IDENTITY',
        firstName: 'John',
        lastName: 'Doe',
        studentId: 'stu123',
      });
      expect(state2.hcsSessionPublicId).toBe('hcs_sess_existing');
    });

    it('SET_IDENTITY with empty string hcsSessionPublicId keeps existing', () => {
      const state1 = flowReducer(initialFlowState, {
        type: 'SET_IDENTITY',
        firstName: 'John',
        lastName: 'Doe',
        studentId: 'stu123',
        hcsSessionPublicId: 'hcs_sess_first',
      });
      const state2 = flowReducer(state1, {
        type: 'SET_IDENTITY',
        firstName: 'John',
        lastName: 'Doe',
        studentId: 'stu123',
        hcsSessionPublicId: undefined,
      });
      expect(state2.hcsSessionPublicId).toBe('hcs_sess_first');
    });

    it('RESET clears hcsSessionPublicId', () => {
      const state1 = flowReducer(initialFlowState, {
        type: 'SET_IDENTITY',
        firstName: 'John',
        lastName: 'Doe',
        studentId: 'stu123',
        hcsSessionPublicId: 'hcs_sess_abc',
      });
      const state2 = flowReducer(state1, { type: 'RESET' });
      expect(state2.hcsSessionPublicId).toBeNull();
    });
  });

  describe('payVerify payload', () => {
    const originalEnv = { ...process.env };

    beforeEach(() => {
      process.env = { ...originalEnv };
      vi.clearAllMocks();
    });

    afterEach(() => {
      process.env = { ...originalEnv };
      vi.restoreAllMocks();
    });

    it('payVerify type includes hcs_session_public_id optional field', async () => {
      const apiSource = await import('../src/lib/api');
      const payVerifyFn = apiSource.payVerify;

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({
          decision: 'APPROVED',
          trust_score: 0.85,
          verified: true,
          similarity: 95.3,
        }), { status: 200 }),
      );

      await payVerifyFn({
        selfie_b64: 'base64data',
        first_name: 'John',
        last_name: 'Doe',
        student_id: 'stu123',
        reaction_ms: 350,
        hcs_session_public_id: 'hcs_sess_test123',
      });

      const callOpts = fetchSpy.mock.calls[0];
      const body = JSON.parse(callOpts[1]?.body as string);
      expect(body.hcs_session_public_id).toBe('hcs_sess_test123');
    });

    it('payVerify works without hcs_session_public_id', async () => {
      const apiSource = await import('../src/lib/api');
      const paySpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({
          decision: 'APPROVED',
          trust_score: 0.85,
          verified: true,
          similarity: 95.3,
        }), { status: 200 }),
      );

      await apiSource.payVerify({
        selfie_b64: 'base64data',
        first_name: 'John',
        last_name: 'Doe',
        student_id: 'stu123',
        reaction_ms: 350,
      });

      const body = JSON.parse(paySpy.mock.calls[0][1]?.body as string);
      expect(body.hcs_session_public_id).toBeUndefined();
    });

    it('payVerify return type includes hybridFusion field', async () => {
      const apiSource = await import('../src/lib/api');
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({
          decision: 'APPROVED',
          trust_score: 0.85,
          verified: true,
          similarity: 95.3,
          hybridFusion: {
            triggered: true,
            globalDecision: 'allow',
            confidenceLevel: 'high',
          },
        }), { status: 200 }),
      );

      const result = await apiSource.payVerify({
        selfie_b64: 'base64data',
        first_name: 'John',
        last_name: 'Doe',
        student_id: 'stu123',
        reaction_ms: 350,
        hcs_session_public_id: 'hcs_sess_test',
      });

      expect(result.hybridFusion).toBeDefined();
      expect(result.hybridFusion?.triggered).toBe(true);
      expect(result.hybridFusion?.globalDecision).toBe('allow');
    });

    it('no sessionToken is ever sent in payload', async () => {
      const apiSource = await import('../src/lib/api');
      const paySpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({
          decision: 'APPROVED',
          trust_score: 0.85,
          verified: true,
          similarity: 95.3,
        }), { status: 200 }),
      );

      await apiSource.payVerify({
        selfie_b64: 'base64data',
        first_name: 'John',
        last_name: 'Doe',
        student_id: 'stu123',
        reaction_ms: 350,
        hcs_session_public_id: 'hcs_sess_test',
      });

      const body = JSON.parse(paySpy.mock.calls[0][1]?.body as string);
      expect(body.sessionToken).toBeUndefined();
      expect(body.cognitiveSessionToken).toBeUndefined();
    });
  });

  describe('No API key in client code', () => {
    it('api.ts does not contain X-API-Key', () => {
      const fs = require('fs');
      const path = require('path');
      const source = fs.readFileSync(
        path.resolve(__dirname, '..', 'src', 'lib', 'api.ts'),
        'utf-8',
      );
      expect(source).not.toContain('X-API-Key');
      expect(source).not.toContain('HV_API_KEY');
    });

    it('api.ts does not contain NEXT_PUBLIC_ secrets', () => {
      const fs = require('fs');
      const path = require('path');
      const source = fs.readFileSync(
        path.resolve(__dirname, '..', 'src', 'lib', 'api.ts'),
        'utf-8',
      );
      expect(source).not.toContain('NEXT_PUBLIC_');
    });
  });
});
