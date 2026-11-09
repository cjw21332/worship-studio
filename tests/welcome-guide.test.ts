import assert from 'node:assert/strict';
import test from 'node:test';
import {filterTutorialLessons} from '../frontend/tutorial-guide-model';

const lessons = [
  {
    title: 'Start here',
    intro: 'Prepare and preview a service.',
    steps: ['Arm a rehearsal display.'],
    check: 'Run the pre-flight check.',
  },
  {
    title: 'Songs',
    intro: 'Create or import songs.',
    steps: ['Add a song to the service.'],
  },
];

test('welcome guide search matches titles, instructions, checks, and ignores case', () => {
  assert.deepEqual(
    filterTutorialLessons(lessons, 'PRe-FLIGHT').map(({index}) => index),
    [0],
  );
  assert.deepEqual(
    filterTutorialLessons(lessons, 'import').map(({index}) => index),
    [1],
  );
});

test('welcome guide search preserves original topic indexes and handles no matches', () => {
  assert.deepEqual(
    filterTutorialLessons(lessons, 'songs').map(({index, lesson}) => ({
      index,
      title: lesson.title,
    })),
    [{index: 1, title: 'Songs'}],
  );
  assert.deepEqual(filterTutorialLessons(lessons, 'not a topic'), []);
  assert.equal(filterTutorialLessons(lessons, '   ').length, lessons.length);
});
