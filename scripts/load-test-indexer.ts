import { spawnSync } from "child_process";
import { resolve } from "path";

function main() {
  const rootDir = resolve(import.meta.dirname ?? __dirname, "..");
  const scriptPath = resolve(rootDir, "scripts/load-test.ts");

  console.log("🚀 Starting Indexer Stress Test wrapper...");

  // Forward all arguments, ensuring the service is set to indexer
  const args = ["ts-node", "--esm", scriptPath, "--service", "indexer", ...process.argv.slice(2)];

  const result = spawnSync("npx", args, {
    cwd: rootDir,
    stdio: "inherit",
  });

  process.exit(result.status ?? 0);
}

main();
