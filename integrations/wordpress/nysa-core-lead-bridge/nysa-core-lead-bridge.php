<?php
/**
 * Plugin Name: NYSA CORE Lead Bridge
 * Description: Durable signed delivery of NIA and contact-form enquiries into NYSA CORE.
 * Version: 1.1.0
 */

if (!defined('ABSPATH')) exit;

final class NYSA_Core_Lead_Bridge {
    private const DB_VERSION = '1.0.0';
    private const CRON_HOOK = 'nysa_core_lead_bridge_retry';
    private const CONTACT_STATEMENT = 'nysa-ai-assisted-response-v1';
    private const NIA_STATEMENT = 'nysa-nia-response-v1';

    public static function init(): void {
        add_action('init', [__CLASS__, 'ensure_journey_cookie'], 1);
        add_action('nysa_contact_lead_saved', [__CLASS__, 'capture_contact_saved'], 10, 2);
        add_filter('rest_request_after_callbacks', [__CLASS__, 'capture_nia'], 10, 3);
        add_action(self::CRON_HOOK, [__CLASS__, 'retry_due']);
        add_filter('cron_schedules', static function (array $schedules): array {
            $schedules['nysa_five_minutes'] = ['interval' => 300, 'display' => 'Every five minutes'];
            return $schedules;
        });
        if (!wp_next_scheduled(self::CRON_HOOK)) wp_schedule_event(time() + 60, 'nysa_five_minutes', self::CRON_HOOK);
    }

    public static function activate(): void {
        global $wpdb;
        require_once ABSPATH . 'wp-admin/includes/upgrade.php';
        $table = self::table();
        $charset = $wpdb->get_charset_collate();
        dbDelta("CREATE TABLE {$table} (
            id bigint unsigned NOT NULL AUTO_INCREMENT,
            event_id varchar(160) NOT NULL,
            source_route varchar(40) NOT NULL,
            payload longtext NOT NULL,
            state varchar(30) NOT NULL DEFAULT 'queued',
            attempts int unsigned NOT NULL DEFAULT 0,
            next_attempt_at datetime NOT NULL,
            response_code int unsigned NULL,
            core_lead_id varchar(80) NULL,
            core_case_id varchar(80) NULL,
            safe_error varchar(80) NULL,
            created_at datetime NOT NULL,
            updated_at datetime NOT NULL,
            PRIMARY KEY (id),
            UNIQUE KEY event_id (event_id),
            KEY due (state,next_attempt_at)
        ) {$charset};");
        update_option('nysa_core_lead_bridge_db_version', self::DB_VERSION, false);
    }

    private static function table(): string {
        global $wpdb;
        return $wpdb->prefix . 'nysa_core_lead_outbox';
    }

    private static function configured(): bool {
        return defined('NYSA_CORE_INTAKE_URL') && defined('NYSA_CORE_INTAKE_SECRET')
            && str_starts_with((string) NYSA_CORE_INTAKE_URL, 'https://')
            && strlen((string) NYSA_CORE_INTAKE_SECRET) >= 32;
    }

