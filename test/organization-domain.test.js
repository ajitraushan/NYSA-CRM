import test from 'node:test';
import assert from 'node:assert/strict';
import { validateOrganizationProfile,publicOrganization,formatOrganizationDate,organizationContactLines } from '../src/organization-domain.js';

const valid={legalName:'NYSA Realty LLC',displayName:'NYSA Realty',defaultCurrency:'aed',timezone:'Asia/Dubai',locale:'en-AE',brandVersion:'NYSA-2026.1',primaryEmail:'INFO@NYSA.AE',websiteUrl:'https://nysa.ae'};

test('organization profile validates and normalizes document defaults',()=>{
  const result=validateOrganizationProfile(valid);
  assert.equal(result.error,undefined);assert.equal(result.profile.defaultCurrency,'AED');assert.equal(result.profile.primaryEmail,'info@nysa.ae');
  assert.match(validateOrganizationProfile({...valid,timezone:'Mars/Olympus'}).error,/timezone/);
  assert.match(validateOrganizationProfile({...valid,defaultCurrency:'dirham'}).error,/three-letter/);
  assert.match(validateOrganizationProfile({...valid,brandVersion:''}).error,/brand version/);
});

test('public organization snapshots preserve asset proof without exposing private storage keys',()=>{
  const safe=publicOrganization({id:'profile-1',version:4,logoStorageKey:'private-secret.png',logoFileName:'nysa.png',logoMediaType:'image/png',logoFileSizeBytes:123,logoFileHash:'abc'});
  assert.equal(safe.logoStorageKey,undefined);assert.equal(safe.logo.fileHash,'abc');assert.equal(safe.logo.downloadUrl,'/api/admin/organization-settings/profile-1/logo');
});

test('proposal helpers apply approved timezone and company identity',()=>{
  const date=formatOrganizationDate('2026-07-15T08:00:00Z',{locale:'en-AE',timezone:'Asia/Dubai'});
  assert.match(date,/12:00/);
  assert.deepEqual(organizationContactLines({legalName:'NYSA Realty LLC',displayName:'NYSA Realty',tradeLicenseNumber:'TL-1',registrationAuthority:'DET',primaryEmail:'info@nysa.ae'}),['Legal entity: NYSA Realty LLC','Trade licence: TL-1 | DET','info@nysa.ae']);
});
