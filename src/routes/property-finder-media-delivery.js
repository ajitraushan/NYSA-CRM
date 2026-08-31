import { Router } from '../lib/http-kit.js';
import { one } from '../db.js';
import { readPrivate } from '../private-files.js';
import { verifyPropertyFinderMediaDeliveryToken } from '../property-finder-media-delivery.js';

const r = Router();

r.get('/integrations/property-finder/sandbox/media/:token', async (req, res) => {
  const verified = verifyPropertyFinderMediaDeliveryToken(req.params.token);
  if (verified.error) return res.status(404).json({ error: 'PF sandbox media delivery is unavailable' });
  const media = await one(`SELECT id,storage_key,file_hash,media_type,file_name,approval_status,usage_rights_confirmed,rights_expires_at
    FROM property_media WHERE id=$1`, [verified.mediaId]);
  if (!media || media.fileHash !== verified.fileHash || media.approvalStatus !== 'approved' || media.usageRightsConfirmed !== true
    || (media.rightsExpiresAt && new Date(media.rightsExpiresAt) <= verified.expiresAt)) return res.status(404).json({ error: 'PF sandbox media delivery is unavailable' });
  const data = await readPrivate(media.storageKey);
  res.setHeader('Content-Type', media.mediaType);
  res.setHeader('Content-Length', data.length);
  res.setHeader('Content-Disposition', `inline; filename="${media.fileName.replace(/"/g, '')}"`);
  res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
  res.end(data);
});

export default r;
