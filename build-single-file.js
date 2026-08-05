/* Builds gamescom-side-events.standalone.html — one self-contained file.
   Inlines styles.css, events-data.js and script.js into index.html.
   Run after changing any of those:  node build-single-file.js            */

const fs = require("fs");
const path = require("path");

const DIR = __dirname;
const OUT = "gamescom-side-events.standalone.html";

const read = (f) => fs.readFileSync(path.join(DIR, f), "utf8");
// A literal </script> inside a <script> block ends it early — neutralise it.
const guard = (s) => s.replace(/<\/script/gi, "<\\/script");

let html = read("index.html");
const css = read("styles.css");
const data = read("events-data.js");
const js = read("script.js");

const banner = `<!--
  Gamescom 2026 Side Events — single-file build.
  Everything (CSS, JS, fallback data) is inlined here, so this file runs on its
  own: no repo, no build step, no local server. Open it or drop it on any host.

  Generated from the sources in https://github.com/ruslanblsh/garna-gamescom2026
  by build-single-file.js — do not hand-edit. Change index.html / styles.css /
  script.js / events-data.js there and re-run the build.

  The event list is still read live from the Google Sheet on every load, so this
  file does NOT need regenerating when events change. Only rebuild if the page
  markup, styles or logic change.

  Note: opened straight from disk (file://) the browser blocks the request to
  Google Sheets, so you will see the bundled snapshot and a note saying so. Serve
  it over http:// to exercise the live path.
-->
`;

html = html.replace(
  /^<!DOCTYPE html>\n/,
  "<!DOCTYPE html>\n" + banner
);

html = html.replace(
  /<link rel="stylesheet" href="styles\.css" \/>/,
  "<style>\n" + css.trim() + "\n</style>"
);

html = html.replace(
  /<script src="events-data\.js"><\/script>\s*<script src="script\.js" defer><\/script>/,
  "<script>\n" + guard(data.trim()) + "\n</script>\n\n<script>\n" + guard(js.trim()) + "\n</script>"
);

// Fail loudly rather than shipping a half-inlined file.
const problems = [];
if (html.includes('href="styles.css"')) problems.push("styles.css not inlined");
if (html.includes('src="script.js"')) problems.push("script.js not inlined");
if (html.includes('src="events-data.js"')) problems.push("events-data.js not inlined");
if (problems.length) {
  console.error("Build failed:\n  " + problems.join("\n  "));
  process.exit(1);
}

fs.writeFileSync(path.join(DIR, OUT), html);
console.log(OUT + " — " + (html.length / 1024).toFixed(0) + " KB, " +
            html.split("\n").length + " lines");
