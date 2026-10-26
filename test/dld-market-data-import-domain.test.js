import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DLD_REQUIRED_COLUMNS,
  CORE_MARKET_UPLOAD_COLUMNS,
  DLD_LOCAL_MAX_FILE_BYTES,
  DLD_LOCAL_MAX_ROWS,
  DLD_LOCAL_REVIEW_ROW_LIMIT,
  inspectDldTransactionsHeader,
  normalizeDldTransactionsSource,
  mapDldTransactionToCore,
  buildDldMarketImportPreview,
  buildDldMarketKpis,
  renderCoreMarketUploadCsv,
  parseCsvText
} from '../src/dld-market-data-import-domain.js';

const hash = 'a'.repeat(64), rowHash = 'b'.repeat(64);
const row = { transaction_id:'DLD-SYN-1', instance_date:'01-08-2026', trans_group_en:'Sales', procedure_name_en:'Sell', property_type_en:'Unit', property_sub_type_en:'Flat', property_usage_en:'Residential', reg_type_en:'Existing Properties', area_id:'SYN-1', area_name_en:'Synthetic Community', procedure_area:'92.9', actual_worth:'1950000', project_number:'SYN-P', project_name_en:'Synthetic Project', rooms_en:'2 B/R', has_parking:'1' };

test('local monthly-file bounds are explicit and keep on-screen review bounded', () => {
  assert.equal(DLD_LOCAL_MAX_FILE_BYTES, 50 * 1024 * 1024);
  assert.equal(DLD_LOCAL_MAX_ROWS, 100000);
  assert.equal(DLD_LOCAL_REVIEW_ROW_LIMIT, 100);
  const csv = `id\n${Array.from({ length:1500 }, (_, index) => index + 1).join('\n')}\n`;
  assert.equal(parseCsvText(csv, { maxRows:DLD_LOCAL_MAX_ROWS }).rows.length, 1500);
});

test('official DLD Transactions.csv subset requires the documented market columns', () => {
  assert.equal(inspectDldTransactionsHeader(DLD_REQUIRED_COLUMNS).compatible, true);
  const result = inspectDldTransactionsHeader(DLD_REQUIRED_COLUMNS.filter(column => column !== 'transaction_id'));
  assert.equal(result.compatible, false);
  assert.deepEqual(result.missingRequired, ['transaction_id']);
});

test('DLD sales transaction maps to a staged CORE observation without party identity', () => {
  const result = mapDldTransactionToCore(row, { sourceFileSha256:hash, sourceRowSha256:rowHash });
  assert.equal(result.accepted, true);
  assert.equal(result.record.source_record_ref, 'DLD-SYN-1');
  assert.equal(result.record.transaction_date, '2026-08-01');
  assert.equal(result.record.transaction_area_sqft, 999.97);
  assert.equal(result.record.verification_status, 'staged_admin_review');
  for (const forbidden of ['buyer','seller','owner','phone','email','passport','emirates']) assert.equal(Object.keys(result.record).some(key => key.includes(forbidden)), false);
});

test('non-sale, invalid measurements and missing hashes fail closed', () => {
  const result = mapDldTransactionToCore({ ...row, trans_group_en:'Mortgage', actual_worth:'0' }, { sourceFileSha256:'bad', sourceRowSha256:'bad' });
  assert.equal(result.accepted, false);
  for (const reason of ['not_sales_transaction','invalid_actual_worth','invalid_source_file_sha256','invalid_source_row_sha256']) assert.ok(result.errors.includes(reason));
});

test('preview rejects duplicate transaction IDs and never executes an import', () => {
  const preview = buildDldMarketImportPreview({ rows:[row,{...row}], sourceFileSha256:hash, rowHashes:[rowHash,'c'.repeat(64)] });
  assert.equal(preview.acceptedRows, 1);
  assert.equal(preview.rejectedRows, 1);
  assert.deepEqual(preview.rejected[0].reasons, ['duplicate_transaction_id_in_file']);
  assert.equal(preview.importExecuted, false);
  assert.equal(preview.adminApprovalRequired, true);
});

