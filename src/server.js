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
import listingIntakeRoutes from './routes/listing-intake.js';
import listingMappingRoutes from './routes/listing-mappings.js';
import qualificationFinanceRoutes from './routes/qualification-finance.js';
import filesProposalRoutes from './routes/files-proposals.js';
import dashboardRoutes from './routes/dashboards.js';
import aiRoutes from './routes/ai.js';
import opportunityRoutes from './routes/opportunities.js';
import integrationRoutes from './routes/integrations.js';
import propertyFinderSandboxRoutes from './routes/property-finder-sandbox.js';
import propertyFinderMediaDeliveryRoutes from './routes/property-finder-media-delivery.js';
import diaryRoutes from './routes/diary.js';
import transactionRepresentationRoutes from './routes/transaction-representation.js';
import campaignRoutes from './routes/campaigns.js';
import governedMatchingRoutes from './routes/governed-matching.js';
import inventoryImportRoutes from './routes/inventory-import.js';
import partnerOrganizationRoutes from './routes/partner-organizations.js';
import release3cGovernedShareRoutes from './routes/release3c-governed-shares.js';
import officialDocumentEvidenceRoutes from './routes/official-document-evidence.js';
import dldMarketIntelligenceRoutes from './routes/dld-market-intelligence.js';
import commissionPayoutRoutes from './routes/commission-payout.js';
import agentLeaveRoutes from './routes/agent-leave.js';
import documentComplianceRoutes from './routes/document-compliance.js';
import marketingMaterialComplianceRoutes from './routes/marketing-material-compliance.js';
import emailCalendlyRoutes from './routes/email-calendly.js';
import classificationCatalogueRoutes from './routes/classification-catalogue.js';
import { migrate, closeDatabase } from './db.js';
import { configureHttpServer, createShutdownHandler, writeRuntimeEvent } from './lib/runtime-lifecycle.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = createApp();

app.mount('/api', authRoutes);
app.mount('/api', listingRoutes);
app.mount('/api', commentRoutes);
app.mount('/api', adminRoutes);
app.mount('/api', websiteIntakeRoutes);
app.mount('/api', listingIntakeRoutes);
app.mount('/api', listingMappingRoutes);
app.mount('/api', crmRoutes);
app.mount('/api', governanceRoutes);
app.mount('/api', leadOperationRoutes);
app.mount('/api', qualificationFinanceRoutes);
app.mount('/api', filesProposalRoutes);
app.mount('/api', dashboardRoutes);
app.mount('/api', aiRoutes);
app.mount('/api', opportunityRoutes);
app.mount('/api', integrationRoutes);
app.mount('/api', propertyFinderMediaDeliveryRoutes);
app.mount('/api', propertyFinderSandboxRoutes);
app.mount('/api', diaryRoutes);
app.mount('/api', transactionRepresentationRoutes);
app.mount('/api', campaignRoutes);
app.mount('/api', governedMatchingRoutes);
app.mount('/api', inventoryImportRoutes);
app.mount('/api', partnerOrganizationRoutes);
app.mount('/api', release3cGovernedShareRoutes);
app.mount('/api', officialDocumentEvidenceRoutes);
app.mount('/api', dldMarketIntelligenceRoutes);
app.mount('/api', commissionPayoutRoutes);
app.mount('/api', agentLeaveRoutes);
app.mount('/api', documentComplianceRoutes);
app.mount('/api', marketingMaterialComplianceRoutes);
app.mount('/api', emailCalendlyRoutes);
app.mount('/api', classificationCatalogueRoutes);
app.static(path.join(__dirname, '..', 'public'));

const PORT = process.env.PORT || 3000;
let server;

const shutdown = createShutdownHandler({
  getServer: () => server,
  closeDatabase
});

async function start() {
  writeRuntimeEvent('starting');
  await migrate();
  await new Promise((resolve, reject) => {
    server = app.listen(PORT, () => {
      server.off('error', reject);
      writeRuntimeEvent('listening');
      resolve();
    });
    configureHttpServer(server);
    server.once('error', reject);
  });
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

start().catch(async (error) => {
  console.error('Application startup failed:', error);
  await shutdown('startup-failure', 1);
});
