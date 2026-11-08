# Worship Studio

**Prepare a service. Preview every slide. Present with confidence.**

Worship Studio is an offline Windows desktop application for organizing and presenting church services. It brings song lyrics, Bible passages, announcements, images, video, and presentation slides into one workspace, with separate controls for preparation and live output.

**Created by Charles James Walet** · [GitHub: @cjw21332](https://github.com/cjw21332) · **Current release: 2.0.0**

[Download the Windows installer](https://github.com/cjw21332/worship-studio/releases/download/v2.0.0/Worship-Studio-2.0.0-x64-setup.exe) · [All releases](https://github.com/cjw21332/worship-studio/releases) · [Report an issue](https://github.com/cjw21332/worship-studio/issues)

## What is it for?

Worship Studio helps church media teams, worship leaders, projection operators, and volunteers prepare a running order and display the right content at the right time. Use it for worship services, prayer meetings, Bible studies, and church gatherings.

The operator works with three main areas: **Library → Service list → Presentation**. Select content from the library, arrange it in the service, and preview a slide before deliberately sending it to the audience. Preparing the next slide does not automatically replace what is live.

Core preparation and presentation work locally without an account or an internet connection. Downloads and optional update checks need internet access. The optional phone remote uses your local network.

## Features

### Song library and lyrics

- Create, edit, search, import, and export songs with title, author, copyright, and other metadata.
- Organize lyrics into verses, choruses, bridges, and other sections; build arrangements with repeated sections.
- Split lyrics into slides using line-count settings or manual breaks.
- Review import results and duplicates before adding songs to the library.
- Use stage-only chord markers and keep service copies independent of later library edits.
- Review usage history and export usage records as CSV.

### Bible passages

- Import local Bible translations and search passages by reference or words.
- Resolve supported English and Filipino book names, aliases, and passage ranges.
- Select multiple verses, preview selected passages together, and add them to the service.
- Present translations in single, parallel, stacked, or line-by-line layouts, with reference and translation information.
- Configure translation-specific fonts and manage recent or favorite passages.

Installers built with the optional local starting library initialize its songs and Bible translations on first launch. You can also import translations in Zefania, OpenSong, OSIS XML, tab-separated data, and Worship Studio Bible JSON. Imported translations remain available offline. Distribution of supplied content requires the appropriate rights.

### Service planning

- Arrange songs, scripture, notes, slide sets, images, video, presentations, and countdowns in a running order.
- Reorder items, save and reopen services, use templates, and review pre-flight checks.
- Use undo/redo and available recovery snapshots for supported service edits.
- Package a service with its media when transferring it to another computer.
- Switch between **Prepare mode** for editing and **Present mode** for operating a service with fewer accidental edits.

### Live presentation and multiple displays

- Keep **Preview** separate from **Live**, then use **Go Live** to send prepared content.
- Configure audience, stage, rehearsal, and confidence output windows.
- Select display destinations and use available split-display and test-pattern controls.
- Outputs require deliberate arming and start black.
- Use separate blackout, clear-text, logo, and freeze controls; emergency blackout remains available while frozen.
- Show current/next content, notes, chords, clocks, timers, and operator messages on stage output.
- Lock output to protect presentation controls and theme changes.

### Text styles and themes

- Start from six built-in themes and customize fonts, text fitting, colors, backgrounds, positioning, lower thirds, and transitions.
- Apply themes to a service, content type, or individual item. Item-specific themes take priority.
- Edit content-type text styles in a compact dialog with a working 16:9 preview, font presets, custom maximum size, color, and horizontal/vertical alignment.
- Preview edits before applying; drafts are retained while switching content types within the open editor.
- Check text contrast and receive validation feedback for invalid sizes.
- Save and apply a content-type style in one action. Repeated edits reuse that style instead of accumulating unused copies.

Applying a style can immediately update matching live content. Check the preview before applying during a service.

### Media and announcements

- Import and manage images and video, and create notes or custom slide sets.
- Import PowerPoint presentations with local conversion tools when available; simplified PPTX extraction is available as a fallback.
- Prepare countdowns, slide loops, notices, and alerts.
- Use **Quick Send** to prepare a Bible passage, notice, or alert without rebuilding the service order.
- Use capture-friendly output windows with compatible screen/window capture software.

### Accessibility and operator experience

- Light, dark, high-contrast, and system appearance options.
- Interface scaling from 100% to 200%, larger targets, stronger focus indicators, and reduced motion.
- Keyboard navigation, resizable panes, shortcut hints, and an in-app walkthrough.
- Simple mode for everyday controls and Full mode for advanced tools.
- English and Filipino interface support; some editor/help text and technical messages remain in English.

### Local storage, recovery, and remote control

- Local SQLite storage for the working library and service data, with managed media in the workspace.
- Song JSON mirrors, file locks, and preserved conflict copies support folder-based synchronization workflows.
- Settings backup/restore, service recovery, activity logs, and diagnostic tools.
- Optional phone remote with PIN/QR pairing, service navigation, and selected presentation controls.
- Optional clicker mappings and update-feed settings.

The phone remote uses local HTTP and is intended for a trusted local network. It is not an internet-hosted remote service. No public automatic-update feed is configured by default.

## Install on another PC

### Requirements

- A **64-bit Windows PC**. Windows 11 x64 is the development and validation environment; other Windows versions are not certified by this project.
- Space for the application and your own media/library.
- A connected projector or second display for audience output, or a rehearsal window for practice.

The installer includes the application runtime. **Node.js, Git, and developer tools are not needed to install or run the released application.**

### Installation steps

1. Open the [2.0.0 release](https://github.com/cjw21332/worship-studio/releases/tag/v2.0.0).
2. Under **Assets**, download **Worship-Studio-2.0.0-x64-setup.exe**. The source-code ZIP is for developers, not installation.
3. Copy that single installer to the destination PC if needed, then run it.
4. Follow the setup wizard, choose the installation location, and finish installation.
5. Open **Worship Studio** from the desktop or Start menu and follow the welcome guide.

The current installer is not code-signed, so Windows may show an unknown-publisher warning. Verify that the file came from this repository's release before deciding whether to run it.

### First service

1. Use **Library → New song** or **File → Import → Songs** to add lyrics.
2. For scripture, select **View → Full mode**, then **File → Import → Bible translation**. Review the import and confirm your permission to use the text.
3. Add content to the **Service list** and arrange the running order.
4. Select an item and slide to inspect its **Preview**.
5. Open **Output → Outputs and displays**, select the intended display, and arm the output. It starts black.
6. Use **Go Live** or **F5** when ready to show the prepared slide.
7. Save the service, and disarm outputs when finished.

Open **Help → Welcome guide** or **Help → Keyboard shortcuts** for the available workflows and shortcuts. Test your actual display setup before a live service.

## Transfer and back up your work

- Use **File → Package with media** to move a service and its referenced media together. A plain service file can still reference media on the original PC.
- Use **Help → Copy workspace path** to locate the active workspace. Close the application before making a complete copy of that folder.
- The default packaged workspace uses `%APPDATA%/worship-studio`, unless a custom workspace or user-data location is selected.
- A settings backup is not a complete backup of your song library and media. Keep a complete workspace copy when moving all your data.
- Installing the application on another PC does not transfer your existing library automatically.

## Optional tools and current limits

| Area | Details |
| --- | --- |
| PowerPoint conversion | Microsoft PowerPoint, or LibreOffice together with `pdftoppm`, enables rendered-slide import. Simplified PPTX import extracts text/images and may omit original layout, animation, or embedded media. Exporting to PNG is another option. |
| Video conversion | FFmpeg is needed for local transcoding. Playback support depends on the file's codecs; test imported media before presenting. |
| Bible content | A starting library can be supplied at build time; otherwise import authorized local translations. |
| Online services | No official CCLI/SongSelect integration, Google Slides integration, or native NDI transmitter is included. |
| Updates | Update checks need an explicitly configured compatible HTTPS feed. Downloading a GitHub Release does not configure automatic updates. |
| Platform validation | Clean installation on a different PC, real projector/hot-plug behavior, screen-reader review, and extended-duration operation still need testing on the target equipment. |

The installer supplies the application, not third-party songs, Bible licenses, or optional conversion tools. Respect the rights associated with content you import or display.

## Run from source

Development requires **Node.js 24**, npm, Git, and a Windows desktop environment for the Electron checks and Windows packaging. Dependencies are locked in `package-lock.json`.

```powershell
git clone https://github.com/cjw21332/worship-studio.git
cd worship-studio
npm ci
npm run build
npm start
```

For a build followed by launch, use `npm run dev`. This command builds before launching; it is not a separate hot-reload development server. Dependency installation and first-time packaging-tool downloads require internet access.

The starting library database is a local build resource and is not tracked in Git. Generate it with `npx tsx scripts/build-starting-library.ts <songs-folder> <bibles-folder>` before building an installer. Review import errors and obtain redistribution rights for included content. Builds without this resource require manual imports. RTK is an optional local command-output helper, not a requirement for other contributors.

### Available checks

```powershell
npm test
npm run typecheck
npm run build
node scripts/startup-check.cjs
node scripts/bible-workflow-check.cjs
node scripts/text-styles-check.cjs
```

Desktop checks launch Electron with temporary user-data folders. They require an interactive Windows session. The text-style check writes a screenshot under `release/`.

See [VALIDATION.md](VALIDATION.md) for the checks actually performed, their limits, and the Windows release acceptance checklist. Legacy harnesses absent from this snapshot are not advertised as available npm scripts.

### Build a Windows installer

```powershell
npm run package:win
node scripts/packaged-check.cjs
node scripts/text-styles-check.cjs --packaged
```

Packaging creates installer and portable executables under `release/`, plus intermediate files. Distribute the `*-setup.exe` for installation. The checks use `release/win-unpacked`, so run them before removing packaging intermediates. Release executables are distributed through [GitHub Releases](https://github.com/cjw21332/worship-studio/releases), not committed into Git.

## How the system is organized

The React interface sends validated requests through Electron's preload bridge to the TypeScript backend. The backend manages local storage, service state, imports, and display windows. Dedicated workers handle Bible and media tasks. Preview and output share a slide renderer to keep presentation behavior consistent.

| Path | Purpose |
| --- | --- |
| `frontend/` | React interface, editors, accessibility controls, translation catalogs, and slide rendering. |
| `frontend/ui-v2/` | Main Library / Service / Presentation workspace, menus, panes, and controls. |
| `backend/` | Electron startup, IPC/preload interfaces, SQLite access, service planning, media/Bible import, themes, outputs, remote, and diagnostics. |
| `public/` | Application artwork and bundled interface font with its license. |
| `packaging/` | Windows icon, installer customization, and user-file guidance. |
| `scripts/` | Resource copying, desktop checks, and build helpers. |
| `tests/` | Automated tests for song sections, Bible selection, and text-style persistence/output behavior. |
| `package.json` / `package-lock.json` | Application metadata, scripts, dependencies, and locked versions. |

The main stack is **Electron, React, TypeScript, Vite, esbuild, SQLite, Zod, and electron-builder**. Generated bundles, dependencies, local databases, and release binaries are excluded from source control.

## Feedback and contributions

Use [GitHub Issues](https://github.com/cjw21332/worship-studio/issues) for bug reports and feature requests. Include the app version, Windows version, steps to reproduce, expected behavior, and what actually happened. Add a screenshot if it helps, but remove private library content or personal information first.

For proposed changes, describe the affected workflow and the checks you ran. Keep changes focused and preserve preview/live separation, output locking, and existing user data.

## Creator, licensing, and acknowledgments

Worship Studio was created by **Charles James Walet** ([cjw21332](https://github.com/cjw21332)).

Worship Studio is licensed under the [MIT License](LICENSE).

Third-party components retain their own licenses. See the [Lucide artwork notice](packaging/user-files/Third-party%20notices.txt) and [Inter font license](public/fonts/Inter-OFL.txt). Imported lyrics, scripture, images, video, and presentation files remain subject to their owners' rights. Worship Studio is an independent project and is not an official product of FreeWorship, CCLI, or Microsoft.
