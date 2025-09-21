import { readFileSync } from "node:fs";
import { join } from "node:path";

export function getVersionInfo() {
  let pkg = {};
  try { pkg = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")); } catch {}
  return {
    name: pkg.name ?? "p5-api",
    version: pkg.version ?? "0.0.0",
    gitSha: process.env.GIT_SHA || process.env.FLY_IMAGE_REF || null,
    node: process.version,
    time: new Date().toISOString()
  };
}