    public static function ensure_journey_cookie(): void {
        if (headers_sent() || !empty($_COOKIE['nysa_core_journey'])) return;
        $value = str_replace('-', '', wp_generate_uuid4());
        setcookie('nysa_core_journey', $value, [
            'expires' => time() + YEAR_IN_SECONDS,
            'path' => COOKIEPATH ?: '/',
            'domain' => defined('COOKIE_DOMAIN') ? COOKIE_DOMAIN : '',
            'secure' => is_ssl(),
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
        $_COOKIE['nysa_core_journey'] = $value;
    }

    private static function journey_key(string $fallback): string {
        $cookie = sanitize_text_field(wp_unslash($_COOKIE['nysa_core_journey'] ?? ''));
        return preg_match('/^[A-Za-z0-9_-]{16,120}$/', $cookie) ? $cookie : hash('sha256', $fallback);
    }

    private static function parse_budget(string $value): array {
        preg_match_all('/([0-9]+(?:[.,][0-9]+)?)\s*([kKmM])?/', str_replace(',', '', $value), $matches, PREG_SET_ORDER);
        $amounts = [];
        foreach ($matches as $match) {
            $amount = (float) $match[1];
            if (strtolower($match[2] ?? '') === 'k') $amount *= 1000;
            if (strtolower($match[2] ?? '') === 'm') $amount *= 1000000;
            if ($amount > 0) $amounts[] = $amount;
        }
        return ['min' => $amounts[0] ?? null, 'max' => $amounts[1] ?? ($amounts[0] ?? null)];
    }

    private static function location(string $country): array {
        if ($country === 'AE') return ['country' => 'AE', 'timeZone' => 'Asia/Dubai', 'confirmed' => true];
        if ($country === 'IN') return ['country' => 'IN', 'timeZone' => 'Asia/Kolkata', 'confirmed' => true];
        return ['country' => null, 'timeZone' => null, 'confirmed' => false];
    }

    private static function contact_payload(array $raw): ?array {
        $name = trim(sanitize_text_field($raw['name'] ?? ''));
        $email = trim(sanitize_email($raw['email'] ?? ''));
        $phone = trim(sanitize_text_field($raw['phone'] ?? ''));
        $interest = sanitize_key($raw['interest'] ?? '');
        $purpose = sanitize_key($raw['purpose'] ?? '');
        $timeline = sanitize_key($raw['timeline'] ?? '');
        $country = strtoupper(sanitize_text_field($raw['country'] ?? ''));
        if ($name === '' || !is_email($email) || $phone === ''
            || !in_array($purpose, ['own_use', 'investment', 'business', 'other'], true)
            || !in_array($timeline, ['within_3_months', '3_to_6_months', '6_to_12_months', 'over_12_months', 'not_sure'], true)
            || !in_array($country, ['AE', 'IN', 'OTHER'], true)) return null;
        $budget = self::parse_budget(sanitize_text_field($raw['budget'] ?? ''));
        $business_types = ['off-plan' => 'Off-plan', 'ready' => 'Sale', 'portfolio' => 'Sale', 'unsure' => 'Unconfirmed'];
        $property_types = $interest && $interest !== 'unsure' ? [$interest] : [];
        $lead_id = absint($raw['lead_id'] ?? 0);
        $event_hash = hash('sha256', implode('|', [$lead_id, strtolower($email), preg_replace('/\D+/', '', $phone)]));
        $ai_consent = !empty($raw['ai_assisted_contact']);
        return [
            'eventId' => 'wp-contact-' . $event_hash,
            'journeyKey' => self::journey_key($event_hash),
            'source' => 'Website',
            'sourceWebsite' => strtolower((string) ($raw['source_host'] ?? ($_SERVER['HTTP_HOST'] ?? 'nysarealty.com'))),
            'page' => home_url('/contact-us/'),
            'form' => 'contact_enquiry_v2',
            'formVersion' => '2.0.0',
            'intakeCompleteness' => 'complete',
            'title' => 'Website contact enquiry',
            'businessType' => $business_types[$interest] ?? 'Unconfirmed',
            'contact' => ['fullName' => $name, 'email' => $email, 'phone' => $phone, 'preferredChannel' => 'WhatsApp'],
            'location' => self::location($country),
            'requirement' => [
                'purpose' => $purpose,
                'timelineCode' => $timeline,
                'fundingMethod' => 'unknown',
                'budgetMin' => $budget['min'],
                'budgetMax' => $budget['max'],
                'propertyTypes' => $property_types,
                'areas' => [],
                'notes' => sanitize_textarea_field($raw['message'] ?? ''),
            ],
            'consent' => [
                'marketing' => false,
                'statementVersion' => self::CONTACT_STATEMENT,
                'aiWhatsapp' => $ai_consent,
                'aiEmail' => $ai_consent,
            ],
            'sourceEvidence' => ['formVersion' => '2.0.0', 'sourceSpecific' => ['entryRoute' => 'contact_form']],
        ];
    }

    public static function capture_contact_saved($lead_id, $submitted): void {
        if (!is_array($submitted)) return;
        $submitted['lead_id'] = absint($lead_id);
        $payload = self::contact_payload($submitted);
        if ($payload) self::enqueue('contact_form', $payload);
    }

    private static function nia_answer(array $raw, array $answers, string $key): array {
        foreach (['requirement', 'profile'] as $section) {
            if (is_array($raw[$section] ?? null) && is_array($raw[$section][$key] ?? null)) {
                return $raw[$section][$key];
            }
        }
        return is_array($answers[$key] ?? null) ? $answers[$key] : [];
    }

    private static function nia_answer_code(array $raw, array $answers, string $key): string {
        $value = self::nia_answer($raw, $answers, $key)['value'] ?? '';
        return is_string($value) ? sanitize_key($value) : '';
    }

    private static function nia_answer_codes(array $raw, array $answers, string $key): array {
        $value = self::nia_answer($raw, $answers, $key)['value'] ?? [];
        if (!is_array($value)) $value = $value === '' ? [] : [$value];
        return array_values(array_filter(array_map(static fn($item) => is_string($item) ? sanitize_key($item) : '', $value)));
    }

    private static function nia_labels(array $codes, array $map): array {
        $labels = [];
        foreach ($codes as $code) if (isset($map[$code])) $labels[] = $map[$code];
        return array_values(array_unique($labels));
    }

    private static function nia_payload(WP_REST_Request $request): ?array {
        $raw = $request->get_json_params();
        if (!is_array($raw)) $raw = $request->get_params();
        $name = trim(sanitize_text_field($raw['name'] ?? ''));
        $email = sanitize_email($raw['email'] ?? '');
        $phone = sanitize_text_field($raw['phone'] ?? '');
        $contact = sanitize_text_field($raw['contact'] ?? '');
        if (!$email && is_email($contact)) $email = $contact;
        if (!$phone && $contact && !is_email($contact)) $phone = $contact;
        if ($email && !is_email($email)) $email = '';
        if ($name === '' || (!$email && !$phone)) return null;
        $answers = is_array($raw['answers'] ?? null) ? $raw['answers'] : [];
        if (!$answers && is_array($raw['answers_json'] ?? null)) $answers = $raw['answers_json'];
        if (!$answers && is_string($raw['answers_json'] ?? null)) {
            $decoded_answers = json_decode((string) $raw['answers_json'], true);
            if (is_array($decoded_answers)) $answers = $decoded_answers;
        }
        $status = sanitize_key($raw['status'] ?? 'partial');
        $lead_key = sanitize_text_field($raw['lead_key'] ?? $raw['assessment_id'] ?? hash('sha256', strtolower($name . '|' . $email . '|' . $phone)));
        $event_hash = hash('sha256', wp_json_encode([$lead_key, $status, $answers]));
        $completed = in_array($status, ['advisory_completed', 'property_shortlist_completed', 'completed', 'advisor_requested'], true);

        $property_code = self::nia_answer_code($raw, $answers, 'property');
        $timing_code = self::nia_answer_code($raw, $answers, 'timing');
        $outcome_code = self::nia_answer_code($raw, $answers, 'outcome');
        $bedroom_code = self::nia_answer_code($raw, $answers, 'bedrooms');
        $readiness_code = self::nia_answer_code($raw, $answers, 'readiness');
        $property_types = self::nia_labels([$property_code], [
            'apartment' => 'Apartment', 'villa' => 'Villa', 'townhouse' => 'Townhouse', 'land' => 'Land',
        ]);
        $timeline_codes = [
            '30' => 'within_30_days', '1-3' => 'within_3_months', '3-6' => '3_to_6_months',
            '6-12' => '6_to_12_months', '12' => 'over_12_months', 'open' => 'not_sure',
        ];
        $purpose = in_array($outcome_code, ['income', 'growth', 'balanced'], true) ? 'investment'
            : (in_array($outcome_code, ['home', 'holiday', 'uae'], true) ? 'own_use' : 'other');
        $bedrooms_min = null;
        $bedrooms_max = null;
        if ($bedroom_code === 'studio') $bedrooms_min = $bedrooms_max = 0;
        elseif (in_array($bedroom_code, ['1', '2', '3'], true)) $bedrooms_min = $bedrooms_max = (int) $bedroom_code;
        elseif ($bedroom_code === '4') $bedrooms_min = 4;

        $confidence = self::nia_labels(self::nia_answer_codes($raw, $answers, 'confidence'), [
            'afford' => 'Comfortable budget', 'costs' => 'Total purchase costs', 'rent' => 'Expected rental income',
            'value' => 'Potential value growth', 'area' => 'Right area', 'compare' => 'Ready versus off-plan comparison',
            'finance' => 'Financing or payment plans', 'resale' => 'Resale flexibility', 'advisor' => 'Advisor guidance',
        ]);
        $location_priorities = self::nia_labels(self::nia_answer_codes($raw, $answers, 'location'), [
            'tenants' => 'Tenant demand', 'growth' => 'Future development and price growth', 'resale' => 'Established area and resale',
            'transport' => 'Work, public transport or road connections', 'family' => 'Schools, parks and family facilities',
            'lifestyle' => 'Waterfront, views and lifestyle', 'guide' => 'Location guidance requested',
        ]);
        $usage_preferences = self::nia_labels([self::nia_answer_code($raw, $answers, 'user')], [
            'tenant' => 'Long-term tenant use', 'guests' => 'Short-term or holiday guests', 'family' => 'Personal or family use',
            'mixed' => 'Personal use and renting', 'unsure' => 'Intended use not decided',
        ]);
        $readiness_preferences = self::nia_labels([$readiness_code], [
            'ready' => 'Ready property', 'offplan' => 'Off-plan property', 'compare' => 'Compare ready and off-plan',
        ]);
        $land_preferences = self::nia_labels([self::nia_answer_code($raw, $answers, 'land')], [
            'home' => 'Land to build a home', 'develop' => 'Land for residential development',
            'hold' => 'Land held for potential future value', 'guidance' => 'Land guidance requested',
        ]);
        $space_preferences = self::nia_labels([self::nia_answer_code($raw, $answers, 'space')], [
            'compact' => 'Compact home or studio', '1-2' => 'One or two bedrooms', '3' => 'Three bedrooms',
            '4' => 'Four or more bedrooms', 'land' => 'Land for a future home or development', 'open' => 'Space guidance requested',
        ]);
        $preferences = array_values(array_unique(array_merge($usage_preferences, $readiness_preferences, $land_preferences, $space_preferences)));
        $business_type = $readiness_code === 'offplan' ? 'Off-plan' : ($readiness_code === 'ready' ? 'Sale' : 'Unconfirmed');
        $preferred_channel = sanitize_key($raw['contact_method'] ?? '') === 'email' && $email ? 'Email' : ($phone ? 'WhatsApp' : 'Email');
        $normalization = [
            'propertyCode' => $property_code, 'timingCode' => $timing_code, 'outcomeCode' => $outcome_code,
            'bedroomCode' => $bedroom_code, 'readinessCode' => $readiness_code,
        ];
        $payload = [
            'eventId' => 'wp-nia-' . $event_hash,
            'journeyKey' => self::journey_key($lead_key),
            'source' => 'Website',
            'sourceWebsite' => strtolower((string) ($_SERVER['HTTP_HOST'] ?? 'nysarealty.com')),
            'page' => esc_url_raw((string) ($raw['page_url'] ?? home_url('/investor-profile/'))),
            'form' => $completed ? 'ai_property_selection_v1' : 'ai_advisory_v1',
            'formVersion' => 'nia-core-bridge-1.1.0',
            'intakeCompleteness' => $completed ? 'complete' : 'partial',
            'title' => 'NIA website enquiry',
            'businessType' => $business_type,
            'contact' => ['fullName' => $name, 'email' => $email ?: null, 'phone' => $phone ?: null, 'preferredChannel' => $preferred_channel],
            'location' => ['country' => null, 'timeZone' => null, 'confirmed' => false],
            'requirement' => [
                'purpose' => $purpose,
                'timelineCode' => $timeline_codes[$timing_code] ?? 'to_be_confirmed',
                'fundingMethod' => 'unknown',
                'propertyTypes' => $property_types,
                'areas' => [],
                'bedroomsMin' => $bedrooms_min,
                'bedroomsMax' => $bedrooms_max,
                'notes' => sanitize_textarea_field($raw['message'] ?? ''),
            ],
            'consent' => ['marketing' => false, 'statementVersion' => self::NIA_STATEMENT, 'aiWhatsapp' => false, 'aiEmail' => false],
            'sourceEvidence' => ['formVersion' => 'nia-core-bridge-1.1.0', 'sourceSpecific' => [
                'entryRoute' => 'nia', 'status' => $status, 'answers' => $answers,
                'profile' => is_array($raw['profile'] ?? null) ? $raw['profile'] : [],
                'requirement' => is_array($raw['requirement'] ?? null) ? $raw['requirement'] : [],
                'normalization' => $normalization,
            ]],
        ];
        if ($completed) {
            $payload['profile'] = [
                'sourceCode' => 'investment_profile',
                'sourceVersion' => 'nia-core-bridge-1.1.0',
                'completedAt' => gmdate('c'),
                'declaredPriorities' => array_values(array_unique(array_merge($confidence, $location_priorities))),
                'mustHaves' => [],
                'preferences' => $preferences,
                'exclusions' => [],
                'acceptableTradeOffs' => $readiness_code === 'compare' ? ['Ready or off-plan'] : [],
            ];
        }
        return $payload;
    }

    public static function capture_nia($response, $handler, WP_REST_Request $request) {
        if ($request->get_route() !== '/nysa/v2/advisory-assessments') return $response;
        $status = method_exists($response, 'get_status') ? (int) $response->get_status() : 500;
        if ($status < 200 || $status >= 300) return $response;
        $payload = self::nia_payload($request);
        if ($payload) self::enqueue('nia', $payload);
        return $response;
    }

    private static function enqueue(string $route, array $payload): void {
        global $wpdb;
        $now = current_time('mysql', true);
        $wpdb->query($wpdb->prepare("INSERT IGNORE INTO " . self::table() . "
            (event_id,source_route,payload,state,attempts,next_attempt_at,created_at,updated_at)
            VALUES(%s,%s,%s,'queued',0,%s,%s,%s)", $payload['eventId'], $route, wp_json_encode($payload), $now, $now, $now));
        $id = (int) $wpdb->get_var($wpdb->prepare('SELECT id FROM ' . self::table() . ' WHERE event_id=%s', $payload['eventId']));
        if ($id) self::deliver($id);
    }

    private static function deliver(int $id): void {
        global $wpdb;
        $table = self::table();
        $row = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$table} WHERE id=%d", $id), ARRAY_A);
        if (!$row || $row['state'] === 'accepted') return;
        if (!self::configured()) {
            $wpdb->update($table, ['state' => 'needs_setup', 'safe_error' => 'CORE_NOT_CONFIGURED', 'updated_at' => current_time('mysql', true)], ['id' => $id]);
            return;
        }
        $timestamp = (string) round(microtime(true) * 1000);
        $body = (string) $row['payload'];
        $signature = hash_hmac('sha256', $timestamp . '.' . $body, (string) NYSA_CORE_INTAKE_SECRET);
        $result = wp_remote_post((string) NYSA_CORE_INTAKE_URL, [
            'timeout' => 10,
            'redirection' => 0,
            'headers' => ['Content-Type' => 'application/json', 'X-NYSA-Timestamp' => $timestamp, 'X-NYSA-Signature' => 'sha256=' . $signature],
            'body' => $body,
            'data_format' => 'body',
        ]);
        $attempts = (int) $row['attempts'] + 1;
        if (is_wp_error($result)) {
            self::reschedule($id, $attempts, 'CORE_UNAVAILABLE');
            return;
        }
        $code = (int) wp_remote_retrieve_response_code($result);
        $response = json_decode((string) wp_remote_retrieve_body($result), true);
        if ($code >= 200 && $code < 300 && is_array($response) && !empty($response['leadId']) && !empty($response['followUpCaseId'])) {
            $wpdb->update($table, [
                'state' => 'accepted', 'attempts' => $attempts, 'response_code' => $code, 'payload' => '{}',
                'core_lead_id' => sanitize_text_field($response['leadId']),
                'core_case_id' => sanitize_text_field($response['followUpCaseId'] ?? ''),
                'safe_error' => null, 'updated_at' => current_time('mysql', true),
            ], ['id' => $id]);
            return;
        }
        if ($code >= 200 && $code < 300 && is_array($response) && !empty($response['leadId'])
            && ($response['followUpStatus'] ?? '') === 'setup_required') {
            $wpdb->query($wpdb->prepare("UPDATE {$table} SET state=%s,attempts=%d,response_code=%d,safe_error=%s,
                next_attempt_at=DATE_ADD(UTC_TIMESTAMP(), INTERVAL 5 MINUTE),updated_at=UTC_TIMESTAMP() WHERE id=%d",
                $attempts >= 10 ? 'needs_review' : 'needs_setup', $attempts, $code, 'CORE_CASE_SETUP_REQUIRED', $id));
            return;
        }
        if ($code >= 400 && $code < 500 && $code !== 409 && $code !== 429) {
            $wpdb->update($table, ['state' => 'needs_review', 'attempts' => $attempts, 'response_code' => $code, 'safe_error' => 'CORE_REJECTED', 'updated_at' => current_time('mysql', true)], ['id' => $id]);
            return;
        }
        self::reschedule($id, $attempts, 'CORE_RETRY_REQUIRED', $code);
    }

    private static function reschedule(int $id, int $attempts, string $error, int $code = 0): void {
        global $wpdb;
        $delay = min(3600, 30 * (2 ** min($attempts, 7)));
        $state = $attempts >= 10 ? 'needs_review' : 'queued';
        $wpdb->query($wpdb->prepare('UPDATE ' . self::table() . ' SET state=%s,attempts=%d,response_code=%s,safe_error=%s,next_attempt_at=DATE_ADD(UTC_TIMESTAMP(), INTERVAL %d SECOND),updated_at=UTC_TIMESTAMP() WHERE id=%d',
            $state, $attempts, $code ?: null, $error, $delay, $id));
    }

    public static function retry_due(): void {
        global $wpdb;
        $ids = $wpdb->get_col("SELECT id FROM " . self::table() . " WHERE state IN ('queued','needs_setup') AND next_attempt_at<=UTC_TIMESTAMP() ORDER BY next_attempt_at,id LIMIT 20");
        foreach ($ids as $id) self::deliver((int) $id);
    }
}

register_activation_hook(__FILE__, ['NYSA_Core_Lead_Bridge', 'activate']);
NYSA_Core_Lead_Bridge::init();
