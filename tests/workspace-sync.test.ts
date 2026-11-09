import assert from 'node:assert/strict';
import {mkdtempSync, readFileSync, readdirSync, rmSync} from 'node:fs';
import test from 'node:test';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {openStore} from '../backend/database';
import {createSongFiles, mirrorSongs, songLocks} from '../backend/workspace';

function setup(localUpdatedAt: string, remoteUpdatedAt: string) {
  const root = mkdtempSync(join(tmpdir(), 'workspace-sync-'));
  const store = openStore(join(root, 'workspace.db'));
  const id = store.saveSong({title: 'Local title', lyrics: 'Local words'});
  const local = {...store.listSongs()[0], id, updatedAt: localUpdatedAt};
  store.syncSong(id, local);
  const remote = {...local, title: 'Synced title', updatedAt: remoteUpdatedAt};
  mirrorSongs(root, [remote]);
  const locks = songLocks(root);
  const files = createSongFiles(root, store, locks);
  return {root, store, id, locks, files};
}

function cleanup(root: string, store: ReturnType<typeof openStore>, locks: ReturnType<typeof songLocks>, files: ReturnType<typeof createSongFiles>) {
  files.close();
  locks.close();
  store.close();
  rmSync(root, {recursive: true, force: true});
}

test('first sync selects the newer synced copy and keeps both versions recoverable', () => {
  const context = setup('2026-01-01T10:00:00.000Z', '2026-01-02T10:00:00.000Z');
  try {
    const report = context.files.sync();
    assert.equal(report.conflicts.length, 0);
    assert.equal(report.reconciled.length, 1);
    assert.equal(report.imported, 1);
    assert.equal(context.store.listSongs()[0].title, 'Synced title');
    assert.equal(
      readdirSync(join(context.root, 'songs', 'conflicts')).length,
      2,
    );
  } finally {
    cleanup(context.root, context.store, context.locks, context.files);
  }
});

test('first sync keeps the newer local copy and refreshes the synced file', () => {
  const context = setup('2026-01-02T10:00:00.000Z', '2026-01-01T10:00:00.000Z');
  try {
    const report = context.files.sync();
    assert.equal(report.conflicts.length, 0);
    assert.equal(report.reconciled.length, 1);
    assert.equal(report.written, 1);
    assert.equal(context.store.listSongs()[0].title, 'Local title');
    assert.equal(
      JSON.parse(readFileSync(join(context.root, 'songs', `${context.id}.json`), 'utf8')).title,
      'Local title',
    );
    assert.equal(readdirSync(join(context.root, 'songs', 'conflicts')).length, 2);
  } finally {
    cleanup(context.root, context.store, context.locks, context.files);
  }
});

test('first sync reports divergent copies with matching timestamps without replacing either', () => {
  const timestamp = '2026-01-01T10:00:00.000Z';
  const context = setup(timestamp, timestamp);
  try {
    const report = context.files.sync();
    assert.equal(report.conflicts.length, 1);
    assert.equal(report.reconciled.length, 0);
    assert.equal(context.store.listSongs()[0].title, 'Local title');
    assert.equal(
      JSON.parse(readFileSync(join(context.root, 'songs', `${context.id}.json`), 'utf8')).title,
      'Synced title',
    );
    assert.equal(readdirSync(join(context.root, 'songs', 'conflicts')).length, 2);
  } finally {
    cleanup(context.root, context.store, context.locks, context.files);
  }
});
