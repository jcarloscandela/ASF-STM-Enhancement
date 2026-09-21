// Node/TypeScript replacement for the former script/build.py.
//
// Expands {{PLACEHOLDERS}} from src/templates/ plus inlines the compiled
// TypeScript libs into src/ASF-STM.js, emitting both distributables:
//   dist/ASF-STM.debug.js (debug lines kept)
//   dist/ASF-STM.user.js  (release, debug lines stripped)
//
// Run with: pnpm build

import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ModuleKind, ScriptTarget, transpileModule } from "typescript";

const REPO_ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DIST_DIR = path.join(REPO_ROOT, "dist");
const SRC_DIR = path.join(REPO_ROOT, "src");
const TEMPLATES_DIR = path.join(SRC_DIR, "templates");
const LIB_DIR = path.join(SRC_DIR, "lib");

const USERSCRIPT_FILE = path.join(SRC_DIR, "ASF-STM.js");
const LIBS = [
  { file: path.join(LIB_DIR, "tradable.ts"), placeholder: "{{TRADABLE_LIB}}" },
  { file: path.join(LIB_DIR, "settings.ts"), placeholder: "{{SETTINGS_LIB}}" },
];
const RELEASE_FILE = path.join(DIST_DIR, "ASF-STM.user.js");
const DEBUG_FILE = path.join(DIST_DIR, "ASF-STM.debug.js");

// Transform placeholder from camelCase to SCREAMING_SNAKE_CASE
function screamingSnakeToCamel(string: string): string {
  return string.replace(/([a-z])([A-Z])/g, "$1_$2").toUpperCase();
}

