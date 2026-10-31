import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const target=path.resolve(process.argv[2]||'');
const expected='660cd1b1f407676924c4b783b56c1c208080d83e549f952a5cc73bbf21daa719';
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
if(!target||!fs.existsSync(target))throw new Error('Exact staging theme functions.php path is required');
const original=fs.readFileSync(target);
if(sha(original)!==expected)throw new Error(`Staging functions.php baseline mismatch: ${sha(original)}`);
let text=original.toString('utf8');
const replaceOnce=(pattern,replacement,label)=>{
  const matches=text.match(new RegExp(pattern.source,pattern.flags.includes('g')?pattern.flags:pattern.flags+'g'))||[];
  if(matches.length!==1)throw new Error(`${label} expected once, found ${matches.length}`);
  text=text.replace(pattern,replacement);
};

replaceOnce(
  /(\s*\$interest = sanitize_key\(wp_unslash\(\$_POST\['interest'\] \?\? ''\)\);\r?\n\s*\$budget = trim\(sanitize_text_field\(wp_unslash\(\$_POST\['budget'\] \?\? ''\)\)\);)/,
  `$1\n    $country = strtoupper(trim(sanitize_text_field(wp_unslash($_POST['country'] ?? ''))));\n    $property_type = sanitize_key(wp_unslash($_POST['property_type'] ?? ''));\n    $purpose = sanitize_key(wp_unslash($_POST['purpose'] ?? ''));\n    $timeline = sanitize_key(wp_unslash($_POST['timeline'] ?? ''));`,
  'guard fields'
);
replaceOnce(
  /(\s*&& in_array\(\$interest, \['', 'off-plan', 'ready', 'portfolio', 'unsure'\], true\))/,
  `\n        && in_array($interest, ['off-plan', 'ready', 'portfolio', 'unsure'], true)\n        && in_array($property_type, ['apartment', 'villa', 'townhouse', 'land', 'commercial', 'unsure'], true)\n        && in_array($country, ['AE', 'IN', 'OTHER'], true)\n        && in_array($purpose, ['own_use', 'investment', 'business', 'other'], true)\n        && in_array($timeline, ['within_3_months', '3_to_6_months', '6_to_12_months', 'over_12_months', 'not_sure'], true)`,
  'guard allowlists'
);
replaceOnce(
  /(\s*\$interest = sanitize_key\(wp_unslash\(\$_POST\['interest'\] \?\? ''\)\);\r?\n\s*\$budget = sanitize_text_field\(wp_unslash\(\$_POST\['budget'\] \?\? ''\)\);)/,
  `$1\n    $country = strtoupper(sanitize_text_field(wp_unslash($_POST['country'] ?? '')));\n    $property_type = sanitize_key(wp_unslash($_POST['property_type'] ?? ''));\n    $purpose = sanitize_key(wp_unslash($_POST['purpose'] ?? ''));\n    $timeline = sanitize_key(wp_unslash($_POST['timeline'] ?? ''));\n    $ai_assisted_contact = !empty($_POST['ai_assisted_contact']);`,
  'handler fields'
);
replaceOnce(
  /(\s*update_post_meta\(\$lead_id, '_nysa_budget', \$budget\);)/,
  `$1\n    update_post_meta($lead_id, '_nysa_country', $country);\n    update_post_meta($lead_id, '_nysa_property_type', $property_type);\n    update_post_meta($lead_id, '_nysa_purpose', $purpose);\n    update_post_meta($lead_id, '_nysa_timeline', $timeline);\n    update_post_meta($lead_id, '_nysa_ai_assisted_contact', $ai_assisted_contact ? '1' : '0');`,
  'contact metadata'
);
replaceOnce(
  /(\s*update_post_meta\(\$lead_id, '_nysa_source_host', sanitize_text_field\(\$host\)\);)/,
  `$1\n\n    do_action('nysa_contact_lead_saved', $lead_id, [\n        'name' => $name, 'email' => $email, 'phone' => $phone, 'interest' => $interest,\n        'property_type' => $property_type, 'budget' => $budget, 'message' => $message, 'country' => $country,\n        'purpose' => $purpose, 'timeline' => $timeline,\n        'ai_assisted_contact' => $ai_assisted_contact, 'source_host' => $host,\n    ]);`,
  'post-save CORE hook'
);

const backup=`${target}.dev241-pre-core-bridge`;
if(fs.existsSync(backup))throw new Error(`Refusing to overwrite existing backup: ${backup}`);
fs.copyFileSync(target,backup,fs.constants.COPYFILE_EXCL);
fs.writeFileSync(target,text,{flag:'w'});
console.log(JSON.stringify({target,backup,beforeSha256:expected,afterSha256:sha(Buffer.from(text)),hook:'nysa_contact_lead_saved'}));
