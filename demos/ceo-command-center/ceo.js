// ── AUTH ─────────────────────────────────────────────────
// Phase 1.5 added a shared-bearer-token auth gate on every /api/* route; window.API_TOKEN is
// injected server-side (see app/main.py's Jinja2Templates wiring) so this never has to be
// hardcoded here. Every fetch() to our own /api/* routes should go through this instead of the
// bare fetch(), including any added later.
function authFetch(url, opts) {
  opts = opts || {};
  opts.headers = Object.assign({}, opts.headers, {Authorization: 'Bearer ' + (window.API_TOKEN || '')});
  return fetch(url, opts);
}

// ══ STATE ══
var state = {
  fg:{ data:[],filtered:[],dead:[],filter:'all',unit:'all',page:1,sort:{col:'value',dir:-1} },
  rm:{ data:[],filtered:[],dead:[],filter:'all',unit:'all',page:1,sort:{col:'value',dir:-1} },
  os:{ data:[],filtered:[],bucket:'all',page:1,sort:{col:'daysOver',dir:-1} },
  PAGE_SIZE:50, stockView:'fg'
};
var fgDeadSet=new Set(), rmDeadSet=new Set(), osDonutChart=null;
var CAT_COLORS=['#1e40af','#b45309','#166534','#6d28d9','#0369a1','#9a3412','#065f46','#7c3aed','#0c4a6e','#713f12'];

// ── PAGE NAV ─────────────────────────────────────────────
function showPage(p, btn) {
  document.querySelectorAll('.page').forEach(function(el){ el.classList.remove('active'); });
  document.querySelectorAll('.sb-item').forEach(function(el){ el.classList.remove('active'); });
  document.getElementById('page-'+p).classList.add('active');
  btn.classList.add('active');
}
function switchStock(v) {
  state.stockView = v;
  // Wow Factor v2, Technique 5: fade+lift on switch, matching the sidebar page-switch motion.
  // style.display is still set directly (unchanged logic) — only the entrance animation is new,
  // retriggered via a forced reflow since re-adding the same class name doesn't restart a CSS
  // animation on its own.
  ['fg','rm','cmp'].forEach(function(k){
    var el = document.getElementById('stock-'+k);
    if (k===v) {
      el.style.display = 'block';
      el.classList.remove('stock-fade-in');
      void el.offsetWidth;
      el.classList.add('stock-fade-in');
    } else {
      el.style.display = 'none';
    }
  });
  document.getElementById('stb-fg').className  = 'st-btn'+(v==='fg'?' active fg':'');
  document.getElementById('stb-rm').className  = 'st-btn rm'+(v==='rm'?' active rm':'');
  document.getElementById('stb-cmp').className = 'st-btn'+(v==='cmp'?' active':'');
  if(v==='cmp' && !cmpState.loaded) cmpLoad();
}

// ── DATE COMPARISON ───────────────────────────────────────
var cmpState = { data:{fg:null,rm:null}, loaded:false, mode:'single' };

function cmpSetMode(mode){
  cmpState.mode = mode;
  document.getElementById('cmp-mode-single').style.cssText  = 'padding:5px 12px;border:none;border-radius:6px;font-size:11px;font-weight:700;cursor:pointer;background:'+(mode==='single'?'#4f46e5':'transparent')+';color:'+(mode==='single'?'#fff':'#64748b');
  document.getElementById('cmp-mode-compare').style.cssText = 'padding:5px 12px;border:none;border-radius:6px;font-size:11px;font-weight:700;cursor:pointer;background:'+(mode==='compare'?'#4f46e5':'transparent')+';color:'+(mode==='compare'?'#fff':'#64748b');
  document.getElementById('cmp-vs-wrap').style.display = mode==='compare' ? 'flex' : 'none';
  cmpRender();
}

function cmpLoad(){
  var type = document.getElementById('cmp-type').value;
  if(cmpState.data[type]){ cmpPopulateDates(type); return; }
  authFetch('/api/stock-snapshots?type='+type)
    .then(function(r){ return r.json(); })
    .then(function(d){
      if(!d.ok) return;
      cmpState.data[type] = d;
      cmpState.loaded = true;
      cmpPopulateDates(type);
    });
}

function cmpPopulateDates(type){
  var dates = (cmpState.data[type] && cmpState.data[type].dates) || [];
  var d1 = document.getElementById('cmp-d1');
  var d2 = document.getElementById('cmp-d2');
  d1.innerHTML = dates.map(function(d){ return '<option>'+d+'</option>'; }).join('');
  d2.innerHTML = dates.map(function(d){ return '<option>'+d+'</option>'; }).join('');
  // Default: d1 = second last, d2 = last
  if(dates.length >= 2){ d1.value = dates[dates.length-2]; d2.value = dates[dates.length-1]; }
  cmpRender();
}

function cmpRender(){
  var type   = document.getElementById('cmp-type').value;
  var d1     = document.getElementById('cmp-d1').value;
  var d2     = document.getElementById('cmp-d2').value;
  var search = (document.getElementById('cmp-search').value||'').toLowerCase().trim();
  var data   = cmpState.data[type];
  var mode   = cmpState.mode;
  if(!data || !d1) return;

  var rows = data.products.filter(function(r){
    return !search || r.name.toLowerCase().indexOf(search) >= 0;
  });

  var thS  = 'background:#0f2044;color:#fff;padding:9px 12px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;white-space:nowrap;position:sticky;top:0;z-index:2;border-right:1px solid rgba(255,255,255,.1)';
  var thGr = 'background:#059669;color:#fff;padding:9px 12px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;white-space:nowrap;position:sticky;top:0;z-index:2;border-right:1px solid rgba(255,255,255,.1)';
  var thBl = 'background:#1d4ed8;color:#fff;padding:9px 12px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;white-space:nowrap;position:sticky;top:0;z-index:2;border-right:1px solid rgba(255,255,255,.1)';
  var thPu = 'background:#7c3aed;color:#fff;padding:9px 12px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;white-space:nowrap;position:sticky;top:0;z-index:2;border-right:1px solid rgba(255,255,255,.1)';

  function vsMaxHtml(pct){
    if(pct==null) return '—';
    var c = pct>=80?'#059669':pct>=40?'#d97706':'#be3525';
    return '<div style="display:flex;align-items:center;gap:5px;justify-content:flex-end">'+
      '<span style="font-size:11px;color:'+c+'">'+pct+'%</span>'+
      '<div style="width:40px;height:4px;background:#e5e7eb;border-radius:2px;overflow:hidden">'+
      '<div style="height:100%;border-radius:2px;width:'+Math.min(pct,100)+'%;background:'+c+'"></div></div></div>';
  }
  function commonCols(r, stockQty){
    var pct = (r.maxLevel && stockQty!=null) ? Math.round((stockQty/r.maxLevel)*100) : null;
    var val = (r.cost && stockQty!=null) ? Math.round(stockQty * r.cost) : null;
    return '<td style="padding:8px 12px;font-size:11px;color:#64748b;font-family:DM Mono,monospace">'+(r.sku||'—')+'</td>'+
      '<td style="padding:8px 12px;font-size:12px;font-weight:600;color:#0f2044">'+r.name+'</td>'+
      '<td style="padding:8px 12px"><span class="cat-badge '+(getCatClass?getCatClass(r.category||''):'')+'">'+(r.category||'—')+'</span></td>'+
      '<td style="padding:8px 12px;font-size:12px;color:#64748b">'+(r.unit||'—')+'</td>'+
      '<td style="padding:8px 12px;text-align:right">'+vsMaxHtml(pct)+'</td>'+
      '<td style="padding:8px 12px;text-align:right;font-family:DM Mono,monospace;font-size:12px;color:#475569">'+(r.cost?'₹'+fmtNum(r.cost):'<span style="background:#fef2f2;color:#be3525;border-radius:4px;padding:1px 5px;font-size:10px;font-weight:700">NO COST</span>')+'</td>'+
      '<td style="padding:8px 12px;text-align:right;font-family:DM Mono,monospace;font-size:12px;font-weight:600;color:#1e40af">'+(val!=null?fmtCur(val):'—')+'</td>';
  }

  var html, kpisHtml = '';

  if(mode === 'single'){
    // ── SINGLE DATE VIEW ──
    rows.sort(function(a,b){ return (b[d1]||0)-(a[d1]||0); });
    var totalStock=0, totalVal=0, zeroCnt=0;
    rows.forEach(function(r){ totalStock+=(r[d1]||0); if(r.value) totalVal+=r.value; if(!(r[d1]||0)) zeroCnt++; });
    kpisHtml = [
      {label:'📅 Date',        val:d1,              bg:'#eff6ff', color:'#1d4ed8'},
      {label:'📦 Total Items', val:rows.length,      bg:'#f8fafc', color:'#0f2044'},
      {label:'📊 Total Stock', val:fmtNum(totalStock),bg:'#f0fdf4', color:'#059669'},
      {label:'⚠ Zero Stock',  val:zeroCnt,          bg:'#fef2f2', color:'#be3525'},
    ].map(function(k){
      return '<div style="background:'+k.bg+';border:1px solid '+k.color+'33;border-radius:10px;padding:10px 18px;min-width:130px;text-align:center">'+
        '<div style="font-size:10px;font-weight:700;color:'+k.color+';text-transform:uppercase;letter-spacing:.5px">'+k.label+'</div>'+
        '<div style="font-size:20px;font-weight:800;color:'+k.color+'">'+k.val+'</div></div>';
    }).join('');

    html = '<table style="min-width:1100px;width:100%"><thead><tr>'+
      '<th style="'+thS+';text-align:left;min-width:140px">SKU Code</th>'+
      '<th style="'+thS+';text-align:left;min-width:220px">Item Name</th>'+
      '<th style="'+thS+';text-align:left;min-width:120px">Category</th>'+
      '<th style="'+thS+';text-align:left;min-width:70px">Unit</th>'+
      '<th style="'+thS+';text-align:right;min-width:110px">VS Max Level</th>'+
      '<th style="'+thS+';text-align:right;min-width:90px">Cost/Unit</th>'+
      '<th style="'+thS+';text-align:right;min-width:100px">Stock Value</th>'+
      '<th style="'+thBl+';text-align:right;min-width:120px">Closing Stock ('+d1+')</th>'+
      '</tr></thead><tbody>';
    rows.forEach(function(r,i){
      var v=r[d1]||0;
      var rowBg = i%2===0?'#fff':'#f8fafc';
      html += '<tr style="background:'+rowBg+';border-bottom:1px solid #f1f5f9">'+
        commonCols(r, v)+
        '<td style="padding:8px 12px;text-align:right;font-family:DM Mono,monospace;font-size:13px;font-weight:700;color:'+(v>0?'#1d4ed8':v<0?'#be3525':'#94a3b8')+'">'+fmtNum(v)+'</td>'+
        '</tr>';
    });

  } else {
    // ── COMPARE VIEW ──
    if(!d2) return;
    var increased=0, decreased=0, unchanged=0, newItems=0;
    rows.forEach(function(r){
      var diff=(r[d2]||0)-(r[d1]||0);
      if(diff>0) increased++; else if(diff<0) decreased++; else unchanged++;
      if(!(r[d1]||0) && (r[d2]||0)>0) newItems++;
    });
    kpisHtml = [
      {label:'📈 Increased', val:increased, bg:'#f0fdf4', color:'#059669'},
      {label:'📉 Decreased', val:decreased, bg:'#fef2f2', color:'#be3525'},
      {label:'➡ Unchanged', val:unchanged, bg:'#f8fafc', color:'#64748b'},
      {label:'🆕 New Items', val:newItems,  bg:'#eff6ff', color:'#1d4ed8'},
    ].map(function(k){
      return '<div style="background:'+k.bg+';border:1px solid '+k.color+'33;border-radius:10px;padding:10px 18px;min-width:120px;text-align:center">'+
        '<div style="font-size:10px;font-weight:700;color:'+k.color+';text-transform:uppercase;letter-spacing:.5px">'+k.label+'</div>'+
        '<div style="font-size:22px;font-weight:800;color:'+k.color+'">'+k.val+'</div></div>';
    }).join('');

    rows.sort(function(a,b){ return Math.abs((b[d2]||0)-(b[d1]||0))-Math.abs((a[d2]||0)-(a[d1]||0)); });
    html = '<table style="min-width:1400px;width:100%"><thead><tr>'+
      '<th style="'+thS+';text-align:left;min-width:140px">SKU Code</th>'+
      '<th style="'+thS+';text-align:left;min-width:220px">Item Name</th>'+
      '<th style="'+thS+';text-align:left;min-width:120px">Category</th>'+
      '<th style="'+thS+';text-align:left;min-width:70px">Unit</th>'+
      '<th style="'+thS+';text-align:right;min-width:110px">VS Max Level</th>'+
      '<th style="'+thS+';text-align:right;min-width:90px">Cost/Unit</th>'+
      '<th style="'+thS+';text-align:right;min-width:100px">Stock Value</th>'+
      '<th style="'+thBl+';text-align:right;min-width:110px">'+d1+'</th>'+
      '<th style="'+thPu+';text-align:right;min-width:110px">'+d2+'</th>'+
      '<th style="'+thGr+';text-align:right;min-width:100px">Change</th>'+
      '<th style="'+thGr+';text-align:right;min-width:90px">Change %</th>'+
      '</tr></thead><tbody>';
    rows.forEach(function(r,i){
      var v1=r[d1]||0, v2=r[d2]||0, diff=v2-v1;
      var pct = v1 ? Math.round((diff/v1)*100) : (v2>0?100:0);
      var dc  = diff>0?'#059669':diff<0?'#be3525':'#94a3b8';
      var rowBg = i%2===0?'#fff':'#f8fafc';
      html += '<tr style="background:'+rowBg+';border-bottom:1px solid #f1f5f9">'+
        commonCols(r, v2)+
        '<td style="padding:8px 12px;text-align:right;font-family:DM Mono,monospace;font-size:12px;color:#1d4ed8;font-weight:600">'+fmtNum(v1)+'</td>'+
        '<td style="padding:8px 12px;text-align:right;font-family:DM Mono,monospace;font-size:12px;color:#7c3aed;font-weight:600">'+fmtNum(v2)+'</td>'+
        '<td style="padding:8px 12px;text-align:right;font-family:DM Mono,monospace;font-size:12px;font-weight:700;color:'+dc+'">'+(diff>0?'+':'')+fmtNum(diff)+'</td>'+
        '<td style="padding:8px 12px;text-align:right;font-size:12px;font-weight:700;color:'+dc+'">'+(diff!==0?(diff>0?'+':'')+pct+'%':'—')+'</td>'+
        '</tr>';
    });
  }

  html += '</tbody></table>';
  document.getElementById('cmp-kpis').innerHTML = kpisHtml;
  document.getElementById('cmp-table-wrap').innerHTML = html;
}

