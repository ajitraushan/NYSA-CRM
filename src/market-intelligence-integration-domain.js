import crypto from 'node:crypto';
import {
  DLD_LOCAL_MAX_FILE_BYTES,DLD_LOCAL_MAX_ROWS,buildDldMarketImportPreview,buildDldMarketKpis,
  normalizeDldTransactionsSource,parseCsvText
} from './dld-market-data-import-domain.js';

const clean=value=>String(value??'').trim();
const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value;
export const fingerprint=value=>crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
export const normalizeIdentity=value=>clean(value).normalize('NFKC').toLowerCase().replace(/\s+/g,' ');
export const listingMarketContextHash=listing=>fingerprint({id:listing.id,reference:listing.reference,updatedAt:listing.updatedAt,areaId:listing.areaId,communityId:listing.communityId,community:listing.community,building:listing.building,propertyType:listing.propertyType,bedrooms:listing.bedrooms,price:Number(listing.price),sizeSqft:Number(listing.sizeSqft)});

export function governedMarketSegment({propertyType,bedrooms}={}){
  const type=normalizeIdentity(propertyType),layout=normalizeIdentity(bedrooms).replace(/\s*(?:b\/?r|bed(?:room)?s?)\s*/g,'');
  if(type.includes('penthouse'))return'Penthouse';
  if(type.includes('villa'))return'Villa';
  if(!type.includes('apartment')&&!type.includes('flat')&&!type.includes('unit'))return null;
  if(layout.includes('studio'))return'Studio';
  const count=Number.parseInt(layout,10);if(count===1)return'1 BR';if(count===2)return'2 BR';if(count===3)return'3 BR';if(count>=4||layout.includes('4+')||layout.includes('5+'))return'4+ BR';return null;
}

export function selectGovernedMarketScope({subject={},observations=[],minComparables=3}={}){
  const segment=governedMarketSegment(subject),communityId=clean(subject.communityId),buildingName=clean(subject.building),buildingIdentity=normalizeIdentity(buildingName);
  const segmentRows=observations.filter(row=>clean(row.communityId)===communityId&&governedMarketSegment(row)===segment);
  const buildingRows=buildingIdentity?segmentRows.filter(row=>normalizeIdentity(row.buildingName)===buildingIdentity||normalizeIdentity(row.projectName)===buildingIdentity):[];
  const useBuilding=Boolean(segment&&buildingIdentity&&buildingRows.length>=minComparables),selected=useBuilding?buildingRows:segmentRows;
  return{segment,level:useBuilding?'building':'community',buildingName:buildingName||null,communityName:clean(subject.community)||null,buildingComparableCount:buildingRows.length,communityComparableCount:segmentRows.length,minimumComparables:minComparables,selected,limitations:[...(!segment?['Inventory must have one governed market segment: Studio, 1 BR, 2 BR, 3 BR, 4+ BR, Penthouse or Villa']:[]),...(segment&&buildingIdentity&&!useBuilding?[`Only ${buildingRows.length} exact ${buildingName} / ${segment} comparable(s) exist; using same-Community ${segment} evidence`]:[]),...(segment&&!buildingIdentity?['Building name is not maintained; using same-Community segment evidence']:[])]};
}

export function validateCommunityDraft(body={}){
  const value={stableCode:clean(body.stableCode).toLowerCase(),areaId:clean(body.areaId),businessLabel:clean(body.businessLabel)};
  const errors=[];
  if(!/^[a-z][a-z0-9_]*$/.test(value.stableCode))errors.push('Stable code must use lowercase letters, numbers and underscores');
  if(!value.areaId)errors.push('Governed Area is required');
  if(value.businessLabel.length<2)errors.push('Community label is required');
  return{valid:!errors.length,errors,value:{...value,normalizedLabel:normalizeIdentity(value.businessLabel)}};
}

export function validateMappingDraft(body={}){
  const value={sourceDatasetRef:clean(body.sourceDatasetRef),sourceAreaRef:clean(body.sourceAreaRef)||null,sourceAreaLabel:clean(body.sourceAreaLabel),communityId:clean(body.communityId),communityVersionId:clean(body.communityVersionId),reason:clean(body.reason)};
  const errors=[];
  if(!value.sourceDatasetRef)errors.push('Source dataset is required');
  if(!value.sourceAreaLabel)errors.push('DLD source area label is required');
  if(!value.communityId||!value.communityVersionId)errors.push('Active canonical Community is required');
  if(value.reason.length<10)errors.push('A meaningful mapping reason is required');
  return{valid:!errors.length,errors,value:{...value,normalizedSourceIdentity:normalizeIdentity(value.sourceAreaRef||value.sourceAreaLabel)}};
}

export function inspectDldCsv(bytes,{sourceDatasetRef}={}){
  if(!Buffer.isBuffer(bytes)||!bytes.length)throw new Error('CSV file is empty');
  if(bytes.length>DLD_LOCAL_MAX_FILE_BYTES)throw new Error('CSV exceeds the 50 MiB limit');
  let text;try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{throw new Error('CSV must be valid UTF-8');}
  const sourceFileSha256=crypto.createHash('sha256').update(bytes).digest('hex'),parsed=parseCsvText(text,{maxRows:DLD_LOCAL_MAX_ROWS});
  const normalized=normalizeDldTransactionsSource(parsed),dataset=clean(sourceDatasetRef)||normalized.sourceDatasetRef;
  const rowHashes=normalized.rows.map(row=>fingerprint(row));
  const preview=buildDldMarketImportPreview({rows:normalized.rows,sourceFileSha256,sourceDatasetRef:dataset,rowHashes});
  const byRow=new Map(preview.rejected.map(row=>[row.rowNumber,row]));let acceptedIndex=0;
  const stagedRows=normalized.rows.map((row,index)=>{const rowNumber=index+2,rejected=byRow.get(rowNumber);return rejected?{rowNumber,sourceRecordRef:rejected.sourceRecordRef,rowHash:rowHashes[index],outcome:'rejected',reasons:rejected.reasons,payload:null}:{rowNumber,sourceRecordRef:preview.accepted[acceptedIndex].source_record_ref,rowHash:rowHashes[index],outcome:'eligible',reasons:[],payload:preview.accepted[acceptedIndex++]};});
  const dates=preview.accepted.map(row=>row.transaction_date).sort();
  const summary={sourceFormat:normalized.sourceFormat,sourceDatasetRef:dataset,sourceFileSha256,sourceRows:preview.sourceRows,acceptedRows:preview.acceptedRows,rejectedRows:preview.rejectedRows,periodStart:dates[0]||null,periodEnd:dates.at(-1)||null,kpis:buildDldMarketKpis(preview.accepted),rejectionSummary:Object.entries(preview.rejected.flatMap(row=>row.reasons).reduce((acc,reason)=>(acc[reason]=(acc[reason]||0)+1,acc),{})).map(([reason,count])=>({reason,count}))};
  return{...summary,previewFingerprint:fingerprint(summary),rows:stagedRows};
}

export function reviewFingerprint({snapshotId,decision,reason}){return fingerprint({snapshotId,decision,reason:clean(reason)||null});}
