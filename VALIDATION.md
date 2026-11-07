# Validation: Worship Studio 2.0.0

This file records checks performed on the current Windows x64 source and packaged application. It replaces older reports that referred to test harnesses and artifacts absent from this source snapshot.

## Completed checks

- Production build and TypeScript checking passed.
- `npm test`: three tests passed, covering song section display, selected Bible passage composition, and text-style persistence/output behavior.
- `node scripts/text-styles-check.cjs`: visible preview, retained drafts across content types, saved settings, repeated style reuse, size validation, Escape closing, and narrow dialog layout passed.
- The text-style dialog passed axe checks in light, dark, and high-contrast themes. This is a targeted dialog audit, not certification of every screen.
- The same text-style checks passed against the packaged application using `--packaged`.
- `node scripts/packaged-check.cjs`: application startup, version 2.0.0, backend display enumeration, song creation, service insertion, preview, and packaged user-file folders passed.
- Windows installer packaging completed successfully. The setup executable is unsigned.

## Reproduce

```powershell
npm ci
npm test
npm run build
node scripts/text-styles-check.cjs
npm run package:win
node scripts/packaged-check.cjs
node scripts/text-styles-check.cjs --packaged
```

Electron checks need an interactive Windows desktop and use disposable user-data directories. Packaging intermediates, including `release/win-unpacked`, must exist for packaged checks. The text-style script creates a screenshot in `release/`.

## Limits

- No clean installation/uninstallation on a separate Windows PC was tested.
- Physical projector/multi-monitor behavior, hot-plug, sleep/wake, actual phone pairing, screen-reader use, and long-running mixed-media sessions are not certified by these checks.
- No bundled Bible database is present in this repository. Bible import is available; no bundled-translation completeness claim is made.
- Exact PowerPoint conversion and video transcoding depend on optional software installed on the destination PC.
- No code-signing certificate or working public automatic-update feed is configured.
- Some older npm script entries refer to missing harnesses. Only scripts present in this repository can be reproduced; no historical coverage or performance totals are claimed.
