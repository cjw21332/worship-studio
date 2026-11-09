import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {
  initialPresentation,
  preview,
  takeLive,
  blackout,
  toggleOutput,
  toggleFreeze,
  visiblePresentation,
  updatePresentation,
  canAutoAdvance,
  serviceSlidePosition,
  type Presentation,
  type Slide
} from '../backend/presentation';

test('timed advance cannot undo blackout or other operator changes', () => {
  let state = updatePresentation(initialPresentation(), { live: makeSlide('Timed slide'), blackout: false });
  const scheduledRevision = state.revision;
  assert.equal(canAutoAdvance(state, 'item-1', 0), true);
  assert.equal(canAutoAdvance(blackout(state), 'item-1', 0), false);
  assert.equal(canAutoAdvance(toggleFreeze(state), 'item-1', 0), false);
  assert.equal(canAutoAdvance(preview(state, makeSlide('New preview')), 'item-1', 0), true);
  assert.equal(canAutoAdvance(preview(state, makeSlide('New preview')), 'item-1', 0, scheduledRevision), false);
  state = toggleOutput(state, 'logo');
  assert.equal(canAutoAdvance(state, 'item-1', 0), false);
});

function makeSlide(text: string, itemId: string = 'item-1'): Slide {
  return { title: 'Test', text, itemId, index: 0 };
}

test('preview never replaces live without explicit takeLive', () => {
  let state = initialPresentation();
  const liveSlide = makeSlide('Live content');
  const previewSlide = makeSlide('Preview content');

  state = updatePresentation(state, { live: liveSlide });
  assert.equal(state.live?.text, 'Live content');

  state = preview(state, previewSlide);
  assert.equal(state.live?.text, 'Live content', 'Live should not change when preview updates');
  assert.equal(state.preview?.text, 'Preview content');
});

test('takeLive moves preview to live and clears blackout', () => {
  let state = initialPresentation();
  const previewSlide = makeSlide('Ready to go live');

  state = preview(state, previewSlide);
  state = takeLive(state);

  assert.equal(state.live?.text, 'Ready to go live');
  assert.equal(state.blackout, false, 'Blackout should be cleared on go live');
  assert.equal(state.clear, false);
  assert.equal(state.logo, false);
});

test('takeLive throws when no preview exists', () => {
  let state = initialPresentation();
  assert.throws(() => takeLive(state), /Choose a slide to preview first/);
});

test('blackout hides live content but preserves state', () => {
  let state = initialPresentation();
  const liveSlide = makeSlide('Live content');
  state = updatePresentation(state, { live: liveSlide, blackout: false });
  state = blackout(state);

  assert.equal(state.blackout, true);
  assert.equal(state.live?.text, 'Live content', 'Live content preserved during blackout');
});

test('toggleOutput blackout/clear/logo are mutually exclusive', () => {
  // Start with blackout=false to test toggling ON
  let state = updatePresentation(initialPresentation(), { blackout: false, live: makeSlide('Live') });

  state = toggleOutput(state, 'blackout');
  assert.equal(state.blackout, true);
  assert.equal(state.clear, false);
  assert.equal(state.logo, false);

  state = toggleOutput(state, 'clear');
  assert.equal(state.blackout, false);
  assert.equal(state.clear, true);
  assert.equal(state.logo, false);

  state = toggleOutput(state, 'logo');
  assert.equal(state.blackout, false);
  assert.equal(state.clear, false);
  assert.equal(state.logo, true);

  state = toggleOutput(state, 'logo');
  assert.equal(state.logo, false);
});

test('freeze captures current state and ignores subsequent changes', () => {
  let state = initialPresentation();
  const liveSlide = makeSlide('Slide 1');
  const nextSlide = makeSlide('Slide 2');
  state = updatePresentation(state, { live: liveSlide, next: nextSlide });

  state = toggleFreeze(state);
  assert.equal(state.freeze, true);
  assert.equal(state.frozenLive?.text, 'Slide 1');
  assert.equal(state.frozenNext?.text, 'Slide 2');

  const newPreview = makeSlide('Preview during freeze');
  state = preview(state, newPreview);
  state = takeLive(state);

  const visible = visiblePresentation(state);
  assert.equal(visible.live?.text, 'Slide 1', 'Frozen live should not change');
  assert.equal(visible.next?.text, 'Slide 2', 'Frozen next should not change');
});

test('unfreeze restores live preview and next', () => {
  let state = initialPresentation();
  const liveSlide = makeSlide('Slide 1');
  const nextSlide = makeSlide('Slide 2');
  state = updatePresentation(state, { live: liveSlide, next: nextSlide });

  state = toggleFreeze(state);
  const newPreview = makeSlide('Preview during freeze');
  state = preview(state, newPreview);
  state = takeLive(state);

  state = toggleFreeze(state);
  assert.equal(state.freeze, false);
  assert.equal(state.live?.text, 'Preview during freeze', 'Live should update to what was previewed during freeze');
  assert.equal(state.next?.text, 'Slide 2');
});

test('visiblePresentation during freeze shows frozen state even if blackout triggered', () => {
  let state = initialPresentation();
  const liveSlide = makeSlide('Slide 1');
  state = updatePresentation(state, { live: liveSlide });

  state = toggleFreeze(state);
  state = blackout(state);

  const visible = visiblePresentation(state);
  assert.equal(visible.blackout, true, 'Emergency blackout should win during freeze');
  assert.equal(visible.live?.text, 'Slide 1');
});

test('updatePresentation increments revision and updates timestamp', () => {
  let state = initialPresentation();
  const rev1 = state.revision;
  const time1 = state.updatedAt;

  state = updatePresentation(state, { blackout: true });

  assert.equal(state.revision, rev1 + 1);
  assert.ok(state.updatedAt >= time1);
});

test('stage state is preserved through freeze cycle', () => {
  let state = initialPresentation();
  const customStage = { message: 'Test message', showChords: false, layout: [] };
  state = updatePresentation(state, { stage: customStage });

  state = toggleFreeze(state);
  state = toggleFreeze(state);

  assert.deepEqual(state.stage, customStage);
});

test('service navigation crosses items and stops cleanly at either boundary', () => {
  const items = [
    {id: 'first', slides: ['one', 'two']},
    {id: 'empty', slides: []},
    {id: 'last', slides: ['three']},
  ];

  assert.deepEqual(serviceSlidePosition(items, 'first', 0, 1), {item: items[0], index: 1});
  assert.deepEqual(serviceSlidePosition(items, 'first', 1, 1), {item: items[2], index: 0});
  assert.deepEqual(serviceSlidePosition(items, 'last', 0, -1), {item: items[0], index: 1});
  assert.equal(serviceSlidePosition(items, 'first', 0, -1), null);
  assert.equal(serviceSlidePosition(items, 'last', 0, 1), null);
});

test('service navigation starts at the first slide and handles empty services', () => {
  const items = [{id: 'first', slides: ['one']}];

  assert.deepEqual(serviceSlidePosition(items, undefined, undefined, 1), {item: items[0], index: 0});
  assert.equal(serviceSlidePosition(items, undefined, undefined, -1), null);
  assert.deepEqual(serviceSlidePosition(items, 'removed', 4, 1), {item: items[0], index: 0});
  assert.equal(serviceSlidePosition([], undefined, undefined, 1), null);
});
