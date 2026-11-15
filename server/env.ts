// Load settings from a local .env file when one exists (Node 20.12+). Variables already set by the host win.
import fs from "node:fs";
if (fs.existsSync(".env")) {
  try { (process as unknown as { loadEnvFile?: (p?: string) => void }).loadEnvFile?.(".env"); } catch { /* host env is enough */ }
}
