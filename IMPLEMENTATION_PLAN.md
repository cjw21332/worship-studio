# Worship Studio — Implementation Plan for Competitive Parity

**Status:** Ready to execute  
**Priority Order:** Phase 1 → Phase 2 → Phase 3 → Phase 4

---

## Phase 1: Foundation & Trust (Week 1-2) ✅ START HERE

### 1.1 Add MIT License
```bash
# Create LICENSE file
cat > LICENSE << 'EOF'
MIT License

Copyright (c) 2024-2026 Charles James Walet and Worship Studio contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
EOF

# Update package.json
# "license": "MIT",
```

### 1.2 Enable Auto-Updates (electron-updater already in deps)
**Files:** `backend/update.ts`, `backend/main.ts`

```typescript
// backend/update.ts - enhance existing createUpdates
export function createUpdates({ userData, isPackaged, version }) {
  if (!isPackaged) return { handle: () => {}, check: async () => {} };

  const { autoUpdater } = require('electron-updater');
  autoUpdater.logger = require('electron-log');
  autoUpdater.autoDownload = false; // Ask user first
  autoUpdater.autoInstallOnAppQuit = true;

  // Configure GitHub Releases feed
  autoUpdater.setFeedURL({
    provider: 'github',
    owner: 'cjw21332',
    repo: 'worship-studio',
    private: false
  });

  return {
    handle: (action) => { /* existing */ },
    check: async () => {
      try {
        const { updateInfo } = await autoUpdater.checkForUpdates();
        return updateInfo ? { available: true, version: updateInfo.version } : { available: false };
      } catch (e) {
        return { available: false, error: e.message };
      }
    }
  };
}
```

**Add to main.ts startup:**
```typescript
// After window creation, check for updates silently
setTimeout(() => {
  updates.check().then(result => {
    if (result.available) {
      win.webContents.send('update:available', result);
    }
  });
}, 10000); // 10s after startup
```

### 1.3 Add macOS Build Target
**File:** `package.json` → `build` section

```json
"mac": {
  "target": [
    { "target": "dmg", "arch": ["x64", "arm64"] },
    { "target": "zip", "arch": ["x64", "arm64"] }
  ],
  "artifactName": "Worship-Studio-${version}-${arch}.${ext}",
  "icon": "packaging/icon.icns",
  "category": "public.app-category.utilities",
  "hardenedRuntime": true,
  "gatekeeperAssess": false,
  "entitlements": "packaging/entitlements.mac.plist",
  "entitlementsInherit": "packaging/entitlements.mac.plist",
  "notarize": {
    "teamId": "YOUR_TEAM_ID"
  }
},
```

**Add scripts:**
```json
"package:mac": "npm run build && electron-builder --mac --x64 --arm64 --publish never",
"package:mac:dir": "npm run build && electron-builder --mac --x64 --arm64 --dir --publish never"
```

### 1.4 Add Linux Build Target
**File:** `package.json` → `build` section

```json
"linux": {
  "target": [
    { "target": "AppImage", "arch": ["x64"] },
    { "target": "deb", "arch": ["x64"] }
  ],
  "artifactName": "Worship-Studio-${version}-${arch}.${ext}",
  "icon": "packaging/icon.png",
  "category": "Utility",
  "maintainer": "Worship Studio <worship-studio@github.com>",
  "description": "Offline worship service planning and presentation"
},
```

**Add scripts:**
```json
"package:linux": "npm run build && electron-builder --linux AppImage deb --x64 --publish never"
```

### 1.5 Code Signing (Windows)
**Prerequisites:** EV Code Signing Certificate (~$200-400/yr) or GitHub Actions + Azure Key Vault

**File:** `package.json` → `build.win`
```json
"win": {
  "target": [...],
  "signAndEditExecutable": true,
  "certificateFile": "cert/cert.p12", // or use env var CSC_LINK
  "certificatePassword": "env:CSC_KEY_PASSWORD",
  "publisherName": "Charles James Walet"
}
```

**GitHub Actions workflow:** `.github/workflows/release.yml`
```yaml
name: Release
on:
  push:
    tags: ['v*']
jobs:
  build:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '24', cache: 'npm' }
      - run: npm ci
      - run: npm run package:win
        env:
          CSC_LINK: ${{ secrets.CSC_LINK }}
          CSC_KEY_PASSWORD: ${{ secrets.CSC_KEY_PASSWORD }}
      - uses: softprops/action-gh-release@v2
        with:
          files: release/*.exe
```

