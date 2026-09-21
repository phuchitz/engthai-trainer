// Builds out/sw.js from scripts/sw-template.js and the real contents of out/.
// Runs after `next build`; see the template for why the list is generated.
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, posix, relative, sep } from "node:path";

const OUT = "out";
/** Big or per-user files that no page needs in order to open. */
const SKIP = [/^sw\.js$/, /^robots\.txt$/, /^sitemap\.xml$/, /\.map$/];

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const files = walk(OUT)
  .map((f) => relative(OUT, f).split(sep).join(posix.sep))
  .filter((f) => !SKIP.some((re) => re.test(f)))
  .sort();

// A file's URL, not its path: /lessons/index.html is requested as /lessons/.
const urls = files.map((f) =>
  f === "index.html" ? "/" : f.endsWith("/index.html") ? `/${f.slice(0, -"index.html".length)}` : `/${f}`,
);

// The cache name changes whenever any byte of the build does, so activating a new
// worker drops the old shell instead of mixing two builds' chunks.
const hash = createHash("sha256");
for (const f of files) hash.update(f).update(readFileSync(join(OUT, f)));
const version = hash.digest("hex").slice(0, 12);

const sw = readFileSync("scripts/sw-template.js", "utf8")
  .replace("__VERSION__", version)
  .replace("__PRECACHE__", JSON.stringify(urls, null, 2));

writeFileSync(join(OUT, "sw.js"), sw);
console.log(`out/sw.js: ${urls.length} files precached, version ${version}`);
