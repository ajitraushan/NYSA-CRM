import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=file=>fs.readFileSync(file,'utf8');

test('UAT-062 migration creates an immutable versioned canonical catalogue and legacy exception queue',()=>{
  const sql=read('src/migrations/103_dev159_uat062_single_source_classification.sql');
  for(const table of ['classification_catalogue_versions','classification_dimensions','classification_values','classification_mappings','classification_legacy_exceptions'])assert.match(sql,new RegExp(`CREATE TABLE ${table}`));
  assert.match(sql,/uat062-v1/);
  assert.match(sql,/ready_secondary/);
  assert.match(sql,/'land','Land'/);
  assert.match(sql,/'plot','Plot'/);
  assert.match(sql,/ambiguous_legacy_classification/);
  assert.match(sql,/classification_catalogue_one_active_uq/);
});

test('Lead and Requirement writes validate the expected catalogue version and persist mapping evidence',()=>{
  const crm=read('src/routes/crm.js'),requirements=read('src/routes/lead-operations.js');
  for(const source of [crm,requirements]){
    assert.match(source,/loadActiveClassificationCatalogue/);
    assert.match(source,/validateClassificationSelection/);
    assert.match(source,/classification_catalogue_version_id/);
    assert.match(source,/classification_mapping_evidence/);
  }
  assert.doesNotMatch(crm,/const CUSTOMER_OBJECTIVES=/);
  assert.doesNotMatch(crm,/const MARKET_STAGE_REQUIREMENTS=/);
  assert.doesNotMatch(crm,/const PROPERTY_SEGMENT_REQUIREMENTS=/);
});

test('Lead capture controls are populated from the active catalogue rather than embedded lists',()=>{
  const ui=read('public/app.js');
  assert.match(ui,/api\('\/crm\/classification-catalogue\/active'\)/);
  assert.match(ui,/classificationOptions\('customer_objective'\)/);
  assert.match(ui,/classificationOptions\('market_stage'\)/);
  assert.match(ui,/classificationOptions\('property_segment'\)/);
  assert.doesNotMatch(ui,/<select name="customerObjective"><option value="buy">/);
});

test('Catalogue route is mounted and exposes active read plus governed exception queue',()=>{
  const route=read('src/routes/classification-catalogue.js'),server=read('src/server.js');
  assert.match(route,/\/crm\/classification-catalogue\/active/);
  assert.match(route,/\/crm\/classification-exceptions/);
  assert.match(server,/classificationCatalogueRoutes/);
});
