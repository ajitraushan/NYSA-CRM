import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './lib/http-kit.js';
import authRoutes from './routes/auth.js';
import listingRoutes from './routes/listings.js';
import commentRoutes from './routes/comments.js';
import adminRoutes from './routes/admin.js';
import crmRoutes from './routes/crm.js';
import governanceRoutes from './routes/governance.js';
import leadOperationRoutes from './routes/lead-operations.js';
import websiteIntakeRoutes from './routes/website-intake.js';
import qualificationFinanceRoutes from './routes/qualification-finance.js';
import filesProposalRoutes from './routes/files-proposals.js';
import dashboardRoutes from './routes/dashboards.js';
import { migrate, closeDatabase } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = createApp();

app.mount('/api', authRoutes);
app.mount('/api', listingRoutes);
app.mount('/api', commentRoutes);
app.mount('/api', adminRoutes);
app.mount('/api', websiteIntakeRoutes);
app.mount('/api', crmRoutes);
app.mount('/api', governanceRoutes);
app.mount('/api', leadOperationRoutes);
app.mount('/api', qualificationFinanceRoutes);
app.mount('/api', filesProposalRoutes);
app.mount('/api', dashboardRoutes);
app.static(path.join(__dirname, '..', 'public'));

const PORT = process.env.PORT || 3000;
let server;

async function start() {
  await migrate();
  server = app.listen(PORT, () => console.log(`NYSA CRM running at http://localhost:${PORT}`));
}

async function shutdown() {
  if (!server) {
    await closeDatabase();
    process.exit(0);
  }

  server.close(async () => {
    await closeDatabase();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

start().catch(async (error) => {
  console.error('Application startup failed:', error);
  await closeDatabase().catch(() => {});
  process.exit(1);
});
