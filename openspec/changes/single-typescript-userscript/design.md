# Design

## Context

See proposal.md for motivation. Current state: `pnpm build` runs `scripts/build.ts` (via the Oxc runner hook), which expands 8 `{{PLACEHOLDERS}}` from `src/templates/` plus compiled `src/lib/*.ts` output into `src/ASF-STM.js` (~2124 lines, plain JS), emitting `dist/ASF-STM.user.js` (lines ending `// DEBUG` removed) and `dist/ASF-STM.debug.js` (`  // DEBUG` markers stripped, code kept). Version comes from `package.json`. Key observation from inspection: every `// DEBUG` block is already runtime-gated on `globalSettings.debug` (e.g. `src/ASF-STM.js:86-102`), so the release/debug split is redundant with the in-app setting — a single file loses nothing. `tsconfig.json` is `strict` + `noUncheckedIndexedAccess`, `lib: ["ES2022", "DOM"]`, and already includes `src/**/*.ts`. CI (`build.yml`) verifies both `dist/` files and attaches both to draft releases.

## Goals / Non-Goals

**Goals:**
- One TypeScript source tree compiling to one self-contained userscript, with zero custom builder code and zero placeholder tokens.
- Debug available in the single file behind the existing `globalSettings.debug` switch.

**Non-Goals:**
- No matching/scan/offer logic changes; conversion is verbatim-first, typed second.
- No test-framework, settings-schema, or template-content changes beyond making templates importable.
- No minification (keep the distributable reviewable, as today).

## Decisions

1. **Bundle with rolldown (Oxc-family), fallback esbuild.**
   Rationale: `tsc` cannot bundle to a single file, and the output must be one self-contained script with no runtime module loader, so a bundler is required. Rolldown keeps the Oxc toolchain story (it powers Vite's bundling) and handles TS + raw text imports via plugins. Alternative (esbuild): more mature and already transitively present via vitest's vite dependency, but adds a second transformer family. Alternative (tsc emit + manual concat): reintroduces bespoke assembly code — exactly what this change removes. Decide finally in implementation; specs are tool-agnostic.
2. **Templates become imports, not placeholders.**
   Rationale: the 5 template files (CSS + 4 JS/HTML fragments) become static text imports (raw-import/plugin) consumed directly by the TS source. This deletes the whole placeholder-expansion category of build failures. Alternative (keep `src/templates/` + a smaller expander): keeps the custom step alive — rejected.
3. **Version via build-time define, header via banner.**
   Rationale: `{{VERSION}}` dies with placeholders; the bundler injects the `package.json` version as a compile-time constant and prepends the userscript metadata block (with the version interpolated) as a banner, preserving the single-source-of-truth rule and Tampermonkey header parsing.
4. **Convert `ASF-STM.js` verbatim-first: rename, type the boundaries, then satisfy `strict`.**
   Rationale: lowest drift risk for 2124 lines. GM_*/Tampermonkey globals get a small ambient declaration file (they are not in DOM lib); `src/lib` imports become normal TS imports; the IIFE wrapper stays so runtime scoping is unchanged. `noUncheckedIndexedAccess` friction is fixed with explicit guards, not weakened config. Alternative (rewrite while converting): rejected — behavior drift would be untestable against the golden reference.
5. **Retire `// DEBUG`, keep the `globalSettings.debug` gate.**
   Rationale: inspection shows the strip step is redundant — release behavior already equals "debug code present but flag off". Debug-variant users reinstall the single file and toggle the existing setting. Alternative (keep a compile-time strip flag producing two files): preserves the split this change removes — rejected.

## Risks / Trade-offs

- [Risk] Verbatim conversion introduces behavior drift → Mitigation: convert without logic edits, run the existing vitest suite plus a built-file smoke comparison against the current `tsx`-built output before deleting the old pipeline.
- [Risk] Tampermonkey/GM typing gaps (`GM_*`, `unsafeWindow` if used) block `strict` → Mitigation: ambient `d.ts` for exactly the APIs used (9 `GM_` hits); no `any` sprawl beyond documented escape hatches.
- [Risk] Bundler output differs subtly (helper injection, import order) → Mitigation: single-file smoke diff on representative scan/match fixtures; keep output unminified for review.
- [Risk] Debug-file users lose their install URL → Mitigation: README reinstall note; old release assets stay published.
- Trade-off: new bundler devDependency (rolldown or esbuild) replaces `scripts/build.ts` + template machinery — net fewer custom moving parts, one more standard one.

## Migration Plan

Land in one change (conversion + single asset + doc updates), bumping `package.json` per the versioning rule. CI verify/release steps drop to the single file. Rollback: revert the change; `dist/` regenerates from the restored pipeline (old release assets remain published, so users are unaffected during the window).

## Open Questions

None. The rolldown-vs-esbuild pick is an implementation detail the specs intentionally leave open.
