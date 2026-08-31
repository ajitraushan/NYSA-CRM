# CRM Test dev.162 — UAT-080 Complete Questionnaire Hotfix

## Outcome sought

Restore the blocked Lead qualification-model administration journey by replacing the incomplete native numeric prompt with the complete maintained questionnaire.

## UAT-080 observed defect

- Role: Full Administrator.
- Workspace: Administration → Lead qualification models → Test questionnaire.
- Expected: every configured question renders with its maintained answer format and choices before the model is approved.
- Actual on dev.161: the action opened one native numeric prompt at a time. A `single_select` question did not display its maintained choices.
- Severity: Blocker. The Administrator could not complete reliable model testing and therefore could not safely approve and activate the model needed for Lead qualification.
- Human retest status: failed on dev.161; pending on dev.162.

## Confirmed RCA

The Administrator test handler did not reuse the governed questionnaire renderer. It always invoked `prompt()` with a numeric range and converted the response with `Number()`, regardless of the factor's `answerType` or `answerOptions`. The agent-facing questionnaire already had the correct renderer, so the defect was isolated to the Administrator test wiring.

## Implemented correction

- The Administrator test action now opens a governed modal containing the complete questionnaire.
- `single_select` factors display every maintained answer label and its configured score value.
- `yes_no` factors display explicit Yes and No choices.
- numeric/scale factors display a bounded numeric input using the maintained minimum and maximum.
- Every question displays its help text, required marker, weight, and answer-format guidance.
- Submission calls the existing model-test endpoint and displays temperature, score, and per-factor contributions.
- The modal explicitly states that the test does not save a Lead assessment.
- Native `prompt()` and `alert()` are not used.

## Verification

- Dev.162 UAT-080 questionnaire wiring tests: 2/2 passed.
- Dev.161 UAT-079 browser wiring regression: 1/1 passed.
- Dev.160 UAT-070–079 correction tests: 4/4 passed.
- Full ordinary regression: 1,199 total; 1,172 passed; 0 failed; 27 protected tests skipped by the ordinary runner.
- No database migration is introduced. The latest migration remains `104_dev160_uat070_079_journey_unblock.sql` (104 total).

## Deployment boundary

- Target: CRM Test only.
- Property Finder remains disabled and excluded.
- Microsoft 365 and Calendly integration switches remain disabled.
- Production and the Production/R2 clone are protected and must not be targeted.

## Required human retest

1. Sign in to CRM Test as Full Administrator.
2. Open Administration → Lead qualification models.
3. Open the intended draft model and choose **Test questionnaire**.
4. Confirm the entire questionnaire opens in one modal.
5. Confirm dropdown questions show all maintained answer choices.
6. Confirm Yes/No questions show explicit choices.
7. Confirm numeric questions show the configured minimum and maximum.
8. Confirm question text, help text, required status, and weight are visible.
9. Complete all required answers and choose **Calculate test result**.
10. Confirm temperature, total score, and factor contributions are shown.
11. Confirm no Lead assessment or Lead status was created or changed.

Only the user's observed CRM Test result may change UAT-080 from failed/pending to passed.
