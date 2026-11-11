import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyDigestSmtpFailure, digestEmailSettings, sendProspectDigest } from '../src/prospect-digest-smtp.js';

const secret = 'synthetic credential never exposed';
const env = {
  PROSPECT_DIGEST_EMAIL_ENABLED: 'true',
  PROSPECT_DIGEST_ENVIRONMENT: 'crm-test',
  PROSPECT_DIGEST_TEST_RECIPIENTS: 'admin@example.com',
  PROSPECT_DIGEST_SMTP_SENDER: 'digest@nysarealty.com',
  LEAD_EMAIL_PASSWORD: 'unrelated synthetic credential',
};
const envelope = {
  to: 'admin@example.com', subject: 'Test digest', text: 'Digest test', html: '<p>Digest test</p>',
  messageId: '<prospect-digest-a1@nysarealty.com>',
};

test('CRM Test allow-list and Production off switch stop dispatch before reading the credential', async () => {
  const forbidden = () => assert.fail('credential or transport was accessed');
  for (const config of [{ ...env, PROSPECT_DIGEST_TEST_RECIPIENTS: '' },
    { ...env, PROSPECT_DIGEST_ENVIRONMENT: 'production', PROSPECT_DIGEST_EMAIL_ENABLED: 'false' },
    { ...env, PROSPECT_DIGEST_SMTP_SENDER: 'lead@nysarealty.com' }]) {
    assert.equal((await sendProspectDigest(envelope, { env: config, readPassword: forbidden, createTransport: forbidden })).state, 'skipped');
  }
});

test('only SMTP auth receives the digest credential and errors expose fixed codes', async () => {
  const result = await sendProspectDigest(envelope, {
    env,
    readPassword(file) {
      assert.equal(file, '/home/nysareal/.nysa-secrets/prospect-digest-smtp/crm-test');
      return secret;
    },
    createTransport(options) {
      assert.deepEqual(options.auth, { user: 'digest@nysarealty.com', pass: secret });
      assert.equal(options.logger, false);
      assert.equal(options.debug, false);
      return {
        async sendMail(message) {
          assert.equal(message.to, envelope.to);
          assert.ok(!JSON.stringify(message).includes(secret));
          throw Object.assign(new Error(secret), { code: 'ETIMEDOUT', command: 'DATA' });
        },
        close() {},
      };
    },
  });
  assert.deepEqual(result, { state: 'review', code: 'SMTP_SUBMISSION_UNCERTAIN' });
  assert.ok(!JSON.stringify({ result, settings: digestEmailSettings(env) }).includes(secret));
});

test('only definite connect, TLS and auth failures are retryable', () => {
  for (const [code, command, expected] of [
    ['ECONNREFUSED', 'CONN', 'SMTP_CONNECT_FAILED'],
    ['ETLS', 'CONN', 'SMTP_TLS_FAILED'],
    ['EAUTH', 'AUTH PLAIN', 'SMTP_AUTH_FAILED'],
  ]) {
    assert.deepEqual(classifyDigestSmtpFailure({ code, command }), { state: 'retryable', code: expected });
  }
  for (const [code, command] of [['ETIMEDOUT', 'DATA'], ['ESOCKET', undefined], ['EAUTH', 'DATA']]) {
    assert.equal(classifyDigestSmtpFailure({ code, command }).state, 'review');
  }
});
