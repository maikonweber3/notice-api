import { parseCli } from "./cli.js";
import { scrapeRss } from "./scrapers/rssScraper.js";
import { scrapeHtml } from "./scrapers/htmlScraper.js";
import { writeJsonl } from "./utils/fileOutput.js";

async function main() {
  const { rss, urls, selector, out } = parseCli(process.argv);

  if (rss.length === 0 && urls.length === 0) {
    console.log(
      "Uso: npm run scrape -- --rss <feed-url> [--rss ...] --url <page-url> [--url ...] [--selector <css>] [--out <arquivo>]"
    );
    process.exitCode = 1;
    return;
  }

  const allRows = [];

  for (const feed of rss) {
    try {
      const rows = await scrapeRss(feed);
      allRows.push(...rows);
      console.log(`RSS OK: ${feed} (${rows.length} itens)`);
    } catch (error) {
      console.error(`RSS ERRO: ${feed}`, error.message);
    }
  }

  for (const url of urls) {
    try {
      const rows = await scrapeHtml(url, selector);
      allRows.push(...rows);
      console.log(`HTML OK: ${url} (${rows.length} itens)`);
    } catch (error) {
      console.error(`HTML ERRO: ${url}`, error.message);
    }
  }

  if (allRows.length === 0) {
    console.log("Nenhum item coletado.");
    return;
  }

  await writeJsonl(out, allRows);
  console.log(`Coleta finalizada: ${allRows.length} itens salvos em ${out}`);
}

main().catch((error) => {
  console.error("Falha inesperada no scraper:", error);
  process.exitCode = 1;
});
