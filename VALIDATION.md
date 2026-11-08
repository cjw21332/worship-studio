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
- The missing legacy harnesses are not part of the current npm scripts. No historical coverage or performance totals are claimed.

## Windows release acceptance checklist

Record the version, Windows version, hardware, operator, date, and outcome for each check. A failed check blocks release until resolved or explicitly accepted by the release owner. Never use a live service as the first test.

- [ ] On a separate clean Windows PC, install the setup executable, start the application, create and reopen a service, then uninstall and confirm user data remains intact. Repeat an upgrade from the previous release and test the portable build separately.
- [ ] Connect the actual projector and stage display. Arm outputs, verify they start black, and check that preview changes do not replace live content. Verify blackout, freeze, unfreeze, and emergency blackout.
- [ ] Disconnect and reconnect each display, change display arrangement, and sleep/wake the computer. Confirm output routing and safety state before continuing.
- [ ] Pair a real phone on a trusted local network; verify navigation, blackout, reconnect, invalid PIN rejection, and behavior when the network is lost.
- [ ] Run a representative service with mixed songs, scripture, images, video and presentations for the expected service duration. Check playback, memory, responsiveness and recovery after an interruption.
- [ ] Back up and restore a workspace on a different PC. Package a service with media, transfer it, reopen it, and verify all referenced media and slide content.
- [ ] Test keyboard navigation, high contrast, scaling, reduced motion and a screen reader on key preparation and presentation workflows.
- [ ] Check optional conversion with and without its required software installed; confirm the user receives a useful explanation when unavailable.
- [ ] If signing and a real feed are configured, verify the signature and publisher on the delivered executable and exercise update check, download, and confirmed installation from a previous installed version. Verify an unavailable feed does not interrupt offline presentation.

## Release configuration and owner decisions

The Windows build scripts use `--publish never`; the CI packaging job produces an unsigned unpacked build and does not publish a release. A public update feed and signing credentials are not configured. A release owner must choose and operate an HTTPS generic update feed, produce the metadata and matching signed installer expected by electron-updater, and test it end to end before advertising updates. Do not store signing credentials in the repository. Certificate acquisition and provider-specific setup, including any hardware-backed signing requirements, remain the owner's responsibility. Signing does not guarantee a particular SmartScreen reputation.

The project declares MIT licensing. macOS and Linux packaging and support are not validated. Their acceptance requires platform-specific build, install, functionality, signing/notarization where applicable, and release testing; adding a target alone does not establish support.
# Additional validation — 2026-11-08

- `npm test`: 31 tests passed, including timed-advance safety and package conflict coverage.
- `npm run typecheck` and `npm run build`: passed. The optional bundled Bible database was absent as documented.
- On this PC, `startup-check.cjs`, `bible-workflow-check.cjs`, and `text-styles-check.cjs` passed in an interactive execution environment. The startup check exercised a windowed stage output; it did not test a physical projector or phone.
- `npm run package:dir` and `packaged-check.cjs` passed on this PC; the packaged application was unsigned.
- Physical hot-plug, sleep/wake, phone pairing, clean-PC installation, screen-reader review, long-running playback, signing, and an update from a published feed remain to be checked using the checklist below.

