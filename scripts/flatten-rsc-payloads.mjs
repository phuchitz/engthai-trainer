// Works around a Next 16.3.5 static-export mismatch.
//
// The build writes each route's RSC payload to a directory, e.g.
//   out/lessons/__next.lessons/__PAGE__.txt
// but next/link prefetches it as a flat path, with a dot where that last slash is:
//   /lessons/__next.lessons.__PAGE__.txt
// so every prefetch 404s on a plain static host. Nothing breaks — Next falls back to a
// full page load — but the prefetch is wasted and the console fills with errors.
//
// This copies each payload to the name the client actually asks for. The originals stay,
// so if a later Next changes its mind about either spelling, both still resolve.
import { copyFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const OUT = "out";
let copied = 0;

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (!statSync(full).isDirectory()) continue;
    if (name.startsWith("__next.")) {
      for (const file of readdirSync(full)) {
        if (!file.endsWith(".txt")) continue;
        copyFileSync(join(full, file), join(dir, `${name}.${file}`));
        copied++;
      }
    }
    walk(full);
  }
}

walk(OUT);
console.log(`out: ${copied} RSC payload aliases written`);
