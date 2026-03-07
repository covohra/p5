import os from 'os'
import { readFileSync, existsSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const __dirname = dirname(fileURLToPath(import.meta.url))

/**
 * Safely read a JSON file if it exists.
 */
function readJsonSafe(path) {
  try {
    if (existsSync(path)) {
      return JSON.parse(readFileSync(path, 'utf8'))
    }
  } catch {
    // ignore
  }
  return null
}

// Resolve package.json for the API package (apps/api/package.json)
const apiPkgJson = readJsonSafe(resolve(__dirname, '..', 'package.json')) || { name: 'p5-api', version: '0.0.0' }

// Try to read @prisma/client version without importing code
let prismaVersion = null
try {
  const prismaPkg = require('@prisma/client/package.json')
  prismaVersion = prismaPkg?.version ?? null
} catch {
  prismaVersion = null
}

/**
 * Best-effort git SHA detection:
 * - GIT_SHA (set by CI)
 * - GITHUB_SHA (default on GitHub Actions)
 * - FLY_IMAGE_REF (Fly provides image ref "registry:tag@sha256:...": we extract the sha)
 */
function detectGitSha() {
  const envSha = process.env.GIT_SHA || process.env.GITHUB_SHA || ''
  if (envSha) return envSha
  const img = process.env.FLY_IMAGE_REF || ''
  const m = img.match(/@sha256:([0-9a-f]{64})/i)
  return m ? m[1] : null
}

export function getVersionInfo() {
  const sha = detectGitSha()
  const shortSha = sha ? sha.slice(0, 7) : null

  return {
    app: {
      name: apiPkgJson.name,
      version: apiPkgJson.version,
    },
    build: {
      gitSha: sha,
      shortSha,
      time: process.env.BUILD_TIME || null, // you can set this in CI if you want
    },
    runtime: {
      node: process.version,
      platform: process.platform,
      arch: process.arch,
      pid: process.pid,
      uptimeSec: Math.round(process.uptime()),
    },
    deps: {
      prisma: prismaVersion,
    },
    env: {
      nodeEnv: process.env.NODE_ENV || null,
      fly: {
        app: process.env.FLY_APP_NAME || null,
        region: process.env.FLY_REGION || null,
        machineId: process.env.FLY_MACHINE_ID || null,
      },
    },
    host: {
      hostname: os.hostname(),
      cpus: os.cpus()?.length ?? null,
      totalMemMB: Math.round(os.totalmem() / (1024 * 1024)),
      freeMemMB: Math.round(os.freemem() / (1024 * 1024)),
    },
  }
}