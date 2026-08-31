import { one, many } from './db.js';

export async function loadActiveClassificationCatalogue(client){
  const version=await one(`SELECT * FROM classification_catalogue_versions
    WHERE status='active' AND effective_from<=NOW() AND (effective_to IS NULL OR effective_to>NOW())`,[],client);
  if(!version)throw Object.assign(new Error('The approved business-classification catalogue is unavailable; this write cannot continue'),{statusCode:503});
  const dimensions=await many(`SELECT d.dimension_code,d.business_label AS dimension_label,d.help_text AS dimension_help,d.sort_order AS dimension_sort,
    v.id AS value_id,v.stable_code,v.business_label,v.help_text,v.active,v.sort_order,v.applicability
    FROM classification_dimensions d JOIN classification_values v ON v.dimension_id=d.id
    WHERE d.catalogue_version_id=$1 ORDER BY d.sort_order,v.sort_order,v.stable_code`,[version.id],client);
  const mappings=await many(`SELECT source_dimension_code,source_value_code,target_context,target_value_code,reason_code,mapping_evidence
    FROM classification_mappings WHERE catalogue_version_id=$1
    ORDER BY source_dimension_code,source_value_code,target_context`,[version.id],client);
  const grouped=[];
  for(const row of dimensions){let dimension=grouped.find(item=>item.code===row.dimensionCode);if(!dimension){dimension={code:row.dimensionCode,label:row.dimensionLabel,helpText:row.dimensionHelp,values:[]};grouped.push(dimension);}dimension.values.push({id:row.valueId,code:row.stableCode,label:row.businessLabel,helpText:row.helpText,active:row.active,sortOrder:row.sortOrder,applicability:row.applicability});}
  return {version:{id:version.id,code:version.versionCode,status:version.status,label:version.businessLabel,approvedAt:version.approvedAt,effectiveFrom:version.effectiveFrom,contentSha256:version.contentSha256},dimensions:grouped,mappings};
}

export function classificationDimension(catalogue,code){return catalogue.dimensions.find(item=>item.code===code);}

export function validateClassificationSelection(catalogue,selection,{allowNotConfirmed=true}={}){
  const requested={customer_objective:selection.customerObjective,market_stage:selection.marketStageRequirement,property_segment:selection.propertySegmentRequirement};
  for(const [dimensionCode,valueCode] of Object.entries(requested)){
    const dimension=classificationDimension(catalogue,dimensionCode),value=dimension?.values.find(item=>item.code===valueCode&&item.active);
    if(!value)return {error:`${dimension?.label||dimensionCode} value '${valueCode||''}' is not active in classification catalogue ${catalogue.version.code}`};
    if(!allowNotConfirmed&&valueCode==='not_confirmed')return {error:`${dimension.label} must be confirmed before this action`};
  }
  const transaction=mapClassificationValue(catalogue,'customer_objective',selection.customerObjective,'derived_transaction');
  if(!transaction)return {error:`Customer objective '${selection.customerObjective}' has no approved transaction mapping in ${catalogue.version.code}`};
  return {value:{catalogueVersionId:catalogue.version.id,classificationVersion:catalogue.version.code,derivedTransaction:transaction.targetValueCode,mappingEvidence:{catalogueVersion:catalogue.version.code,objective:selection.customerObjective,derivedTransaction:transaction.targetValueCode,reasonCode:transaction.reasonCode}}};
}

export function mapClassificationValue(catalogue,sourceDimension,sourceValue,targetContext){return catalogue.mappings.find(item=>item.sourceDimensionCode===sourceDimension&&item.sourceValueCode===sourceValue&&item.targetContext===targetContext);}
export function legacyBusinessType(derivedTransaction){return derivedTransaction==='sale'?'Sale':derivedTransaction==='rental'?'Rental':'Unconfirmed';}
export function isInventorySideObjective(objective){return ['sell','rent_out'].includes(objective);}
