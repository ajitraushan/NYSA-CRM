export const DLD_MARKET_IMPORT_POLICY_VERSION = 'r4-dld-market-import-v1';
export const DLD_DATASET_REF = 'dubai-pulse:dld_transactions-open:Transactions.csv';
export const DLD_WEBSITE_DATASET_REF = 'dubailand.gov.ae:open-data:real-estate-data:transactions-csv';
export const DLD_LOCAL_MAX_FILE_BYTES = 50 * 1024 * 1024;
export const DLD_LOCAL_MAX_ROWS = 100000;
export const DLD_LOCAL_REVIEW_ROW_LIMIT = 100;

export const DLD_REQUIRED_COLUMNS = Object.freeze([
  'transaction_id',
  'instance_date',
  'trans_group_en',
  'procedure_name_en',
  'property_type_en',
  'property_sub_type_en',
  'property_usage_en',
  'reg_type_en',
  'area_id',
  'area_name_en',
  'procedure_area',
  'actual_worth'
]);

export const DLD_OPTIONAL_COLUMNS = Object.freeze([
  'project_number',
  'project_name_en',
  'master_project_en',
  'building_name_en',
  'rooms_en',
  'has_parking',
  'meter_sale_price'
]);

export const DLD_WEBSITE_REQUIRED_COLUMNS = Object.freeze([
  'TRANSACTION_NUMBER',
  'INSTANCE_DATE',
  'GROUP_EN',
  'PROCEDURE_EN',
  'IS_OFFPLAN_EN',
  'USAGE_EN',
  'AREA_EN',
  'PROP_TYPE_EN',
  'PROP_SB_TYPE_EN',
  'TRANS_VALUE',
  'PROCEDURE_AREA'
]);

export const CORE_MARKET_UPLOAD_COLUMNS = Object.freeze([
  'mapping_version',
  'source_dataset_ref',
  'source_file_sha256',
  'source_row_sha256',
  'source_record_ref',
  'transaction_date',
  'transaction_type',
  'transaction_subtype',
  'registration_type',
  'area_source_ref',
  'area_name',
  'project_source_ref',
  'project_name',
  'master_project_name',
  'building_name',
  'property_type',
  'property_sub_type',
  'property_usage',
  'bedrooms_label',
  'has_parking',
  'transaction_amount_aed',
  'transaction_area_sqm',
  'transaction_area_sqft',
  'price_per_sqft_aed',
  'usage_basis',
  'verification_status'
]);

const clean = value => String(value ?? '').trim();
const finitePositive = value => {
  const number = Number(String(value ?? '').replaceAll(',', '').trim());
  return Number.isFinite(number) && number > 0 ? number : null;
};
const sha256 = value => /^[a-f0-9]{64}$/i.test(clean(value));

