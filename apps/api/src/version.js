import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export function getVersionInfo() {
  let pkg = {};
  try {
    // Works in Fly + local as long as runtime has package.json (yours does)
    pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8'));
  } catch {
    // ignore
  }

  return {
    service: 'p5-api',
    name: pkg.name ?? 'p5-api',
    version: pkg.version ?? process.env.npm_package_version ?? '0.0.0',
    env: process.env.NODE_ENV || 'unknown',
    // prefer explicit CI SHA, fallback to Fly image ref if present
    commit: process.env.GIT_SHA || process.env.FLY_IMAGE_REF || 'local',
    node: process.version,
    time: new Date().toISOString(),
  };
}