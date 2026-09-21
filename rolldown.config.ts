// Rolldown build for the single-file userscript.
//
// `pnpm build` runs `rolldown -c`: bundles `src/ASF-STM.ts` (which imports
// `src/lib/*.ts` and the template texts as modules) into the single
// self-contained `dist/ASF-STM.user.js`, with the `package.json` version
// injected as a compile-time constant and the Tampermonkey metadata block
// prepended as a banner. No builder script, no placeholders.

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "rolldown";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const packageJson = JSON.parse(readFileSync(path.join(ROOT, "package.json"), "utf8")) as { version?: unknown };
if (typeof packageJson.version !== "string" || packageJson.version.length === 0) {
  throw new Error("rolldown.config: package.json has no usable version field");
}
const VERSION: string = packageJson.version;

const BANNER = `// ==UserScript==
// @name            ASF STM Enhancement
// @namespace       https://greasyfork.org/users/738914
// @description     ASF bot list trade matcher
// @license         Apache-2.0
// @author          Rudokhvist
// @author          iBreakEverything
// @match           *://steamcommunity.com/id/*/badges
// @match           *://steamcommunity.com/id/*/badges/
// @match           *://steamcommunity.com/profiles/*/badges
// @match           *://steamcommunity.com/profiles/*/badges/
// @match           *://steamcommunity.com/tradeoffer/new/*source=asfstm*
// @version         ${VERSION}
// @connect         asf.justarchi.net
// @connect         raw.githubusercontent.com
// @grant           GM.xmlHttpRequest
// @grant           GM_addStyle
// @grant           GM_xmlhttpRequest
// ==/UserScript==
`;

export default defineConfig({
  input: "src/ASF-STM.ts",
  output: {
    file: "dist/ASF-STM.user.js",
    format: "iife",
    banner: BANNER,
  },
  transform: {
    define: {
      __VERSION__: JSON.stringify(VERSION),
    },
  },
  plugins: [
    {
      name: "template-text",
      resolveId(source: string, importer: string | undefined): string | undefined {
        if (source.endsWith(".css") || source.endsWith(".html")) {
          // Virtual id with a `.js` suffix: the served content is plain JS,
          // and the suffix keeps the bundler from sniffing the real extension.
          return `\0template-text:${path.resolve(path.dirname(importer ?? ROOT), source)}.js`;
        }
        return undefined;
      },
      load(id: string): string | undefined {
        const prefix = "\0template-text:";
        if (id.startsWith(prefix)) {
          const filePath = id.slice(prefix.length, -".js".length);
          return `export default ${JSON.stringify(readFileSync(filePath, "utf8"))};`;
        }
        return undefined;
      },
    },
  ],
});
