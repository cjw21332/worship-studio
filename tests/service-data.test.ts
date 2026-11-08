import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {mkdtempSync, rmSync, readFileSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openStore} from '../backend/database';
import {snapshotService, parseService, ServiceHistory, referencedAssets, preflight, usageCSV} from '../backend/service-plan';
import {packService, unpackService} from '../backend/service-package';

test('service history undo/redo works correctly', () => {
  const history = new ServiceHistory();
  const items = [
    { id: '1', position: 0, title: 'Song 1', slides: ['Slide 1'], kind: 'song' },
    { id: '2', position: 1, title: 'Song 2', slides: ['Slide 2'], kind: 'song' }
  ];

  const modified = [
    { id: '1', position: 0, title: 'Song 1', slides: ['Slide 1'], kind: 'song' },
    { id: '2', position: 1, title: 'Song 2 Modified', slides: ['Slide 2 Modified'], kind: 'song' },
    { id: '3', position: 2, title: 'Song 3', slides: ['Slide 3'], kind: 'song' }
  ];

  history.capture(items, modified);
  assert.equal(history.status().canUndo, true);
  assert.equal(history.status().canRedo, false);

  const undone = history.undo(modified);
  assert.deepEqual(undone, items);
  assert.equal(history.status().canUndo, false);
  assert.equal(history.status().canRedo, true);

  const redone = history.redo(undone);
  assert.deepEqual(redone, modified);
  assert.equal(history.status().canUndo, true);
  assert.equal(history.status().canRedo, false);
});

test('service history ignores identical captures', () => {
  const history = new ServiceHistory();
  const items = [{ id: '1', position: 0, title: 'Song 1', slides: ['Slide 1'], kind: 'song' }];

  history.capture(items, items);
  assert.equal(history.status().canUndo, false);
});

test('service file parsing handles legacy format', () => {
  const legacy = {
    format: 'worship-studio-service-v1',
    items: [
      { title: 'Song 1', slides: ['Slide 1'] },
      { title: 'Song 2', slides: ['Slide 2'] }
    ]
  };

  const parsed = parseService(legacy);
  assert.equal(parsed.format, 'worship-studio-service');
  assert.equal(parsed.version, 2);
  assert.equal(parsed.name, 'Imported service');
  assert.equal(parsed.items.length, 2);
  assert.ok(parsed.items[0].id);
  assert.equal(parsed.items[0].position, 0);
  assert.equal(parsed.items[1].position, 1);
});

test('service file parsing rejects newer version', () => {
  const newer = { format: 'worship-studio-service', version: 99, name: 'Test', items: [], settings: {} };
  assert.throws(() => parseService(newer), /newer Worship Studio version/);
});

test('snapshotService creates valid service file', () => {
  const items = [
    { id: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa', position: 0, title: 'Song 1', slides: ['Slide 1'], kind: 'song', sourceId: 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb' }
  ];
  const service = snapshotService(items, 'Test Service', { themeId: 'default' });
  
  assert.equal(service.name, 'Test Service');
  assert.equal(service.items.length, 1);
  assert.equal(service.settings.themeId, 'default');
  assert.ok(service.savedAt);
});

test('referencedAssets finds asset IDs in service items', () => {
  const items = [
    { 
      id: '11111111-1111-4111-8111-111111111111', position: 0, title: 'Song 1', slides: ['asset:aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa'], 
      kind: 'song', mediaPages: [], backgroundId: 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb'
    },
    { 
      id: '22222222-2222-4222-8222-222222222222', position: 1, title: 'Image', slides: ['studio-media://asset/cccccccc-cccc-4ccc-8ccc-cccccccccccc'], 
      kind: 'slide-set', mediaPages: [{ imageId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' }]
    }
  ];

  const refs = referencedAssets(items);
  assert.equal(refs.length, 4);
  assert.ok(refs.includes('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa'));
  assert.ok(refs.includes('bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb'));
  assert.ok(refs.includes('cccccccc-cccc-4ccc-8ccc-cccccccccccc'));
  assert.ok(refs.includes('dddddddd-dddd-4ddd-8ddd-dddddddddddd'));
});

test('preflight detects missing assets and unarmed output', () => {
  const missingAssetId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
  const items = [
    { id: '11111111-1111-4111-8111-111111111111', position: 0, title: 'Song 1', slides: ['Slide 1'], kind: 'song', mediaPages: [] },
    { id: '22222222-2222-4222-8222-222222222222', position: 1, title: 'Missing Media', slides: ['asset:' + missingAssetId], kind: 'image', mediaPages: [{ imageId: missingAssetId }] }
  ];

  const issues = preflight(items, {
    armed: false,
    displayFound: false,
    missingAssetIds: [missingAssetId],
    missingFonts: ['Custom Font']
  });

  // 1 for unarmed, 1 for display not found, 1 for missing font, 1 for missing asset
  assert.equal(issues.length, 4);
  assert.ok(issues.some(i => i.message.includes('Audience output is not armed')));
  assert.ok(issues.some(i => i.message.includes('display is not connected')));
  assert.ok(issues.some(i => i.message.includes('Missing font: Custom Font')));
  assert.ok(issues.some(i => i.message.includes('missing media ' + missingAssetId)));
});

test('preflight warns about placeholder items', () => {
  const items = [
    { id: '1', position: 0, title: 'Placeholder', slides: ['Content'], kind: 'note', placeholder: true }
  ];

  const issues = preflight(items, { armed: true, displayFound: true, missingAssetIds: [], missingFonts: [] });
  assert.ok(issues.some(i => i.kind === 'warning' && i.message.includes('placeholder has not been filled')));
});

test('usageCSV generates valid CSV with BOM', () => {
  const rows = [
    { title: 'Song 1', serviceName: 'Sunday', usedAt: '2024-01-01T10:00:00Z', songId: 'song-1', kind: 'song', reference: '', translations: '' },
    { title: 'John 3:16', serviceName: 'Sunday', usedAt: '2024-01-01T10:05:00Z', songId: null, kind: 'bible', reference: 'John 3:16', translations: 'Test' }
  ];

  const csv = usageCSV(rows);
  assert.ok(csv.startsWith('\uFEFF')); // BOM
  assert.ok(csv.includes('Date,Service,Title,Song ID,Content type,Reference,Translations'));
  assert.ok(csv.includes('Song 1'));
  assert.ok(csv.includes('John 3:16'));
  assert.ok(csv.includes('song-1'));
});