import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {parseSections, isSectionHeader, buildSlides} from '../backend/songs';

test('all section markers recognized', () => {
  const markers = ['verse', 'pre chorus', 'pre', 'chorus', 'bridge', 'tag', 'intro', 'outro', 'end'];
  for (const m of markers) {
    assert.ok(isSectionHeader(m), `${m} should be recognized`);
    assert.ok(isSectionHeader(m.toUpperCase()), `${m.toUpperCase()} should be recognized`);
    assert.ok(isSectionHeader('[' + m + ']'), `[${m}] should be recognized`);
    assert.ok(isSectionHeader(m.charAt(0)), `single letter ${m.charAt(0)} should be recognized`);
  }
});

test('parseSections includes all sections with lyrics', () => {
  const lyrics = `Verse 1
First verse line

Pre Chorus
Pre chorus line

Chorus
Chorus line

Bridge
Bridge line

Tag
Tag line

Intro
Intro line

Outro
Outro line

End
Final ending line`;

  const sections = parseSections(lyrics);
  console.log('Sections:', sections.map(s => s.type + ' (' + s.lines.length + ' lines)'));

  const types = sections.map(s => s.type);
  assert.ok(types.includes('verse'), 'verse should be present');
  assert.ok(types.includes('prechorus'), 'prechorus should be present');
  assert.ok(types.includes('chorus'), 'chorus should be present');
  assert.ok(types.includes('bridge'), 'bridge should be present');
  assert.ok(types.includes('tag'), 'tag should be present');
  assert.ok(types.includes('intro'), 'intro should be present');
  assert.ok(types.includes('outro'), 'outro should be present');
  assert.ok(types.includes('end'), 'end should be present');
});

test('buildSlides includes end section in slides', () => {
  const song = {
    sections: [
      { id: 's1', type: 'verse', label: 'Verse 1', lines: ['Verse line 1', 'Verse line 2'] },
      { id: 's2', type: 'chorus', label: 'Chorus', lines: ['Chorus line 1'] },
      { id: 's3', type: 'end', label: 'End', lines: ['Ending line'] }
    ],
    arrangement: ['s1', 's2', 's3']
  };

  const slides = buildSlides(song, 4);
  assert.ok(slides.length >= 3);
  const endSlide = slides.find(s => s.sectionId === 's3');
  assert.ok(endSlide, 'end section should produce a slide');
  assert.ok(endSlide.text.includes('Ending line'), 'end slide should contain lyrics');
});