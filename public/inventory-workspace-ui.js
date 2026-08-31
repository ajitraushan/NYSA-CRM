(function inventoryWorkspaceUI(global) {
  const escapeHtml = value => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  function journeyMarkup({ mode = 'create', verificationStatus = 'unverified', partyCount = 0 } = {}) {
    const detail = mode === 'detail';
    const draftExists = mode !== 'create';
    const activated = ['verified', 'not_required'].includes(verificationStatus);
    const steps = [
      {
        number: 1,
        target: detail ? 'inventory-step-property' : 'listing-form',
        title: 'Build the Inventory draft',
        text: 'Record property identity, commercial terms, source and responsible NYSA agent.',
        state: detail ? 'complete' : 'current',
        label: detail ? 'Draft saved' : mode === 'edit' ? 'Editing property facts' : 'You are here'
      },
      {
        number: 2,
        target: 'inventory-step-authority',
        title: 'Establish authority and activate',
        text: 'Save the owner or represented party first, then submit the evidence for Manager verification.',
        state: !detail ? 'locked' : activated ? 'complete' : 'current',
        label: !detail ? draftExists ? 'Return after saving property facts' : 'Available after draft save' : activated ? 'Inventory active' : partyCount ? 'Ready for verification' : 'Owner and authority required'
      },
      {
        number: 3,
        target: 'inventory-step-external',
        title: 'Prepare an external Listing',
        text: 'Optional and separate. Portal preparation never changes the Internal Inventory record or its owner.',
        state: !detail || !activated ? 'locked' : 'optional',
        label: !detail && draftExists ? 'Return after saving property facts' : activated ? 'Optional next journey' : 'Available after activation'
      }
    ];
    return `<nav class="inventory-journey" aria-label="Inventory journey">${steps.map(step => `<button type="button" class="inventory-journey-step ${step.state}" data-inventory-journey-target="${escapeHtml(step.target)}" ${step.state === 'locked' ? 'disabled aria-disabled="true"' : ''}><b>${step.number}</b><span><strong>${escapeHtml(step.title)}</strong><small>${escapeHtml(step.text)}</small><em>${escapeHtml(step.label)}</em></span></button>`).join('')}</nav>`;
  }

  function sectionHeading(number, title, guidance) {
    return `<div class="span3 inventory-form-section-heading"><b>${escapeHtml(number)}</b><span><strong>${escapeHtml(title)}</strong><small>${escapeHtml(guidance)}</small></span></div>`;
  }

  global.NysaInventoryWorkspaceUI = Object.freeze({ journeyMarkup, sectionHeading });
})(globalThis);
