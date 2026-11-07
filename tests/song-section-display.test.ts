import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {parseSections,buildSlides,isSectionHeader} from '../backend/songs';

test('section headings are recognized and excluded from slides',()=>{
 const text='Verse 1\nFirst line\nSecond line\n\nPre- chorus\nPrepare\n\nPre\nAgain\n\nChorus\nSing\n\nBridge 2\nRise\n\nTag\nAmen';
 const sections=parseSections(text);
 assert.deepEqual(sections.map(s=>s.type),['verse','prechorus','prechorus','chorus','bridge','tag']);
 assert.equal(isSectionHeader('Pre- chorus'),true);
 assert.equal(isSectionHeader('Pre'),true);
 assert.equal(isSectionHeader('Sing the chorus'),false);
 const slides=buildSlides({sections,arrangement:sections.map(s=>s.id)},4);
 assert.deepEqual(slides.map(s=>s.text),['First line\nSecond line','Prepare','Again','Sing','Rise','Amen']);
});
