/* Shared presentation for governed review actions. Forms retain their handlers,
   validation and authorization; this component never submits a decision. */
(()=>{
  const screens=[
    ['[data-compliance-review]','Review this signed document'],
    ['[data-official-review]','Review this official document'],
    ['#customer-kyc-form','Review customer identity'],
    ['[data-customer-change-decision]','Review the customer change'],
    ['#customer-duplicate-review-form','Review the customer duplicate'],
    ['#partner-duplicate-decision','Review the partner duplicate'],
    ['#partner-verification-decision','Review partner verification'],
    ['[data-developer-arrangement-review]','Review the developer arrangement'],
    ['[data-property-noc-review], [data-listing-noc-review]','Review the property NOC'],
    ['#verify-form, #inventory-verification-decision-form','Review inventory verification'],
    ['#proposal-review-confirmation','Review the proposal'],
    ['#deal-approval-form','Review Deal closure'],
    ['[data-batch-decision]','Review commission payments'],
    ['#leave-decision-form','Review the leave application'],
    ['.marketing-channel-decision','Review the marketing channel request']
  ];
  const decorate=(form,title)=>{
    if(form.dataset.reviewPanelApplied)return;
    form.dataset.reviewPanelApplied='true';
    const details=form.closest('details');
    if(details){
      details.classList.add('review-action-panel');
      details.open=true;
      details.querySelector('summary')?.classList.add('review-action-heading');
    }else{
      form.classList.add('review-action-panel');
      const heading=document.createElement('h3');
      heading.className='review-action-heading span3';
      heading.textContent=`Next step: ${title.toLowerCase()}`;
      form.prepend(heading);
    }
  };
  const apply=(root=document)=>{
    for(const [selector,title] of screens){
      if(root.matches?.(selector))decorate(root,title);
      root.querySelectorAll(selector).forEach(form=>decorate(form,title));
    }
  };
  window.NysaReviewPanel=Object.freeze({apply,screens});
  apply();
  new MutationObserver(records=>{
    for(const record of records)for(const node of record.addedNodes)
      if(node.nodeType===1)apply(node);
  }).observe(document.body,{childList:true,subtree:true});
})();