// Minifies template literals containing HTML by removing tabs and newlines
// Also removes /* HTML */ comment and enclosing backticks used for syntax highlighting
function minifyJsHtmlTemplate(content: string): string {
  content = content.replace(/(\r|\n|( {4})|`|\/\* HTML \*\/)/g, "");
  content = content.replace(/ {2,}/g, " ");
  return content;
}

// Modified version of CSS minifier by Borgar
// https://stackoverflow.com/a/223689/5853386 (Accessed on 2024-12-27)
function minifyCss(css: string): string {
  const rules: string[] = [];

  // remove comments - this will break a lot of hacks :-P
  css = css.replace(/\s*\/\*\s*\*\//g, "$$HACK1$$"); // preserve IE<6 comment hack
  css = css.replace(/\/\*[\s\S]*?\*\//g, "");
  css = css.replace("$$HACK1$$", "/**/"); // preserve IE<6 comment hack

  // url() doesn't need quotes
  css = css.replace(/url\((["'])([^)]*)\1\)/g, "url($2)");

  // spaces may be safely collapsed as generated content will collapse them anyway
  css = css.replace(/\s+/g, " ");

  // shorten collapsable colors: #aabbcc to #abc
  css = css.replace(/#([0-9a-f])\1([0-9a-f])\2([0-9a-f])\3(\s|;)/g, "#$1$2$3$4");

  // fragment values can loose zeros
  css = css.replace(/:\s*0(\.\d+([cm]m|e[mx]|in|p[ctx]))\s*;/g, ":$1;");

  for (const rule of css.matchAll(/([^{]+)\{([^}]*)\}/g)) {
    // we don't need spaces around operators
    const selectors = (rule[1] ?? "")
      .split(",")
      .map((selector) => selector.trim().replace(/(?<=[[(>+=])\s+|\s+(?=[=~^$*|>+\])])/g, ""));

    // order is important, but we still want to discard repetitions
    const properties = new Map<string, string>();
    const porder: string[] = [];
    for (const prop of (rule[2] ?? "").matchAll(/(.*?):(.*?)(;|$)/g)) {
      const key = (prop[1] ?? "").trim().toLowerCase();
      if (!porder.includes(key)) {
        porder.push(key);
      }
      properties.set(key, (prop[2] ?? "").trim());
    }

    // output rule if it contains any declarations
    if (properties.size > 0) {
      rules.push(`${selectors.join(",")}{${porder.map((key) => `${key}:${properties.get(key)}`).join(";")}}`);
    }
  }
  return rules.join("");
}

function fail(message: string): never {
  console.error(`build failed: ${message}`);
  process.exit(1);
}

function readFile(filePath: string): string {
  try {
    // Normalize newlines so Windows checkouts produce the same output as CI.
    return readFileSync(filePath, "utf8").replace(/\r\n/g, "\n");
  } catch (error) {
    fail(`cannot read ${path.relative(REPO_ROOT, filePath)}: ${error}`);
  }
}

// Compiles one TypeScript lib to plain JavaScript suitable for inlining into
// the userscript (no modules: ESM `export` markers are stripped, so the code
// lands as bare declarations exactly like the former .js libs).
function compileLibForInline(filePath: string): string {
  const source = readFile(filePath);
  const { outputText } = transpileModule(source, {
    compilerOptions: { target: ScriptTarget.ES2022, module: ModuleKind.ESNext },
  });
  const inlined = outputText
    .split("\n")
    .map((line) => line.replace(/^export\s+/, ""))
    .join("\n");
  if (/^\s*(import|export)[\s{]/m.test(inlined)) {
    fail(`${path.relative(REPO_ROOT, filePath)} left module syntax in the inlined output`);
  }
  return inlined;
}

function main(): void {
  let script = readFile(USERSCRIPT_FILE);

  let templateFiles: string[];
  try {
    templateFiles = readdirSync(TEMPLATES_DIR).sort();
  } catch {
    fail(`missing templates directory: ${path.relative(REPO_ROOT, TEMPLATES_DIR)}`);
  }
  if (templateFiles.length === 0) {
    fail(`no template files found in ${path.relative(REPO_ROOT, TEMPLATES_DIR)}`);
  }

  for (const file of templateFiles) {
    // Init placeholder: variableName -> {{VARIABLE_NAME}}
    const stem = file.replace(/\.[^.]*$/, "");
    const placeholder = `{{${screamingSnakeToCamel(stem)}}}`;

    if (!script.includes(placeholder)) {
      fail(
        `placeholder ${placeholder} from template ${file} not found in ${path.relative(REPO_ROOT, USERSCRIPT_FILE)}`,
      );
    }

    // Get and minify content where possible
    let content = readFile(path.join(TEMPLATES_DIR, file));
    if (file.endsWith(".js")) {
      content = minifyJsHtmlTemplate(content);
    } else if (file.endsWith(".css")) {
      content = minifyCss(content);
    }

    // Replace placeholder with content
    script = script.replaceAll(placeholder, content);
  }

  // Inline the compiled TypeScript libs (tested via vitest, shipped inline so
  // dist stays single-file).
  for (const lib of LIBS) {
    if (!script.includes(lib.placeholder)) {
      fail(
        `placeholder ${lib.placeholder} from ${path.relative(REPO_ROOT, lib.file)} not found in ${path.relative(REPO_ROOT, USERSCRIPT_FILE)}`,
      );
    }
    script = script.replaceAll(lib.placeholder, compileLibForInline(lib.file));
  }

  // The version has a single source of truth: package.json.
  const packageJson = JSON.parse(readFile(path.join(REPO_ROOT, "package.json"))) as { version?: unknown };
  if (typeof packageJson.version !== "string" || packageJson.version.length === 0) {
    fail("package.json has no usable version field");
  }
  script = script.replaceAll("{{VERSION}}", packageJson.version);

  const leftovers = [...new Set(script.match(/{{[A-Za-z0-9_.]+}}/g) ?? [])].sort();
  if (leftovers.length > 0) {
    fail(`unreplaced placeholders in ${path.relative(REPO_ROOT, USERSCRIPT_FILE)}: ${leftovers.join(", ")}`);
  }

  mkdirSync(DIST_DIR, { recursive: true });
  writeFileSync(DEBUG_FILE, script.replaceAll("  // DEBUG", ""), { encoding: "utf8" });

  const releaseScript = script
    .split("\n")
    .filter((line) => !line.endsWith("// DEBUG"))
    .join("\n");
  writeFileSync(RELEASE_FILE, releaseScript, { encoding: "utf8" });

  for (const output of [DEBUG_FILE, RELEASE_FILE]) {
    let size = 0;
    try {
      size = readFile(output).length;
    } catch {
      size = 0;
    }
    if (size === 0) {
      fail(`expected output was not written: ${path.relative(REPO_ROOT, output)}`);
    }
  }

  console.log(`built ${path.relative(REPO_ROOT, DEBUG_FILE)} and ${path.relative(REPO_ROOT, RELEASE_FILE)}`);
}

main();