function normalizeDate(value) {
  const text = clean(value);
  const dmy = /^(\d{2})-(\d{2})-(\d{4})$/.exec(text);
  if (dmy) {
    const iso = `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
    const parsed = new Date(`${iso}T00:00:00.000Z`);
    return Number.isFinite(parsed.valueOf()) && parsed.toISOString().startsWith(iso) ? iso : null;
  }
  const ymd = /^(\d{4})-(\d{2})-(\d{2})(?:[ T].*)?$/.exec(text);
  if (!ymd) return null;
  const date = `${ymd[1]}-${ymd[2]}-${ymd[3]}`;
  const parsed = new Date(`${date}T00:00:00.000Z`);
  return Number.isFinite(parsed.valueOf()) && parsed.toISOString().startsWith(date) ? date : null;
}

export function inspectDldTransactionsHeader(columns = []) {
  const found = new Set(columns.map(clean).filter(Boolean));
  const missingApiRequired = DLD_REQUIRED_COLUMNS.filter(column => !found.has(column));
  const missingWebsiteRequired = DLD_WEBSITE_REQUIRED_COLUMNS.filter(column => !found.has(column));
  const sourceFormat = missingApiRequired.length === 0 ? 'dubai_pulse_api_csv' : missingWebsiteRequired.length === 0 ? 'dubailand_website_csv' : null;
  const recognized = new Set([...DLD_REQUIRED_COLUMNS, ...DLD_OPTIONAL_COLUMNS, ...DLD_WEBSITE_REQUIRED_COLUMNS, 'IS_FREE_HOLD_EN', 'ACTUAL_AREA', 'ROOMS_EN', 'PARKING', 'NEAREST_METRO_EN', 'NEAREST_MALL_EN', 'NEAREST_LANDMARK_EN', 'TOTAL_BUYER', 'TOTAL_SELLER', 'MASTER_PROJECT_EN', 'PROJECT_EN']);
  return {
    policyVersion: DLD_MARKET_IMPORT_POLICY_VERSION,
    compatible: sourceFormat !== null,
    sourceFormat,
    missingRequired: sourceFormat ? [] : missingApiRequired,
    missingApiRequired,
    missingWebsiteRequired,
    recognizedOptional: DLD_OPTIONAL_COLUMNS.filter(column => found.has(column)),
    ignoredColumns: [...found].filter(column => !recognized.has(column))
  };
}

export function normalizeDldTransactionsSource({ headers = [], rows = [] } = {}) {
  const inspection = inspectDldTransactionsHeader(headers);
  if (!inspection.compatible) throw new Error(`Missing required DLD columns: ${inspection.missingRequired.join(', ')}`);
  if (inspection.sourceFormat === 'dubai_pulse_api_csv') return { ...inspection, sourceDatasetRef: DLD_DATASET_REF, rows };
  return {
    ...inspection,
    sourceDatasetRef: DLD_WEBSITE_DATASET_REF,
    rows: rows.map(row => ({
      transaction_id: row.TRANSACTION_NUMBER,
      instance_date: row.INSTANCE_DATE,
      trans_group_en: row.GROUP_EN,
      procedure_name_en: row.PROCEDURE_EN,
      property_type_en: row.PROP_TYPE_EN,
      property_sub_type_en: row.PROP_SB_TYPE_EN,
      property_usage_en: row.USAGE_EN,
      reg_type_en: row.IS_OFFPLAN_EN,
      area_id: '',
      area_name_en: row.AREA_EN,
      procedure_area: row.PROCEDURE_AREA,
      actual_worth: row.TRANS_VALUE,
      project_number: '',
      project_name_en: row.PROJECT_EN,
      master_project_en: row.MASTER_PROJECT_EN,
      building_name_en: '',
      rooms_en: row.ROOMS_EN,
      has_parking: row.PARKING,
      meter_sale_price: ''
    }))
  };
}

export function mapDldTransactionToCore(row, context = {}) {
  const sourceRecordRef = clean(row?.transaction_id);
  const transactionDate = normalizeDate(row?.instance_date);
  const transactionAreaSqm = finitePositive(row?.procedure_area);
  const transactionAmountAed = finitePositive(row?.actual_worth);
  const sourceFileSha256 = clean(context.sourceFileSha256).toLowerCase();
  const sourceRowSha256 = clean(context.sourceRowSha256).toLowerCase();
  const transactionGroup = clean(row?.trans_group_en);
  const errors = [];
  if (!sourceRecordRef) errors.push('missing_transaction_id');
  if (!transactionDate) errors.push('invalid_instance_date');
  if (!/^sales?$/i.test(transactionGroup)) errors.push('not_sales_transaction');
  if (!clean(row?.property_type_en)) errors.push('missing_property_type');
  if (!clean(row?.area_name_en)) errors.push('missing_area_name');
  if (!transactionAreaSqm) errors.push('invalid_procedure_area');
  if (!transactionAmountAed) errors.push('invalid_actual_worth');
  if (!sha256(sourceFileSha256)) errors.push('invalid_source_file_sha256');
  if (!sha256(sourceRowSha256)) errors.push('invalid_source_row_sha256');
  if (errors.length) return { accepted: false, sourceRecordRef: sourceRecordRef || null, errors };

  const transactionAreaSqft = Number((transactionAreaSqm * 10.763910416709722).toFixed(2));
  return {
    accepted: true,
    record: {
      mapping_version: DLD_MARKET_IMPORT_POLICY_VERSION,
      source_dataset_ref: clean(context.sourceDatasetRef) || DLD_DATASET_REF,
      source_file_sha256: sourceFileSha256,
      source_row_sha256: sourceRowSha256,
      source_record_ref: sourceRecordRef,
      transaction_date: transactionDate,
      transaction_type: transactionGroup,
      transaction_subtype: clean(row.procedure_name_en),
      registration_type: clean(row.reg_type_en),
      area_source_ref: clean(row.area_id),
      area_name: clean(row.area_name_en),
      project_source_ref: clean(row.project_number),
      project_name: clean(row.project_name_en),
      master_project_name: clean(row.master_project_en),
      building_name: clean(row.building_name_en),
      property_type: clean(row.property_type_en),
      property_sub_type: clean(row.property_sub_type_en),
      property_usage: clean(row.property_usage_en),
      bedrooms_label: clean(row.rooms_en),
      has_parking: clean(row.has_parking),
      transaction_amount_aed: Number(transactionAmountAed.toFixed(2)),
      transaction_area_sqm: Number(transactionAreaSqm.toFixed(2)),
      transaction_area_sqft: transactionAreaSqft,
      price_per_sqft_aed: Number((transactionAmountAed / transactionAreaSqft).toFixed(2)),
      usage_basis: 'governed_import',
      verification_status: 'staged_admin_review'
    }
  };
}

export function buildDldMarketImportPreview({ rows = [], sourceFileSha256, sourceDatasetRef = DLD_DATASET_REF, rowHashes = [] } = {}) {
  if (!Array.isArray(rows) || !rows.length) throw new Error('At least one DLD source row is required');
  if (!sha256(sourceFileSha256)) throw new Error('A SHA-256 hash of the immutable source file is required');
  const accepted = [], rejected = [], seen = new Set();
  rows.forEach((row, index) => {
    const result = mapDldTransactionToCore(row, { sourceFileSha256, sourceDatasetRef, sourceRowSha256: rowHashes[index] });
    if (!result.accepted) return rejected.push({ rowNumber: index + 2, sourceRecordRef: result.sourceRecordRef, reasons: result.errors });
    if (seen.has(result.record.source_record_ref)) return rejected.push({ rowNumber: index + 2, sourceRecordRef: result.record.source_record_ref, reasons: ['duplicate_transaction_id_in_file'] });
    seen.add(result.record.source_record_ref);
    accepted.push(result.record);
  });
  return {
    policyVersion: DLD_MARKET_IMPORT_POLICY_VERSION,
    sourceDatasetRef,
    sourceFileSha256: sourceFileSha256.toLowerCase(),
    sourceRows: rows.length,
    acceptedRows: accepted.length,
    rejectedRows: rejected.length,
    accepted,
    rejected,
    importExecuted: false,
    adminApprovalRequired: true
  };
}

const median = values => {
  const ordered = values.filter(Number.isFinite).toSorted((a, b) => a - b);
  if (!ordered.length) return null;
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 ? ordered[middle] : Number(((ordered[middle - 1] + ordered[middle]) / 2).toFixed(2));
};

const percentile = (values, proportion) => {
  const ordered = values.filter(Number.isFinite).toSorted((a, b) => a - b);
  if (!ordered.length) return null;
  const position = (ordered.length - 1) * proportion, lower = Math.floor(position), upper = Math.ceil(position);
  return Number((ordered[lower] + (ordered[upper] - ordered[lower]) * (position - lower)).toFixed(2));
};

const monthLastDate = month => {
  const [year, monthNumber] = month.split('-').map(Number);
  return `${month}-${String(new Date(Date.UTC(year, monthNumber, 0)).getUTCDate()).padStart(2, '0')}`;
};

export function buildDldMarketKpis(records = []) {
  const accepted = records.filter(record => record?.verification_status === 'staged_admin_review');
  if (!accepted.length) return { available: false, acceptedSales: 0, message: 'No accepted sales are available for analytics' };
  const dates = accepted.map(record => clean(record.transaction_date)).filter(Boolean).toSorted();
  const dateFrom = dates[0] || null, dateTo = dates.at(-1) || null;
  const aggregate = keyFromRecord => {
    const grouped = new Map();
    for (const record of accepted) {
      const label = clean(keyFromRecord(record)) || 'Unspecified';
      const entry = grouped.get(label) || { label, transactions: 0, totalValueAed: 0, totalAreaSqft: 0, values: [], pricesPerSqft: [] };
      entry.transactions += 1;
      entry.totalValueAed += Number(record.transaction_amount_aed) || 0;
      entry.totalAreaSqft += Number(record.transaction_area_sqft) || 0;
      entry.values.push(Number(record.transaction_amount_aed));
      entry.pricesPerSqft.push(Number(record.price_per_sqft_aed));
      grouped.set(label, entry);
    }
    return [...grouped.values()].map(entry => ({
      label: entry.label,
      transactions: entry.transactions,
      totalValueAed: Number(entry.totalValueAed.toFixed(2)),
      weightedAveragePricePerSqftAed: entry.totalAreaSqft > 0 ? Number((entry.totalValueAed / entry.totalAreaSqft).toFixed(2)) : null,
      medianTransactionValueAed: median(entry.values),
      medianPricePerSqftAed: median(entry.pricesPerSqft)
    }));
  };
  const communities = aggregate(record => record.area_name)
    .toSorted((a, b) => b.transactions - a.transactions || b.totalValueAed - a.totalValueAed || a.label.localeCompare(b.label));
  const communitiesByValue = communities.toSorted((a, b) => b.totalValueAed - a.totalValueAed || b.transactions - a.transactions || a.label.localeCompare(b.label));
  const propertyTypes = aggregate(record => clean(record.property_sub_type) || clean(record.property_type))
    .toSorted((a, b) => b.transactions - a.transactions || b.totalValueAed - a.totalValueAed || a.label.localeCompare(b.label));
  const bedroomMix = aggregate(record => record.bedrooms_label)
    .toSorted((a, b) => b.transactions - a.transactions || b.totalValueAed - a.totalValueAed || a.label.localeCompare(b.label));
  const projects = aggregate(record => record.project_name)
    .filter(entry => entry.label !== 'Unspecified')
    .toSorted((a, b) => b.transactions - a.transactions || b.totalValueAed - a.totalValueAed || a.label.localeCompare(b.label));
  const registrationMix = aggregate(record => /off[\s-]?plan/i.test(clean(record.registration_type)) ? 'Off-plan' : 'Ready / existing')
    .toSorted((a, b) => b.transactions - a.transactions);
  const offPlanSales = registrationMix.find(entry => entry.label === 'Off-plan')?.transactions || 0;
  const firstMonth = dateFrom?.slice(0, 7), lastMonth = dateTo?.slice(0, 7);
  const monthlyActivity = aggregate(record => clean(record.transaction_date).slice(0, 7))
    .map(entry => ({
      ...entry,
      coverage: ((entry.label === firstMonth && dateFrom !== `${firstMonth}-01`) || (entry.label === lastMonth && dateTo !== monthLastDate(lastMonth))) ? 'partial' : 'complete'
    }))
    .toSorted((a, b) => a.label.localeCompare(b.label));
  const transactionValues = accepted.map(record => Number(record.transaction_amount_aed));
  const pricesPerSqft = accepted.map(record => Number(record.price_per_sqft_aed));
  const totalAreaSqft = accepted.reduce((sum, record) => sum + (Number(record.transaction_area_sqft) || 0), 0);
  return {
    available: true,
    acceptedSales: accepted.length,
    totalTransactionValueAed: Number(transactionValues.reduce((sum, value) => sum + (value || 0), 0).toFixed(2)),
    medianTransactionValueAed: median(transactionValues),
    weightedAveragePricePerSqftAed: totalAreaSqft > 0 ? Number((transactionValues.reduce((sum, value) => sum + (value || 0), 0) / totalAreaSqft).toFixed(2)) : null,
    medianPricePerSqftAed: median(pricesPerSqft),
    transactionValueRangeAed: { p25: percentile(transactionValues, 0.25), median: median(transactionValues), p75: percentile(transactionValues, 0.75) },
    pricePerSqftRangeAed: { p25: percentile(pricesPerSqft, 0.25), median: median(pricesPerSqft), p75: percentile(pricesPerSqft, 0.75) },
    communityCount: communities.length,
    offPlanSales,
    offPlanSharePercent: Number(((offPlanSales / accepted.length) * 100).toFixed(1)),
    dateFrom,
    dateTo,
    communities,
    communitiesByValue,
    propertyTypes,
    bedroomMix,
    projects,
    registrationMix,
    monthlyActivity
  };
}

const quoteCsv = value => {
  const text = String(value ?? '');
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

export function renderCoreMarketUploadCsv(records = []) {
  const lines = [CORE_MARKET_UPLOAD_COLUMNS.join(',')];
  for (const record of records) lines.push(CORE_MARKET_UPLOAD_COLUMNS.map(column => quoteCsv(record?.[column])).join(','));
  return `${lines.join('\r\n')}\r\n`;
}

export function parseCsvText(text, { maxRows = 1000 } = {}) {
  const input = String(text ?? '').replace(/^\uFEFF/, '');
  if (!input.trim()) throw new Error('CSV file is empty');
  const matrix = [];
  let row = [], field = '', quoted = false;
  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (quoted) {
      if (character === '"' && input[index + 1] === '"') { field += '"'; index += 1; }
      else if (character === '"') quoted = false;
      else field += character;
    } else if (character === '"') quoted = true;
    else if (character === ',') { row.push(field); field = ''; }
    else if (character === '\n') {
      row.push(field.replace(/\r$/, '')); field = '';
      if (row.some(value => clean(value))) matrix.push(row);
      row = [];
      if (matrix.length > maxRows + 1) throw new Error(`POC accepts at most ${maxRows} data rows`);
    } else field += character;
  }
  if (quoted) throw new Error('CSV contains an unterminated quoted field');
  row.push(field.replace(/\r$/, ''));
  if (row.some(value => clean(value))) matrix.push(row);
  if (matrix.length < 2) throw new Error('CSV must contain a header and at least one data row');
  if (matrix.length > maxRows + 1) throw new Error(`POC accepts at most ${maxRows} data rows`);
  const headers = matrix[0].map(clean);
  if (headers.some((header, index) => !header || headers.indexOf(header) !== index)) throw new Error('CSV headers must be present and unique');
  return {
    headers,
    rows: matrix.slice(1).map(values => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ''])))
  };
}
