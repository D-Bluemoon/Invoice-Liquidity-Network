#!/usr/bin/env node

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const reportDir = path.join(repoRoot, '.security');
const severity = process.env.SECURITY_AUDIT_LEVEL || 'high';

const npmAuditRoots = [
  'cli',
  'sdk',
  'indexer',
  'notifications',
  'packages/indexer',
  'packages/mock-backend',
  'packages/sdk'
].filter((dir) => fs.existsSync(path.join(repoRoot, dir, 'package-lock.json')));

function usage() {
  console.log(`Usage: node scripts/dependency-audit.js <audit|snyk|licenses|scan|report> [--fix]

Commands:
  audit      Run dependency audits across the pnpm workspace and npm projects.
  snyk       Run Snyk across all detected projects.
  licenses   Run the license compliance checker.
  scan       Run npm audit, license compliance, and Snyk.
  report     Generate vulnerability and license reports in .security/.

Options:
  --fix      With audit, run npm audit fix for package-lock based projects.

Environment:
  SECURITY_AUDIT_LEVEL  npm/Snyk severity threshold. Defaults to high.`);
}

function toReportName(label) {
  return label.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();
}

function runCommand(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd || repoRoot,
    encoding: 'utf8',
    shell: process.platform === 'win32'
  });

  let output = `${result.stdout || ''}${result.stderr || ''}`;

  if (result.error) {
    output = `${output}${output ? '\n' : ''}${result.error.message}`;
  }

  if (options.reportPath) {
    fs.writeFileSync(options.reportPath, output || `Command exited with status ${result.status}\n`);
  } else if (output) {
    process.stdout.write(output);
  }

  if (result.error) {
    return {
      ok: false,
      status: 1,
      output
    };
  }

  return {
    ok: result.status === 0,
    status: result.status || 0,
    output
  };
}

function ensureReportDir() {
  fs.mkdirSync(reportDir, { recursive: true });
}

function runNpmAudit({ fix = false, report = false } = {}) {
  if (npmAuditRoots.length === 0) {
    console.log('No package-lock.json files found for npm audit.');
    return true;
  }

  let ok = true;
  const summary = [];

  for (const relativeDir of npmAuditRoots) {
    const cwd = path.join(repoRoot, relativeDir);
    const label = relativeDir;
    const args = fix
      ? ['audit', 'fix', '--omit=dev']
      : ['audit', '--omit=dev', `--audit-level=${severity}`];

    if (report && !fix) {
      args.push('--json');
    }

    console.log(`\nRunning npm ${args.join(' ')} in ${label}`);
    const reportPath = report && !fix
      ? path.join(reportDir, `npm-audit-${toReportName(label)}.json`)
      : undefined;
    const result = runCommand('npm', args, { cwd, reportPath });

    summary.push({
      project: label,
      command: `npm ${args.join(' ')}`,
      status: result.status,
      report: reportPath ? path.relative(repoRoot, reportPath) : undefined
    });

    if (!result.ok) {
      ok = false;
      console.error(`npm audit failed for ${label} with status ${result.status}.`);
    }
  }

  if (report) {
    fs.writeFileSync(
      path.join(reportDir, 'npm-audit-summary.json'),
      `${JSON.stringify(summary, null, 2)}\n`
    );
  }

  return ok;
}

function runPnpmAudit({ report = false } = {}) {
  if (!fs.existsSync(path.join(repoRoot, 'pnpm-lock.yaml'))) {
    return true;
  }

  const args = ['audit', '--prod', `--audit-level=${severity}`];

  if (report) {
    args.push('--json');
  }

  console.log('\nRunning pnpm workspace audit');
  const result = runCommand('pnpm', args, {
    reportPath: report ? path.join(reportDir, 'pnpm-audit-workspace.json') : undefined
  });

  if (!result.ok) {
    console.error(`pnpm workspace audit failed with status ${result.status}.`);
  }

  return result.ok;
}

function runSnyk({ report = false } = {}) {
  const args = ['--yes', 'snyk', 'test', '--all-projects', `--severity-threshold=${severity}`];

  if (report) {
    args.push('--json');
  }

  console.log('\nRunning Snyk dependency scan');
  const result = runCommand('npx', args, {
    reportPath: report ? path.join(reportDir, 'snyk-report.json') : undefined
  });

  if (!result.ok) {
    console.error(`Snyk scan failed with status ${result.status}.`);
  }

  return result.ok;
}

function runLicenses({ report = false } = {}) {
  console.log('\nRunning license compliance check');
  const result = runCommand('node', ['scripts/check-licenses.js'], {
    reportPath: report ? path.join(reportDir, 'license-report.txt') : undefined
  });

  if (!result.ok) {
    console.error(`License compliance check failed with status ${result.status}.`);
  }

  return result.ok;
}

function runScan({ report = false } = {}) {
  if (report) {
    ensureReportDir();
  }

  const pnpmAuditOk = runPnpmAudit({ report });
  const npmAuditOk = runNpmAudit({ report });
  const auditOk = pnpmAuditOk && npmAuditOk;
  const licensesOk = runLicenses({ report });
  const snykOk = runSnyk({ report });

  return auditOk && licensesOk && snykOk;
}

function main() {
  const [, , command, ...flags] = process.argv;
  const fix = flags.includes('--fix');

  if (!command || command === '--help' || command === '-h' || flags.includes('--help') || flags.includes('-h')) {
    usage();
    process.exit(command ? 0 : 1);
  }

  let ok;

  switch (command) {
    case 'audit':
      if (fix) {
        ok = runNpmAudit({ fix });
      } else {
        const pnpmAuditOk = runPnpmAudit();
        const npmAuditOk = runNpmAudit();
        ok = pnpmAuditOk && npmAuditOk;
      }
      break;
    case 'snyk':
      ok = runSnyk();
      break;
    case 'licenses':
      ok = runLicenses();
      break;
    case 'scan':
      ok = runScan();
      break;
    case 'report':
      ok = runScan({ report: true });
      console.log(`\nSecurity reports written to ${path.relative(repoRoot, reportDir)}/`);
      break;
    default:
      usage();
      process.exit(1);
  }

  process.exit(ok ? 0 : 1);
}

main();
