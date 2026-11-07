import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {combineBiblePages} from '../backend/bible-handlers';
import type {BiblePage} from '../backend/bible';

test('selected Bible pages are combined in passage order with their columns',()=>{
 const page=(reference:string,text:string):BiblePage=>({title:reference,reference,mode:'single',showVerseNumbers:true,rows:[],columns:[{translationId:'one',label:'Test',text,copyright:''}]});
 const pages=[page('John 3:16','16 First'),page('John 3:17','17 Second'),page('John 3:18','18 Third')];
 const result=combineBiblePages(pages,[2,0]);
 assert.equal(result.columns[0].text,'16 First\n18 Third');
 assert.equal(result.reference,'John 3:16 · John 3:18');
 assert.throws(()=>combineBiblePages(pages,[3]),/selected verses changed/i);
});