function cmpExportCSV(){
  var type = document.getElementById('cmp-type').value;
  var d1   = document.getElementById('cmp-d1').value;
  var d2   = document.getElementById('cmp-d2').value;
  var data = cmpState.data[type];
  if(!data) return;
  var csv = [['SKU Code','Item Name','Category','Unit','VS Max Level %','Cost/Unit','Stock Value','Stock on '+d1,'Stock on '+d2,'Change','Change %'].join(',')];
  data.products.forEach(function(r){
    var v1=r[d1]||0, v2=r[d2]||0, diff=v2-v1;
    var pct = v1 ? Math.round((diff/v1)*100) : (v2>0?100:0);
    csv.push(['"'+(r.sku||'')+'"','"'+r.name+'"','"'+(r.category||'')+'"','"'+(r.unit||'')+'"',
      r.availPct!=null?r.availPct+'%':'',r.cost||'',r.value!=null?r.value:'',v1,v2,diff,(diff!==0?pct+'%':'0%')].join(','));
  });
  var blob = new Blob([csv.join('\n')],{type:'text/csv'});
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = type.toUpperCase()+'_Compare_'+d1.replace(/\//g,'-')+'_vs_'+d2.replace(/\//g,'-')+'.csv';
  a.click();
}

// ── INIT ─────────────────────────────────────────────────
window.onload = function() {
  document.getElementById('lastUpdated').textContent = 'Loading…';
  authFetch('/api/fg').then(function(r){return r.json();}).then(function(d){ if(d.ok) loadFG(d); else showFGError(d.error); }).catch(function(e){ showFGError(e.message); });
  authFetch('/api/rm').then(function(r){return r.json();}).then(function(d){ if(d.ok) loadRM(d); else showRMError(d.error); }).catch(function(e){ showRMError(e.message); });
  authFetch('/api/os').then(function(r){return r.json();}).then(function(d){ if(d.ok) loadOS(d); else showOSError(d.error); }).catch(function(e){ showOSError(e.message); });
  authFetch('/api/po').then(function(r){return r.json();}).then(function(d){ if(d.ok) loadPO(d); else document.getElementById('po-table-wrap').innerHTML='<div class="empty" style="color:var(--overdue)">&#9888; '+d.error+'</div>'; }).catch(function(e){ document.getElementById('po-table-wrap').innerHTML='<div class="empty" style="color:var(--overdue)">&#9888; '+e.message+'</div>'; });
  authFetch('/api/pipeline').then(function(r){return r.json();}).then(function(d){ if(d.ok) loadSP(d); else spShowError(d.error); }).catch(function(e){ spShowError(e.message); });
  document.getElementById('lastUpdated').textContent = 'Live · '+new Date().toLocaleString('en-IN');
};
function refreshData(){ document.getElementById('lastUpdated').textContent='Refreshing…'; window.onload(); }
function refreshData(){ document.getElementById('lastUpdated').textContent='Refreshing…'; window.onload(); }

// ── FORMATTERS ───────────────────────────────────────────
function fmtNum(n){ return n===null||n===undefined?'—':Number(n).toLocaleString('en-IN'); }
function fmtCur(n){
  if(!n||isNaN(n)) return '₹0';
  if(n>=1e7) return '₹'+(n/1e7).toFixed(2)+' Cr';
  if(n>=1e5) return '₹'+(n/1e5).toFixed(1)+' L';
  return '₹'+Number(Math.round(n)).toLocaleString('en-IN');
}
function getCatClass(cat){
  if(!cat) return 'cat-other';
  var c=cat.toLowerCase();
  if(c.includes('ice')) return 'cat-ICE_CREAM';
  if(c.includes('wooden')||c.includes('cutlery')) return 'cat-Wooden';
  if(c.includes('bamboo')) return 'cat-Bamboo';
  if(c.includes('straw')) return 'cat-Straw';
  if(c==='ns rm') return 'cat-NS_RM';
  if(c==='s rm') return 'cat-S_RM';
  return 'cat-other';
}
function stockBar(closing, maxLevel){
  if(!maxLevel||maxLevel<=0){
    var cls=closing>0?'bar-good':'bar-zero';
    return '<div class="stock-bar-wrap"><div class="stock-bar"><div class="stock-bar-fill '+cls+'" style="width:'+(closing>0?100:0)+'%"></div></div><span class="stock-pct">—</span></div>';
  }
  var ratio=closing/maxLevel, pct=Math.min(Math.round(ratio*100),100);
  var cls=ratio>=0.5?'bar-good':ratio>=0.2?'bar-warn':'bar-low';
  if(closing<=0) cls='bar-zero';
  return '<div class="stock-bar-wrap"><div class="stock-bar"><div class="stock-bar-fill '+cls+'" style="width:'+pct+'%"></div></div><span class="stock-pct">'+Math.round(ratio*100)+'%</span></div>';
}

// ── LOAD FG ──────────────────────────────────────────────
function loadFG(raw){
  state.fg.data=(raw.ims||[]).map(function(r){
    var cost=(r.cost!==null&&!isNaN(r.cost))?parseFloat(r.cost):null;
    var closing=parseFloat(r.closing)||0;
    return{skuCode:r.skuCode||'',item:r.item||'',category:r.category||'',unit:r.unit||'',
           closing:closing,maxLevel:parseFloat(r.maxLevel)||0,avgDaily:parseFloat(r.avgDaily)||0,
           cost:cost,value:(cost?Math.round(closing*cost):null)};
  });
  state.fg.dead=raw.dead||[];
  fgDeadSet=new Set(state.fg.dead.map(function(d){ return String(d.name||'').toLowerCase().trim(); }));
  document.getElementById('fg-count').textContent='('+state.fg.data.length+')';
  buildCatOptions('fg-cat-filter',state.fg.data);
  updateFGKPIs(); filterFG(); renderFGDead(); updateSummaryBanner();
}
function loadRM(raw){
  state.rm.data=(raw.ims||[]).map(function(r){
    var cost=(r.cost!==null&&!isNaN(r.cost))?parseFloat(r.cost):null;
    var closing=parseFloat(r.closing)||0;
    return{skuCode:r.skuCode||'',item:r.item||'',category:r.category||'',unit:r.unit||'',
           closing:closing,maxLevel:parseFloat(r.maxLevel)||0,avgDaily:parseFloat(r.avgDaily)||0,
           cost:cost,value:(cost?Math.round(closing*cost):null)};
  });
  state.rm.dead=raw.dead||[];
  rmDeadSet=new Set(state.rm.dead.map(function(d){ return String(d.name||'').toLowerCase().trim(); }));
  document.getElementById('rm-count').textContent='('+state.rm.data.length+')';
  buildCatOptions('rm-cat-filter',state.rm.data);
  updateRMKPIs(); filterRM(); renderRMDead(); updateSummaryBanner();
}

// ── SUMMARY BANNER ───────────────────────────────────────
function updateSummaryBanner(){
  var fd=state.fg.data, rd=state.rm.data;
  var fgVal=fd.filter(function(r){return r.value!==null;}).reduce(function(s,r){return s+r.value;},0);
  var fgStk=fd.reduce(function(s,r){return s+r.closing;},0);
  var rmVal=rd.filter(function(r){return r.value!==null;}).reduce(function(s,r){return s+r.value;},0);
  var rmStk=rd.reduce(function(s,r){return s+r.closing;},0);
  var deadVal=0;
  var fgCost={},rmCost={};
  fd.forEach(function(r){if(r.cost) fgCost[r.item.toLowerCase().trim()]=r.cost;});
  rd.forEach(function(r){if(r.cost) rmCost[r.item.toLowerCase().trim()]=r.cost;});
  state.fg.dead.forEach(function(d){var c=fgCost[String(d.name||'').toLowerCase().trim()];if(c) deadVal+=Math.round((d.qty||0)*c);});
  state.rm.dead.forEach(function(d){var c=rmCost[String(d.name||'').toLowerCase().trim()];if(c) deadVal+=Math.round((d.qty||0)*c);});
  dsCountUp(document.getElementById('sum-fg-value'),fgVal,{format:fmtCur});
  dsCountUp(document.getElementById('sum-fg-stock'),Math.round(fgStk),{format:fmtNum});
  document.getElementById('sum-fg-sub').textContent=fd.filter(function(r){return r.value!==null;}).length+' costed';
  dsCountUp(document.getElementById('sum-rm-value'),rmVal,{format:fmtCur});
  dsCountUp(document.getElementById('sum-rm-stock'),Math.round(rmStk),{format:fmtNum});
  document.getElementById('sum-rm-sub').textContent=rd.filter(function(r){return r.value!==null;}).length+' costed';
  dsCountUp(document.getElementById('sum-dead-value'),deadVal,{format:fmtCur});
  document.getElementById('sum-dead-sub').textContent=(state.fg.dead.length+state.rm.dead.length)+' items (FG+RM)';
}

// ── FG KPIs ──────────────────────────────────────────────
function updateFGKPIs(){
  var d=state.fg.data;
  var costed=d.filter(function(r){return r.value!==null;});
  var totalVal=costed.reduce(function(s,r){return s+r.value;},0);
  var totalStk=d.reduce(function(s,r){return s+r.closing;},0);
  var nc=d.filter(function(r){return r.cost===null;}).length;
  var lc=d.filter(function(r){return r.closing<=0;}).length;
  var deadVal=0,costByName={};
  d.forEach(function(r){if(r.cost) costByName[r.item.toLowerCase().trim()]=r.cost;});
  state.fg.dead.forEach(function(dd){var c=costByName[String(dd.name||'').toLowerCase().trim()];if(c) deadVal+=Math.round((dd.qty||0)*c);});
  dsCountUp(document.getElementById('fg-kpi-total'),d.length,{format:fmtNum});
  dsCountUp(document.getElementById('fg-kpi-stock'),Math.round(totalStk),{format:fmtNum});
  dsCountUp(document.getElementById('fg-kpi-value'),totalVal,{format:fmtCur});
  document.getElementById('fg-kpi-value-sub').textContent=costed.length+' of '+d.length+' costed';
  dsCountUp(document.getElementById('fg-kpi-nocost'),nc,{format:fmtNum});
  dsCountUp(document.getElementById('fg-kpi-low'),lc,{format:fmtNum});
  dsCountUp(document.getElementById('fg-kpi-dead-val'),state.fg.dead.length,{format:fmtNum});
  document.getElementById('fg-kpi-dead-sub').textContent=deadVal>0?'Value: '+fmtCur(deadVal):'Non-moving';
  document.getElementById('fg-coverage').innerHTML='<strong>Cost Coverage</strong>'+
    '<span class="cov-pill costed">✓ '+costed.length+' costed</span><span style="color:var(--ink-5)">·</span>'+
    '<span class="cov-pill missing">✗ '+nc+' missing</span><span style="color:var(--ink-5)">·</span>'+
    '<span class="cov-pill pct">'+(d.length?Math.round(costed.length/d.length*100):0)+'% coverage</span>'+
    '<span class="cov-note">— Value totals include costed items only</span>';
  renderCatBars('fg',d,totalVal); renderTop10Bars('fg',d);
}

// ── RM KPIs ──────────────────────────────────────────────
function updateRMKPIs(){
  var d=state.rm.data;
  var costed=d.filter(function(r){return r.value!==null;});
  var totalVal=costed.reduce(function(s,r){return s+r.value;},0);
  var totalStk=d.reduce(function(s,r){return s+r.closing;},0);
  var nc=d.filter(function(r){return r.cost===null;}).length;
  var lc=d.filter(function(r){return r.closing<=0;}).length;
  var deadVal=0,costByName={};
  d.forEach(function(r){if(r.cost) costByName[r.item.toLowerCase().trim()]=r.cost;});
  state.rm.dead.forEach(function(dd){var c=costByName[String(dd.name||'').toLowerCase().trim()];if(c) deadVal+=Math.round((dd.qty||0)*c);});
  dsCountUp(document.getElementById('rm-kpi-total'),d.length,{format:fmtNum});
  dsCountUp(document.getElementById('rm-kpi-stock'),Math.round(totalStk),{format:fmtNum});
  dsCountUp(document.getElementById('rm-kpi-value'),totalVal,{format:fmtCur});
  document.getElementById('rm-kpi-value-sub').textContent=costed.length+' of '+d.length+' costed';
  dsCountUp(document.getElementById('rm-kpi-nocost'),nc,{format:fmtNum});
  dsCountUp(document.getElementById('rm-kpi-low'),lc,{format:fmtNum});
  dsCountUp(document.getElementById('rm-kpi-dead-val'),state.rm.dead.length,{format:fmtNum});
  document.getElementById('rm-kpi-dead-sub').textContent=deadVal>0?'Value: '+fmtCur(deadVal):'Non-moving';
  document.getElementById('rm-coverage').innerHTML='<strong>Cost Coverage</strong>'+
    '<span class="cov-pill costed">✓ '+costed.length+' costed</span><span style="color:var(--ink-5)">·</span>'+
    '<span class="cov-pill missing">✗ '+nc+' missing</span><span style="color:var(--ink-5)">·</span>'+
    '<span class="cov-pill pct rm">'+(d.length?Math.round(costed.length/d.length*100):0)+'% coverage</span>'+
    '<span class="cov-note">— Value totals include costed items only</span>';
  renderCatBars('rm',d,totalVal); renderTop10Bars('rm',d);
}

// ── CAT BARS & TOP10 ─────────────────────────────────────
function renderCatBars(tab,data,totalVal){
  var catMap={};
  data.forEach(function(r){if(r.value===null) return; var c=r.category||'Uncategorized'; catMap[c]=(catMap[c]||0)+r.value;});
  var cats=Object.keys(catMap).map(function(k){return{cat:k,val:catMap[k]};}).sort(function(a,b){return b.val-a.val;});
  if(!cats.length){document.getElementById(tab+'-cat-bars').innerHTML='<div class="empty">No data</div>';return;}
  var maxVal=cats[0].val;
  document.getElementById(tab+'-cat-total').textContent=fmtCur(totalVal);
  var html='';
  cats.forEach(function(c,i){
    var pct=maxVal?Math.round(c.val/maxVal*100):0;
    var ofTotal=totalVal?Math.round(c.val/totalVal*100):0;
    html+='<div class="bar-row">'+
      '<div class="bar-label"><span class="cat-badge '+getCatClass(c.cat)+'">'+c.cat+'</span></div>'+
      '<div class="bar-track" style="flex:1;background:var(--border);border-radius:4px;height:7px;overflow:hidden;min-width:50px">'+
      '<div class="bar-fill" style="width:'+pct+'%;background:'+CAT_COLORS[i%CAT_COLORS.length]+'"></div></div>'+
      '<div class="bar-value">'+fmtCur(c.val)+'</div>'+
      '<div class="bar-pct">'+ofTotal+'%</div></div>';
  });
  document.getElementById(tab+'-cat-bars').innerHTML=html;
}
function renderTop10Bars(tab,data){
  var deadSet=tab==='fg'?fgDeadSet:rmDeadSet;
  var accent=tab==='fg'?'#1e40af':'#b45309';
  var costed=data.filter(function(r){return r.value!==null&&!deadSet.has(r.item.toLowerCase().trim());});
  costed.sort(function(a,b){return b.value-a.value;});
  var top10=costed.slice(0,10);
  var maxVal=top10.length?top10[0].value:1;
  var total=top10.reduce(function(s,r){return s+r.value;},0);
  document.getElementById(tab+'-top10-total').textContent=fmtCur(total);
  if(!top10.length){document.getElementById(tab+'-top10-bars').innerHTML='<div class="empty">No costed items</div>';return;}
  var html='';
  top10.forEach(function(r,i){
    var pct=Math.round(r.value/maxVal*100);
    html+='<div class="bar-row">'+
      '<div class="bar-rank">'+(i+1)+'</div>'+
      '<div class="bar-label" title="'+r.item+'">'+r.item+'</div>'+
      '<div class="bar-track" style="flex:1;background:var(--border);border-radius:4px;height:7px;overflow:hidden;min-width:50px">'+
      '<div class="bar-fill" style="width:'+pct+'%;background:'+accent+'"></div></div>'+
      '<div class="bar-value">'+fmtCur(r.value)+'</div></div>';
  });
  document.getElementById(tab+'-top10-bars').innerHTML=html;
}

// ── FILTERS ──────────────────────────────────────────────
function buildCatOptions(elId,data){
  var sel=document.getElementById(elId),cats={};
  data.forEach(function(r){if(r.category) cats[r.category]=(cats[r.category]||0)+1;});
  sel.innerHTML='<option value="">All Categories</option>';
  Object.keys(cats).sort().forEach(function(c){sel.innerHTML+='<option value="'+c+'">'+c+' ('+cats[c]+')</option>';});
}
function setFGFilter(f){
  state.fg.filter=f; state.fg.page=1;
  ['all','low','dead','nocost','negative'].forEach(function(x){var el=document.getElementById('fg-f-'+x);if(el) el.classList.remove('active');});
  document.getElementById('fg-f-'+f).classList.add('active'); filterFG();
}
function setRMFilter(f){
  state.rm.filter=f; state.rm.page=1;
  ['all','low','dead','nocost','negative'].forEach(function(x){var el=document.getElementById('rm-f-'+x);if(el) el.classList.remove('active');});
  document.getElementById('rm-f-'+f).classList.add('active'); filterRM();
}
function setFGUnit(u){
  state.fg.unit=u; state.fg.page=1;
  ['all','carton','bags'].forEach(function(x){var el=document.getElementById('fg-u-'+x);if(el) el.classList.remove('active');});
  var el=document.getElementById('fg-u-'+(u==='all'?'all':u.toLowerCase())); if(el) el.classList.add('active');
  filterFG();
}
function setRMUnit(u){
  state.rm.unit=u; state.rm.page=1;
  ['all','kg','bags'].forEach(function(x){var el=document.getElementById('rm-u-'+x);if(el) el.classList.remove('active');});
  var el=document.getElementById('rm-u-'+(u==='all'?'all':u.toLowerCase())); if(el) el.classList.add('active');
  filterRM();
}
function filterFG(){
  var q=document.getElementById('fg-search').value.toLowerCase();
  var cat=document.getElementById('fg-cat-filter').value;
  var f=state.fg.filter, u=state.fg.unit;
  state.fg.filtered=state.fg.data.filter(function(r){
    if(q&&!r.item.toLowerCase().includes(q)&&!r.skuCode.toLowerCase().includes(q)) return false;
    if(cat&&r.category!==cat) return false;
    if(u!=='all'&&r.unit!==u) return false;
    var isDead=fgDeadSet.has(r.item.toLowerCase().trim());
    if(f==='dead') return isDead;
    if(isDead) return false;
    if(f==='low') return r.closing<=0;
    if(f==='nocost') return r.cost===null;
    if(f==='negative') return r.closing<0;
    return true;
  });
  state.fg.page=1; sortData('fg'); renderFGTable();
}
function filterRM(){
  var q=document.getElementById('rm-search').value.toLowerCase();
  var cat=document.getElementById('rm-cat-filter').value;
  var f=state.rm.filter, u=state.rm.unit;
  state.rm.filtered=state.rm.data.filter(function(r){
    if(q&&!r.item.toLowerCase().includes(q)&&!r.skuCode.toLowerCase().includes(q)) return false;
    if(cat&&r.category!==cat) return false;
    if(u!=='all'&&r.unit!==u) return false;
    var isDead=rmDeadSet.has(r.item.toLowerCase().trim());
    if(f==='dead') return isDead;
    if(isDead) return false;
    if(f==='low') return r.closing<=0;
    if(f==='nocost') return r.cost===null;
    if(f==='negative') return r.closing<0;
    return true;
  });
  state.rm.page=1; sortData('rm'); renderRMTable();
}
function sortData(tab){
  var s=state[tab],col=s.sort.col,dir=s.sort.dir;
  s.filtered.sort(function(a,b){
    var av=a[col],bv=b[col];
    if(av===null||av===undefined) return 1;
    if(bv===null||bv===undefined) return -1;
    if(typeof av==='string') return dir*av.localeCompare(bv);
    return dir*(av-bv);
  });
}
function toggleSort(tab,col){
  var s=state[tab];
  if(s.sort.col===col) s.sort.dir*=-1;
  else{s.sort.col=col;s.sort.dir=-1;}
  s.page=1; sortData(tab);
  if(tab==='fg') renderFGTable(); else renderRMTable();
}

// ── RENDER STOCK TABLES ───────────────────────────────────
function renderStockTable(tab){
  var rows=state[tab].filtered, s=state[tab].sort;
  var page=state[tab].page, ps=state.PAGE_SIZE;
  var start=(page-1)*ps, slice=rows.slice(start,start+ps);
  var accent=tab==='fg'?'#1e40af':'#b45309';
  var deadSet=tab==='fg'?fgDeadSet:rmDeadSet;
  document.getElementById(tab+'-row-count').textContent=rows.length+' item'+(rows.length!==1?'s':'');

  function th(col,label){
    var sorted=s.col===col,icon=sorted?(s.dir===1?' ▲':' ▼'):' ⇅';
    return '<th class="'+(sorted?'sorted':'')+'" onclick="toggleSort(\''+tab+'\',\''+col+'\')">'+label+'<span style="font-size:9px;margin-left:3px;opacity:.5">'+icon+'</span></th>';
  }
  if(!slice.length){
    document.getElementById(tab+'-table-wrap').innerHTML='<div class="empty">No items found</div>';
    document.getElementById(tab+'-pagination').innerHTML=''; return;
  }
  var html='<table><thead><tr><th>SKU Code</th>'+th('item','Item Name')+th('category','Category')+'<th>Unit</th>'+
    th('closing','Closing Stock')+'<th>VS Max Level</th>'+th('cost','Cost/Unit')+th('value','Stock Value')+'<th>Status</th></tr></thead><tbody>';
  slice.forEach(function(r){
    var isDead=deadSet.has(r.item.toLowerCase().trim());
    var isZero=r.closing<=0;
    var rowCls=isZero?' class="row-zero"':isDead?' class="dead-tag-row"':'';
    var status=isDead?'<span class="act-badge act-dead">💀 Dead</span>':isZero?'<span class="act-badge act-zero">⚠ Zero</span>':'<span class="act-badge act-ok">✓ OK</span>';
    html+='<tr'+rowCls+'>'+
      '<td class="sku-cell">'+(r.skuCode||'—')+'</td>'+
      '<td style="font-weight:500">'+r.item+'</td>'+
      '<td><span class="cat-badge '+getCatClass(r.category)+'">'+(r.category||'—')+'</span></td>'+
      '<td style="color:var(--ink-3)">'+(r.unit||'—')+'</td>'+
      '<td class="num-cell" style="color:'+(isZero?'var(--danger)':'var(--ink)')+'">'+fmtNum(r.closing)+'</td>'+
      '<td>'+stockBar(r.closing,r.maxLevel)+'</td>'+
      '<td class="num-cell">'+(r.cost?'<span style="color:var(--ink-3)">₹'+fmtNum(r.cost)+'</span>':'<span class="no-cost-tag">NO COST</span>')+'</td>'+
      '<td class="value-cell">'+(r.value!==null?'<span style="color:'+accent+';font-weight:600">'+fmtCur(r.value)+'</span>':'<span style="color:var(--ink-5);font-style:italic;font-size:11px">—</span>')+'</td>'+
      '<td>'+status+'</td></tr>';
  });
  html+='</tbody></table>';
  document.getElementById(tab+'-table-wrap').innerHTML=html;
  renderPagination(tab,rows.length);
}
function renderFGTable(){ renderStockTable('fg'); }
function renderRMTable(){ renderStockTable('rm'); }

function stockExportCSV(tab){
  var rows = state[tab].filtered;
  var cols = ['SKU Code','Item Name','Category','Unit','Closing Stock','Cost/Unit','Stock Value','Status'];
  var deadSet = tab==='fg' ? fgDeadSet : rmDeadSet;
  var csv = [cols.join(',')];
  rows.forEach(function(r){
    var isDead = deadSet.has((r.item||'').toLowerCase().trim());
    var status = isDead ? 'Dead' : r.closing<=0 ? 'Zero' : 'OK';
    csv.push([
      '"'+(r.skuCode||'')+'"',
      '"'+(r.item||'')+'"',
      '"'+(r.category||'')+'"',
      '"'+(r.unit||'')+'"',
      r.closing||0,
      r.cost||'',
      r.value!=null?r.value:'',
      status
    ].join(','));
  });
  var blob = new Blob([csv.join('\n')], {type:'text/csv'});
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = (tab==='fg'?'FG':'RM')+'_Stock_'+new Date().toISOString().slice(0,10)+'.csv';
  a.click();
}

// ── DEAD TABLES ──────────────────────────────────────────
function renderDeadTable(tab){
  var data=state[tab].dead, imsData=state[tab].data;
  var elId=tab+'-dead-wrap';
  var el=document.getElementById(elId);
  if(!data.length){el.innerHTML='<div class="empty">✅ No dead stock recorded</div>';return;}
  var costMap={};
  imsData.forEach(function(r){if(r.item&&r.cost) costMap[r.item.toLowerCase().trim()]=r.cost;});
  var totalVal=0,partial=false;
  var html='<table><thead><tr><th>#</th><th>Item Name</th><th>Qty</th><th style="text-align:right">Cost/Unit</th><th style="text-align:right">Dead Value</th></tr></thead><tbody>';
  data.forEach(function(r,i){
    var key=String(r.name||'').toLowerCase().trim();
    var cost=costMap[key]||null;
    var qty=r.qty||0, val=cost?Math.round(qty*cost):null;
    if(val!==null) totalVal+=val; else partial=true;
    html+='<tr><td class="rank-cell">'+(i+1)+'</td>'+
      '<td style="font-weight:500">'+(r.name||'')+'</td>'+
      '<td class="num-cell" style="color:var(--danger)">'+fmtNum(qty)+'</td>'+
      '<td class="num-cell">'+(cost?'₹'+fmtNum(cost):'<span class="no-cost-tag">NO COST</span>')+'</td>'+
      '<td class="value-cell">'+(val!==null?'<span style="color:var(--danger);font-weight:700">'+fmtCur(val)+'</span>':'<span style="color:var(--ink-5);font-style:italic">—</span>')+'</td></tr>';
  });
  html+='<tr class="total-row"><td colspan="4" style="padding:9px 12px;font-size:10px;letter-spacing:.4px;text-transform:uppercase;color:var(--danger)">Total Dead Stock Value</td>'+
    '<td class="value-cell" style="padding:9px 12px"><span style="color:var(--danger);font-size:13px">'+fmtCur(totalVal)+'</span>'+(partial?'<span style="color:var(--ink-4);font-size:10px;margin-left:5px;font-style:italic">(partial)</span>':'')+'</td></tr>';
  html+='</tbody></table>';
  el.innerHTML=html;
}
function renderFGDead(){ renderDeadTable('fg'); }
function renderRMDead(){ renderDeadTable('rm'); }

// ── PAGINATION ────────────────────────────────────────────
function renderPagination(tab,total){
  var ps=state.PAGE_SIZE,page=state[tab].page,tp=Math.ceil(total/ps);
  var el=document.getElementById(tab+'-pagination');
  if(tp<=1){el.innerHTML='<span class="pagination-info">'+total+' item'+(total!==1?'s':'')+'</span>';return;}
  var from=Math.min((page-1)*ps+1,total),to=Math.min(page*ps,total);
  var btns='<div class="page-btns"><button class="page-btn" onclick="goPage(\''+tab+'\','+Math.max(1,page-1)+')">‹</button>';
  var rs=Math.max(1,page-2),re=Math.min(tp,rs+4);
  for(var p=rs;p<=re;p++) btns+='<button class="page-btn'+(p===page?' active':'')+'" onclick="goPage(\''+tab+'\','+p+')">'+p+'</button>';
  btns+='<button class="page-btn" onclick="goPage(\''+tab+'\','+Math.min(tp,page+1)+')">›</button></div>';
  el.innerHTML='<span class="pagination-info">'+from+'–'+to+' of '+total+'</span>'+btns;
}
function goPage(tab,p){state[tab].page=p;if(tab==='fg')renderFGTable();else renderRMTable();}

function showFGError(m){document.getElementById('fg-table-wrap').innerHTML='<div class="empty" style="color:var(--danger)">⚠ '+m+'</div>';}
function showRMError(m){document.getElementById('rm-table-wrap').innerHTML='<div class="empty" style="color:var(--danger)">⚠ '+m+'</div>';}

// ══ OS FUNCTIONS ══════════════════════════════════════════
function loadOS(raw){
  state.os.data=(raw.invoices||[]).map(function(r){
    return{invoiceNo:r.invoiceNo||'',customer:r.customer||'',terms:r.terms||'',
           salesRep:r.salesRep||'',state:r.state||'',city:r.city||'',
           dispDate:r.dispDate||'',dueDate:r.dueDate||'',
           daysOver:r.daysOver!==null?r.daysOver:null,bucket:r.bucket||'unknown',
           amount:r.amount||0,gst:r.gst||0,
           payStatus:r.payStatus||null,payPlanned:r.payPlanned||'',payActual:r.payActual||''};
  });
  var overdue=state.os.data.filter(function(r){return['0-30','31-60','61-90','90+'].indexOf(r.bucket)>=0;});
  document.getElementById('sb-os-badge').textContent=overdue.length+' OD';
  osRenderKPIs(); osRenderBuckets(); osRenderTop10(); osRenderSalesRep(); osRenderStateWise(); osRenderDonut();
  osBuildSelects(); osApplyFilter();
}
function osFmt(n){if(!n||isNaN(n)) return '₹0'; if(n>=1e7) return '₹'+(n/1e7).toFixed(2)+' Cr'; if(n>=1e5) return '₹'+(n/1e5).toFixed(1)+' L'; return '₹'+Number(Math.round(n)).toLocaleString('en-IN');}
function osBktLabel(b){var m={'advance':'Advance Payment','notdue':'Not Yet Due','0-30':'0–30 Days Overdue','31-60':'31–60 Days Overdue','61-90':'61–90 Days Overdue','90+':'90+ Days Overdue'};return m[b]||b;}
function osBktColor(b){var m={'advance':'#166534','notdue':'#3b6d11','0-30':'#d97706','31-60':'#dc2626','61-90':'#991b1b','90+':'#7f1d1d'};return m[b]||'#9d9a93';}
function osBktBg(b){var m={'advance':'#f0fdf4','notdue':'#eaf3de','0-30':'#fef3e2','31-60':'#fef2f2','61-90':'#fef2f2','90+':'#7f1d1d'};return m[b]||'#f8f7f3';}
function osBktTxt(b){return b==='90+'?'#fff':osBktColor(b);}
function osObClass(b){var m={'advance':'ob-advance','notdue':'ob-notdue','0-30':'ob-030','31-60':'ob-3160','61-90':'ob-6190','90+':'ob-90p'};return m[b]||'';}

function osRenderKPIs(){
  var d=state.os.data;
  var overdue=d.filter(function(r){return['0-30','31-60','61-90','90+'].indexOf(r.bucket)>=0;});
  var advance=d.filter(function(r){return r.bucket==='advance';});
  var notdue=d.filter(function(r){return r.bucket==='notdue';});
  var critical=d.filter(function(r){return r.bucket==='90+';});
  var sum=function(arr){return arr.reduce(function(s,r){return s+r.amount;},0);};
  dsCountUp(document.getElementById('os-kpi-overdue'),sum(overdue),{format:osFmt});
  document.getElementById('os-kpi-overdue-sub').textContent=overdue.length+' invoices overdue';
  dsCountUp(document.getElementById('os-kpi-advance'),sum(advance),{format:osFmt});
  document.getElementById('os-kpi-advance-sub').textContent=advance.length+' invoices — pre-paid';
  dsCountUp(document.getElementById('os-kpi-notdue'),sum(notdue),{format:osFmt});
  document.getElementById('os-kpi-notdue-sub').textContent=notdue.length+' within credit period';
  dsCountUp(document.getElementById('os-kpi-total'),d.length,{format:fmtNum});
  document.getElementById('os-kpi-total-sub').textContent=osFmt(sum(d))+' total dispatched';
  dsCountUp(document.getElementById('os-kpi-critical'),sum(critical),{format:osFmt});
  document.getElementById('os-kpi-critical-sub').textContent=critical.length+' invoices — urgent!';
}
function osRenderBuckets(){
  var buckets=['advance','notdue','0-30','31-60','61-90','90+'];
  var d=state.os.data,bMap={},maxAmt=0;
  buckets.forEach(function(b){bMap[b]={amt:0,cnt:0};});
  d.forEach(function(r){if(bMap[r.bucket]){bMap[r.bucket].amt+=r.amount;bMap[r.bucket].cnt++;}});
  buckets.forEach(function(b){if(bMap[b].amt>maxAmt) maxAmt=bMap[b].amt;});
  var totalOD=['0-30','31-60','61-90','90+'].reduce(function(s,b){return s+bMap[b].amt;},0);
  document.getElementById('os-bucket-total').textContent=osFmt(totalOD);
  var html='';
  buckets.forEach(function(b){
    var pct=maxAmt?Math.round(bMap[b].amt/maxAmt*100):0;
    html+='<div class="os-bucket"><div class="os-bucket-head"><span class="os-bkt-label">'+osBktLabel(b)+'</span>'+
      '<div class="os-bkt-right"><span class="os-bkt-amt">'+osFmt(bMap[b].amt)+'</span>'+
      '<span class="badge" style="background:'+osBktBg(b)+';color:'+osBktTxt(b)+'">'+bMap[b].cnt+' inv</span></div></div>'+
      '<div style="background:var(--border);border-radius:4px;height:7px;overflow:hidden">'+
      '<div style="height:7px;border-radius:4px;width:'+pct+'%;background:'+osBktColor(b)+';transition:width .7s"></div></div></div>';
  });
  html+='<div class="os-divider"><span>Total Overdue</span><span style="font-weight:700;color:#dc2626">'+osFmt(totalOD)+'</span></div>';
  document.getElementById('os-bucket-bars').innerHTML=html;
}
function osRenderTop10(){
  var custMap={};
  state.os.data.forEach(function(r){
    if(r.bucket==='advance'||r.bucket==='notdue') return;
    if(!custMap[r.customer]) custMap[r.customer]={amt:0,maxDays:0};
    custMap[r.customer].amt+=r.amount;
    if((r.daysOver||0)>custMap[r.customer].maxDays) custMap[r.customer].maxDays=r.daysOver||0;
  });
  var top10=Object.keys(custMap).map(function(k){return{name:k,amt:custMap[k].amt,maxDays:custMap[k].maxDays};})
    .sort(function(a,b){return b.amt-a.amt;}).slice(0,10);
  document.getElementById('os-top10-total').textContent=osFmt(top10.reduce(function(s,r){return s+r.amt;},0));
  if(!top10.length){document.getElementById('os-top10-wrap').innerHTML='<div class="empty">No overdue</div>';return;}
  var html='<table><thead><tr><th>#</th><th>Customer</th><th style="text-align:right">OS Amount</th><th style="text-align:center">Risk</th></tr></thead><tbody>';
  top10.forEach(function(r,i){
    var risk=r.maxDays>90?'Critical':r.maxDays>60?'High':r.maxDays>30?'Medium':'Low';
    var rc=risk==='Critical'?'risk-critical':risk==='High'?'risk-high':risk==='Medium'?'risk-medium':'risk-safe';
    html+='<tr><td style="color:var(--ink-4);font-size:10.5px">'+(i+1)+'</td>'+
      '<td style="font-weight:500">'+r.name+'</td>'+
      '<td class="num-cell" style="color:#dc2626;font-weight:600">'+osFmt(r.amt)+'</td>'+
      '<td style="text-align:center"><span class="badge '+rc+'">'+risk+'</span></td></tr>';
  });
  html+='</tbody></table>';
  document.getElementById('os-top10-wrap').innerHTML=html;
}
function osRenderSalesRep(){
  var repMap={},COLORS=['#1e40af','#166534','#d97706','#dc2626','#7c3aed','#0369a1'];
  state.os.data.forEach(function(r){if(r.bucket==='advance'||r.bucket==='notdue'||!r.salesRep) return; repMap[r.salesRep]=(repMap[r.salesRep]||0)+r.amount;});
  var reps=Object.keys(repMap).map(function(k){return{name:k,amt:repMap[k]};}).sort(function(a,b){return b.amt-a.amt;});
  var maxAmt=reps.length?reps[0].amt:1;
  if(!reps.length){document.getElementById('os-rep-bars').innerHTML='<div class="empty">No data</div>';return;}
  var html='';
  reps.forEach(function(r,i){
    var pct=Math.round(r.amt/maxAmt*100);
    html+='<div class="os-bucket"><div class="os-bucket-head"><span class="os-bkt-label">'+r.name+'</span><span class="os-bkt-amt">'+osFmt(r.amt)+'</span></div>'+
      '<div style="background:var(--border);border-radius:4px;height:7px;overflow:hidden">'+
      '<div style="height:7px;border-radius:4px;width:'+pct+'%;background:'+COLORS[i%COLORS.length]+';transition:width .7s"></div></div></div>';
  });
  document.getElementById('os-rep-bars').innerHTML=html;
}
function osRenderStateWise(){
  var stMap={};
  state.os.data.forEach(function(r){if(r.bucket==='advance'||r.bucket==='notdue'||!r.state) return; stMap[r.state]=(stMap[r.state]||0)+r.amount;});
  var states=Object.keys(stMap).map(function(k){return{name:k,amt:stMap[k]};}).sort(function(a,b){return b.amt-a.amt;});
  var maxAmt=states.length?states[0].amt:1;
  document.getElementById('os-state-total').textContent=osFmt(states.reduce(function(s,r){return s+r.amt;},0));
  if(!states.length){document.getElementById('os-state-bars').innerHTML='<div class="empty">No data</div>';return;}
  var html='';
  states.forEach(function(r){
    var pct=Math.round(r.amt/maxAmt*100);
    html+='<div class="os-bucket"><div class="os-bucket-head"><span class="os-bkt-label">'+r.name+'</span><span class="os-bkt-amt">'+osFmt(r.amt)+'</span></div>'+
      '<div style="background:var(--border);border-radius:4px;height:7px;overflow:hidden">'+
      '<div style="height:7px;border-radius:4px;width:'+pct+'%;background:#dc2626;transition:width .7s"></div></div></div>';
  });
  document.getElementById('os-state-bars').innerHTML=html;
}
function osRenderDonut(){
  var buckets=['0-30','31-60','61-90','90+'];
  var labels=['0–30 Days','31–60 Days','61–90 Days','90+ Days'];
  var colors=['#d97706','#dc2626','#991b1b','#7f1d1d'];
  var vals=buckets.map(function(b){return state.os.data.filter(function(r){return r.bucket===b;}).reduce(function(s,r){return s+r.amount;},0);});
  if(osDonutChart) osDonutChart.destroy();
  var ctx=document.getElementById('osDonut');
  if(!ctx) return;
  var total=vals.reduce(function(s,v){return s+v;},0);
  // v3 "wow factor" pass: dsCenterLabel/DS_CHART_TOOLTIP (shared.js) give this donut a hero
  // total in the hole it used to waste, and a tooltip matching the app's card system instead of
  // Chart.js's default black box — same helpers Gross Margin's donut uses.
  // Bug fix, same as Gross Margin's donut: the custom plugins array must be a sibling of
  // `options`, not nested inside it (nested there, it silently overwrote options.plugins's
  // {legend,tooltip} object via duplicate-key last-write-wins, and the center label never
  // actually registered as a plugin at all).
  // responsive:false + a fixed-size canvas (see the HTML comment at this canvas) — same reason
  // Gross Margin's donut uses this, not the responsive+container-measured pattern: a chart
  // created while its page is still display:none never gets a correct size to measure in the
  // first place, and responsive mode has no fallback for that.
  osDonutChart=new Chart(ctx,{type:'doughnut',data:{labels:labels,datasets:[{data:vals,backgroundColor:colors,borderWidth:2,borderColor:'#fff',hoverOffset:4}]},
    options:{responsive:false,cutout:'65%',plugins:{legend:{display:false},tooltip:{...DS_CHART_TOOLTIP,callbacks:{label:function(c){return c.label+': '+osFmt(c.raw);}}}}},
    plugins:[dsCenterLabel(osFmt(total),'Overdue')]});
  var leg='';
  labels.forEach(function(l,i){var pct=total?Math.round(vals[i]/total*100):0;leg+='<span style="display:flex;align-items:center;gap:4px"><span style="width:8px;height:8px;border-radius:2px;background:'+colors[i]+';display:inline-block"></span>'+l+' ('+pct+'%)</span>';});
  document.getElementById('os-donut-legend').innerHTML=leg;
}
function osBuildSelects(){
  var reps={},states={};
  state.os.data.forEach(function(r){if(r.salesRep) reps[r.salesRep]=1;if(r.state) states[r.state]=1;});
  var rSel=document.getElementById('os-rep-filter');
  rSel.innerHTML='<option value="">All Sales Reps</option>';
  Object.keys(reps).sort().forEach(function(r){rSel.innerHTML+='<option>'+r+'</option>';});
  var sSel=document.getElementById('os-state-filter');
  sSel.innerHTML='<option value="">All States</option>';
  Object.keys(states).sort().forEach(function(s){sSel.innerHTML+='<option>'+s+'</option>';});
}
function osSetBucket(b){
  state.os.bucket=b;state.os.page=1;
  ['all','advance','notdue','030','3160','6190','90p'].forEach(function(x){var el=document.getElementById('osf-'+x);if(el) el.classList.remove('active');});
  var map={'all':'all','advance':'advance','notdue':'notdue','0-30':'030','31-60':'3160','61-90':'6190','90+':'90p'};
  var el=document.getElementById('osf-'+(map[b]||'all'));if(el) el.classList.add('active');
  osApplyFilter();
}
function osApplyFilter(){
  var q=document.getElementById('os-search').value.toLowerCase();
  var rep=document.getElementById('os-rep-filter').value;
  var st=document.getElementById('os-state-filter').value;
  var bkt=state.os.bucket;
  state.os.filtered=state.os.data.filter(function(r){
    if(q&&!r.invoiceNo.toLowerCase().includes(q)&&!r.customer.toLowerCase().includes(q)) return false;
    if(rep&&r.salesRep!==rep) return false;
    if(st&&r.state!==st) return false;
    if(bkt!=='all'&&r.bucket!==bkt) return false;
    return true;
  });
  state.os.page=1; osSortData(); osRenderTable();
}
function osSortData(){
  var col=state.os.sort.col,dir=state.os.sort.dir;
  state.os.filtered.sort(function(a,b){
    var av=a[col],bv=b[col];
    if(av===null||av===undefined) return 1;
    if(bv===null||bv===undefined) return -1;
    if(typeof av==='string') return dir*av.localeCompare(bv);
    return dir*(av-bv);
  });
}
function osToggleSort(col){
  if(state.os.sort.col===col) state.os.sort.dir*=-1;
  else{state.os.sort.col=col;state.os.sort.dir=-1;}
  state.os.page=1;osSortData();osRenderTable();
}
function osRenderTable(){
  var rows=state.os.filtered,s=state.os.sort;
  var slice=rows;
  document.getElementById('os-row-count').textContent=rows.length+' invoice'+(rows.length!==1?'s':'');
  function th(col,label,align){
    var sorted=s.col===col,icon=sorted?(s.dir===1?' ▲':' ▼'):' ⇅';
    var st=align?' style="text-align:'+align+'"':'';
    return '<th class="'+(sorted?'sorted os':'')+'"'+st+' onclick="osToggleSort(\''+col+'\')">'+label+'<span style="font-size:9px;margin-left:3px;opacity:.5">'+icon+'</span></th>';
  }
  if(!slice.length){document.getElementById('os-table-wrap').innerHTML='<div class="empty">No invoices found</div>';document.getElementById('os-pagination').innerHTML='';return;}
  var html='<table><thead><tr>'+th('invoiceNo','Invoice No')+th('customer','Customer')+th('dispDate','Dispatch Date')+th('terms','Terms','center')+th('dueDate','Planned Date')+th('daysOver','Days Overdue','center')+th('amount','OS Amount','right')+th('salesRep','Sales Rep')+'<th style="text-align:center">Ageing</th><th style="text-align:center">Pay Status</th></tr></thead><tbody>';
  slice.forEach(function(r){
    var daysStr=r.bucket==='advance'?'<span class="ob ob-advance">Advance</span>':r.daysOver===null?'—':r.daysOver<0?'<span class="ob ob-notdue">-'+Math.abs(r.daysOver)+'d</span>':'<span style="display:inline-flex;padding:2px 7px;border-radius:4px;font-size:10.5px;font-weight:700;font-family:\'DM Mono\',monospace;background:'+osBktBg(r.bucket)+';color:'+osBktTxt(r.bucket)+'">'+r.daysOver+'d</span>';
    // Pay Status badge from Split_FMS
    var payBadge;
    if(r.payStatus==='paid'){
      payBadge='<span class="ob" style="background:#dcfce7;color:#166534;border:1px solid #bbf7d0">✓ Paid</span>'+(r.payActual?'<br><span style="font-size:9.5px;color:#6b7280">'+r.payActual+'</span>':'');
    } else if(r.payStatus==='overdue'){
      var daysLate=r.payPlanned?Math.floor((new Date()-new Date(r.payPlanned.split('/').reverse().join('-')))/86400000):null;
      payBadge='<span class="ob" style="background:#fef2f2;color:#dc2626;border:1px solid #fecaca">⚠ Overdue'+(daysLate!==null?' '+daysLate+'d':'')+'</span>';
    } else if(r.payStatus==='ontrack'){
      payBadge='<span class="ob" style="background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe">● On Track</span>'+(r.payPlanned?'<br><span style="font-size:9.5px;color:#6b7280">Plan: '+r.payPlanned+'</span>':'');
    } else {
      payBadge='<span style="color:#d1d5db;font-size:10px">—</span>';
    }
    html+='<tr><td style="font-family:\'DM Mono\',monospace;font-size:10.5px;color:var(--ink-3)">'+r.invoiceNo+'</td>'+
      '<td style="font-weight:500;min-width:150px">'+r.customer+'</td>'+
      '<td style="font-family:\'DM Mono\',monospace;font-size:11.5px">'+r.dispDate+'</td>'+
      '<td style="text-align:center;color:var(--ink-3)">'+r.terms+'</td>'+
      '<td style="font-family:\'DM Mono\',monospace;font-size:11.5px;color:'+(r.bucket==='notdue'||r.bucket==='advance'?'#166534':'#dc2626')+'">'+(r.payPlanned||r.dueDate)+'</td>'+
      '<td style="text-align:center">'+daysStr+'</td>'+
      '<td class="value-cell" style="color:'+(r.bucket==='advance'||r.bucket==='notdue'?'var(--ink)':'#dc2626')+'">'+osFmt(r.amount)+'</td>'+
      '<td style="color:var(--ink-3)">'+r.salesRep+'</td>'+
      '<td style="text-align:center"><span class="ob '+osObClass(r.bucket)+'">'+osBktLabel(r.bucket)+'</span></td>'+
      '<td style="text-align:center;white-space:nowrap">'+payBadge+'</td></tr>';
  });
  html+='</tbody></table>';
  document.getElementById('os-table-wrap').innerHTML=html;
  document.getElementById('os-pagination').innerHTML='<span class="pagination-info">'+rows.length+' invoice'+(rows.length!==1?'s':'')+'</span>';
}
function showOSError(m){document.getElementById('os-table-wrap').innerHTML='<div class="empty" style="color:#dc2626">⚠ '+m+'</div>';}

// ══ PO STATE ══
state.po = { data:[], filtered:[], page:1, sort:{col:'plannedDate',dir:1} };

// ══ PO LOAD ══
function loadPO(raw){
  state.po.data = raw.orders || [];
  var totalOrders = new Set(state.po.data.map(function(r){ return r.orderId; })).size;
  var overdue = state.po.data.filter(function(r){ return r.isOverdue; });
  var overdueOrders = new Set(overdue.map(function(r){ return r.orderId; })).size;
  document.getElementById('sb-po-badge').textContent = overdueOrders + ' OD';
  if(overdueOrders > 0) document.getElementById('sb-po-badge').classList.add('overdue-badge');
  poRenderKPIs(); poBuildSelects(); poRenderCharts(); poApplyFilter();
}
function poRenderKPIs(){
  var d = state.po.data;
  var orderIds = new Set(d.map(function(r){ return r.orderId; }));
  var customers = new Set(d.map(function(r){ return r.customer; }));
  var totalQty = d.reduce(function(s,r){ return s+r.pendingQty; }, 0);
  var totalAmt = d.reduce(function(s,r){ return s+r.pendingAmt; }, 0);
  var overdue = d.filter(function(r){ return r.isOverdue; });
  var overdueIds = new Set(overdue.map(function(r){ return r.orderId; }));
  var overdueAmt = overdue.reduce(function(s,r){ return s+r.pendingAmt; }, 0);
  dsCountUp(document.getElementById('po-kpi-orders'),orderIds.size,{format:fmtNum});
  document.getElementById('po-kpi-orders-sub').textContent = orderIds.size + ' unique orders, ' + d.length + ' lines';
  dsCountUp(document.getElementById('po-kpi-qty'),Math.round(totalQty),{format:fmtNum});
  dsCountUp(document.getElementById('po-kpi-amt'),totalAmt,{format:fmtCur});
  document.getElementById('po-kpi-amt-sub').textContent = 'GST: ' + fmtCur(d.reduce(function(s,r){ return s+r.pendingGst; }, 0));
  dsCountUp(document.getElementById('po-kpi-overdue'),overdueIds.size,{format:fmtNum});
  document.getElementById('po-kpi-overdue-sub').textContent = overdue.length + ' lines past planned date';
  dsCountUp(document.getElementById('po-kpi-customers'),customers.size,{format:fmtNum});
  dsCountUp(document.getElementById('po-kpi-overdue-amt'),overdueAmt,{format:fmtCur});
}
function poRenderCharts(){
  var d = state.po.data;
  var COLORS = ['#7c3aed','#1e40af','#b45309','#166534','#dc2626','#0369a1','#9a3412','#065f46'];
  // Category bars
  var catMap = {};
  d.forEach(function(r){ catMap[r.category] = (catMap[r.category]||0) + r.pendingAmt; });
  var cats = Object.keys(catMap).map(function(k){ return {name:k, amt:catMap[k]}; }).sort(function(a,b){ return b.amt-a.amt; });
  var maxAmt = cats.length ? cats[0].amt : 1;
  var totalAmt = cats.reduce(function(s,c){ return s+c.amt; }, 0);
  document.getElementById('po-cat-total').textContent = fmtCur(totalAmt);
  var html = '';
  cats.forEach(function(c,i){
    var pct = Math.round(c.amt/maxAmt*100);
    html += '<div class="bar-row"><div class="bar-label" style="max-width:180px" title="'+c.name+'">'+c.name+'</div>'+
      '<div class="bar-track" style="flex:1;background:var(--border);border-radius:4px;height:7px;overflow:hidden;min-width:50px">'+
      '<div class="bar-fill" style="width:'+pct+'%;background:'+COLORS[i%COLORS.length]+'"></div></div>'+
      '<div class="bar-value">'+fmtCur(c.amt)+'</div></div>';
  });
  document.getElementById('po-cat-bars').innerHTML = html || '<div class="empty">No data</div>';
  // Top 10 customers
  var custMap = {};
  d.forEach(function(r){ custMap[r.customer] = (custMap[r.customer]||0) + r.pendingAmt; });
  var top10 = Object.keys(custMap).map(function(k){ return {name:k, amt:custMap[k]}; }).sort(function(a,b){ return b.amt-a.amt; }).slice(0,10);
  var maxC = top10.length ? top10[0].amt : 1;
  document.getElementById('po-top10-total').textContent = fmtCur(top10.reduce(function(s,c){ return s+c.amt; }, 0));
  html = '';
  top10.forEach(function(r,i){
    var pct = Math.round(r.amt/maxC*100);
    html += '<div class="bar-row"><div class="bar-rank">'+(i+1)+'</div>'+
      '<div class="bar-label" title="'+r.name+'" style="max-width:180px">'+r.name+'</div>'+
      '<div class="bar-track" style="flex:1;background:var(--border);border-radius:4px;height:7px;overflow:hidden;min-width:50px">'+
      '<div class="bar-fill" style="width:'+pct+'%;background:#7c3aed"></div></div>'+
      '<div class="bar-value">'+fmtCur(r.amt)+'</div></div>';
  });
  document.getElementById('po-top10-bars').innerHTML = html || '<div class="empty">No data</div>';
  // Sales rep bars
  var repMap = {};
  d.forEach(function(r){ if(r.salesRep) repMap[r.salesRep] = (repMap[r.salesRep]||0) + r.pendingAmt; });
  var reps = Object.keys(repMap).map(function(k){ return {name:k, amt:repMap[k]}; }).sort(function(a,b){ return b.amt-a.amt; });
  var maxR = reps.length ? reps[0].amt : 1;
  html = '';
  reps.forEach(function(r,i){
    var pct = Math.round(r.amt/maxR*100);
    html += '<div class="os-bucket"><div class="os-bucket-head"><span class="os-bkt-label">'+r.name+'</span><span class="os-bkt-amt">'+fmtCur(r.amt)+'</span></div>'+
      '<div style="background:var(--border);border-radius:4px;height:7px;overflow:hidden">'+
      '<div style="height:7px;border-radius:4px;width:'+pct+'%;background:'+COLORS[i%COLORS.length]+';transition:width .7s"></div></div></div>';
  });
  var repEl = document.getElementById('po-rep-bars'); if(repEl) repEl.innerHTML = html || '<div class="empty">No data</div>';
  // State bars
  var stMap = {};
  d.forEach(function(r){ if(r.state) stMap[r.state.trim()] = (stMap[r.state.trim()]||0) + r.pendingAmt; });
  var states = Object.keys(stMap).map(function(k){ return {name:k, amt:stMap[k]}; }).sort(function(a,b){ return b.amt-a.amt; });
  var maxS = states.length ? states[0].amt : 1;
  html = '';
  states.forEach(function(r){
    var pct = Math.round(r.amt/maxS*100);
    html += '<div class="os-bucket"><div class="os-bucket-head"><span class="os-bkt-label">'+r.name+'</span><span class="os-bkt-amt">'+fmtCur(r.amt)+'</span></div>'+
      '<div style="background:var(--border);border-radius:4px;height:7px;overflow:hidden">'+
      '<div style="height:7px;border-radius:4px;width:'+pct+'%;background:#7c3aed;transition:width .7s"></div></div></div>';
  });
  var stEl = document.getElementById('po-state-bars'); if(stEl) stEl.innerHTML = html || '<div class="empty">No data</div>';
}
var poSdData = { cust:[], prod:[], cat:[] };
var poSdVal  = { cust:'', prod:'', cat:'' };
function poBuildSelects(){
  var cats={}, custs={}, prods={};
  state.po.data.forEach(function(r){
    if(r.category) cats[r.category]=1;
    if(r.customer) custs[r.customer.trim()]=1;
    if(r.product)  prods[r.product.trim()]=1;
  });
  poSdData.cat  = Object.keys(cats).sort();
  poSdData.cust = Object.keys(custs).sort();
  poSdData.prod = Object.keys(prods).sort();
  ['cust','prod','cat'].forEach(function(k){ poSdRender(k,''); });
}
function poSdRender(k, q){
  var items = poSdData[k].filter(function(v){ return !q || v.toLowerCase().includes(q.toLowerCase()); });
  var labels = {cust:'All Customers', prod:'All Products', cat:'All Categories'};
  var el = document.getElementById('po-'+k+'-list');
  var sel = poSdVal[k];
  var html = '<div class="po-sd-item'+(sel===''?' selected':'')+'" onclick="poSdSelect(\''+k+'\',\'\')">'+labels[k]+'</div>';
  items.forEach(function(v){
    html += '<div class="po-sd-item'+(sel===v?' selected':'')+'" onclick="poSdSelect(\''+k+'\','+JSON.stringify(v)+')">'+v+'</div>';
  });
  el.innerHTML = html;
}
function poSdToggle(k){
  ['cust','prod','cat'].forEach(function(x){
    if(x!==k) document.getElementById('po-'+x+'-drop').style.display='none';
  });
  var drop = document.getElementById('po-'+k+'-drop');
  var open = drop.style.display==='none';
  drop.style.display = open?'block':'none';
  if(open){ var qi=document.getElementById('po-'+k+'-q'); qi.value=''; qi.focus(); poSdRender(k,''); }
}
function poSdFilter(k){
  poSdRender(k, document.getElementById('po-'+k+'-q').value);
}
function poSdSelect(k, v){
  poSdVal[k] = v;
  var labels = {cust:'All Customers', prod:'All Products', cat:'All Categories'};
  document.getElementById('po-'+k+'-label').textContent = v || labels[k];
  document.getElementById('po-'+k+'-drop').style.display='none';
  poApplyFilter();
}
document.addEventListener('click', function(e){
  ['cust','prod','cat'].forEach(function(k){
    var wrap = document.getElementById('po-'+k+'-wrap');
    if(wrap && !wrap.contains(e.target)) document.getElementById('po-'+k+'-drop').style.display='none';
  });
});
function poApplyFilter(){
  var q = document.getElementById('po-search').value.toLowerCase();
  var cat = poSdVal.cat;
  var cust = poSdVal.cust;
  var prod = poSdVal.prod;
  var status = document.getElementById('po-status-filter').value;
  var overdueOnly = document.getElementById('po-overdue-only').checked;
  state.po.filtered = state.po.data.filter(function(r){
    if(q && !r.orderId.toLowerCase().includes(q)) return false;
    if(cust && r.customer.trim() !== cust) return false;
    if(prod && r.product.trim() !== prod) return false;
    if(cat && r.category !== cat) return false;
    if(overdueOnly && !r.isOverdue) return false;
    if(status==='overdue' && !r.isOverdue) return false;
    if(status==='partial' && r.orderStatus!=='Partial') return false;
    if(status==='pending' && (r.isOverdue || r.orderStatus==='Partial')) return false;
    return true;
  });
  state.po.page = 1; poSortData(); poRenderTable();
}
function poDownloadCSV(){
  var rows = state.po.filtered;
  var headers = ['Order ID','Product','Category','Customer','State','Sales Rep','Planned Date','Ordered Qty','Dispatched','Pending Qty','Pending Value','Status'];
  var csv = headers.join(',') + '\n';
  rows.forEach(function(r){
    var status = r.isOverdue ? 'Overdue' : (r.orderStatus==='Partial' ? 'Partial' : 'Pending');
    var row = [r.orderId, r.product, r.category, r.customer, r.state, r.salesRep, r.plannedDate, r.qty, r.dispatchQty, r.pendingQty, r.pendingAmt, status];
    csv += row.map(function(v){ return '"'+(v||'').toString().replace(/"/g,'""')+'"'; }).join(',') + '\n';
  });
  var blob = new Blob([csv], {type:'text/csv'});
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'pending_orders_'+new Date().toISOString().slice(0,10)+'.csv';
  a.click();
}
function parseDMY(s){ if(!s)return 0; var p=s.split('/'); return p.length===3?new Date(p[2],p[1]-1,p[0]).getTime():0; }
function poSortData(){
  var col=state.po.sort.col, dir=state.po.sort.dir;
  state.po.filtered.sort(function(a,b){
    var av=a[col], bv=b[col];
    if(av===null||av===undefined) return 1;
    if(bv===null||bv===undefined) return -1;
    if(col==='plannedDate') return dir*(parseDMY(av)-parseDMY(bv));
    if(typeof av==='string') return dir*av.localeCompare(bv);
    return dir*(av-bv);
  });
}
function poToggleSort(col){
  if(state.po.sort.col===col) state.po.sort.dir*=-1;
  else{state.po.sort.col=col;state.po.sort.dir=-1;}
  state.po.page=1; poSortData(); poRenderTable();
}
function poRenderTable(){
  var rows=state.po.filtered, s=state.po.sort;
  var start=0, slice=rows;
  document.getElementById('po-row-count').textContent = rows.length+' line'+(rows.length!==1?'s':'');
  function th(col,label,align){
    var sorted=s.col===col, icon=sorted?(s.dir===1?' ▲':' ▼'):' ⇅';
    var st=align?' style="text-align:'+align+'"':'';
    return '<th class="'+(sorted?'sorted po':'')+'"'+st+' onclick="poToggleSort(\''+col+'\')">'+label+'<span style="font-size:9px;margin-left:3px;opacity:.5">'+icon+'</span></th>';
  }
  if(!slice.length){ document.getElementById('po-table-wrap').innerHTML='<div class="empty">No pending orders found</div>'; document.getElementById('po-pagination').innerHTML=''; return; }
  var html='<table><thead><tr><th>#</th>'+th('orderId','Order ID')+th('product','Product')+th('category','Category')+th('customer','Customer')+th('state','State')+th('salesRep','Sales Rep')+th('plannedDate','Planned Date','center')+th('qty','Ordered Qty','right')+th('dispatchQty','Dispatched','right')+th('pendingQty','Pending Qty','right')+th('pendingAmt','Pending Value','right')+'<th style="text-align:center">Status</th></tr></thead><tbody>';
  slice.forEach(function(r,i){
    var rowCls = r.isOverdue ? ' class="po-overdue-row"' : '';
    var statusBadge = r.isOverdue
      ? '<span class="overdue-badge">⚠ Overdue</span>'
      : (r.orderStatus==='Partial' ? '<span class="partial-badge">◑ Partial</span>' : '<span class="ok-badge">● Pending</span>');
    var dispPct = r.qty > 0 ? Math.round(r.dispatchQty/r.qty*100) : 0;
    html += '<tr'+rowCls+'>'+
      '<td style="color:var(--ink-5);font-size:10.5px">'+(start+i+1)+'</td>'+
      '<td style="font-family:\'DM Mono\',monospace;font-size:10.5px;color:var(--po-accent);font-weight:600">'+r.orderId+'</td>'+
      '<td style="font-weight:500;min-width:160px;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="'+r.product+'">'+r.product+'</td>'+
      '<td><span class="cat-badge cat-po">'+r.category+'</span></td>'+
      '<td style="min-width:130px;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="'+r.customer+'">'+r.customer+'</td>'+
      '<td style="color:var(--ink-3)">'+r.state+'</td>'+
      '<td style="color:var(--ink-3)">'+r.salesRep+'</td>'+
      '<td style="text-align:center;font-family:\'DM Mono\',monospace;font-size:11.5px;color:'+(r.isOverdue?'var(--overdue)':'var(--ink-2)')+'">'+r.plannedDate+'</td>'+
      '<td class="num-cell">'+fmtNum(r.qty)+'</td>'+
      '<td style="text-align:right">'+
        '<div style="display:flex;align-items:center;gap:5px;justify-content:flex-end">'+
        '<div style="width:36px;height:4px;border-radius:3px;background:var(--border);overflow:hidden"><div style="height:100%;border-radius:3px;width:'+dispPct+'%;background:var(--success)"></div></div>'+
        '<span style="font-family:\'DM Mono\',monospace;font-size:11.5px">'+fmtNum(r.dispatchQty)+'</span></div>'+
      '</td>'+
      '<td class="num-cell" style="color:'+(r.isOverdue?'var(--overdue)':'var(--po-accent)')+';font-weight:600">'+fmtNum(r.pendingQty)+'</td>'+
      '<td class="value-cell" style="color:'+(r.isOverdue?'var(--overdue)':'var(--po-accent)')+';font-weight:600">'+fmtCur(r.pendingAmt)+'</td>'+
      '<td style="text-align:center">'+statusBadge+'</td></tr>';
  });
  html += '</tbody></table>';
  document.getElementById('po-table-wrap').innerHTML = html;
  document.getElementById('po-pagination').innerHTML='<span class="pagination-info">'+rows.length+' line'+(rows.length!==1?'s':'')+'</span>';
}

// ══ SALES PIPELINE ══════════════════════════════════════════
var spState = { data:null, filtered:[], page:1, sort:{col:'target',dir:-1}, search:'', colFilters:{} };

function spGetColVal(r, col){
  switch(col){
    case 'live':     return r.live||0;
    case 'opening':  return r.opening||0;
    case 'target':   return r.target||0;
    case 'orderQty': return r.orderQty||0;
    case 'dispatch': return r.dispatch||0;
    case 'pending':    return r.pending||0;
    case 'pendingAmt': return r.pendingAmt||0;
    case 'ach':        return r.ach||0;
    case 'name':       return r.name||'';
    default: return '';
  }
}

function spOpenFilter(col, event){
  event.stopPropagation();
  var existing = document.getElementById('sp-filter-popup');
  if(existing){ existing.remove(); return; }
  var rows = spState.data ? spState.data.rows : [];
  var values = [];
  var seen = new Set();
  if(col==='customer'){
    rows.forEach(function(r){ (r.dispLines||[]).forEach(function(l){ var v=l.customer||''; if(v&&!seen.has(v)){seen.add(v);values.push(v);} }); });
    values.sort(function(a,b){return a.localeCompare(b);});
  } else {
    rows.forEach(function(r){ var v=String(spGetColVal(r,col)); if(!seen.has(v)){seen.add(v);values.push(v);} });
    values.sort(function(a,b){ var na=parseFloat(a),nb=parseFloat(b); return (!isNaN(na)&&!isNaN(nb))?na-nb:a.localeCompare(b); });
  }
  var active = spState.colFilters[col] || null;
  var popup = document.createElement('div');
  popup.id = 'sp-filter-popup';
  popup.style.cssText = 'position:fixed;background:#1e2a3a;border:1px solid #334155;border-radius:8px;padding:12px;z-index:9999;min-width:190px;max-height:320px;display:flex;flex-direction:column;gap:6px;box-shadow:0 8px 24px rgba(0,0,0,.5)';
  var rect = event.target.getBoundingClientRect();
  popup.style.top  = (rect.bottom+4)+'px';
  popup.style.left = Math.min(rect.left, window.innerWidth-210)+'px';
  var listHtml = '<div id="sp-flt-list" style="overflow-y:auto;max-height:190px;display:flex;flex-direction:column;gap:2px">';
  values.forEach(function(v){
    var chk = !active || active.has(v);
    listHtml += '<label style="display:flex;align-items:center;gap:6px;cursor:pointer;padding:2px 0;color:#e2e8f0;font-size:12px"><input type="checkbox" value="'+v+'" '+(chk?'checked':'')+' style="cursor:pointer"> '+v+'</label>';
  });
  listHtml += '</div>';
  popup.innerHTML =
    '<input id="sp-flt-s" type="text" placeholder="Search..." style="padding:5px 8px;border:1px solid #334155;border-radius:5px;background:#0f172a;color:#fff;font-size:12px;width:100%;box-sizing:border-box">'+
    '<div style="display:flex;gap:5px">'+
      '<button onclick="document.querySelectorAll(\'#sp-flt-list input\').forEach(function(c){c.checked=true})" style="flex:1;padding:3px;background:#059669;color:#fff;border:none;border-radius:4px;font-size:11px;cursor:pointer">All</button>'+
      '<button onclick="document.querySelectorAll(\'#sp-flt-list input\').forEach(function(c){c.checked=false})" style="flex:1;padding:3px;background:#475569;color:#fff;border:none;border-radius:4px;font-size:11px;cursor:pointer">None</button>'+
    '</div>'+
    listHtml+
    '<button onclick="spApplyFilter(\''+col+'\')" style="padding:5px;background:#1d4ed8;color:#fff;border:none;border-radius:5px;font-size:12px;font-weight:700;cursor:pointer;width:100%">Done</button>';
  document.body.appendChild(popup);
  document.getElementById('sp-flt-s').addEventListener('input',function(){
    var q=this.value.toLowerCase();
    document.querySelectorAll('#sp-flt-list label').forEach(function(l){ l.style.display=l.textContent.toLowerCase().includes(q)?'':'none'; });
  });
  setTimeout(function(){
    document.addEventListener('click',function h(e){ if(!popup.contains(e.target)){popup.remove();document.removeEventListener('click',h);} });
  },100);
}

function spApplyFilter(col){
  var checked=[].slice.call(document.querySelectorAll('#sp-flt-list input:checked')).map(function(c){return c.value;});
  var popup=document.getElementById('sp-filter-popup'); if(popup) popup.remove();
  var rows = spState.data ? spState.data.rows : [];
  var allVals = col==='customer'
    ? new Set(rows.reduce(function(a,r){(r.dispLines||[]).forEach(function(l){if(l.customer)a.push(l.customer);});return a;},[]))
    : new Set(rows.map(function(r){return String(spGetColVal(r,col));}));
  if(checked.length===0){ spState.colFilters[col]=new Set(['__none__']); }
  else if(checked.length===allVals.size){ delete spState.colFilters[col]; }
  else { spState.colFilters[col]=new Set(checked); }
  spApplyFilters();
}

function spApplyFilters(){
  var rows = spState.data ? spState.data.rows : [];
  var s = spState.search;
  spState.filtered = rows.filter(function(r){
    if(s && r.name.toLowerCase().indexOf(s)<0) return false;
    for(var col in spState.colFilters){
      if(col==='customer'){
        var custs=(r.dispLines||[]).map(function(l){return l.customer||'';}).filter(Boolean);
        if(!custs.some(function(c){return spState.colFilters[col].has(c);})) return false;
      } else {
        if(!spState.colFilters[col].has(String(spGetColVal(r,col)))) return false;
      }
    }
    return true;
  });
  spRenderTable();
}

function spExportCSV(){
  var rows = spState.filtered;
  var openLbl = spState.data ? spState.data.openDateLabel : 'Opening';
  var cols = ['SR','Product','Closing Stock',openLbl,'Target','Order Qty','Dispatch','Pending Qty','Pending Amt','Ach%'];
  var csv = [cols.join(',')];
  rows.forEach(function(r){
    csv.push([r.sr,'"'+r.name+'"',r.live,r.opening,r.target,r.orderQty||0,r.dispatch,r.pending,r.pendingAmt||0,r.ach].join(','));
  });
  var a=document.createElement('a');
  a.href='data:text/csv;charset=utf-8,'+encodeURIComponent(csv.join('\n'));
  a.download='sales_pipeline_'+((spState.data&&spState.data.monthLabel)||'export')+'.csv';
  a.click();
}

function spShowError(msg){
  document.getElementById('sp-table-wrap').innerHTML='<div class="empty" style="color:var(--danger)">⚠ '+msg+'</div>';
  var lbl=document.getElementById('sp-month-label'); if(lbl) lbl.textContent='Error';
}

function loadSP(raw){
  spState.data = raw;
  spState.page = 1;
  spState.search = '';
  // Populate month selector
  var sel = document.getElementById('sp-month-sel');
  sel.innerHTML = (raw.months||[]).map(function(m){
    return '<option'+(m===raw.monthLabel?' selected':'')+'>'+m+'</option>';
  }).join('');
  var lbl2=document.getElementById('sp-month-label'); if(lbl2) lbl2.textContent = raw.monthLabel;
  document.getElementById('sb-sp-badge').textContent = (raw.rows||[]).length;
  spRenderKPIs(raw.kpis||{});
  spState.filtered = (raw.rows||[]).slice();
  spRenderTable();
}

function spRefresh(){ spLoadMonth(); }
function spLoadMonth(){
  var m = document.getElementById('sp-month-sel').value;
  if (!m || m==='Loading…') return;
  document.getElementById('sp-table-wrap').innerHTML='<div class="loading"><div class="spinner" style="border-top-color:var(--sp-accent)"></div><p>Loading...</p></div>';
  var lbl3=document.getElementById('sp-month-label'); if(lbl3) lbl3.textContent = m;
  authFetch('/api/pipeline?month='+encodeURIComponent(m)).then(function(r){return r.json();}).then(function(d){ if(d.ok) loadSP(d); else spShowError(d.error); }).catch(function(e){ spShowError(e.message); });
}

function spRenderKPIs(k){
  var ach = k.totAch||0;
  var achColor = ach>=90?'var(--success)':ach>=60?'var(--warning)':'var(--danger)';
  function setText(id,v){ var el=document.getElementById(id); if(el) el.textContent=v; }
  dsCountUp(document.getElementById('sp-k-live'),k.totLive||0,{format:fmtNum});
  setText('sp-k-live-s',  fmtNum(k.totLive||0)+' units');
  setText('sp-k-inward',  fmtNum(k.totInward||0));
  setText('sp-k-total',   fmtNum(k.totTotal||0));
  dsCountUp(document.getElementById('sp-k-target'),k.totTarget||0,{format:fmtNum});
  dsCountUp(document.getElementById('sp-k-disp'),k.totDisp||0,{format:fmtNum});
  setText('sp-k-disp-s',  fmtCur(k.totDispAmt||0));
  dsCountUp(document.getElementById('sp-k-disp-amt'),k.totDispAmt||0,{format:fmtCur});
  dsCountUp(document.getElementById('sp-k-ach'),ach,{format:function(v){return Math.round(v)+'%';}});
  setText('sp-k-ach-s',   fmtNum(k.totDisp||0)+' / '+fmtNum(k.totTarget||0));
  dsCountUp(document.getElementById('sp-k-pendq'),k.totPendQ||0,{format:function(v){return(v>0?'+':'')+fmtNum(v);}});
  dsCountUp(document.getElementById('sp-k-pendamt'),k.totPendAmt||0,{format:fmtCur});
  dsCountUp(document.getElementById('sp-k-avgpend'),k.avgPendAmt||0,{format:fmtCur});
  // Phase 3 unification: sp-k-ach now lives in a plain white .kpi-card (matching Stock/OS/PO),
  // not a glossy colored card — so achievement level is now conveyed by coloring just the
  // value text, same convention OS Ageing's "Not Yet Due" kpi-card already uses.
  var achEl = document.getElementById('sp-k-ach');
  if(achEl) achEl.style.color = achColor;
}

function spApplySearch(){
  spState.search = (document.getElementById('sp-search').value||'').toLowerCase().trim();
  spState.page = 1;
  spApplyFilters();
}

function spToggleSort(col){
  if(spState.sort.col===col) spState.sort.dir*=-1;
  else{spState.sort.col=col;spState.sort.dir=-1;}
  spRenderTable();
}
function spRenderTable(){
  var rows = spState.filtered;
  var sc=spState.sort.col, sd=spState.sort.dir;
  rows = rows.slice().sort(function(a,b){
    var av=spGetColVal(a,sc), bv=spGetColVal(b,sc);
    if(sc==='name'||sc==='particulars'){ av=String(av).toLowerCase();bv=String(bv).toLowerCase(); return av<bv?-sd:av>bv?sd:0; }
    return (Number(av)-Number(bv))*sd;
  });
  var openLbl = spState.data ? spState.data.openDateLabel : '—';
  document.getElementById('sp-row-count').textContent = rows.length + ' products';
  var slice = rows;
  var totLive=0,totOpen=0,totInw=0,totTot=0,totTgt=0,totOrdQty=0,totW1=0,totW2=0,totW3=0,totW4=0,totDisp=0,totPend=0,totPendAmt=0;
  rows.forEach(function(r){ totLive+=r.live;totOpen+=r.opening;totInw+=r.inward;totTot+=r.total;totTgt+=r.target;totOrdQty+=(r.orderQty||0);totW1+=r.w1;totW2+=r.w2;totW3+=r.w3;totW4+=r.w4;totDisp+=r.dispatch;totPend+=r.pending;totPendAmt+=(r.pendingAmt||0); });
  // Wow Factor v2, Technique 3 — this table used a fully custom inline-styled header (a solid
  // full-saturation fill PER COLUMN: green/navy/amber/purple/red) plus tinted background washes
  // on every body cell — a spreadsheet look that bypassed the shared borderless CSS entirely
  // (inline styles beat the #page-sp CSS override) and read as loud next to every other table in
  // the app. One flat header now, color moved back to text/values only, matching Stock/OS/PO/
  // Gross Margin's convention. The `.total-row`-style navy tfoot bar is kept — that's the app's
  // own established total-row idiom (see the dead-stock and customer-detail tables), not part of
  // the problem.
  var thBase  = 'background:var(--surface2,#F8FAFC);color:var(--ink-2,#3a3834);padding:9px 10px 10px;font-size:9.5px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;white-space:nowrap;cursor:pointer;user-select:none;position:sticky;top:0;z-index:2';
  var fBtn = function(col){ return '<button onclick="spOpenFilter(\''+col+'\',event)" style="background:rgba(0,0,0,.05);border:none;color:var(--ink-3,#6a6760);cursor:pointer;border-radius:3px;padding:1px 4px;font-size:9px;margin-left:4px">'+(spState.colFilters[col]?'🔵':'▼')+'</button>'; };
  var sIcon = function(col){ var sorted=sc===col; return '<span style="font-size:9px;margin-left:3px;opacity:'+(sorted?'1':'.4')+'">'+(!sorted?'⇅':sd===1?'▲':'▼')+'</span>'; };
  var thClick = function(col){ return ' onclick="spToggleSort(\''+col+'\')"'; };
  var html = '<table style="min-width:1300px"><thead><tr>'+
    '<th style="'+thBase+';width:36px">SR</th>'+
    '<th style="'+thBase+';text-align:left;min-width:160px"'+thClick('name')+'>PARTICULARS'+sIcon('name')+fBtn('name')+'</th>'+
    '<th style="'+thBase+'"'+thClick('live')+'>CLOSING STOCK'+sIcon('live')+fBtn('live')+'</th>'+
    '<th style="'+thBase+'"'+thClick('opening')+'>'+openLbl+sIcon('opening')+fBtn('opening')+'</th>'+
    '<th style="'+thBase+'"'+thClick('target')+'>TARGET'+sIcon('target')+fBtn('target')+'</th>'+
    '<th style="'+thBase+'"'+thClick('orderQty')+'>ORDER QTY'+sIcon('orderQty')+'</th>'+
    '<th style="'+thBase+'"'+thClick('dispatch')+'>DISPATCH'+sIcon('dispatch')+fBtn('dispatch')+'</th>'+
    '<th style="'+thBase+'">CUSTOMERS'+fBtn('customer')+'</th>'+
    '<th style="'+thBase+'"'+thClick('pending')+'>PENDING QTY'+sIcon('pending')+fBtn('pending')+'</th>'+
    '<th style="'+thBase+'"'+thClick('pendingAmt')+'>PENDING AMT (₹)'+sIcon('pendingAmt')+'</th>'+
    '<th style="'+thBase+'"'+thClick('ach')+'>ACH %'+sIcon('ach')+fBtn('ach')+'</th>'+
    '</tr></thead><tbody>';
  if (!slice.length) { html += '<tr><td colspan="11" class="empty">No products found</td></tr>'; }
  slice.forEach(function(r,i){
    var achColor = r.ach>=90?'#059669':r.ach>=60?'#d97706':'#be3525';
    var zero = function(n){ return (!n||n===0)?'<span style="color:#c9c6be">—</span>':Number(n).toLocaleString('en-IN'); };
    // Wow Factor v2, Technique 3 — no zebra stripe / no inline row background, matching the
    // rest of the app ("Deliberately no zebra-striping" is the shared.css tables' own comment);
    // an inline background here would also block the shared `tbody tr:hover` CSS rule, since
    // inline styles beat author stylesheets regardless of the pseudo-class.
    html += '<tr>'+
      '<td style="text-align:center;color:#9d9a93;font-size:10.5px;padding:10px 6px">'+r.sr+'</td>'+
      '<td style="padding:10px 10px;font-weight:600;color:#191917;min-width:160px;max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="'+r.name+'">'+r.name+'</td>'+
      '<td style="text-align:right;padding:10px 10px;font-family:DM Mono,monospace;font-size:12px;color:#166534;font-weight:600">'+zero(r.live)+'</td>'+
      '<td style="text-align:right;padding:10px 10px;font-family:DM Mono,monospace;font-size:12px;color:#166534;font-weight:700">'+zero(r.opening)+'</td>'+
      '<td style="text-align:right;padding:10px 10px;font-family:DM Mono,monospace;font-size:12px;font-weight:700;color:#d97706">'+zero(r.target)+'</td>'+
      '<td style="text-align:right;padding:10px 10px;font-family:DM Mono,monospace;font-size:12px;font-weight:700;color:#7c3aed">'+zero(r.orderQty)+'</td>'+
      '<td style="text-align:right;padding:10px 10px;font-family:DM Mono,monospace;font-size:12px;font-weight:700;color:#059669">'+zero(r.dispatch)+'</td>'+
      '<td style="text-align:center;padding:10px 10px">'+(r.custCount?'<button onclick="spShowCusts('+i+')" style="background:#1d4ed8;color:#fff;border:none;border-radius:5px;padding:3px 8px;font-size:11px;font-weight:700;cursor:pointer">👥 '+r.custCount+' cust</button>':'<span style="color:#c9c6be">—</span>')+'</td>'+
      '<td style="text-align:right;padding:10px 10px;font-family:DM Mono,monospace;font-size:12px;font-weight:700;color:'+(r.pending>0?'#be3525':'#059669')+'">'+(r.pending>0?'+':'')+zero(r.pending)+'</td>'+
      '<td style="text-align:right;padding:10px 10px;font-family:DM Mono,monospace;font-size:12px;font-weight:700;color:'+(r.pendingAmt>0?'#991b1b':'#9d9a93')+'">'+((r.pendingAmt>0)?fmtCur(r.pendingAmt):'<span style="color:#c9c6be">—</span>')+'</td>'+
      '<td style="text-align:center;padding:10px 10px">'+
        '<div style="display:flex;align-items:center;gap:5px;justify-content:center">'+
        '<div style="width:36px;height:4px;background:#e5e2db;border-radius:4px;overflow:hidden"><div style="height:100%;border-radius:4px;width:'+Math.min(r.ach,100)+'%;background:'+achColor+'"></div></div>'+
        '<span style="font-family:DM Mono,monospace;font-size:11px;font-weight:700;color:'+achColor+'">'+r.ach+'%</span>'+
        '</div>'+
      '</td>'+
      '</tr>';
  });
  // Footer totals
  html += '<tfoot><tr style="background:#0F2044">'+
    '<td style="padding:7px 6px;color:#fff;font-size:10px;font-weight:700;text-align:center">—</td>'+
    '<td style="padding:7px 10px;color:#fff;font-weight:700;font-size:11px">TOTAL</td>'+
    '<td style="padding:7px 10px;text-align:right;color:#6ee7b7;font-family:DM Mono,monospace;font-size:12px;font-weight:700">'+fmtNum(totLive)+'</td>'+
    '<td style="padding:7px 10px;text-align:right;color:#6ee7b7;font-family:DM Mono,monospace;font-size:12px;font-weight:700">'+fmtNum(totOpen)+'</td>'+
    '<td style="padding:7px 10px;text-align:right;color:#fcd34d;font-family:DM Mono,monospace;font-size:12px;font-weight:700">'+fmtNum(totTgt)+'</td>'+
    '<td style="padding:7px 10px;text-align:right;color:#c4b5fd;font-family:DM Mono,monospace;font-size:12px;font-weight:700">'+fmtNum(totOrdQty)+'</td>'+
    '<td style="padding:7px 10px;text-align:right;color:#6ee7b7;font-family:DM Mono,monospace;font-size:12px;font-weight:700">'+fmtNum(totDisp)+'</td>'+
    '<td></td>'+
    '<td style="padding:7px 10px;text-align:right;color:#fca5a5;font-family:DM Mono,monospace;font-size:12px;font-weight:700">'+(totPend>0?'+':'')+fmtNum(totPend)+'</td>'+
    '<td style="padding:7px 10px;text-align:right;color:#fca5a5;font-family:DM Mono,monospace;font-size:12px;font-weight:700">'+fmtCur(totPendAmt)+'</td>'+
    '<td></td></tr></tfoot></table>';
  document.getElementById('sp-table-wrap').innerHTML = html;
  // Real bug fix: spShowCusts(idx) used to look up spState.filtered[idx], but `idx` here is a
  // row's position in `slice` — the SORTED array actually rendered above, sorted from a COPY of
  // spState.filtered (`rows.slice().sort(...)`) that was never written back anywhere. Those two
  // orders only ever matched by coincidence, so clicking a customer badge opened whichever
  // product happened to sit at that same index in the unsorted array — a real product, but
  // usually not the one clicked (explains "shows 5 cust but the modal shows 2" — that's a
  // different row's data), and sometimes one with no dispatch lines at all (explains rows where
  // clicking did nothing — spShowCusts silently no-ops when the wrong row has no dispLines).
  // Saving the exact array that was rendered fixes the lookup for every row, not just by luck.
  spState.rendered = slice;
}

function spShowCusts(idx){
  var rows = spState.rendered || spState.filtered;
  var r = rows[idx];
  if(!r || !r.dispLines || !r.dispLines.length) return;
  var lines = r.dispLines;
  var totalQty = lines.reduce(function(s,l){return s+l.qty;},0);
  var totalAmt = lines.reduce(function(s,l){return s+l.amt;},0);
  var totalGst = lines.reduce(function(s,l){return s+l.gst;},0);
  var custSet  = new Set(lines.map(function(l){return l.customer;}).filter(Boolean));

  function inr(n){ return n?'₹'+Number(n).toLocaleString('en-IN'):'—'; }
  function fmt(n){ return n?Number(n).toLocaleString('en-IN'):'—'; }

  var spSearch = '';
  function buildRows(q){
    return lines.filter(function(l){
      if(!q) return true;
      var s = (l.date+l.invoice+l.customer).toLowerCase();
      return s.includes(q.toLowerCase());
    }).map(function(l,i){
      return '<tr style="background:'+(i%2===0?'#fff':'#f8faf8')+';border-bottom:1px solid #e5e7eb">'+
        '<td style="padding:8px 10px;color:#6b7280;font-size:12px;text-align:center">'+(i+1)+'</td>'+
        '<td style="padding:8px 10px;font-size:12px;color:#374151;white-space:nowrap">'+l.date+'</td>'+
        '<td style="padding:8px 10px;font-size:12px;color:#374151;font-family:DM Mono,monospace">'+l.invoice+'</td>'+
        '<td style="padding:8px 10px;font-size:13px;color:#111827;font-weight:500">'+l.customer+'</td>'+
        '<td style="padding:8px 10px;text-align:right;font-family:DM Mono,monospace;font-size:13px;font-weight:700;color:#059669">'+fmt(l.qty)+'</td>'+
        '<td style="padding:8px 10px;text-align:right;font-size:12px;color:#374151">'+(l.rate?'<span style="background:#fef3c7;color:#92400e;border-radius:4px;padding:2px 6px;font-weight:700">'+inr(l.rate)+'</span>':'—')+'</td>'+
        '<td style="padding:8px 10px;text-align:right;font-family:DM Mono,monospace;font-size:12px;font-weight:600;color:#be3525">'+inr(l.amt)+'</td>'+
        '<td style="padding:8px 10px;text-align:right;font-family:DM Mono,monospace;font-size:12px;color:#7c3aed">'+inr(l.gst)+'</td>'+
      '</tr>';
    }).join('') || '<tr><td colspan="8" style="text-align:center;padding:20px;color:#9ca3af">No results</td></tr>';
  }

  var modal = document.createElement('div');
  modal.id = 'sp-cust-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px';
  modal.innerHTML =
    '<div style="background:#fff;border-radius:14px;width:100%;max-width:860px;max-height:88vh;display:flex;flex-direction:column;box-shadow:0 24px 64px rgba(0,0,0,.35)">'+
      // Header
      '<div style="padding:20px 24px 16px;border-bottom:1px solid #e5e7eb;display:flex;justify-content:space-between;align-items:flex-start">'+
        '<div>'+
          '<div style="font-size:18px;font-weight:800;color:#111827">📦 '+r.name+'</div>'+
          '<div style="font-size:12px;color:#6b7280;margin-top:3px">Customer dispatch tracking</div>'+
        '</div>'+
        '<button id="sp-cust-close" style="background:#f3f4f6;border:none;border-radius:8px;width:32px;height:32px;cursor:pointer;font-size:16px;color:#6b7280;display:flex;align-items:center;justify-content:center">✕</button>'+
      '</div>'+
      // KPI cards
      '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;padding:16px 24px;border-bottom:1px solid #e5e7eb">'+
        '<div style="background:#faf7f2;border-radius:10px;padding:14px 16px;border:1px solid #e8e0d5"><div style="font-size:24px;font-weight:800;color:#111827">'+fmt(totalQty)+'</div><div style="font-size:10px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:.5px;margin-top:4px">Total Qty</div></div>'+
        '<div style="background:#eff6ff;border-radius:10px;padding:14px 16px;border:1px solid #bfdbfe"><div style="font-size:24px;font-weight:800;color:#1d4ed8">'+custSet.size+'</div><div style="font-size:10px;font-weight:700;color:#3b82f6;text-transform:uppercase;letter-spacing:.5px;margin-top:4px">Customers</div></div>'+
        '<div style="background:#f0fdf4;border-radius:10px;padding:14px 16px;border:1px solid #bbf7d0"><div style="font-size:22px;font-weight:800;color:#15803d">'+inr(totalAmt)+'</div><div style="font-size:10px;font-weight:700;color:#16a34a;text-transform:uppercase;letter-spacing:.5px;margin-top:4px">Total Amount</div></div>'+
        '<div style="background:#f5f3ff;border-radius:10px;padding:14px 16px;border:1px solid #ddd6fe"><div style="font-size:22px;font-weight:800;color:#7c3aed">'+inr(totalGst)+'</div><div style="font-size:10px;font-weight:700;color:#8b5cf6;text-transform:uppercase;letter-spacing:.5px;margin-top:4px">GST Amount</div></div>'+
      '</div>'+
      // Search
      '<div style="padding:12px 24px;border-bottom:1px solid #e5e7eb">'+
        '<input id="sp-cust-search" placeholder="🔍  Search date / invoice / customer..." style="width:100%;padding:9px 14px;border:1px solid #e5e7eb;border-radius:8px;font-size:13px;outline:none;box-sizing:border-box">'+
      '</div>'+
      // Table
      '<div style="overflow-y:auto;flex:1">'+
        '<table style="width:100%;border-collapse:collapse;min-width:700px">'+
          '<thead style="position:sticky;top:0"><tr>'+
            '<th style="padding:10px 10px;background:#0F2044;color:#ffffff;font-size:11px;font-weight:800;letter-spacing:.6px;text-align:center;border-bottom:2px solid #1e3a6e">#</th>'+
            '<th style="padding:10px 10px;background:#0F2044;color:#ffffff;font-size:11px;font-weight:800;letter-spacing:.6px;text-align:left;border-bottom:2px solid #1e3a6e">DATE</th>'+
            '<th style="padding:10px 10px;background:#0F2044;color:#ffffff;font-size:11px;font-weight:800;letter-spacing:.6px;text-align:left;border-bottom:2px solid #1e3a6e">INVOICE</th>'+
            '<th style="padding:10px 10px;background:#0F2044;color:#ffffff;font-size:11px;font-weight:800;letter-spacing:.6px;text-align:left;border-bottom:2px solid #1e3a6e">CUSTOMER NAME</th>'+
            '<th style="padding:10px 10px;background:#0F2044;color:#ffffff;font-size:11px;font-weight:800;letter-spacing:.6px;text-align:right;border-bottom:2px solid #1e3a6e">DISPATCH QTY</th>'+
            '<th style="padding:10px 10px;background:#0F2044;color:#ffffff;font-size:11px;font-weight:800;letter-spacing:.6px;text-align:right;border-bottom:2px solid #1e3a6e">RATE (₹)</th>'+
            '<th style="padding:10px 10px;background:#0F2044;color:#ffffff;font-size:11px;font-weight:800;letter-spacing:.6px;text-align:right;border-bottom:2px solid #1e3a6e">TOTAL AMT (₹)</th>'+
            '<th style="padding:10px 10px;background:#0F2044;color:#ffffff;font-size:11px;font-weight:800;letter-spacing:.6px;text-align:right;border-bottom:2px solid #1e3a6e">GST AMT (₹)</th>'+
          '</tr></thead>'+
          '<tbody id="sp-cust-tbody">'+buildRows('')+'</tbody>'+
          '<tfoot><tr style="background:#0F2044">'+
            '<td colspan="4" style="padding:9px 10px;color:#fff;font-weight:700;font-size:12px">TOTAL</td>'+
            '<td style="padding:9px 10px;text-align:right;color:#6ee7b7;font-family:DM Mono,monospace;font-size:13px;font-weight:700">'+fmt(totalQty)+'</td>'+
            '<td style="padding:9px 10px;text-align:right;color:#9ca3af;font-size:12px">—</td>'+
            '<td style="padding:9px 10px;text-align:right;color:#fca5a5;font-family:DM Mono,monospace;font-size:13px;font-weight:700">'+inr(totalAmt)+'</td>'+
            '<td style="padding:9px 10px;text-align:right;color:#c4b5fd;font-family:DM Mono,monospace;font-size:13px;font-weight:700">'+inr(totalGst)+'</td>'+
          '</tr></tfoot>'+
        '</table>'+
      '</div>'+
    '</div>';

  document.body.appendChild(modal);
  modal.addEventListener('click', function(e){ if(e.target===modal) modal.remove(); });
  document.getElementById('sp-cust-close').addEventListener('click', function(){ modal.remove(); });
  document.getElementById('sp-cust-search').addEventListener('input', function(){
    document.getElementById('sp-cust-tbody').innerHTML = buildRows(this.value);
  });
}

function spRenderPagination(total){
  var ps=state.PAGE_SIZE, page=spState.page, tp=Math.ceil(total/ps);
  var el=document.getElementById('sp-pagination');
  if(tp<=1){ el.innerHTML='<span class="pagination-info">'+total+' products</span>'; return; }
  var from=Math.min((page-1)*ps+1,total), to=Math.min(page*ps,total);
  var btns='<div class="page-btns"><button class="page-btn" onclick="spGoPage('+Math.max(1,page-1)+')">‹</button>';
  var rs=Math.max(1,page-2), re=Math.min(tp,rs+4);
  for(var p=rs;p<=re;p++) btns+='<button class="page-btn'+(p===page?' active':'')+'" onclick="spGoPage('+p+')">'+p+'</button>';
  btns+='<button class="page-btn" onclick="spGoPage('+Math.min(tp,page+1)+')">›</button></div>';
  el.innerHTML='<span class="pagination-info">'+from+'–'+to+' of '+total+' products</span>'+btns;
}
function spGoPage(p){ spState.page=p; spRenderTable(); }
