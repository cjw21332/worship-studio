# FreeWorship / Worship Studio — Competitive Analysis & Improvement Roadmap

**Analysis Date:** 2026-11-08  
**Current Version:** 2.0.0  
**Tech Stack:** Electron + React 19 + TypeScript + SQLite (Drizzle ORM) + Vite + esbuild

---

## Executive Summary

Worship Studio (formerly FreeWorship) is a **solid, well-architected offline-first Windows desktop application** for worship service presentation. It excels at core presentation workflows (preview/live separation, multi-output, themes, Bible handling) but **lags significantly behind modern alternatives** in cloud collaboration, streaming/NDI, mobile remotes, and ecosystem integrations.

**Positioning:** "ProPresenter for volunteers on a budget" — powerful local tool, but missing the networked/streaming features that define 2024-2026 worship tech.

---

## 1. Competitive Landscape (2024-2026)

| Software | Price | Platform | NDI | Cloud Sync | Mobile Remote | Streaming | CCLI/SongSelect | Planning Center | Bible API |
|----------|-------|----------|-----|------------|---------------|-----------|-----------------|-----------------|-----------|
| **ProPresenter** | $29/mo / $289/yr | macOS, Win | ✅ Native | ✅ Proprietary | iOS/Android | ✅ Built-in | ✅ Native | ✅ Native | 100+ built-in |
| **EasyWorship** | $299 one-time / $15/mo | Windows | ❌ | ❌ | iOS/Android | ❌ | ✅ Per-site | ❌ | 90+ built-in |
| **MediaShout** | $289/yr | Win, macOS | ❌ | ❌ | iOS/Android | ❌ | ✅ | ❌ | Built-in |
| **Faithlife Proclaim** | $19+/mo | Win, macOS (cloud) | ❌ | ✅ Native | Browser | ✅ Native | ✅ Native | ✅ Native | Logos integration |
| **FreeShow** | **Free (GPL)** | Win, macOS, **Linux** | ✅ **Native** | ✅ **Cloud sync** | **Browser-based** | ✅ **RTMP/NDI** | ✅ Planning Center | ✅ Planning Center | **200+ via API.Bible** |
| **WorshipTools Presenter** | Free + paid | Win, macOS | ✅ | ✅ | iOS/Android | ✅ | ✅ Native | ✅ Native | Built-in |
| **OpenLP** | Free (GPL) | Win, macOS, Linux | ❌ | ❌ | Browser | ❌ | ❌ | ❌ | Local only |
| **Worship Studio** | **Free (UNLICENSED)** | **Windows only** | ❌ | ❌ | **Local HTTP (PIN/QR)** | ❌ | ❌ | ❌ | **Local import only** |

### Key Market Shifts (2024-2026)

1. **NDI is table stakes** — FreeShow, ProPresenter, WorshipTools all ship native NDI. Churches expect lyrics on stream without SDI converters.
2. **Cloud sync is expected** — Volunteers prep at home, present on-site. FreeShow, Proclaim, WorshipTools solve this; Worship Studio requires manual file copy.
3. **Browser-based remotes > native apps** — FreeShow's web remote works on any device; Worship Studio's local HTTP remote needs same network + firewall config.
4. **API.Bible / Planning Center integration** — FreeShow and WorshipTools pull 200+ translations and sync songs automatically; Worship Studio requires manual import.
5. **RTMP/streaming output** — FreeShow 1.6+ can stream directly to YouTube/Facebook; ProPresenter has built-in streaming; Worship Studio has zero streaming support.
6. **Cross-platform** — FreeShow runs on Linux; Worship Studio is Windows-only (Electron but no macOS/Linux builds tested).

---

## 2. Worship Studio — Current Feature Inventory

### ✅ Strengths (Competitive Advantages)

