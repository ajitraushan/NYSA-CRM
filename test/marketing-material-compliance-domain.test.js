import test from 'node:test';
import assert from 'node:assert/strict';
import {aggregateMaterialStatus,deriveReleaseEligibility,effectiveReleaseUntil,evaluateMaterialPreflight,materialFingerprint,mayReviewMaterial,resolveMaterialApprover,validateChannelRuleDraft,validateMaterialTypeDraft,validateReviewDecision} from '../src/marketing-material-compliance-domain.js';

const activeRule={status:'active',listingRequired:true,campaignRequired:false,approvedMediaRequired:true,permitRequirement:'either',requiredDisclosureCodes:['broker_name'],defaultValidityDays:30};
const good={rule:activeRule,material:{listingId:'listing'},documentVersion:{immutable:1},media:[{approvalStatus:'approved',usageRightsConfirmed:true,rightsExpiresAt:'2026-09-30'}],permit:{reference:'permit',expiresAt:'2026-09-15'},disclosureCodes:['broker_name'],now:Date.parse('2026-08-14')};

test('material type uses controlled stable identity',()=>assert.equal(validateMaterialTypeDraft({stableCode:'social_post',label:'Social post',description:'Approved property social creative',scopeType:'property'}).valid,true));
test('invalid material type is rejected',()=>assert.equal(validateMaterialTypeDraft({stableCode:'Bad Code',label:'x',description:'short'}).valid,false));
test('channel rule accepts Manager or Director route',()=>assert.equal(validateChannelRuleDraft({materialTypeId:'t',materialTypeVersionId:'v',channelCode:'instagram',regionCode:'dubai',approverRoute:'manager_or_director'}).valid,true));
test('channel rule never infers legal permit requirements',()=>assert.equal(validateChannelRuleDraft({materialTypeId:'t',materialTypeVersionId:'v',channelCode:'print',regionCode:'dubai'}).value.permitRequirement,'none'));
test('Manager route resolves exact reporting Manager',()=>assert.deepEqual(resolveMaterialApprover({route:'manager',submitterId:'agent',managerId:'manager',directorId:'director'}).approverId,'manager'));
test('Director route resolves Director',()=>assert.equal(resolveMaterialApprover({route:'director',submitterId:'agent',managerId:'manager',directorId:'director'}).approverId,'director'));
test('either route accepts selected eligible Director',()=>assert.equal(resolveMaterialApprover({route:'manager_or_director',submitterId:'agent',managerId:'manager',directorId:'director',selectedApproverId:'director'}).approverRole,'director'));
test('self approval fails for operational approver',()=>assert.throws(()=>resolveMaterialApprover({route:'manager',submitterId:'manager',managerId:'manager'}),/Self-approval/));
test('assigned Manager with team authority may review',()=>assert.equal(mayReviewMaterial({broker:{id:'m',jobRole:'manager',managedTeamIds:['team']},request:{assignedApproverId:'m',assignedApproverRole:'manager',assignedTeamId:'team'},submitterId:'a'}),true));
test('Director must be exact assigned approver',()=>assert.equal(mayReviewMaterial({broker:{id:'d',jobRole:'director'},request:{assignedApproverId:'other',assignedApproverRole:'director'},submitterId:'a'}),false));
test('full Administrator has direct review exception',()=>assert.equal(mayReviewMaterial({broker:{id:'a',role:'admin'},request:{},submitterId:'a'}),true));
test('complete configured dependencies pass preflight',()=>assert.deepEqual(evaluateMaterialPreflight(good),{canSubmit:true,blockers:[]}));
test('unapproved media and missing disclosure fail closed',()=>{const result=evaluateMaterialPreflight({...good,media:[{approvalStatus:'pending',usageRightsConfirmed:false}],disclosureCodes:[]});assert.equal(result.canSubmit,false);assert.ok(result.blockers.includes('media_rights_not_current'));assert.ok(result.blockers.includes('disclosure_missing:broker_name'));});
test('permit either rule accepts verified official evidence',()=>assert.equal(evaluateMaterialPreflight({...good,permit:null,officialEvidence:[{reviewDecision:'verified',expiresAt:'2026-09-01'}]}).canSubmit,true));
test('earliest dependency determines release end',()=>assert.equal(effectiveReleaseUntil({approvedAt:'2026-08-14T00:00:00Z',requestedReleaseUntil:'2026-09-30T00:00:00Z',defaultValidityDays:30,mediaRightsExpiries:['2026-08-25T00:00:00Z'],permitExpiresAt:'2026-09-01T00:00:00Z'}),'2026-08-25T00:00:00.000Z'));
test('approved current channel is released for use',()=>assert.equal(deriveReleaseEligibility({reviewStatus:'approved',releaseFrom:'2026-08-01',releaseUntil:'2026-08-30',now:Date.parse('2026-08-14')}).status,'released_for_use'));
test('dependency change makes approval stale',()=>assert.equal(deriveReleaseEligibility({reviewStatus:'approved',dependenciesCurrent:false}).status,'stale'));
test('future approved channel is scheduled',()=>assert.equal(deriveReleaseEligibility({reviewStatus:'approved',releaseFrom:'2026-09-01',now:Date.parse('2026-08-14')}).status,'scheduled'));
test('channel aggregate supports partial approval',()=>assert.equal(aggregateMaterialStatus(['approved','pending']),'partially_approved'));
test('decision reason is mandatory except approval',()=>{assert.equal(validateReviewDecision({decision:'approved'}).valid,true);assert.equal(validateReviewDecision({decision:'rejected',reason:'no'}).valid,false);});
test('fingerprint is stable across object key order',()=>assert.equal(materialFingerprint({b:2,a:{d:4,c:3}}),materialFingerprint({a:{c:3,d:4},b:2})));
