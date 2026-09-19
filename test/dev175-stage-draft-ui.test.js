import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const definitions=['draftFormKey','captureStageDraft','applyStageDraft'].map(name=>source.split('\n').find(line=>line.trimStart().startsWith(`const ${name}=`))).join('\n');
const {draftFormKey,captureStageDraft,applyStageDraft}=vm.runInNewContext(`${definitions};({draftFormKey,captureStageDraft,applyStageDraft})`,{Event:class Event{}});
const form=(id,value)=>({id:'',classList:['deal-checklist-form'],closest:()=>({dataset:{checklistItemId:id}}),elements:[{name:'evidenceReference',type:'text',value,dispatchEvent(){}}]});
const pane=forms=>({querySelectorAll:()=>forms});

test('DEF-116 repeated checklist forms retain stable distinct draft keys after earlier items complete',()=>{
  const first=form('first','Buyer evidence'),second=form('second','Terms evidence');
  const payload=captureStageDraft(pane([first,second]));
  assert.equal(payload.schemaVersion,2);
  assert.notEqual(draftFormKey(first,0),draftFormKey(second,1));
  const reloaded=form('second','');applyStageDraft(pane([reloaded]),payload);
  assert.equal(reloaded.elements[0].value,'Terms evidence');
});

test('DEF-116 old ambiguous repeated draft forms do not copy evidence to a different checklist item',()=>{
  const first=form('first',''),second=form('second','');
  applyStageDraft(pane([first,second]),{schemaVersion:1,forms:[{key:'deal-checklist-form',controls:[{name:'evidenceReference',value:'Ambiguous old value'}]}]});
  assert.equal(first.elements[0].value,'');assert.equal(second.elements[0].value,'');
});

test('DEF-116 unique legacy drafts remain readable and file bytes are not captured',()=>{
  const unique=form('one','');
  applyStageDraft(pane([unique]),{schemaVersion:1,forms:[{key:'deal-checklist-form',controls:[{name:'evidenceReference',value:'Legacy evidence'}]}]});
  assert.equal(unique.elements[0].value,'Legacy evidence');
  unique.elements.push({name:'document',type:'file',value:'not-a-draft-file'});
  assert.equal(captureStageDraft(pane([unique])).forms[0].controls.length,1);
});
