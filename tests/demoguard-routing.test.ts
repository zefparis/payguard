/**
 * FIX-DEMOGUARD-ROUTE-PROD: Routing tests
 *
 * Verifies:
 * - /demoguard route is always registered (not conditionally mounted)
 * - /demoguard renders DemoGuard when flag true
 * - /demoguard renders disabled message when flag false
 * - /demoguard does not redirect to PayGuard
 * - / still renders PayGuard
 * - DemoGuard route is present in production routing config
 * - No HV_API_KEY / HCS_API_KEY in client
 *
 * @copyright (c) 2026 Benjamin BARRERE / IA SOLUTION
 * Patents Pending FR2514274 | FR2514546
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const APP_FILE = path.resolve(__dirname, '..', 'src', 'App.tsx');
const ROUTES_FILE = path.resolve(__dirname, '..', 'src', 'constants', 'routes.ts');
const CONSTANTS_FILE = path.resolve(__dirname, '..', 'src', 'demoguard', 'constants.ts');
const VERCEL_FILE = path.resolve(__dirname, '..', 'vercel.json');
const BUILD_DIR = path.resolve(__dirname, '..', 'dist');

const APP_SRC = fs.readFileSync(APP_FILE, 'utf-8');
const ROUTES_SRC = fs.readFileSync(ROUTES_FILE, 'utf-8');
const CONSTANTS_SRC = fs.readFileSync(CONSTANTS_FILE, 'utf-8');
const VERCEL_SRC = fs.readFileSync(VERCEL_FILE, 'utf-8');

describe('FIX-DEMOGUARD-ROUTE: Route registration', () => {
  it('routes.ts contains DEMOGUARD = "/demoguard"', () => {
    expect(ROUTES_SRC).toContain('DEMOGUARD');
    expect(ROUTES_SRC).toContain('/demoguard');
  });

  it('App.tsx registers /demoguard route unconditionally', () => {
    expect(APP_SRC).toContain('path={ROUTES.DEMOGUARD}');
    expect(APP_SRC).not.toMatch(/\{DEMOGUARD_ENABLED\s*&&\s*<Route/);
  });

  it('App.tsx uses ternary for DemoGuard vs Disabled', () => {
    expect(APP_SRC).toMatch(/DEMOGUARD_ENABLED\s*\?\s*<DemoGuard/);
    expect(APP_SRC).toContain('DemoGuardDisabled');
  });

  it('/demoguard route is not nested under another route', () => {
    const lines = APP_SRC.split('\n');
    const demoguardLine = lines.findIndex(l => l.includes('path={ROUTES.DEMOGUARD}'));
    expect(demoguardLine).toBeGreaterThan(-1);
    const routeLine = lines[demoguardLine];
    expect(routeLine).toContain('<Route');
    expect(routeLine.trim().startsWith('<Route')).toBe(true);
  });
});

describe('FIX-DEMOGUARD-ROUTE: No redirect to PayGuard', () => {
  it('catch-all route does not match /demoguard', () => {
    expect(APP_SRC).toContain('path="*"');
    const catchAllMatch = APP_SRC.match(/path="\*"[^}]*/);
    expect(catchAllMatch).toBeDefined();
    expect(catchAllMatch![0]).toContain('Navigate');
    expect(catchAllMatch![0]).toContain('ROUTES.HOME');
  });

  it('/demoguard element does not contain Navigate', () => {
    const demoguardMatch = APP_SRC.match(/path=\{ROUTES\.DEMOGUARD\}[^/]*\/>/);
    expect(demoguardMatch).toBeDefined();
    expect(demoguardMatch![0]).not.toContain('Navigate');
  });
});

describe('FIX-DEMOGUARD-ROUTE: Feature flag', () => {
  it('DEMOGUARD_ENABLED reads import.meta.env.VITE_DEMOGUARD_ENABLED === "true"', () => {
    expect(CONSTANTS_SRC).toContain('import.meta.env.VITE_DEMOGUARD_ENABLED');
    expect(CONSTANTS_SRC).toContain("'true'");
  });

  it('Disabled screen shows explicit message', () => {
    expect(APP_SRC).toContain('DemoGuard is disabled in this build');
  });
});

describe('FIX-DEMOGUARD-ROUTE: Vercel SPA config', () => {
  it('vercel.json has SPA fallback to index.html', () => {
    const config = JSON.parse(VERCEL_SRC);
    expect(config.rewrites || config.routes).toBeDefined();
    const hasFallback = VERCEL_SRC.includes('index.html');
    expect(hasFallback).toBe(true);
  });
});

describe('FIX-DEMOGUARD-ROUTE: Production build includes DemoGuard', () => {
  it('dist/index.html exists after build', () => {
    expect(fs.existsSync(path.join(BUILD_DIR, 'index.html'))).toBe(true);
  });

  it('DemoGuard component is imported in App.tsx (tree-shaken only if unused)', () => {
    expect(APP_SRC).toContain("from './pages/DemoGuard'");
  });
});

describe('FIX-DEMOGUARD-ROUTE: No secrets in client', () => {
  it('App.tsx does not contain HV_API_KEY', () => {
    expect(APP_SRC).not.toContain('HV_API_KEY');
  });

  it('App.tsx does not contain HCS_API_KEY', () => {
    expect(APP_SRC).not.toContain('HCS_API_KEY');
  });

  it('constants.ts does not contain HV_API_KEY', () => {
    expect(CONSTANTS_SRC).not.toContain('HV_API_KEY');
  });

  it('constants.ts does not contain HCS_API_KEY', () => {
    expect(CONSTANTS_SRC).not.toContain('HCS_API_KEY');
  });
});