| Area | Details |
|------|---------|
| **Preview/Live Separation** | Deliberate "Go Live" workflow; preview never auto-replaces live — **best-in-class for volunteer safety** |
| **Multi-Output Architecture** | Audience, Stage, Rehearsal, Confidence, Secondary — each with independent layouts |
| **Theme System** | 6 built-in themes, per-content-type overrides, per-item themes, live preview, contrast validation |
| **Bible Handling** | Parallel/stacked/line-by-line layouts, translation-specific fonts, passage search, recent/favorites |
| **Song Management** | Arrangements, sections, chord markers (stage-only), usage history, CSV export, duplicate detection |
| **Service Planning** | Templates, undo/redo, recovery snapshots, packaging with media, prepare/present modes |
| **Accessibility** | High contrast, scaling 100-200%, reduced motion, keyboard nav, screen reader friendly, EN/PH locales |
| **Output Safety** | Output locking, armed outputs start black, emergency blackout always available, display identification |
| **Local-First** | Zero cloud dependency, SQLite + JSON mirrors, folder sync workflows, settings backup/restore |
| **Diagnostics** | Activity logs, diagnostic export, startup/performance measurement, renderer error capture |
| **PowerPoint Import** | LibreOffice + pdftoppm pipeline (rendered slides) + simplified PXT extraction fallback |
| **Remote Control** | Local HTTP + QR/PIN pairing, service nav, slide control, blackout/logo — works offline |

### ⚠️ Gaps vs. Modern Alternatives

| Category | Missing / Weak | Competitor Reference |
|----------|----------------|---------------------|
| **NDI Output** | ❌ None | FreeShow, ProPresenter, WorshipTools |
| **RTMP/Streaming** | ❌ None | FreeShow (RTMP + Icecast), ProPresenter |
| **Blackmagic/DeckLink** | ❌ None | FreeShow (keying layers) |
| **Cloud Sync** | ❌ Manual file copy only | FreeShow, Proclaim, WorshipTools |
| **Planning Center** | ❌ No integration | FreeShow, WorshipTools, Proclaim |
| **CCLI SongSelect** | ❌ No integration | EasyWorship, ProPresenter, WorshipTools |
| **API.Bible** | ❌ Local import only (Zefania/OSIS/TSV) | FreeShow (200+ translations) |
| **Cross-Platform** | ❌ Windows only (no macOS/Linux CI) | FreeShow, OpenLP, ProPresenter |
| **MIDI/OSC** | ❌ None | FreeShow (bidirectional), ProPresenter |
| **Stage Display App** | ❌ Web-based only (confidence output) | ProPresenter (native iOS/Android), FreeShow (browser) |
| **Chord Charts** | ⚠️ Stage-only markers, no Charts integration | WorshipTools (Charts), FreeShow |
| **CCLI Auto-Reporting** | ❌ Manual CSV export only | WorshipTools, ProPresenter, EasyWorship |
| **Video Transcoding** | ⚠️ Requires external FFmpeg | FreeShow (built-in), ProPresenter |
| **Live Edit During Presentation** | ❌ Edit mode not available live | FreeShow (on-the-fly editing) |
| **Web Output / Confidence Monitor** | ⚠️ Confidence window only | FreeShow (web output for any device) |
| **Auto-Updates** | ⚠️ Requires explicit HTTPS feed config | All paid tools + FreeShow (GitHub releases) |
| **Code Signing** | ❌ Installer not signed (unknown publisher) | All commercial tools |
| **Linux Support** | ❌ None | FreeShow, OpenLP |

---

## 3. Architecture Assessment

### Strengths
- **Clean separation:** React frontend ↔ Electron backend via typed IPC (Zod schemas)
- **Worker isolation:** Bible worker + Media worker off main thread
- **SQLite + Drizzle:** Type-safe migrations, WAL mode, schema versioning
- **State machine:** Presentation state transitions (preview/live/freeze/blackout) are explicit
- **Output abstraction:** `createOutputs()` handles multi-display, arming, test patterns
- **Theme resolution:** Cascading priority (global → content-type → item → slide) with live preview
- **Diagnostics built-in:** Structured logging, performance marks, error boundaries

### Technical Debt / Risks
| Area | Risk |
|------|------|
| **UNLICENSED** | No OSS license — limits community contribution, forks, adoption |
| **Windows-only CI** | No macOS/Linux builds; Electron supports them but untested |
| **Single-process main** | All IPC, outputs, workers in one Node process — crash = total loss |
| **No auto-update feed** | Users must manually download GitHub releases |
| **No code signing** | SmartScreen warnings hurt adoption |
| **Bible worker uses legacy IPC** | `unpackedResource` for worker paths; fragile in packaged apps |
| **Settings schema evolution** | `WorkspaceSettingsSchema` parses JSON files directly — migration gaps possible |
| **Media serving via custom protocol** | `studio-media://` — clever but adds complexity for NDI/streaming later |

---

## 4. Prioritized Improvement Roadmap

### Phase 1: Foundation & Trust (Weeks 1-4) — *Do First*

