import { Router } from '../lib/http-kit.js';
import { one, many, execute, uuid, audit } from '../db.js';
import { requireAuth, notViewer } from '../auth.js';

const r = Router();
r.use(requireAuth);
const EDIT_WINDOW_MINUTES = 15;

r.get('/listings/:id/comments', async (req, res) => {
  const listing = await one('SELECT id FROM listings WHERE id = $1 AND deleted_at IS NULL', [req.params.id]);
  if (!listing) return res.status(404).json({ error: 'Listing not found' });
  const rows = await many(`SELECT c.id, c.listing_id, c.body, c.parent_comment_id, c.created_at, c.edited_at,
    b.id AS author_id, b.name AS author_name, b.brokerage AS author_brokerage
    FROM comments c JOIN brokers b ON b.id = c.author_id
    WHERE c.listing_id = $1 AND c.deleted_at IS NULL ORDER BY c.created_at ASC`, [req.params.id]);
  res.json({ count: rows.length, comments: rows });
});

r.post('/listings/:id/comments', notViewer, async (req, res) => {
  const listing = await one('SELECT id FROM listings WHERE id = $1 AND deleted_at IS NULL', [req.params.id]);
  if (!listing) return res.status(404).json({ error: 'Listing not found' });
  const { body, parentCommentId } = req.body || {};
  if (!body || !body.trim()) return res.status(400).json({ error: 'Comment body is required' });
  if (parentCommentId) {
    const parent = await one('SELECT id FROM comments WHERE id = $1 AND listing_id = $2 AND deleted_at IS NULL', [parentCommentId, req.params.id]);
    if (!parent) return res.status(400).json({ error: 'Parent comment not found on this listing' });
  }
  const id = uuid();
  const comment = await one(`INSERT INTO comments (id, listing_id, author_id, body, parent_comment_id)
    VALUES ($1,$2,$3,$4,$5) RETURNING *`, [id,req.params.id,req.broker.id,body.trim(),parentCommentId||null]);
  res.status(201).json(comment);
});

function withinEditWindow(comment) {
  return Date.now() - new Date(comment.createdAt).getTime() <= EDIT_WINDOW_MINUTES * 60 * 1000;
}

r.patch('/comments/:id', async (req, res) => {
  const comment = await one('SELECT * FROM comments WHERE id = $1 AND deleted_at IS NULL', [req.params.id]);
  if (!comment) return res.status(404).json({ error: 'Comment not found' });
  if (comment.authorId !== req.broker.id) return res.status(403).json({ error: 'You can only edit your own comments' });
  if (!withinEditWindow(comment)) return res.status(403).json({ error: `Comments can only be edited within ${EDIT_WINDOW_MINUTES} minutes of posting` });
  const { body } = req.body || {};
  if (!body || !body.trim()) return res.status(400).json({ error: 'Comment body is required' });
  res.json(await one('UPDATE comments SET body=$1, edited_at=NOW() WHERE id=$2 RETURNING *', [body.trim(),comment.id]));
});

r.delete('/comments/:id', async (req, res) => {
  const comment = await one('SELECT * FROM comments WHERE id = $1 AND deleted_at IS NULL', [req.params.id]);
  if (!comment) return res.status(404).json({ error: 'Comment not found' });
  const isAdmin = req.broker.role === 'admin';
  const isAuthor = comment.authorId === req.broker.id;
  if (!isAdmin && !isAuthor) return res.status(403).json({ error: 'You can only delete your own comments' });
  if (isAuthor && !isAdmin && !withinEditWindow(comment)) return res.status(403).json({ error: 'Own comments can only be deleted within the edit window; ask an admin' });
  await execute('UPDATE comments SET deleted_at=NOW() WHERE id=$1', [comment.id]);
  if (isAdmin && !isAuthor) await audit('Comment', comment.id, 'moderated_deleted', req.broker.id, { listingId:comment.listingId });
  res.json({ ok:true });
});

export default r;
