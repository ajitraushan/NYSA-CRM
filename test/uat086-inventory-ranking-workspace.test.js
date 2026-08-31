import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=file=>readFileSync(new URL(`../${file}`,import.meta.url),'utf8');

test('UAT-086 opens ranked Inventory in a dedicated returnable workspace',()=>{
  const app=read('public/app.js');
  assert.match(app,/Open ranked Inventory workspace/);
  assert.match(app,/inventory-ranking-page/);
  assert.match(app,/data-ranking-return/);
  assert.match(app,/Return to Opportunity/);
  assert.match(app,/opportunityChanged&&o\.isConnected/);
  assert.match(app,/openOpportunityDetail\(id\)/);
  assert.doesNotMatch(app,/data-opportunity-ranking-result><\/div>/);
});

test('UAT-086 paginates ranked Inventory ten properties at a time',()=>{
  const ui=read('public/matching-completion-ui.js'),html=read('public/index.html');
  assert.match(ui,/pageSize=10/);
  assert.match(ui,/rankable\.slice\(first,last\)/);
  assert.match(ui,/Showing \$\{first\+1\}–\$\{last\} of \$\{rankable\.length\} ranked properties/);
  assert.match(ui,/Previous 10/);
  assert.match(ui,/Next 10/);
  assert.match(ui,/data-matching-page/);
  assert.match(html,/\.matching-pagination/);
});

test('UAT-086 keeps the workspace open after assignment and refreshes on return',()=>{
  const app=read('public/app.js'),ui=read('public/matching-completion-ui.js');
  assert.match(app,/onAssignmentChanged:\(\)=>\{opportunityChanged=true/);
  assert.match(app,/continue reviewing this ranked run or return to the Opportunity/);
  assert.match(ui,/onAssignmentChanged\?\.\(response\)/);
  assert.match(ui,/currentPage=Math\.min\(currentPage,totalPages\)/);
});
