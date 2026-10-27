<?php
if (!defined('ABSPATH')) exit;

$is_staging = str_starts_with(strtolower((string) ($_SERVER['HTTP_HOST'] ?? '')), 'staging.');
$submission_status = isset($_GET['enquiry']) ? sanitize_key(wp_unslash($_GET['enquiry'])) : '';
$submitted = in_array($submission_status, ['received', 'staging'], true);
$submission_message = $submission_status === 'staging'
    ? 'The enquiry was stored securely and accepted for delivery to CRM Test. Live outreach remains disabled.'
    : 'Thank you. Your enquiry has been received and an advisor will review it.';
$errors = [];
if ($submission_status === 'invalid') $errors[] = 'Please complete all required fields with valid details.';
if ($submission_status === 'error') $errors[] = 'We could not save your enquiry. Please call or WhatsApp NYSA instead.';
if ($is_staging && $submission_status === 'blocked') $errors[] = 'The staging anti-spam check blocked this test submission.';

require get_template_directory() . '/header.php';
?>
<main id="content">
  <section class="inner-hero compact-archive-hero contact-hero"><div><p class="kicker">Contact NYSA</p><h1>Tell us what you’re looking for.</h1><p>Share your goals and questions. An advisor will help you decide the next step.</p></div></section>
  <section class="contact-production">
    <div class="contact-copy">
      <p class="kicker">Speak with an advisor</p><h2>Discuss your property plans with an advisor.</h2>
      <p>Tell us what you want to achieve, your approximate budget and preferred timeline. We can then discuss suitable properties, timing, funding considerations and realistic exit options.</p>
      <dl><div><dt>Email</dt><dd><a href="mailto:admin@nysarealty.com">admin@nysarealty.com</a></dd></div><div><dt>Call or WhatsApp</dt><dd><a href="tel:+971561021324">+971 56 102 1324</a></dd></div><div><dt>Office</dt><dd>20th Floor, Citadel Tower, Business Bay, Dubai</dd></div></dl>
    </div>
    <div class="contact-form-panel">
      <p class="contact-faq-link">Quick question? <a href="<?php echo esc_url(home_url('/faq/')); ?>">Check our FAQ first.</a></p>
      <div class="contact-confirmation" id="contact-preview-confirmation" role="status" <?php echo $submitted ? '' : 'hidden'; ?>><strong><?php echo $is_staging ? 'Your test enquiry was accepted.' : 'Thank you for contacting NYSA.'; ?></strong><p><?php echo esc_html($submission_message); ?></p></div>
      <?php if ($errors) : ?><div class="contact-errors" role="alert"><strong>Please check the following:</strong><ul><?php foreach ($errors as $error) : ?><li><?php echo esc_html($error); ?></li><?php endforeach; ?></ul></div><?php endif; ?>
      <form class="nysa-contact-form" method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>">
        <?php wp_nonce_field('nysa_contact_form', 'nysa_contact_nonce'); ?><input type="hidden" name="action" value="nysa_contact_enquiry">
        <?php $nysa_form_started_at = time(); ?><input type="hidden" name="nysa_form_started_at" value="<?php echo esc_attr((string) $nysa_form_started_at); ?>"><input type="hidden" name="nysa_form_started_token" value="<?php echo esc_attr(wp_create_nonce('nysa_contact_started_' . $nysa_form_started_at)); ?>">
        <div class="nysa-contact-trap" aria-hidden="true" style="position:absolute;left:-10000px;width:1px;height:1px;overflow:hidden"><label>Leave this field empty<input type="text" name="company_website" value="" tabindex="-1" autocomplete="off"></label></div>
        <div class="form-grid">
          <label><span>Name *</span><input type="text" name="name" autocomplete="name" required></label>
          <label><span>Email *</span><input type="email" name="email" autocomplete="email" required></label>
          <label><span>Phone / WhatsApp *</span><input type="tel" name="phone" autocomplete="tel" required></label>
          <label><span>Country *</span><select name="country" required><option value="">Select one</option><option value="AE">UAE</option><option value="IN">India</option><option value="OTHER">Other country</option></select></label>
          <label><span>I’m interested in</span><select name="interest"><option value="">Select one</option><option value="off-plan">Off-plan property</option><option value="ready">Ready property</option><option value="portfolio">Portfolio review</option><option value="unsure">Not sure yet</option></select></label>
          <label><span>Purpose *</span><select name="purpose" required><option value="">Select one</option><option value="own_use">A home for my own use</option><option value="investment">Investment</option><option value="business">Business use</option><option value="other">Other</option></select></label>
          <label><span>Preferred timeline *</span><select name="timeline" required><option value="">Select one</option><option value="within_3_months">Within 3 months</option><option value="3_to_6_months">3–6 months</option><option value="6_to_12_months">6–12 months</option><option value="over_12_months">More than 12 months</option><option value="not_sure">Not sure yet</option></select></label>
          <label class="form-wide"><span>Approximate budget</span><input type="text" name="budget" placeholder="For example, AED 1.5M–2M"></label>
          <label class="form-wide"><span>How can we help?</span><textarea name="message" rows="5" placeholder="Your goals, preferred timeline or questions"></textarea></label>
        </div>
        <label class="privacy-check"><input type="checkbox" name="privacy" value="1" required><span>I agree that NYSA Realty LLC may use these details to respond to my enquiry.</span></label>
        <label class="privacy-check"><input type="checkbox" name="ai_assisted_contact" value="1"><span>I agree to AI-assisted WhatsApp and email responses from NYSA about this enquiry. I can ask for a person or opt out at any time.</span></label>
        <?php if (function_exists('nysa_contact_turnstile_enabled') && nysa_contact_turnstile_enabled()) : ?><div class="cf-turnstile" data-sitekey="<?php echo esc_attr((string) NYSA_TURNSTILE_SITE_KEY); ?>" data-action="contact_enquiry"></div><?php endif; ?>
        <div class="form-submit"><button type="submit">Send enquiry</button><small><?php echo $is_staging ? 'Staging sends this test enquiry to CRM Test only; customer outreach is disabled.' : 'Your details are sent securely to NYSA.'; ?></small></div>
      </form>
    </div>
  </section>
</main>
<?php require get_template_directory() . '/footer.php'; ?>
