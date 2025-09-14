export function getVersionInfo() {
  return {
    sha: process.env.GIT_SHA || null,
    node: process.version,
    pid: process.pid,
    env: process.env.NODE_ENV || 'unknown',
    fly: {
      allocId: process.env.FLY_ALLOC_ID || null,
      machineId: process.env.FLY_MACHINE_ID || null
    },
    time: new Date().toISOString()
  }
}