### 1.6 Contribution Docs
```bash
# CONTRIBUTING.md
cat > CONTRIBUTING.md << 'EOF'
# Contributing to Worship Studio

## Development Setup
1. Install Node.js 24, Git
2. `git clone https://github.com/cjw21332/worship-studio.git`
3. `cd worship-studio && npm ci`
4. `npm run dev` (builds + launches Electron)

## Code Style
- TypeScript strict mode
- ESLint + Prettier (run `npm run lint` if configured)
- Conventional commits: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`

## Pull Requests
- Target `main` branch
- Include tests for new features
- Update CHANGELOG.md (or let release script handle it)
- Ensure `npm run typecheck && npm test && npm run build` pass

## License
By contributing, you agree your contributions are licensed under MIT.
EOF

# CODE_OF_CONDUCT.md (Contributor Covenant)
cat > CODE_OF_CONDUCT.md << 'EOF'
# Contributor Covenant Code of Conduct

## Our Pledge
We as members, contributors, and leaders pledge to make participation in our community a harassment-free experience for everyone...

[Full text at https://www.contributor-covenant.org/version/2/1/code_of_conduct/]
EOF
```

### 1.7 GitHub Issue Templates
```bash
mkdir -p .github/ISSUE_TEMPLATE

cat > .github/ISSUE_TEMPLATE/bug_report.yml << 'EOF'
name: Bug Report
description: Report a bug in Worship Studio
title: "[Bug]: "
labels: ["bug"]
body:
  - type: markdown
    attributes:
      value: "Thanks for reporting! Please fill out the sections below."
  - type: input
    id: version
    attributes:
      label: App Version
      placeholder: "2.0.0"
    validations:
      required: true
  - type: input
    id: os
    attributes:
      label: Windows Version
      placeholder: "Windows 11 23H2"
    validations:
      required: true
  - type: textarea
    id: steps
    attributes:
      label: Steps to Reproduce
      placeholder: |
        1. Open Worship Studio
        2. Create a new song...
        3. Observe error
    validations:
      required: true
  - type: textarea
    id: expected
    attributes:
      label: Expected Behavior
    validations:
      required: true
  - type: textarea
    id: actual
    attributes:
      label: Actual Behavior
    validations:
      required: true
  - type: textarea
    id: logs
    attributes:
      label: Diagnostic Logs
      description: "Help → Export Diagnostics, then paste relevant lines"
      render: text
EOF

cat > .github/ISSUE_TEMPLATE/feature_request.yml << 'EOF'
name: Feature Request
description: Suggest a new feature
title: "[Feature]: "
labels: ["enhancement"]
body:
  - type: markdown
    attributes:
      value: "Describe the feature and why it would help your church."
  - type: textarea
    id: problem
    attributes:
      label: Problem Statement
      description: "What workflow is painful or missing?"
    validations:
      required: true
  - type: textarea
    id: solution
    attributes:
      label: Proposed Solution
      description: "How should it work?"
    validations:
      required: true
  - type: textarea
    id: alternatives
    attributes:
      label: Alternatives Considered
      description: "Other tools that do this well?"
  - type: checkboxes
    id: priority
    attributes:
      label: Priority
      options:
        - label: "Critical for our Sunday workflow"
        - label: "Nice to have"
        - label: "Future consideration"
EOF
```

---

## Phase 2: Networked Features (Weeks 3-10)

### 2.1 NDI Output — Architecture

**New files:**
- `backend/ndi-worker.ts` — Isolated NDI process (crash isolation)
- `backend/ndi-handlers.ts` — IPC handlers for NDI config
- `frontend/NDISettings.tsx` — UI for NDI output config

**Dependencies:**
```bash
npm i @ndi/sdk  # or node-ndi if @ndi/sdk not on npm
# Note: NDI SDK requires Windows; may need to compile native addon
```

**Alternative (pure JS, no native):**
```bash
# Use ndi-lib wrapper or spawn ffmpeg with NDI output
npm i fluent-ffmpeg
# ffmpeg -f ndi -i "Worship Studio" -f decklink ... (for Blackmagic)
```

