import fs from "node:fs/promises";
import path from "node:path";

export async function writeJsonl(filePath, rows) {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
  const content = rows.map((row) => JSON.stringify(row)).join("\n") + "\n";
  await fs.appendFile(filePath, content, "utf-8");
}
