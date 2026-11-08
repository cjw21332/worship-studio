# Integration discovery

Reviewed 2026-11-08. These are proposals, not promises of compatibility or delivery dates. Core presentation must remain available offline.

## Local confidence monitor

The existing local HTTP remote (`backend/remote.ts`) already supplies live text after PIN pairing, but its bearer token also authorizes presentation commands. It is therefore not suitable as a read-only stage-display credential. Its public state does not supply the stage layout, next slide, notes, or clocks. A proper confidence monitor needs a separate, revocable read-only session and an explicitly limited state projection, clear stale/disconnected indications, readable scaling, and network and accessibility tests. HTTP exposes content and credentials to the local network; restrict use to a trusted network and assess TLS before expanding deployment. Pilot on a phone and tablet with real operators before promising it as a replacement for the stage window.

## NDI

Value: send presentation output to a network video production system. Dependencies: a supported native SDK, frame capture, runtime distribution rights, performance and recovery on real receiver hardware. The [NDI SDK licensing documentation](https://docs.ndi.video/all/developing-with-ndi/sdk/licensing) and [distribution terms](https://docs.ndi.video/all/developing-with-ndi/sdk/software-distribution) impose conditions; review the current SDK agreement for the intended use. Spike: capture a test output and send it to one receiver, measuring frame rate, latency, CPU, disconnect recovery, and shutdown. Do not ship the SDK before confirming terms and packaging.

## Cloud sync

Value: prepare on one machine and present on another. Risks include conflicting edits, deleted data, media transfer size, credentials, privacy, service availability and recurring cost. Spike: define identities and a versioned local-first data model, then simulate offline concurrent edits, deletions, retry and restoration with two test workspaces. A hosted service and account are separate owner decisions; no provider is assumed.

## Planning Center

Value: bring an existing service plan into local preparation. The [developer documentation](https://developer.planning.center/docs/) describes developer applications and OAuth. Verify scopes, rate limits, content permissions, account requirements, and secure token storage. Spike: with a test organization, authenticate and import a single plan into a preview without modifying the local library; test revoked access and offline reopening.

## SongSelect

Value: reduce manual lyric entry while retaining copyright metadata. [CCLI describes third-party integrations](https://songselect.ccli.com/about/apipartners), but this does not establish access for this project or permission to retain content offline. Seek partner terms and verify user entitlements and reporting requirements. Spike only after access is granted: import one authorized song into a review screen with complete attribution and explicit error handling.

## Bible APIs

Value: help users find authorized translations. [API.Bible's FAQ](https://scripture.api.bible/faq) requires registration and describes copyright, display and commercial-use restrictions. Available translations, caching and offline rights must be confirmed per version and current agreement; do not assume a particular catalog size. Spike: authenticate, list permitted versions, retrieve a passage with attribution, and verify the required behavior offline and when access is revoked.
