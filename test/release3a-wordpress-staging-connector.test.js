import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve('release-artifacts/release-3/r3a/wordpress-staging');
const plugin=fs.readFileSync(path.join(root,'nysa-crm-test-intake-connector','nysa-crm-test-intake-connector.php'),'utf8');
const bridge=fs.readFileSync(path.join(root,'nysa-crm-test-intake-connector','assets','intake-bridge.js'),'utf8');

test('R3A-WEBSITE-PROFILE-46C connector is staging-only and CRM Test allowlisted',()=>{
  assert.match(plugin,/const ENDPOINT = 'https:\/\/crm-test\.nysarealty\.com\/api\/intake\/website'/);
  assert.match(plugin,/\/prometheus\//);
  assert.doesNotMatch(plugin,/https:\/\/crm\.nysarealty\.com\/api\/intake\/website/);
});

test('R3A-INTAKE-41 connector signs exact body and retains immutable retries',()=>{
  assert.match(plugin,/hash_hmac\('sha256', \$timestamp \. '\.' \. \$body/);
  assert.match(plugin,/'X-Nysa-Timestamp'/);
  assert.match(plugin,/'X-Nysa-Signature'/);
  assert.match(plugin,/UNIQUE KEY lead_key/);
  assert.match(plugin,/UNIQUE KEY event_id/);
  assert.match(plugin,/Retry exact payload/);
  assert.match(plugin,/\$body = \(string\) \$row->payload_json/);
});

test('R3A-WEBSITE-PROFILE-46C sends only completed evidence and maps profile fields',()=>{
  assert.match(plugin,/advisory_completed/);
  assert.match(plugin,/property_shortlist_completed/);
  assert.match(plugin,/'sourceCode' => 'investment_profile'/);
  assert.match(plugin,/'declaredPriorities'/);
  assert.match(plugin,/'preferences'/);
  assert.match(plugin,/'sourceEvidence'/);
  assert.match(plugin,/'purchaseTimeline' => 'to_be_confirmed'/);
  assert.match(plugin,/'timelineCode' => \$intermediate\['requirement'\]\['purchaseTimeline'\]/);
  assert.match(plugin,/Residency goal:/);
});

test('R3A-WEBSITE-PROFILE-46C normalizes all four sources through one intermediate schema',()=>{
  assert.match(plugin,/INTERMEDIATE_SCHEMA_VERSION = 'nysa-intermediate-enquiry-1'/);
  assert.match(plugin,/metform_after_store_form_data/);
  assert.match(plugin,/2427 => 'speak_to_advisor_v2'/);
  assert.match(plugin,/2443 => 'brochure_download_v2'/);
  assert.match(plugin,/'ai_property_selection_v1'/);
  assert.match(plugin,/'ai_advisory_v1'/);
  assert.match(plugin,/intermediate_from_metform/);
  assert.match(plugin,/intermediate_from_ai/);
  assert.match(plugin,/map_intermediate_to_crm/);
});

test('Incomplete legacy forms are retained without inventing controlled CRM values',()=>{
  assert.match(plugin,/validation_status VARCHAR\(30\)/);
  assert.match(plugin,/'needs_mapping'/);
  assert.match(plugin,/\$errors\[\] = 'business_type'/);
  assert.match(plugin,/\$errors\[\] = 'purpose'/);
  assert.match(plugin,/\$errors\[\] = 'purchase_timeline'/);
  assert.match(plugin,/Complete mapping and send/);
  assert.match(plugin,/controlled_wordpress_review/);
  assert.match(plugin,/admin_post_nysa_crm_test_intake_complete_mapping/);
});

test('Intermediate evidence strips browser secrets and retains attribution',()=>{
  assert.match(plugin,/nonce\|captcha\|token\|password\|secret/);
  assert.match(plugin,/'attribution'/);
  assert.match(plugin,/'utmSource'/);
  assert.match(plugin,/'brochureCode'/);
  assert.match(plugin,/'property' => array\('externalId'/);
});

test('R3A-CONSENT-INTAKE records absence of website marketing consent as denied',()=>{
  assert.match(plugin,/return false;\s*}\s*\n\s*private static function preferred_channel/s);
  assert.match(plugin,/'marketing' => self::marketing_consent/);
  assert.match(plugin,/truthfully records it as denied/);
});

test('Connector stores delivery evidence and never exposes the saved secret',()=>{
  assert.match(plugin,/delivery_status VARCHAR\(30\)/);
  assert.match(plugin,/response_body LONGTEXT/);
  assert.match(plugin,/attempt_count INT UNSIGNED/);
  assert.match(plugin,/Saved - leave blank to keep it/);
  assert.doesNotMatch(plugin,/value="<\?php echo esc_attr\(\$settings\['shared_secret'\]\)/);
});

test('R3A-WEBSITE-PROFILE-46C direct Calendly journeys are retained before redirect',()=>{
  assert.match(plugin,/Version: 1\.9\.4/);
  assert.match(plugin,/wp_ajax_nopriv_/);
  assert.match(plugin,/check_ajax_referer\('nysa_crm_test_public_intake'/);
  assert.match(plugin,/bridge_rate_limit/);
  assert.match(plugin,/intermediate_from_bridge/);
  assert.match(plugin,/\$result\['delivery_status'\] \?\? 'failed'/);
  assert.match(bridge,/a\[href\*="calendly\.com"\]/);
  assert.match(bridge,/Saving your enquiry securely/);
  assert.match(bridge,/finishAndRedirect/);
  assert.ok(bridge.indexOf('postEnquiry(')<bridge.indexOf('finishAndRedirect(pendingRedirect'));
});

test('R3A-ADVISORY-SUBMIT-62 recovers cached legacy summary links without a 404',()=>{
  assert.match(plugin,/redirect_legacy_advisory_summary/);
  assert.match(plugin,/\(string\) \(\$_GET\['nysa_ai_lead'\] \?\? ''\) !== '1'/);
  assert.ok(plugin.includes("preg_match('#/contact-us/?$#'"));
  assert.match(plugin,/'legacy_advisory' => 'recovered'/);
  assert.match(plugin,/#nysa-investment-tool/);
  assert.match(plugin,/wp_safe_redirect\(\$destination, 302/);
  assert.doesNotMatch(plugin,/\$_GET\['nysa_name'\]|\$_GET\['nysa_email'\]|\$_GET\['nysa_phone'\]|\$_GET\['nysa_message'\]/);
});

test('R3A-AI-ADVISORY-CAPTURE-59 corrects the staging REST boundary and requires confirmed retention',()=>{
  assert.match(plugin,/'aiLeadRestUrl' => rest_url/);
  assert.match(plugin,/'crmTestIntake' => array/);
  assert.match(plugin,/'retained' => \$retained/);
  assert.match(bridge,/isAiLeadRequest/);
  assert.match(bridge,/config\.aiLeadRestUrl/);
  assert.match(bridge,/intake\.retained/);
  assert.match(bridge,/Sending the advisory securely to NYSA/);
  assert.match(bridge,/Your answers remain on this page/);
});

test('R3A-ENV-ISOLATION-61 intercepts staging AI intake before any legacy handler can target Production',()=>{
  assert.match(plugin,/rest_pre_dispatch/);
  assert.match(plugin,/intercept_ai_lead_capture/);
  assert.match(plugin,/!self::is_staging_site\(\)/);
  assert.match(plugin,/return new WP_REST_Response/);
  assert.ok(plugin.indexOf('intercept_ai_lead_capture')<plugin.indexOf('capture_and_deliver(self::intermediate_from_ai'));
  assert.doesNotMatch(plugin,/rest_request_after_callbacks/);
});

test('R3A-ENV-ISOLATION-61 removes the Production-relative AI route from rendered staging pages',()=>{
  assert.match(plugin,/start_staging_output_guard/);
  assert.match(plugin,/rewrite_staging_ai_route/);
  assert.match(plugin,/render_early_isolation_guard/);
  assert.match(plugin,/X-Nysa-Staging-Connector/);
  assert.match(plugin,/nocache_headers\(\)/);
  assert.match(plugin,/ISOLATED_ROUTE = '\/nysa-crm-test\/v1\/ai-leads'/);
  assert.match(plugin,/rest_url\(ltrim\(self::ISOLATED_ROUTE, '\/'\)\)/);
  assert.match(plugin,/ob_start\(array\(__CLASS__, 'rewrite_staging_ai_route'\)\)/);
});

test('R3A-ENV-ISOLATION-61 owns a staging-only REST namespace with no legacy callback dependency',()=>{
  assert.match(plugin,/register_isolated_ai_route/);
  assert.match(plugin,/register_rest_route\('nysa-crm-test\/v1', '\/ai-leads'/);
  assert.match(plugin,/capture_isolated_ai_request/);
  assert.match(plugin,/PHP_INT_MIN/);
  assert.match(bridge,/new URL\(value, window\.location\.href\)\.href === new URL\(config\.aiLeadRestUrl/);
});

test('R3A-ADVISORY-PRIVACY-60 removes personal advisory evidence from navigation URLs',()=>{
  assert.match(plugin,/'contactUrl' => home_url\('\/\?page_id=838'\)/);
  assert.match(bridge,/sanitizeAdvisorySummaryLinks/);
  assert.match(bridge,/data-nysa-advisory-summary/);
  assert.match(bridge,/#nysa-investment-tool/);
  assert.doesNotMatch(bridge,/window\.location\.assign\([^\n]*nysa_name/);
});

test('R3A-ADVISORY-SUBMIT-62 makes the summary button an explicit retained action',()=>{
  assert.match(bridge,/Save advisory and start property shortlist/);
  assert.match(bridge,/retainAdvisoryOnDemand/);
  assert.match(bridge,/Sending the advisory securely to NYSA/);
  assert.match(bridge,/Advisory safely retained in CRM Test/);
  assert.match(bridge,/Continue with Property Selection below/);
  assert.match(bridge,/window\.nysaAdvisoryAnswers/);
  assert.match(bridge,/window\.history\.replaceState\(null, '', '#nysa-investment-tool'\)/);
  assert.doesNotMatch(bridge,/Opening the contact page/);
  assert.match(bridge,/advisoryRetention\.then\(function \(result\) \{ return result\.ok \? result : retainAdvisoryOnDemand\(\); \}\)/);
  assert.match(bridge,/if \(scope\.matches && scope\.matches\(selector\)\) links\.unshift\(scope\)/);
  assert.match(bridge,/link\.remove\(\)/);
  assert.doesNotMatch(bridge,/link\.hidden = true/);
});

test('R3A-WEBSITE-PROFILE-46C custom AI form uses capture-phase governed intake',()=>{
  assert.match(bridge,/closest\('#nysa-lead-form'\)/);
  assert.match(bridge,/stopImmediatePropagation/);
  assert.match(bridge,/document\.addEventListener\('submit', interceptAiShortlist, true\)/);
  assert.match(bridge,/form_code: 'ai_advisory_v1'/);
  assert.match(bridge,/purchase_timeline: 'to_be_confirmed'/);
  assert.doesNotThrow(()=>new Function(bridge));
});

test('Public bridge is staging-only, idempotent and preserves all four source identities',()=>{
  assert.match(plugin,/self::is_staging_site\(\)/);
  assert.match(plugin,/submission_id/);
  assert.match(plugin,/source_record_key = 'bridge_'/);
  for(const source of ['speak_to_advisor_v2','brochure_download_v2','ai_advisory_v1','ai_property_selection_v1']){
    assert.match(plugin,new RegExp(source));
  }
  assert.match(bridge,/window\.crypto\.randomUUID/);
  assert.match(bridge,/activeSubmissionId/);
  assert.doesNotMatch(bridge,/shared_secret|WEBSITE_INTAKE_SECRET|LISTING_INTAKE_SECRET/);
});
