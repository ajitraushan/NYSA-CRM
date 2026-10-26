const $=s=>document.querySelector(s),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const samples={
  ready:{row:2,id:'A-1204 | Marina Heights | 1,210 sqft | Dubai Marina | Dubai',result:'Ready to create',tone:'ready',action:'Create Draft after commit recheck'},
  active:{row:3,id:'B-804 | Harbour Tower | 980 sqft | Dubai Marina | Dubai',inventoryRef:'NYSA-INV-000241',inventoryId:'7ae398cb-865d-43f0-a70e-8f04a5b22b41',inventoryStatus:'Available',result:'Active duplicate',tone:'blocked',action:'Open existing Inventory'},
  closed:{row:4,id:'V-19 | Palm Villas | 3,850 sqft | Palm Jumeirah | Dubai',inventoryRef:'NYSA-INV-000118',inventoryId:'51a0ef9b-f6d8-4a56-aabc-5821d37ef1d8',inventoryStatus:'Closed',result:'Closed Inventory found',tone:'review',action:'Request Manager reopening'},
  missing:{row:5,id:'C-302 | Building missing | 740 sqft | JVC | Dubai',result:'Incomplete identity',tone:'blocked',action:'Correct workbook row'},
  possible:{row:6,id:'D-910 | Creek Residence | 1,105 sqft | Dubai Creek Harbour | Dubai',inventoryRef:'NYSA-INV-000356',inventoryId:'5debd626-4d36-4e33-bbdb-8d1c42b158f4',inventoryStatus:'Possible match',result:'Possible match',tone:'review',action:'Review existing CRM work item'}
};
const sets={mixed:['ready','active','closed','missing','possible'],active:['active'],closed:['closed'],missing:['missing'],possible:['possible'],ready:['ready']};
function render(){
  const items=sets[$('#scenario').value].map(key=>samples[key]),counts={ready:0,blocked:0,review:0};items.forEach(item=>counts[item.tone]++);
  $('#summary').innerHTML=`<span><b>${items.length}</b> rows reviewed</span><span class="ready"><b>${counts.ready}</b> ready</span><span class="blocked"><b>${counts.blocked}</b> blocked</span><span class="review"><b>${counts.review}</b> needs review</span>`;
  $('#rows').innerHTML=items.map(item=>{const parts=item.id.split(' | ');return`<tr><td>${item.row}</td><td><b>${esc(parts[0])}</b><small>${esc(parts.slice(1).join(' · '))}</small></td><td>${item.inventoryRef?`<button class="record-link" data-inventory-id="${esc(item.inventoryId)}" data-inventory-ref="${esc(item.inventoryRef)}" data-inventory-status="${esc(item.inventoryStatus)}">Open ${esc(item.inventoryRef)}</button><small>Status: ${esc(item.inventoryStatus)}</small>`:'<span class="muted">No matched Inventory</span>'}</td><td><span class="badge ${item.tone}">${esc(item.result)}</span></td><td>${esc(item.action)}</td></tr>`}).join('');
  $('#record-target').hidden=true;
  document.querySelectorAll('[data-inventory-id]').forEach(button=>button.onclick=()=>{const target=$('#record-target');target.hidden=false;target.innerHTML=`<div><p class="eyebrow">INTEGRATED RECORD TARGET</p><h3>${esc(button.dataset.inventoryRef)}</h3><span class="badge review">${esc(button.dataset.inventoryStatus)}</span></div><div><b>CRM integration behavior</b><p>This link opens the actual Inventory detail screen for ${esc(button.dataset.inventoryRef)}. The import row remains uncommitted and no duplicate is created.</p></div>`;target.scrollIntoView({behavior:'smooth',block:'nearest'});});
}
function show(id){document.querySelectorAll('.view').forEach(x=>x.hidden=x.id!==id);document.querySelectorAll('nav button').forEach(x=>x.classList.toggle('active',x.dataset.view===id));if(id==='preview')render();}
document.querySelectorAll('nav button').forEach(button=>button.onclick=()=>show(button.dataset.view));$('#show-preview').onclick=()=>show('preview');$('#scenario').onchange=render;
