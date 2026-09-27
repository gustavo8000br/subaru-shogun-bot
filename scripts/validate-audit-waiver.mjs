#!/usr/bin/env node

import fs from 'node:fs';

const EXPECTED = {
  advisory: 'GHSA-ggr8-5vv4-36mx',
  advisoryUrl: 'https://github.com/advisories/GHSA-ggr8-5vv4-36mx',
  expires: '2026-10-27',
  packages: ['@prisma/config', 'deepmerge-ts', 'prisma'],
  prismaVersion: '6.19.3',
  configVersion: '6.19.3',
  deepmergeVersion: '7.1.5',
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function exactKeys(actual, expected, label) {
  assert(Array.isArray(actual), `${label} must be an array`);
  assert(
    actual.length === expected.length && expected.every((value) => actual.includes(value)),
    `${label} differs from the approved SEC-009 scope`,
  );
}

export function validateAuditReport(report, lock, today = new Date()) {
  const utcDate = today.toISOString().slice(0, 10);
  assert(utcDate <= EXPECTED.expires, `SEC-009 waiver expired on ${EXPECTED.expires}`);
  assert(report?.auditReportVersion === 2, 'Unsupported or missing npm audit JSON schema');

  const vulnerabilities = report.vulnerabilities;
  assert(vulnerabilities && typeof vulnerabilities === 'object', 'Missing vulnerabilities object');
  exactKeys(Object.keys(vulnerabilities), EXPECTED.packages, 'npm audit vulnerability packages');

  const expectedNodes = {
    '@prisma/config': 'node_modules/@prisma/config',
    'deepmerge-ts': 'node_modules/deepmerge-ts',
    prisma: 'node_modules/prisma',
  };
  for (const name of EXPECTED.packages) {
    const item = vulnerabilities[name];
    assert(item?.severity === 'high', `${name} severity must remain HIGH`);
    assert(item?.nodes?.length === 1 && item.nodes[0] === expectedNodes[name], `${name} node differs from approved scope`);
  }

  const deepmerge = vulnerabilities['deepmerge-ts'];
  assert(deepmerge.range === '<8.0.0', 'deepmerge-ts range differs from approved advisory');
  exactKeys(deepmerge.effects, ['@prisma/config'], 'deepmerge-ts effects');
  assert(deepmerge.via?.length === 1, 'deepmerge-ts must have exactly the approved advisory');
  const advisory = deepmerge.via[0];
  assert(typeof advisory === 'object', 'deepmerge-ts advisory must be a structured npm audit entry');
  assert(advisory.name === 'deepmerge-ts' && advisory.severity === 'high', 'Advisory package or severity changed');
  assert(advisory.url === EXPECTED.advisoryUrl, 'Advisory URL differs from approved GHSA');
  assert(advisory.range === '<8.0.0', 'Advisory affected range changed');
  assert(advisory.source === 1145093, 'Advisory source ID differs from approved GHSA record');

  exactKeys(vulnerabilities['@prisma/config'].via, ['deepmerge-ts'], '@prisma/config dependency path');
  exactKeys(vulnerabilities['@prisma/config'].effects, ['prisma'], '@prisma/config effects');
  exactKeys(vulnerabilities.prisma.via, ['@prisma/config'], 'Prisma dependency path');
  exactKeys(vulnerabilities.prisma.effects, [], 'Prisma effects');

  assert(report.metadata?.vulnerabilities?.high === 3, 'npm audit HIGH count must remain exactly three');
  assert(report.metadata?.vulnerabilities?.total === 3, 'npm audit total count must remain exactly three');
  for (const severity of ['critical', 'moderate', 'low']) {
    assert((report.metadata?.vulnerabilities?.[severity] ?? 0) === 0, `Unexpected ${severity} findings in npm audit report`);
  }

  const packages = lock?.packages;
  assert(packages, 'package-lock.json has no packages map');
  assert(packages['node_modules/prisma']?.version === EXPECTED.prismaVersion, 'Prisma lockfile version changed');
  assert(packages['node_modules/prisma']?.dependencies?.['@prisma/config'] === EXPECTED.configVersion, 'Prisma config edge changed');
  assert(packages['node_modules/@prisma/config']?.version === EXPECTED.configVersion, '@prisma/config lockfile version changed');
  assert(packages['node_modules/@prisma/config']?.dependencies?.['deepmerge-ts'] === EXPECTED.deepmergeVersion, 'deepmerge-ts edge changed');
  assert(packages['node_modules/deepmerge-ts']?.version === EXPECTED.deepmergeVersion, 'deepmerge-ts lockfile version changed');

  return {
    status: 'WAIVED',
    advisory: EXPECTED.advisory,
    severity: 'HIGH',
    state: 'OPEN',
    findings: 3,
    packagePath: `prisma@${EXPECTED.prismaVersion} -> @prisma/config@${EXPECTED.configVersion} -> deepmerge-ts@${EXPECTED.deepmergeVersion}`,
    expires: EXPECTED.expires,
  };
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const [reportPath, commandExit, auditKind] = process.argv.slice(2);
  try {
    assert(reportPath, 'Usage: validate-audit-waiver.mjs <npm-audit.json> <npm-audit-exit-code> <production|full>');
    assert(['production', 'full'].includes(auditKind), 'Audit kind must be production or full');
    assert(commandExit === '1', `npm audit ${auditKind} exit code must be 1 while the approved findings remain open`);
    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    const lock = JSON.parse(fs.readFileSync('package-lock.json', 'utf8'));
    const result = validateAuditReport(report, lock);
    console.log(`SEC-009 ${result.status}: ${result.findings} ${result.severity} findings, ${result.state}, advisory ${result.advisory}; ${result.packagePath}; accepted through ${result.expires} inclusive. npm audit ${auditKind} exit 1 is retained as raw evidence.`);
  } catch (error) {
    console.error(`SEC-009 audit gate FAIL: ${error.message}`);
    process.exitCode = 1;
  }
}