**Implementation approach:**
1. Add `ndi` role to `OutputRole` type in `outputs.ts`
2. Create `NdiOutput` class implementing output interface
3. Register in `createOutputs()` when NDI SDK available
4. Add NDI settings to `ExtrasSettings.tsx` → new `NDISettings` tab
5. Render slides to offscreen canvas → push frames to NDI

**Key files to modify:**
- `backend/outputs.ts` — Add NDI output type
- `backend/presentation.ts` — Add frame capture for NDI
- `backend/main.ts` — Initialize NDI worker
- `frontend/OutputSettings.tsx` — NDI configuration UI

### 2.2 Cloud Sync — Supabase Architecture

**Why Supabase:** PostgreSQL + Realtime + Auth + Storage + Edge Functions; generous free tier; self-hostable.

**Schema (Supabase):**
```sql
-- Users (Supabase Auth)
-- Workspaces (church-level)
CREATE TABLE workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Synced entities
CREATE TABLE synced_songs (
  id UUID PRIMARY KEY,
  workspace_id UUID REFERENCES workspaces(id),
  title TEXT, lyrics JSONB, author TEXT, copyright TEXT,
  detail JSONB, updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE synced_services (
  id UUID PRIMARY KEY,
  workspace_id UUID REFERENCES workspaces(id),
  name TEXT, items JSONB, settings JSONB,
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE synced_settings (
  workspace_id UUID REFERENCES workspaces(id),
  key TEXT, value JSONB,
  PRIMARY KEY (workspace_id, key)
);

-- Enable RLS: users only see their workspace
ALTER TABLE synced_songs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workspace_access" ON synced_songs
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));
```

**Local sync engine (`backend/sync-engine.ts`):**
```typescript
// Conflict resolution: last-write-wins with vector clocks per entity
// Offline-first: queue mutations locally, push when online
// Merge strategy: song lyrics = manual conflict UI; settings = LWW
```

**UI Flow:**
1. `ExtrasSettings.tsx` → "Cloud Sync" tab
2. "Sign in with GitHub/Google/Email" (Supabase Auth)
3. "Create Workspace" or "Join Workspace" (invite code)
4. Toggle sync per entity type (Songs, Services, Settings, Media refs)
5. Status indicator: 🟢 Synced / 🟡 Pending / 🔴 Conflict

### 2.3 Planning Center Integration

**OAuth Flow:**
1. Register Worship Studio as PCO app (developer.planningcenteronline.com)
2. Store `client_id`, `client_secret` in app (or user enters)
3. User clicks "Connect Planning Center" → OAuth redirect → callback to local HTTP server
4. Store refresh token encrypted in local DB