| # | Initiative | Effort | Impact |
|---|------------|--------|--------|
| 1.1 | **Add MIT/Apache-2.0 license** | 1 day | Enables community, forks, distro packaging |
| 1.2 | **Code-sign Windows installer** (EV cert or GitHub Actions + `electron-builder` signing) | 1 week | Removes SmartScreen warnings; trust |
| 1.3 | **Configure auto-update feed** (GitHub Releases + `electron-updater`) | 3 days | Users stay current automatically |
| 1.4 | **Add macOS build target + CI** (GitHub Actions macOS runner) | 1 week | Cross-platform parity; expands audience |
| 1.5 | **Add Linux build target (AppImage/Flatpak)** | 1 week | Matches FreeShow/OpenLP; server/streaming boxes |

### Phase 2: Networked Features (Weeks 5-12) — *High Differentiator*

| # | Initiative | Effort | Impact |
|---|------------|--------|--------|
| 2.1 | **NDI Output** — Integrate `ndi-lib` or `node-ndi` worker; add NDI output role | 3 weeks | **Critical for streaming churches**; parity with FreeShow/ProPresenter |
| 2.2 | **Cloud Sync (optional)** — Supabase/Firebase or self-hosted; sync songs, services, settings | 4 weeks | Volunteer prep at home → present on-site |
| 2.3 | **Planning Center Integration** — OAuth + API sync (songs, plans, people) | 3 weeks | Major workflow for mid/large churches |
| 2.4 | **CCLI SongSelect Import** — Search/import lyrics with copyright metadata | 2 weeks | Saves hours/week for worship leaders |
| 2.5 | **API.Bible Integration** — 200+ translations via API key; fallback to local import | 2 weeks | Eliminates manual Bible import friction |

### Phase 3: Streaming & Production (Weeks 13-20) — *Modern Expectations*

| # | Initiative | Effort | Impact |
|---|------------|--------|--------|
| 3.1 | **RTMP Output** — Stream directly to YouTube/Facebook/Custom RTMP | 3 weeks | **All-in-one streaming**; no OBS needed for simple cases |
| 3.2 | **Blackmagic DeckLink Support** — Key/fill via `node-decklink` or `decklink-sdk` | 3 weeks | Pro hardware integration |
| 3.3 | **MIDI/OSC Integration** — Bidirectional; slide changes → lighting, MIDI → next slide | 2 weeks | Production automation |
| 3.4 | **Web Confidence Monitor** — Serve stage view via local HTTP (like FreeShow) | 2 weeks | Any phone/tablet as confidence monitor |
| 3.5 | **Live Edit Mode** — Edit slide text while live (FreeShow-style) | 2 weeks | Fix typos mid-service without blackout |

### Phase 4: Ecosystem & Polish (Weeks 21-28) — *Retention & Growth*

| # | Initiative | Effort | Impact |
|---|------------|--------|--------|
| 4.1 | **CCLI Auto-Reporting** — Generate CCLI reports from usage history | 1 week | Compliance automation |
| 4.2 | **WorshipTools Charts Integration** — Pull chord charts if user has subscription | 2 weeks | Musician workflow |
| 4.3 | **Enhanced Remote** — WebSocket-based (lower latency), playlist view, chord charts | 2 weeks | Better volunteer experience |
| 4.4 | **Service Templates Marketplace** — Share/import service templates (JSON) | 1 week | Community content |
| 4.5 | **Accessibility Audit + Fixes** — WCAG 2.1 AA, screen reader testing | 2 weeks | Inclusivity; legal compliance |

### Phase 5: Architecture Modernization (Ongoing)

| # | Initiative | Effort | Impact |
|---|------------|--------|--------|
| 5.1 | **Split main process** — Separate output/renderer processes for crash isolation | 3 weeks | Reliability |
| 5.2 | **Plugin System** — Load custom importers, outputs, themes via dynamic import | 4 weeks | Extensibility |
| 5.3 | **TypeScript Project References** — Faster builds, clearer boundaries | 1 week | Dev velocity |
| 5.4 | **E2E Test Suite (Playwright)** — Critical paths: import → service → present | 2 weeks | Regression prevention |

---

## 5. Quick Wins (Can Ship This Month)

