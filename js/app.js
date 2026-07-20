
const APP_VERSION='2.0.0';
let album=null;
let state={counts:{},updatedAt:null};
let deferredPrompt=null;
const $=id=>document.getElementById(id);

async function init(){
  album=await fetch('./data/album.json',{cache:'no-store'}).then(r=>r.json());
  loadState();
  buildSectionSelect();
  bindEvents();
  renderAll();
  if('serviceWorker' in navigator) navigator.serviceWorker.register('./service-worker.js');
}
function loadState(){
  try{
    const raw=localStorage.getItem(album.storageKey);
    if(raw){
      const parsed=JSON.parse(raw);
      state={counts:parsed.counts||{},updatedAt:parsed.updatedAt||null};
    }
  }catch(e){console.warn(e)}
}
function save(){
  state.updatedAt=new Date().toISOString();
  localStorage.setItem(album.storageKey,JSON.stringify(state));
  $('saveState').textContent='Guardado '+new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
}
function count(id){return Number(state.counts[id]||0)}
function setCount(id,n){
  if(n<=0) delete state.counts[id]; else state.counts[id]=n;
  save(); renderAll();
}
function allItems(){return album.sections.flatMap(s=>s.items.map(i=>({...i,section:s})))}
function totals(){
  const items=allItems(), have=items.filter(x=>count(x.id)>0).length;
  return {have,total:items.length,missing:items.length-have,dups:items.reduce((a,x)=>a+Math.max(0,count(x.id)-1),0)};
}
function buildSectionSelect(){
  $('sectionSelect').innerHTML=album.sections.map((s,i)=>`<option value="${i}">${s.emoji} ${s.group?'Grupo '+s.group+' · ':''}${s.code||s.id} · ${s.name}</option>`).join('');
}
function renderAll(){renderMetrics();renderDashboard();renderAlbum();renderList();}
function renderMetrics(){
  const t=totals();
  $('haveMetric').textContent=t.have;$('totalMetric').textContent=t.total;
  $('progressMetric').textContent=(t.total?((t.have/t.total)*100).toFixed(1):0)+'%';
  $('missingMetric').textContent=t.missing;$('dupsMetric').textContent=t.dups;
}
function sectionStats(s){
  const have=s.items.filter(i=>count(i.id)>0).length;
  return {have,total:s.items.length,pct:Math.round(have/s.items.length*100)};
}
function renderDashboard(){
  let html='';
  const specialStart=album.sections[0];
  html+=`<div class="special-grid"><div class="special-card" data-index="0"><b>${specialStart.emoji} ${specialStart.name}</b><small>${sectionStats(specialStart).have}/${specialStart.items.length}</small></div></div>`;
  for(const g of album.groups){
    html+=`<div class="group-block"><div class="group-label">Grupo ${g.id}</div><div class="team-grid">`;
    for(const id of g.teams){
      const i=album.sections.findIndex(s=>s.id===id),s=album.sections[i],st=sectionStats(s);
      html+=`<div class="team-card" data-index="${i}">
        <div class="flag">${s.emoji}</div>
        <div><div class="team-code">${s.code}</div><div class="team-name">${s.name}</div></div>
        <div class="team-progress">${st.have}/${st.total}<br><span>${st.pct}%</span></div>
        <div class="bar"><i style="width:${st.pct}%"></i></div>
      </div>`;
    }
    html+='</div></div>';
  }
  const tail=album.sections.slice(-2);
  html+='<div class="special-grid">'+tail.map(s=>{const i=album.sections.indexOf(s),st=sectionStats(s);return `<div class="special-card" data-index="${i}"><b>${s.emoji} ${s.name}</b><small>${st.have}/${st.total} · ${st.pct}%</small></div>`}).join('')+'</div>';
  $('groupCards').innerHTML=html;
  document.querySelectorAll('[data-index]').forEach(el=>el.addEventListener('click',()=>openSection(+el.dataset.index)));
}
function openSection(i){
  $('sectionSelect').value=i;
  showView('album');renderAlbum();
}
function renderAlbum(){
  if(!album)return;
  const s=album.sections[+$('sectionSelect').value||0], filter=$('stickerFilter').value;
  $('albumTitle').innerHTML=`<span class="big-flag">${s.emoji}</span><span>${s.group?'Grupo '+s.group+' · ':''}${s.code||s.id} · ${s.name}</span>`;
  let items=s.items.filter(i=>filter==='all'||(filter==='owned'&&count(i.id)>0)||(filter==='missing'&&count(i.id)===0)||(filter==='dups'&&count(i.id)>1));
  $('stickers').innerHTML=items.map(i=>{const c=count(i.id);return `<article class="sticker ${c?'owned':''} ${c>1?'dup':''}">
    <div class="number">${i.display}</div><div class="status">${c>1?'x'+c:c?'Tengo':'Falta'}</div>
    <div class="qty"><button class="minus" data-dec="${i.id}">−</button><button data-inc="${i.id}">+</button></div></article>`}).join('');
  document.querySelectorAll('[data-inc]').forEach(b=>b.addEventListener('click',()=>setCount(b.dataset.inc,count(b.dataset.inc)+1)));
  document.querySelectorAll('[data-dec]').forEach(b=>b.addEventListener('click',()=>setCount(b.dataset.dec,count(b.dataset.dec)-1)));
}
let activeList='missing';
function listText(kind){
  const lines=[];
  for(const s of album.sections){
    const vals=s.items.filter(i=>kind==='missing'?count(i.id)===0:count(i.id)>1).map(i=>kind==='missing'?i.display:`${i.display} (x${count(i.id)-1})`);
    if(vals.length) lines.push(`${s.emoji} ${s.code||s.id} ${s.name}: ${vals.join(', ')}`);
  }
  return lines.length?lines.join('\n'):'No hay figuritas en esta lista.';
}
function renderList(){$('listOutput').value=listText(activeList)}
function showView(id){
  document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.id===id));
  document.querySelectorAll('.bottom-nav button').forEach(b=>b.classList.toggle('active',b.dataset.view===id));
  window.scrollTo({top:0,behavior:'smooth'});
}
function exportData(){
  const payload={format:'mi-album-2026',version:APP_VERSION,exportedAt:new Date().toISOString(),counts:state.counts};
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);
  a.download=`respaldo_album_mundial_2026_${new Date().toISOString().slice(0,10)}.album`;a.click();URL.revokeObjectURL(a.href);
}
async function importPayload(file){
  const data=JSON.parse(await file.text());
  if(!data.counts||typeof data.counts!=='object') throw new Error('Formato inválido');
  state={counts:data.counts,updatedAt:new Date().toISOString()};save();renderAll();
}
async function compareFile(file){
  const other=JSON.parse(await file.text()),their=other.counts||{};
  const canGive=[],needFrom=[];
  for(const x of allItems()){
    const mine=count(x.id),theirs=Number(their[x.id]||0);
    if(mine>1&&theirs===0) canGive.push(`${x.section.code||x.section.id}-${x.display}`);
    if(theirs>1&&mine===0) needFrom.push(`${x.section.code||x.section.id}-${x.display}`);
  }
  $('compareOutput').innerHTML=`<div class="compare-section"><h3>Tú puedes darle (${canGive.length})</h3>${canGive.length?canGive.map(x=>`<div class="compare-item">${x}</div>`).join(''):'Nada por ahora.'}</div>
  <div class="compare-section"><h3>Puede darte (${needFrom.length})</h3>${needFrom.length?needFrom.map(x=>`<div class="compare-item">${x}</div>`).join(''):'Nada por ahora.'}</div>`;
}
function bindEvents(){
  document.querySelectorAll('.bottom-nav button').forEach(b=>b.addEventListener('click',()=>showView(b.dataset.view)));
  $('sectionSelect').addEventListener('change',renderAlbum);$('stickerFilter').addEventListener('change',renderAlbum);
  document.querySelectorAll('[data-list]').forEach(b=>b.addEventListener('click',()=>{activeList=b.dataset.list;document.querySelectorAll('[data-list]').forEach(x=>x.classList.toggle('active',x===b));renderList()}));
  $('copyList').addEventListener('click',async()=>{await navigator.clipboard.writeText($('listOutput').value);$('copyList').textContent='Copiado';setTimeout(()=>$('copyList').textContent='Copiar lista',1200)});
  $('exportBtn').addEventListener('click',exportData);
  $('importBtn').addEventListener('click',()=>$('importFile').click());
  $('importFile').addEventListener('change',async e=>{try{await importPayload(e.target.files[0]);alert('Respaldo restaurado.')}catch(err){alert(err.message)}});
  $('compareFile').addEventListener('change',async e=>{try{await compareFile(e.target.files[0])}catch(err){alert('No se pudo leer el respaldo.')}});
  $('resetBtn').addEventListener('click',()=>{if(confirm('¿Borrar todo el progreso de este dispositivo?')){state={counts:{},updatedAt:null};save();renderAll()}});
  window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;$('installBtn').classList.remove('hidden')});
  $('installBtn').addEventListener('click',async()=>{if(deferredPrompt){deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;$('installBtn').classList.add('hidden')}});
}
init();