**Sync Operations:**
- **Songs:** PCO Songs → Worship Studio library (title, lyrics, author, CCLI#, tags)
- **Plans:** PCO Plan → Worship Studio service (order, items, notes)
- **People:** PCO People → Operator assignments (optional)

**Implementation:**
```typescript
// backend/pco-client.ts
class PlanningCenterClient {
  async getSongs(perPage = 100) { /* paginated */ }
  async getPlan(planId) { /* plan with items */ }
  async pushSong(song) { /* create/update in PCO */ }
}

// backend/pco-sync.ts
async function syncFromPCO(workspaceId, since?) { /* incremental */ }
async function pushToPCO(workspaceId, songIds?) { /* create new */ }
```

**UI:** `Integrations.tsx` → Planning Center tab

### 2.4 CCLI SongSelect Integration

**API:** `api.songselect.ccli.com` (requires CCLI account + SongSelect subscription)

**Features:**
- Search by title/author/CCLI#
- Import lyrics + copyright + admin info
- Auto-report usage (Phase 4)

**Implementation:**
```typescript
// backend/songselect-client.ts
class SongSelectClient {
  async search(query) { /* returns songs */ }
  async getSong(songId) { /* full lyrics + metadata */ }
  async reportUsage(songId, date, copies) { /* Phase 4 */ }
}
```

**UI:** `SongImport.tsx` → "Search SongSelect" tab

### 2.5 API.Bible Integration

**API:** `api.bible` (free tier: 5000 requests/day; 200+ translations)

**Features:**
- Browse translations by language
- Fetch passages by reference
- Audio Bibles (future)

**Implementation:**
```typescript
// backend/apibible-client.ts
class ApiBibleClient {
  async getTranslations(language = 'eng') { /* list */ }
  async getPassage(translationId, reference) { /* verses */ }
  async importTranslation(translationId) { /* bulk import to local SQLite */ }
}
```

**UI:** `BibleImport.tsx` → "Download from API.Bible" wizard

---

## Phase 3: Streaming & Production (Weeks 11-18)

### 3.1 RTMP Streaming Output

**Architecture:** Use `fluent-ffmpeg` to encode rendered frames → RTMP

```typescript
// backend/rtmp-worker.ts
class RtmpStreamer {
  private ffmpeg: FfmpegCommand;
  private canvas: OffscreenCanvas; // or electron's BrowserWindow capture

  start(rtmpUrl, options: { fps: 30, bitrate: '2500k', resolution: '1920x1080' }) {
    this.ffmpeg = ffmpeg()
      .inputFormat('rawvideo')
      .inputOptions(['-f rawvideo', '-pix_fmt bgra', `-s ${options.resolution}`, `-r ${options.fps}`])
      .input('pipe:0')
      .outputOptions([
        '-c:v libx264', '-preset veryfast', '-tune zerolatency',
        `-b:v ${options.bitrate}`, '-maxrate ${options.bitrate}', '-bufsize 5000k',
        '-pix_fmt yuv420p', '-g 60', '-f flv'
      ])
      .output(rtmpUrl)
      .on('error', this.handleError)
      .run();

    // Pipe frames from presentation renderer
    this.frameInterval = setInterval(() => this.captureAndSend(), 1000 / options.fps);
  }

  private captureAndSend() {
    // Capture current live slide from renderer process
    // Send raw frame to ffmpeg stdin
  }
}
```

**UI:** `OutputSettings.tsx` → "Streaming" tab → RTMP URL, key, quality presets

### 3.2 Blackmagic DeckLink Support

**Option A:** `node-decklink` (native addon, Windows/macOS/Linux)
**Option B:** FFmpeg with DeckLink input/output (`-f decklink`)

```bash
# FFmpeg approach (no native deps)
ffmpeg -f decklink -i "DeckLink Duo (1)" -f rawvideo -pix_fmt uyvy422 pipe:1
```

**Key/Fill for lyrics overlay:**
- Fill: Rendered slide (with alpha)
- Key: Alpha channel from theme (text opaque, background transparent)

### 3.3 MIDI/OSC Integration

**MIDI:** `npm i midi` or `web-midi-api` (Electron supports Web MIDI)
**OSC:** `npm i osc` or `node-osc`

```typescript
// backend/midi-handler.ts
import { MidiInput, MidiOutput } from 'midi';

class MidiController {
  private input: MidiInput;
  private output: MidiOutput;

  onSlideChange(callback: (slide: Slide) => void) {
    this.input.on('message', (delta, msg) => {
      const [status, data1, data2] = msg;
      if (status === 0x90 && data2 > 0) { // Note On
        if (data1 === 60) callback('next');
        if (data1 === 59) callback('previous');
      }
    });
  }

  sendSlideTrigger(slideIndex: number) {
    this.output.sendMessage([0x90, 60 + slideIndex, 127]); // Note On
    this.output.sendMessage([0x80, 60 + slideIndex, 0]);   // Note Off
  }
}
```

### 3.4 Web Confidence Monitor

**Serve stage view via local HTTP (like FreeShow):**

```typescript
// backend/web-confidence.ts
import { createServer } from 'http';
import { WebSocketServer } from 'ws';

function startConfidenceServer(port = 8080, getState) {
  const server = createServer((req, res) => {
    if (req.url === '/') return serveHtml(res);
    if (req.url === '/state') return serveJson(res, getState());
  });

  const wss = new WebSocketServer({ server });
  wss.on('connection', ws => {
    const interval = setInterval(() => {
      ws.send(JSON.stringify(getState()));
    }, 100);
    ws.on('close', () => clearInterval(interval));
  });

  server.listen(port);
  return server;
}
```

**UI:** `ExtrasSettings.tsx` → "Web Confidence" → shows URL + QR code

### 3.5 Live Edit Mode

**FreeShow-style:** Double-click live slide → inline edit → Enter to commit

```typescript
// frontend/LiveEditOverlay.tsx
// Only enabled in Present mode, when output is live
// Edits go to service item immediately, re-render live slide
```

---

## Phase 4: Ecosystem & Polish (Weeks 19-26)

### 4.1 CCLI Auto-Reporting
```typescript
// backend/ccli-reporter.ts
class CcliReporter {
  async generateReport(startDate, endDate) {
    const usage = store.usageHistory(); // existing
    const songs = usage.filter(u => u.kind === 'song' && u.usedAt >= startDate && u.usedAt <= endDate);
    // Group by songId, count occurrences
    // Output CCLI format (CSV with Song#, Title, Author, Copies, Date)
  }
}
```

### 4.2 Enhanced Remote (WebSocket)
```typescript
// backend/remote.ts → upgrade from HTTP polling to WebSocket
// Lower latency, real-time slide preview on phone
// Add chord chart view for musicians
```

### 4.3 Accessibility Audit
- Run `npm i -D @axe-core/playwright`
- Add test: `npm run test:a11y`
- Fix: focus order, ARIA labels, color contrast, screen reader labels

---

## Code Quality Gates (Add to CI)

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]
jobs:
  check:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '24', cache: 'npm' }
      - run: npm ci
      - run: npm run typecheck
      - run: npm run lint        # add eslint
      - run: npm test
      - run: npm run build
      - run: npm run package:win -- --dir  # test packaging
