import assert from 'node:assert/strict';
import test from 'node:test';
import { validateAuditReport } from '../scripts/validate-audit-waiver.mjs';

const advisory = {
  source: 1145093,
  name: 'deepmerge-ts',
  url: 'https://github.com/advisories/GHSA-ggr8-5vv4-36mx',
  severity: 'high',
  range: '<8.0.0',
};

function fixture() {
  return {
    auditReportVersion: 2,
    vulnerabilities: {
      '@prisma/config': {
        severity: 'high',
        via: ['deepmerge-ts'],
        effects: ['prisma'],
        nodes: ['node_modules/@prisma/config'],
      },
      'deepmerge-ts': {
        severity: 'high',
        via: [advisory],
        effects: ['@prisma/config'],
        range: '<8.0.0',
        nodes: ['node_modules/deepmerge-ts'],
      },
      prisma: {
        severity: 'high',
        via: ['@prisma/config'],
        effects: [],
        nodes: ['node_modules/prisma'],
      },
    },
    metadata: { vulnerabilities: { high: 3, total: 3 } },
  };
}

const lock = {
  packages: {
    'node_modules/prisma': { version: '6.19.3', dependencies: { '@prisma/config': '6.19.3' } },
    'node_modules/@prisma/config': { version: '6.19.3', dependencies: { 'deepmerge-ts': '7.1.5' } },
    'node_modules/deepmerge-ts': { version: '7.1.5' },
  },
};

test('waives only the three approved HIGH/open SEC-009 records through expiry date', () => {
  const result = validateAuditReport(fixture(), lock, new Date('2026-10-27T23:59:59.000Z'));
  assert.equal(result.status, 'WAIVED');
  assert.equal(result.severity, 'HIGH');
  assert.equal(result.state, 'OPEN');
  assert.equal(result.findings, 3);
});

test('rejects another advisory or dependency node', () => {
  const report = fixture();
  report.vulnerabilities['deepmerge-ts'].via.push({ ...advisory, source: 999, url: 'https://example.invalid' });
  assert.throws(() => validateAuditReport(report, lock, new Date('2026-09-27T00:00:00Z')));
});

test('rejects an additional affected package/path', () => {
  const report = fixture();
  report.vulnerabilities['other-package'] = {
    severity: 'high',
    via: [advisory],
    effects: [],
    nodes: ['node_modules/other-package'],
  };
  report.metadata.vulnerabilities.high = 4;
  report.metadata.vulnerabilities.total = 4;
  assert.throws(() => validateAuditReport(report, lock, new Date('2026-09-27T00:00:00Z')));
});

test('rejects a different finding count or severity', () => {
  const report = fixture();
  report.metadata.vulnerabilities.high = 4;
  assert.throws(() => validateAuditReport(report, lock, new Date('2026-09-27T00:00:00Z')));
  const report2 = fixture();
  report2.vulnerabilities.prisma.severity = 'critical';
  assert.throws(() => validateAuditReport(report2, lock, new Date('2026-09-27T00:00:00Z')));
});

test('rejects any audit after the approved review date', () => {
  assert.throws(() => validateAuditReport(fixture(), lock, new Date('2026-10-28T00:00:00Z')), /expired/);
});

test('rejects dependency chain or lockfile version drift', () => {
  const changedLock = structuredClone(lock);
  changedLock.packages['node_modules/@prisma/config'].dependencies['deepmerge-ts'] = '8.0.2';
  assert.throws(() => validateAuditReport(fixture(), changedLock, new Date('2026-09-27T00:00:00Z')));
});
