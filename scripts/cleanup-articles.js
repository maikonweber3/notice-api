import { pool } from "../src/db/pool.js";
import { runArticleCleanup } from "../src/services/cleanupService.js";
import { countArticles } from "../src/repositories/articlesRepository.js";

const before = await countArticles();
const result = await runArticleCleanup({ force: true });
const after = await countArticles();

console.log(JSON.stringify({ before, after, ...result }, null, 2));
await pool.end();