test('CORE upload CSV uses a stable governed header and safe quoting', () => {
  const mapped = mapDldTransactionToCore({ ...row, area_name_en:'Synthetic, Community' }, { sourceFileSha256:hash, sourceRowSha256:rowHash }).record;
  const csv = renderCoreMarketUploadCsv([mapped]);
  assert.equal(csv.split('\r\n')[0], CORE_MARKET_UPLOAD_COLUMNS.join(','));
  assert.match(csv, /"Synthetic, Community"/);
  assert.equal(csv.endsWith('\r\n'), true);
});

test('small CSV POC parser supports quoted commas and rejects oversized or malformed files', () => {
  const parsed = parseCsvText('\uFEFFtransaction_id,area_name_en\r\nDLD-1,"Synthetic, Community"\r\n');
  assert.deepEqual(parsed.headers, ['transaction_id','area_name_en']);
  assert.equal(parsed.rows[0].area_name_en, 'Synthetic, Community');
  assert.throws(() => parseCsvText('a\n1\n2\n', { maxRows:1 }), /at most 1/);
  assert.throws(() => parseCsvText('a,b\n"broken,2'), /unterminated/);
});

test('official DLD website CSV headers normalize to the same governed transaction contract', () => {
  const text = 'TRANSACTION_NUMBER,INSTANCE_DATE,GROUP_EN,PROCEDURE_EN,IS_OFFPLAN_EN,IS_FREE_HOLD_EN,USAGE_EN,AREA_EN,PROP_TYPE_EN,PROP_SB_TYPE_EN,TRANS_VALUE,PROCEDURE_AREA,ACTUAL_AREA,ROOMS_EN,PARKING,NEAREST_METRO_EN,NEAREST_MALL_EN,NEAREST_LANDMARK_EN,TOTAL_BUYER,TOTAL_SELLER,MASTER_PROJECT_EN,PROJECT_EN\n"102-SYN-1","2026-08-08 15:22:44","Sales","Sell - Pre registration","Off-Plan","Free Hold","Residential","Synthetic Area","Unit","Flat","1087750","44.02","44.02","Studio","1","Metro","Mall","Landmark","0","0","","Synthetic Project"\n';
  const normalized = normalizeDldTransactionsSource(parseCsvText(text));
  assert.equal(normalized.sourceFormat, 'dubailand_website_csv');
  assert.equal(normalized.rows[0].transaction_id, '102-SYN-1');
  const mapped = mapDldTransactionToCore(normalized.rows[0], { sourceFileSha256:hash, sourceRowSha256:rowHash });
  assert.equal(mapped.accepted, true);
  assert.equal(mapped.record.transaction_date, '2026-08-08');
  assert.equal(mapped.record.area_name, 'Synthetic Area');
  assert.equal(mapped.record.project_name, 'Synthetic Project');
});

test('accepted sales produce descriptive file KPIs and governed breakdowns', () => {
  const records = [
    mapDldTransactionToCore(row, { sourceFileSha256:hash, sourceRowSha256:rowHash }).record,
    mapDldTransactionToCore({ ...row, transaction_id:'DLD-SYN-2', actual_worth:'2050000', area_name_en:'Second Community', reg_type_en:'Off-Plan' }, { sourceFileSha256:hash, sourceRowSha256:'c'.repeat(64) }).record
  ];
  const kpis = buildDldMarketKpis(records);
  assert.equal(kpis.available, true);
  assert.equal(kpis.acceptedSales, 2);
  assert.equal(kpis.totalTransactionValueAed, 4000000);
  assert.equal(kpis.medianTransactionValueAed, 2000000);
  assert.equal(kpis.weightedAveragePricePerSqftAed, 2000.06);
  assert.equal(kpis.communityCount, 2);
  assert.equal(kpis.offPlanSharePercent, 50);
  assert.equal(kpis.communities.length, 2);
  assert.equal(kpis.communities[0].weightedAveragePricePerSqftAed > 0, true);
  assert.deepEqual(kpis.transactionValueRangeAed, { p25:1975000, median:2000000, p75:2025000 });
  assert.equal(kpis.registrationMix.length, 2);
  assert.equal(kpis.monthlyActivity[0].coverage, 'partial');
  assert.equal(kpis.communitiesByValue.length, 2);
  assert.equal(kpis.bedroomMix[0].label, '2 B/R');
});
