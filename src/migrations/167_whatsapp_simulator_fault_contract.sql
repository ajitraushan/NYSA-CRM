-- DEV263: keep the persisted simulator fault contract aligned with the
-- application-level whitelist. This is a forward correction because migration
-- 166 is already installed on CRM Test and must remain immutable.

ALTER TABLE wa_simulated_provider_control
  DROP CONSTRAINT IF EXISTS wa_simulated_provider_control_fault_mode_check;

ALTER TABLE wa_simulated_provider_control
  ADD CONSTRAINT wa_simulated_provider_control_fault_mode_check
  CHECK(fault_mode IN (
    'none',
    'timeout',
    'rate_limited',
    'server_error',
    'invalid_number',
    'invalid_payload',
    'template_paused'
  ));