```

---

## Dependency Checklist for New Features

| Feature | New Dependencies | Native Build? |
|---------|------------------|---------------|
| NDI | `@ndi/sdk` or `fluent-ffmpeg` + NDI runtime | Yes (NDI SDK) |
| Cloud Sync | `@supabase/supabase-js` | No |
| Planning Center | `oauth4webapi` or custom | No |
| SongSelect | Custom fetch + XML parsing | No |
| API.Bible | Custom fetch | No |
| RTMP | `fluent-ffmpeg` + FFmpeg binary | FFmpeg bundled |
| DeckLink | `node-decklink` or FFmpeg | Yes (DeckLink SDK) |
| MIDI | `midi` (native) or Web MIDI API | Maybe |
| OSC | `osc` | No |
| Web Confidence | `ws` | No |
| Accessibility | `@axe-core/playwright` | No |

---

## Milestone Definitions

| Milestone | Criteria | Target Date |
|-----------|----------|-------------|
| **M1: Foundation** | MIT license, signed Windows installer, auto-updates, macOS/Linux builds, CI passing | Week 2 |
| **M2: Networked Core** | NDI output working, Cloud Sync (Supabase) beta, Planning Center import, API.Bible import | Week 10 |
| **M3: Streaming** | RTMP streaming to YouTube, Web Confidence Monitor, MIDI basic | Week 18 |
| **M4: Polish** | CCLI reporting, enhanced remote, accessibility pass, plugin API design | Week 26 |

---

## Risk Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| NDI SDK native build fails on CI | High | High | Use FFmpeg + NDI as fallback; document Windows-only for NDI |
| Supabase free tier limits hit | Medium | Medium | Implement efficient sync (delta + compression); self-host option |
| PCO API rate limits | Low | Medium | Cache aggressively; batch requests; respect headers |
| FFmpeg binary size | Medium | Low | Use `ffmpeg-static` (20MB); optional download |
| macOS notarization delays | Medium | Medium | Pre-submit test builds; use `electron-notarize` |
| Volunteer contributor burnout | High | High | Keep scope small per PR; good issue templates; mentorship |

---

## Success Metrics

| Metric | Current | Target (6mo) | Target (12mo) |
|--------|---------|--------------|---------------|
| GitHub Stars | ~50 | 200 | 500 |
| Weekly Active Users | Unknown | 100 | 500 |
| Churches using NDI | 0 | 20 | 100 |
| Churches using Cloud Sync | 0 | 30 | 150 |
| PCO-integrated churches | 0 | 15 | 75 |
| macOS/Linux downloads | 0 | 50/week | 200/week |
| Contributors | 1 | 5 | 15 |

---

*This plan is a living document. Update as features ship and feedback arrives.*