| # | Task | Files to Touch | Est. Time |
|---|------|----------------|-----------|
| Q1 | Add `license: "MIT"` to package.json + LICENSE file | `package.json`, new `LICENSE` | 30 min |
| Q2 | Enable `electron-updater` auto-check on startup | `backend/update.ts`, `main.ts` | 2 hours |
| Q3 | Add macOS `electron-builder` config (DMG + universal) | `package.json` build section | 2 hours |
| Q4 | Add Linux AppImage target | `package.json` build section | 2 hours |
| Q5 | Document "How to contribute" + code of conduct | `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md` | 1 hour |
| Q6 | Add GitHub Issue templates (bug, feature, question) | `.github/ISSUE_TEMPLATE/` | 1 hour |
| Q7 | Add `npm run package:mac` and `npm run package:linux` scripts | `package.json` | 30 min |
| Q8 | Publish first signed release (if cert available) | CI/CD pipeline | 1 day |

---

## 6. Strategic Positioning Options

### Option A: "The Reliable Offline Standard" (Current Trajectory)
- Double down on local-first, zero-dependency, volunteer-safe
- Add NDI + cloud sync as *optional* modules
- **Pros:** Differentiated from cloud-heavy tools; appeals to security-conscious churches
- **Cons:** Market moving toward networked/streaming; may become niche

### Option B: "FreeShow for Windows — Native, Polished, Supported"
- Match FreeShow feature-for-feature (NDI, RTMP, PCO, API.Bible, cloud sync)
- Keep Windows-native UI/UX advantages (better text rendering, system integration)
- **Pros:** Direct competitor to fastest-growing free tool; Windows churches prefer native apps
- **Cons:** High engineering lift; FreeShow has head start + community

### Option C: "ProPresenter Lite — Paid Sustainability"
- Add paid tier: cloud sync, PCO, SongSelect, auto-updates, priority support
- Keep core presentation free (current feature set + NDI)
- **Pros:** Sustainable funding; can hire full-time devs
- **Cons:** License change required; community backlash risk; competes with ProPresenter directly

### Recommendation: **Hybrid B + A**
1. **Phase 1-2:** Match FreeShow's *networked* features (NDI, cloud sync, PCO, API.Bible) — these are table stakes now
2. **Keep:** Offline-first architecture, preview/live safety, Windows-native polish
3. **License:** Switch to **MIT** — enables distro packaging (Chocolatey, Winget, Scoop), community PRs, forks
4. **Monetization (later):** Optional hosted sync service (like Proclaim) or support subscriptions — *not* feature gating

---

## 7. Resource Estimates

| Phase | Engineering Weeks | Key Dependencies |
|-------|-------------------|------------------|
| Phase 1 (Foundation) | 4-5 | Code signing cert ($200-400/yr), Apple Developer ($99/yr) for macOS notarization |
| Phase 2 (Networked) | 8-12 | Planning Center dev account, CCLI SongSelect API access, API.Bible key |
| Phase 3 (Streaming) | 8-10 | `ndi-lib` (Windows SDK), `node-rtmp` or `fluent-ffmpeg`, DeckLink SDK (optional) |
| Phase 4 (Ecosystem) | 4-6 | CCLI reporting API, WorshipTools Charts API |
| Phase 5 (Architecture) | 6-8 | Refactoring time; no external deps |

**Total:** ~30-40 engineering weeks for full parity with FreeShow + Worship Studio's unique strengths.

**Team Suggestion:** 1 full-time lead + 1 part-time contributor can deliver Phase 1-2 in 4-6 months.

---

## 8. Immediate Next Steps (This Week)

1. **Add MIT License** — `echo "MIT License..." > LICENSE` + update `package.json`
2. **Open GitHub Discussion** — "Roadmap 2025: NDI, Cloud Sync, Planning Center" — gather community input
3. **Set up macOS CI** — Add `macos-latest` job to GitHub Actions; fix any build issues
4. **Prototype NDI** — Spike: `npm i @ndi/sdk` or `node-ndi`; render a slide to NDI in 100 lines
5. **Document Architecture** — `ARCHITECTURE.md` with data flow, IPC contracts, extension points

---

## 9. Appendix: Feature Comparison Matrix (Detailed)

### Core Presentation

