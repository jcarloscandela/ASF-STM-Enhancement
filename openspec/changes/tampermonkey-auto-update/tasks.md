# Tasks

## 1. Build banner auto-update metadata

- [ ] 1.1 Add stable `@updateURL` and `@downloadURL` entries (both pointing at `https://github.com/jcarloscandela/ASF-STM-Enhancement/releases/latest/download/ASF-STM.user.js`) to the `BANNER` in `rolldown.config.ts`, and verify `pnpm build` emits both lines in the header of `dist/ASF-STM.user.js` alongside the correct `@version`
- [ ] 1.2 Bump the patch version in `package.json` per the repo versioning rule, and verify `pnpm build` injects the new version into the banner `@version`

## 2. CI published release with stable asset

- [ ] 2.1 Change the `Draft release` step in `.github/workflows/build.yml` so a version bump yields a published (not draft-only) release keeping the stable asset filename `ASF-STM.user.js`, and verify the workflow YAML parses and the release step still gates on the version increase
- [ ] 2.2 Run the full gate (`pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`) and verify all pass with the banner change

## 3. Docs and install flow

- [ ] 3.1 Update `README.md` (and `AGENTS.md` if it documents install/distribution) to point installation at the always-latest download URL with a one-time-reinstall note for existing users, and verify the documented URL matches the banner `@updateURL`/`@downloadURL` exactly

## 4. End-to-end verification

- [ ] 4.1 After merge of the version bump, confirm a published release exists for the new version and fetching `.../releases/latest/download/ASF-STM.user.js` returns a file whose `@version` equals the bumped version
- [ ] 4.2 Run `openspec validate --change "tampermonkey-auto-update"` (and strict if available) and verify the change passes with no errors
