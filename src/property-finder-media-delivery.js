import { createHmac, timingSafeEqual } from 'node:crypto';
import { imageDimensions } from './private-files.js';
import { PROPERTY_FINDER_IMAGE_POLICY } from './property-finder-preflight.js';

export const PROPERTY_FINDER_MEDIA_DELIVERY_CONFIRMATION = 'PREPARE_PROPERTY_FINDER_SANDBOX_MEDIA';
const text = value => String(value ?? '').trim();
const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');

function configuredSecret(env = process.env) {
  const secret = text(env.PROPERTY_FINDER_MEDIA_DELIVERY_SECRET);
  return secret.length >= 32 ? secret : null;
}

function configuredOrigin(env = process.env) {
  try {
    const url = new URL(text(env.NYSA_R3B_UAT_BASE_URL));
    if (env.NYSA_DEPLOYMENT_ENV !== 'crm_test' || url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) return null;
    return url.origin;
  } catch { return null; }
}

function jpegComponents(buffer) {
  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) { offset++; continue; }
    const marker = buffer[offset + 1];
    if (marker === 0xd8 || marker === 0xd9) { offset += 2; continue; }
    if (offset + 4 > buffer.length) break;
    const length = buffer.readUInt16BE(offset + 2);
    if (length < 2 || offset + 2 + length > buffer.length) break;
    if ([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)) return buffer[offset + 9];
    offset += 2 + length;
  }
  return null;
}

export function inspectPropertyFinderImage(buffer, mediaType) {
  const dimensions = imageDimensions(buffer, mediaType);
  if (!dimensions) return { eligible: false, blocker: 'Image dimensions could not be verified safely' };
  const { width, height } = dimensions;
  const aspectRatio = width / height;
  let colourSpace = 'sRGB';
  if (mediaType === 'image/jpeg' && jpegComponents(buffer) === 4) return { eligible: false, width, height, blocker: 'CMYK JPEG must be converted to sRGB before Property Finder delivery' };
  if (mediaType === 'image/png' && buffer.length >= 26 && ![2, 3, 6].includes(buffer[25])) return { eligible: false, width, height, blocker: 'PNG must use an RGB colour model before Property Finder delivery' };
  const p = PROPERTY_FINDER_IMAGE_POLICY;
  const eligible = width >= p.minWidth && height >= p.minHeight && width <= p.maxWidth && height <= p.maxHeight && aspectRatio >= p.minAspectRatio && aspectRatio <= p.maxAspectRatio;
  return {
    eligible,
    width,
    height,
    colourSpace,
    blocker: eligible ? null : `Image is ${width} x ${height}; PF requires 800 x 600 to 1920 x 1080 with landscape ratio 1.3:1 to 1.8:1`
  };
}

export function createPropertyFinderMediaDelivery({ media, now = new Date(), env = process.env, lifetimeDays = 8 } = {}) {
  const secret = configuredSecret(env), origin = configuredOrigin(env);
  if (!secret || !origin) return { error: 'CRM-Test PF media delivery is not safely configured' };
  const expiresAt = new Date(now.getTime() + lifetimeDays * 86400000);
  const body = encode({ mediaId: text(media?.id), fileHash: text(media?.fileHash), expiresAt: expiresAt.toISOString(), purpose: 'pf-sandbox-preflight' });
  const signature = createHmac('sha256', secret).update(body).digest('base64url');
  return { deliveryUrl: `${origin}/api/integrations/property-finder/sandbox/media/${body}.${signature}`, availableUntil: expiresAt.toISOString() };
}

export function verifyPropertyFinderMediaDeliveryToken(token, { env = process.env, now = new Date() } = {}) {
  const secret = configuredSecret(env);
  if (!secret || typeof token !== 'string') return { error: 'PF media delivery token is unavailable' };
  const separator = token.lastIndexOf('.');
  if (separator < 1) return { error: 'PF media delivery token is invalid' };
  const body = token.slice(0, separator), supplied = token.slice(separator + 1);
  const expected = createHmac('sha256', secret).update(body).digest('base64url');
  const a = Buffer.from(supplied), b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { error: 'PF media delivery token is invalid' };
  let value;
  try { value = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')); } catch { return { error: 'PF media delivery token is invalid' }; }
  if (value?.purpose !== 'pf-sandbox-preflight' || !text(value.mediaId) || !text(value.fileHash)) return { error: 'PF media delivery token is invalid' };
  const expiresAt = new Date(value.expiresAt);
  if (Number.isNaN(expiresAt.getTime()) || expiresAt <= now) return { error: 'PF media delivery token has expired' };
  return { mediaId: text(value.mediaId), fileHash: text(value.fileHash), expiresAt };
}

export function propertyFinderMediaDeliveryStatus(env = process.env) {
  return { configured: Boolean(configuredSecret(env) && configuredOrigin(env)), crmTestOnly: true, minimumLifetimeDays: 7 };
}