| Feature | Worship Studio | FreeShow | ProPresenter | EasyWorship | WorshipTools |
|---------|----------------|----------|--------------|-------------|--------------|
| Preview/Live Separation | ✅ Excellent | ✅ Good | ✅ Excellent | ✅ Good | ✅ Good |
| Multi-Output (5+) | ✅ 5 roles | ✅ Unlimited | ✅ Unlimited | ⚠️ 3 max | ✅ Unlimited |
| Stage Layouts | ✅ Custom grid | ✅ Flexible | ✅ Advanced | ⚠️ Fixed | ✅ Flexible |
| Transitions | ✅ Per-slide | ✅ Per-slide | ✅ Advanced | ✅ Basic | ✅ Per-slide |
| Live Text Edit | ❌ | ✅ | ✅ | ❌ | ❌ |
| Freeze/Blackout | ✅ Granular | ✅ | ✅ | ✅ | ✅ |
| Output Lock | ✅ | ❌ | ✅ | ❌ | ❌ |

### Content Management

| Feature | Worship Studio | FreeShow | ProPresenter | EasyWorship | WorshipTools |
|---------|----------------|----------|--------------|-------------|--------------|
| Song Library | ✅ Rich | ✅ Good | ✅ Excellent | ✅ Good | ✅ Excellent |
| Arrangements/Sections | ✅ | ✅ | ✅ | ✅ | ✅ |
| Chord Charts (Stage) | ✅ Markers only | ✅ Full | ✅ Full | ⚠️ Basic | ✅ Integrated |
| CCLI SongSelect | ❌ | ⚠️ Planning Center | ✅ Native | ✅ Native | ✅ Native |
| Planning Center Sync | ❌ | ✅ | ✅ | ❌ | ✅ Native |
| Bible Translations | Local import | 200+ API.Bible | 100+ built-in | 90+ built-in | Built-in |
| Bible Layouts | 4 modes | 3 modes | Advanced | Basic | Good |
| Media Library | ✅ Images/Video/PPTX | ✅ | ✅ Excellent | ✅ Good | ✅ Good |
| PPTX Import | LibreOffice + fallback | Basic | Excellent | Good | Good |

### Network & Streaming

| Feature | Worship Studio | FreeShow | ProPresenter | EasyWorship | WorshipTools |
|---------|----------------|----------|--------------|-------------|--------------|
| NDI Output | ❌ | ✅ Native | ✅ Native | ❌ | ✅ Native |
| RTMP Streaming | ❌ | ✅ | ✅ | ❌ | ✅ |
| Blackmagic SDI | ❌ | ✅ Key/Fill | ✅ | ❌ | ❌ |
| MIDI/OSC | ❌ | ✅ Bidirectional | ✅ | ❌ | ❌ |
| Cloud Sync | ❌ | ✅ Supabase | ✅ Proprietary | ❌ | ✅ Native |
| Web Remote | ⚠️ Local HTTP | ✅ Full web app | ✅ iOS/Android | ✅ iOS/Android | ✅ iOS/Android |
| Web Confidence | ❌ | ✅ | ❌ | ❌ | ❌ |

### Platform & Operations

| Feature | Worship Studio | FreeShow | ProPresenter | EasyWorship | WorshipTools |
|---------|----------------|----------|--------------|-------------|--------------|
| Windows | ✅ Native | ✅ | ✅ | ✅ Native | ✅ |
| macOS | ❌ (untested) | ✅ Native | ✅ Native | ❌ | ✅ Native |
| Linux | ❌ | ✅ AppImage/Flatpak | ❌ | ❌ | ❌ |
| Auto-Updates | ⚠️ Manual feed | ✅ GitHub | ✅ Native | ✅ Native | ✅ Native |
| Code Signed | ❌ | ✅ | ✅ | ✅ | ✅ |
| License | UNLICENSED | GPL-3.0 | Proprietary | Proprietary | Freemium |
| Offline-First | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## 10. Conclusion

Worship Studio has **exceptional bones** — the presentation engine, theme system, Bible handling, and volunteer-safe workflow are **best-in-class for offline use**. But the **market has moved**: churches now expect NDI, cloud sync, Planning Center, and streaming as *baseline*.

**The window is open:** FreeShow proves a free tool can have pro features. Worship Studio can **leapfrog** by combining:
- FreeShow's networked features (NDI, RTMP, PCO, API.Bible, cloud sync)
- Worship Studio's superior offline UX (preview/live safety, output locking, theme system)
- Windows-native polish (text rendering, system integration, installer)

**Start with Phase 1 (license, signing, auto-update, macOS/Linux builds)** — these are low-effort, high-trust signals. Then **NDI + Cloud Sync + Planning Center** — the three features that will make churches *switch*.

---

*Generated by automated analysis of the Worship Studio 2.0.0 codebase and 2024-2026 competitive research. For questions or corrections, open a GitHub Discussion.*