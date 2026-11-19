import { runVulnerabilitySync } from "../services/vulnerabilitySyncService.js";
import { pool } from "../db/pool.js";

const sources = process.argv.slice(2).filter(Boolean);
runVulnerabilitySync({ sources: sources.length ? sources : undefined })
  .then((r) => console.log(JSON.stringify(r, null, 2)))
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
