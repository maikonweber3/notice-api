function readMultiFlag(args, name) {
  const values = [];
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === name && args[i + 1] && !args[i + 1].startsWith("--")) {
      values.push(args[i + 1]);
      i += 1;
    }
  }
  return values;
}

function readSingleFlag(args, name, defaultValue) {
  const index = args.findIndex((arg) => arg === name);
  if (index >= 0 && args[index + 1] && !args[index + 1].startsWith("--")) {
    return args[index + 1];
  }
  return defaultValue;
}

export function parseCli(argv) {
  const args = argv.slice(2);
  const rss = readMultiFlag(args, "--rss");
  const urls = readMultiFlag(args, "--url");
  const selector = readSingleFlag(args, "--selector", "article h2, h2, h3");
  const out = readSingleFlag(args, "--out", "./data/noticias.jsonl");

  return { rss, urls, selector, out };
}
