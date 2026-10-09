// ══ SALES DASHBOARD — CEO Design ══════════════════════════════

// window.API_TOKEN is injected server-side (see app/main.py's Jinja2Templates wiring) — every
// /api/* call needs it since Phase 1.5 added a shared-bearer-token auth gate.
function authFetch(url, opts) {
  opts = opts || {};
  opts.headers = Object.assign({}, opts.headers, {Authorization: 'Bearer ' + (window.API_TOKEN || '')});
  return fetch(url, opts);
}

var SD = { data: [], pending: [], loaded: false, pendLoaded: false, activeTab: 1 };

// ── Number formatters ────────────────────────────────────────
function sdN(n){ return n == null ? '-' : Number(n).toLocaleString('en-IN'); }
function sdAmt(n){ if(!n) return '-'; if(n>=10000000) return '₹'+(n/10000000).toFixed(2)+'Cr'; if(n>=100000) return '₹'+(n/100000).toFixed(2)+'L'; return '₹'+sdN(n); }
function sdDate(s){ if(!s) return '-'; const p=s.split('-'); return p.length===3?p[2]+'/'+p[1]+'/'+p[0]:s; }
function sdMonth(s){ if(!s) return '-'; const ms=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']; const p=s.split('-'); return ms[+p[1]-1]+' '+p[0]; }

// ── KPI card ─────────────────────────────────────────────────
function sdKpi(label, val, sub, color){
  color = color || '#1B2A4A';
  return '<div style="background:'+color+';border-radius:10px;padding:12px 18px;color:#fff;min-width:130px;flex-shrink:0;box-shadow:0 2px 8px rgba(0,0,0,.15)"><div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;opacity:.75;margin-bottom:4px">'+label+'</div><div style="font-size:20px;font-weight:700;line-height:1;font-family:\'Playfair Display\',serif">'+val+'</div><div style="font-size:9px;opacity:.6;margin-top:4px">'+sub+'</div></div>';
}

// ── Init ─────────────────────────────────────────────────────
var _sdashLoaded = false;
function sdashInit(){
  if(!_sdashLoaded){ _sdashLoaded=true; sdLoadData(); sdLoadPending(); }
}

function sdRefresh(){ SD.loaded=false; SD.pendLoaded=false; _sdashLoaded=false; sdashInit(); }

// ── Fetch data ───────────────────────────────────────────────
function sdLoadData(){
  document.getElementById('sd-updated').textContent = 'Loading...';
  authFetch('/api/sales',{cache:'no-store'})
    .then(r=>r.json())
    .then(res=>{
      SD.data = res.rows || [];
      SD.loaded = true;
      sdPopulateFilters();
      sdRender();
      document.getElementById('sd-updated').textContent = 'Updated: '+new Date().toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'});
    })
    .catch(e=>{ document.getElementById('sd-updated').textContent = 'Error: '+e.message; });
}

function sdLoadPending(){
  authFetch('/api/sales-pending',{cache:'no-store'})
    .then(r=>r.json())
    .then(res=>{ SD.pending = res.rows || []; SD.pendLoaded = true; sdRenderPending(); })
    .catch(()=>{});
}

// ── Populate filter dropdowns ────────────────────────────────
function sdPopulateFilters(){
  var cats  = [...new Set(SD.data.map(r=>r.category).filter(Boolean))].sort();
  var reps  = [...new Set(SD.data.map(r=>r.sales_rep).filter(Boolean))].sort();
  var states= [...new Set(SD.data.map(r=>r.state).filter(Boolean))].sort();
  var dates = SD.data.map(r=>r.dispatch_date).filter(Boolean).sort();

  var catEl = document.getElementById('sd-cat');
  var prev  = catEl.value;
  catEl.innerHTML = '<option value="">All Categories</option>' + cats.map(c=>'<option value="'+c+'">'+c+'</option>').join('');
  catEl.value = prev;

  var repEl = document.getElementById('sd-rep');
  prev = repEl.value;
  repEl.innerHTML = '<option value="">All Reps</option>' + reps.map(r=>'<option value="'+r+'">'+r+'</option>').join('');
  repEl.value = prev;

  var stEl = document.getElementById('sd-state');
  prev = stEl.value;
  stEl.innerHTML = '<option value="">All States</option>' + states.map(s=>'<option value="'+s+'">'+s+'</option>').join('');
  stEl.value = prev;

  // Also fill customer tab state filter
  var cstEl = document.getElementById('sd-cust-state');
  if(cstEl){ cstEl.innerHTML = '<option value="">All States</option>' + states.map(s=>'<option value="'+s+'">'+s+'</option>').join(''); }

  // Set default date range
  if(dates.length && !document.getElementById('sd-from').value){
    document.getElementById('sd-from').value = dates[0];
    document.getElementById('sd-to').value   = dates[dates.length-1];
  }

  // Pending reps
  var pendReps = [...new Set(SD.pending.map(r=>r.sales_rep).filter(Boolean))].sort();
  var prEl = document.getElementById('sd-pend-rep');
  if(prEl){ prEl.innerHTML = '<option value="">All Reps</option>' + pendReps.map(r=>'<option value="'+r+'">'+r+'</option>').join(''); }
}

// ── Get filtered rows ────────────────────────────────────────
function sdFiltered(){
  var from  = document.getElementById('sd-from').value;
  var to    = document.getElementById('sd-to').value;
  var cat   = document.getElementById('sd-cat').value;
  var rep   = document.getElementById('sd-rep').value;
  var state = document.getElementById('sd-state').value;
  return SD.data.filter(r=>{
    if(from && r.dispatch_date < from) return false;
    if(to   && r.dispatch_date > to)   return false;
    if(cat  && r.category  !== cat)    return false;
    if(rep  && r.sales_rep !== rep)    return false;
    if(state && r.state    !== state)  return false;
    return true;
  });
}

function sdResetFilters(){
  var dates = SD.data.map(r=>r.dispatch_date).filter(Boolean).sort();
  document.getElementById('sd-from').value  = dates[0]||'';
  document.getElementById('sd-to').value    = dates[dates.length-1]||'';
  document.getElementById('sd-cat').value   = '';
  document.getElementById('sd-rep').value   = '';
  document.getElementById('sd-state').value = '';
  sdRender();
}

// ── Tab switching ─────────────────────────────────────────────
function sdTab(n){
  SD.activeTab = n;
  [1,2,3,4].forEach(i=>{
    document.getElementById('sdt-'+i).className = 'sd-tab'+(i===n?' active':'');
    var p = document.getElementById('sd-p'+i);
    if(p) p.style.display = i===n ? 'block' : 'none';
  });
  sdRender();
}

// ── Master render ────────────────────────────────────────────
function sdRender(){
  if(!SD.loaded) return;
  var d = sdFiltered();
  document.getElementById('sd-count').textContent = sdN(d.length)+' records';
  if(SD.activeTab===1){ sdRenderSummary(d); sdRenderProd(); sdRenderLedger(); }
  else if(SD.activeTab===2) sdRenderMonth();
  else if(SD.activeTab===3) sdRenderCust();
  else if(SD.activeTab===4) sdRenderPending();
}

// ── TAB 1: Dispatch Summary ───────────────────────────────────
var _sdCatData=[], _sdProdData=[], _sdLedger=[];

function sdRenderSummary(d){
  // KPIs
  var tQ  = d.reduce((s,r)=>s+r.qty,0);
  var tA  = d.reduce((s,r)=>s+r.amount,0);
  var ords= new Set(d.map(r=>r.order_id)).size;
  var custs=new Set(d.map(r=>r.customer)).size;
  document.getElementById('sd-kpis').innerHTML =
    sdKpi('Total Qty Dispatched', sdN(tQ), 'units', '#1B2A4A') +
    sdKpi('Total Revenue', sdAmt(tA), 'gross amount', '#166534') +
    sdKpi('Total Orders', sdN(ords), 'unique orders', '#1e40af') +
    sdKpi('Active Customers', custs, 'accounts', '#7c3aed');

  // Category map
  var catM = {};
  d.forEach(r=>{
    var c = r.category||'Unknown';
    if(!catM[c]) catM[c]={qty:0,amt:0};
    catM[c].qty += r.qty; catM[c].amt += r.amount;
  });
  _sdCatData = Object.entries(catM).sort((a,b)=>b[1].qty-a[1].qty);
  var tQ2 = _sdCatData.reduce((s,[,v])=>s+v.qty,0)||1;
  document.getElementById('sd-cat-body').innerHTML = _sdCatData.map(([c,v],i)=>{
    var pct = (v.qty/tQ2*100).toFixed(1);
    return '<tr style="border-bottom:1px solid var(--border)"><td style="padding:7px 10px;font-size:12px">'+(i===0?'🥇 ':i===1?'🥈 ':i===2?'🥉 ':'')+'<strong>'+c+'</strong></td><td style="text-align:right;padding:7px 10px;font-size:12px;font-family:\'DM Mono\',monospace">'+sdN(v.qty)+'</td><td style="text-align:right;padding:7px 10px;font-size:12px;font-family:\'DM Mono\',monospace">'+sdAmt(v.amt)+'</td><td style="text-align:right;padding:7px 10px;font-size:12px;font-family:\'DM Mono\',monospace">'+pct+'%</td></tr>';
  }).join('') || '<tr><td colspan="4" style="text-align:center;padding:24px;color:var(--ink-4)">No data</td></tr>';

  // Product map
  var prodM = {};
  d.forEach(r=>{
    var p = r.product||'Unknown';
    if(!prodM[p]) prodM[p]={qty:0,amt:0,cat:r.category};
    prodM[p].qty += r.qty; prodM[p].amt += r.amount;
  });
  _sdProdData = Object.entries(prodM).sort((a,b)=>b[1].qty-a[1].qty);

  // Ledger
  _sdLedger = d.slice().sort((a,b)=>(b.dispatch_date||'').localeCompare(a.dispatch_date||''));
  sdRenderProd();
  sdRenderLedger();
}

function sdRenderProd(){
  if(!_sdProdData.length) return;
  var q = (document.getElementById('sd-prod-search')?.value||'').toLowerCase();
  var f = _sdProdData.filter(([p])=>!q||p.toLowerCase().includes(q));
  document.getElementById('sd-prod-body').innerHTML = f.map(([p,v])=>
    '<tr style="border-bottom:1px solid var(--border)"><td style="padding:6px 10px;font-size:11.5px">'+p+'<br><span style="font-size:10px;color:var(--ink-4)">'+( v.cat||'')+'</span></td><td style="text-align:right;padding:6px 10px;font-size:11.5px;font-family:\'DM Mono\',monospace">'+sdN(v.qty)+'</td><td style="text-align:right;padding:6px 10px;font-size:11.5px;font-family:\'DM Mono\',monospace">'+sdAmt(v.amt)+'</td></tr>'
  ).join('') || '<tr><td colspan="3" style="text-align:center;padding:24px;color:var(--ink-4)">No data</td></tr>';
}

function sdRenderLedger(){
  if(!_sdLedger.length) return;
  var q = (document.getElementById('sd-ldg-search')?.value||'').toLowerCase();
  var f = _sdLedger.filter(r=>!q||(r.customer+r.product+r.order_id).toLowerCase().includes(q));
  document.getElementById('sd-ldg-count').textContent = sdN(f.length)+' rows';
  var statusColor = {Complete:'var(--success)',Dispatched:'var(--fg-accent)',Pending:'var(--warning)'};
  document.getElementById('sd-ldg-body').innerHTML = f.slice(0,500).map(r=>{
    var sc = statusColor[r.dispatch_status]||'var(--ink-3)';
    return '<tr style="border-bottom:1px solid var(--border)"><td style="padding:6px 10px;font-size:11px;font-family:\'DM Mono\',monospace;color:var(--fg-accent)">'+r.order_id+'</td><td style="padding:6px 10px;font-size:11.5px;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="'+r.customer+'">'+r.customer+'</td><td style="padding:6px 10px;font-size:11.5px;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="'+r.product+'">'+r.product+'</td><td style="padding:6px 10px;font-size:11px;font-family:\'DM Mono\',monospace;white-space:nowrap">'+sdDate(r.dispatch_date)+'</td><td style="text-align:right;padding:6px 10px;font-size:11.5px;font-family:\'DM Mono\',monospace">'+sdN(r.qty)+'</td><td style="text-align:right;padding:6px 10px;font-size:11.5px;font-family:\'DM Mono\',monospace">'+sdAmt(r.amount)+'</td><td style="padding:6px 10px;font-size:11px">'+r.sales_rep+'</td><td style="padding:6px 10px"><span style="font-size:10px;font-weight:600;color:'+sc+'">'+r.dispatch_status+'</span></td></tr>';
  }).join('') || '<tr><td colspan="8" style="text-align:center;padding:24px;color:var(--ink-4)">No data</td></tr>';
}

// ── TAB 2: Month View ─────────────────────────────────────────
function sdRenderMonth(){
  var d = sdFiltered();
  var mMap = {};
  d.forEach(r=>{
    var m = r.month||'';
    if(!m) return;
    if(!mMap[m]) mMap[m]={qty:0,amt:0,ords:new Set(),custs:new Set()};
    mMap[m].qty+=r.qty; mMap[m].amt+=r.amount;
    mMap[m].ords.add(r.order_id); mMap[m].custs.add(r.customer);
  });
  var months = Object.entries(mMap).sort((a,b)=>b[0].localeCompare(a[0]));
  var tQ=months.reduce((s,[,v])=>s+v.qty,0), tA=months.reduce((s,[,v])=>s+v.amt,0);
  document.getElementById('sd-m-kpis').innerHTML =
    sdKpi('Total Months', months.length, 'with data', '#1B2A4A') +
    sdKpi('Total Qty', sdN(tQ), 'all months', '#166534') +
    sdKpi('Total Revenue', sdAmt(tA), 'all months', '#1e40af');
  document.getElementById('sd-month-body').innerHTML = months.map(([m,v])=>
    '<tr style="border-bottom:1px solid var(--border)"><td style="padding:8px 10px;font-size:12.5px;font-weight:600">'+sdMonth(m)+'</td><td style="text-align:right;padding:8px 10px;font-size:12px;font-family:\'DM Mono\',monospace">'+v.ords.size+'</td><td style="text-align:right;padding:8px 10px;font-size:12px;font-family:\'DM Mono\',monospace">'+sdN(v.qty)+'</td><td style="text-align:right;padding:8px 10px;font-size:12px;font-family:\'DM Mono\',monospace">'+sdAmt(v.amt)+'</td><td style="text-align:right;padding:8px 10px;font-size:12px;font-family:\'DM Mono\',monospace">'+v.custs.size+'</td></tr>'
  ).join('') || '<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--ink-4)">No data</td></tr>';
}

// ── TAB 3: Customers ──────────────────────────────────────────
function sdRenderCust(){
  var d = sdFiltered();
  var q     = (document.getElementById('sd-cust-search')?.value||'').toLowerCase();
  var state = document.getElementById('sd-cust-state')?.value||'';
  var cMap  = {};
  d.forEach(r=>{
    var c = r.customer||'Unknown';
    if(!cMap[c]) cMap[c]={qty:0,amt:0,ords:new Set(),state:r.state,rep:r.sales_rep,lastDate:''};
    cMap[c].qty+=r.qty; cMap[c].amt+=r.amount;
    cMap[c].ords.add(r.order_id);
    if(r.dispatch_date > cMap[c].lastDate) cMap[c].lastDate=r.dispatch_date;
  });
  var custs = Object.entries(cMap)
    .filter(([c,v])=>(!q||c.toLowerCase().includes(q))&&(!state||v.state===state))
    .sort((a,b)=>b[1].amt-a[1].amt);
  document.getElementById('sd-cust-count').textContent = custs.length+' customers';
  document.getElementById('sd-cust-body').innerHTML = custs.map(([c,v],i)=>
    '<tr style="border-bottom:1px solid var(--border)"><td style="padding:7px 10px;font-size:11px;color:var(--ink-4);font-family:\'DM Mono\',monospace">'+(i+1)+'</td><td style="padding:7px 10px;font-size:12px;font-weight:500;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="'+c+'">'+c+'</td><td style="padding:7px 10px;font-size:11px;color:var(--ink-3)">'+( v.state||'-')+'</td><td style="padding:7px 10px;font-size:11px;color:var(--ink-3)">'+( v.rep||'-')+'</td><td style="text-align:right;padding:7px 10px;font-size:12px;font-family:\'DM Mono\',monospace">'+v.ords.size+'</td><td style="text-align:right;padding:7px 10px;font-size:12px;font-family:\'DM Mono\',monospace">'+sdN(v.qty)+'</td><td style="text-align:right;padding:7px 10px;font-size:12px;font-family:\'DM Mono\',monospace">'+sdAmt(v.amt)+'</td><td style="padding:7px 10px;font-size:11px;font-family:\'DM Mono\',monospace">'+sdDate(v.lastDate)+'</td></tr>'
  ).join('') || '<tr><td colspan="8" style="text-align:center;padding:24px;color:var(--ink-4)">No data</td></tr>';
}

// ── TAB 4: Pending Orders ─────────────────────────────────────
function sdRenderPending(){
  if(!SD.pendLoaded) return;
  var q   = (document.getElementById('sd-pend-search')?.value||'').toLowerCase();
  var rep = document.getElementById('sd-pend-rep')?.value||'';
  var f   = SD.pending.filter(r=>{
    if(rep && r.sales_rep!==rep) return false;
    if(q && !(r.customer+r.product+r.order_id).toLowerCase().includes(q)) return false;
    return r.pending_qty > 0;
  });
  var tPQ = f.reduce((s,r)=>s+r.pending_qty,0);
  var tPA = f.reduce((s,r)=>s+r.pending_amount,0);
  document.getElementById('sd-pend-count').textContent = sdN(f.length)+' orders';
  document.getElementById('sd-pend-kpis').innerHTML =
    sdKpi('Pending Orders', sdN(f.length), 'with qty > 0', '#991B1B') +
    sdKpi('Pending Qty', sdN(tPQ), 'units', '#7C3AED') +
    sdKpi('Pending Amount', sdAmt(tPA), 'value', '#b45309');
  var today = new Date().toISOString().slice(0,10);
  document.getElementById('sd-pend-body').innerHTML = f.map(r=>{
    var overdue = r.planned_date && r.planned_date < today;
    var dateStyle = overdue ? 'color:var(--danger);font-weight:600' : 'color:var(--ink-3)';
    return '<tr style="border-bottom:1px solid var(--border)'+(overdue?';background:var(--danger-light)':'')+'"><td style="padding:7px 10px;font-size:11px;font-family:\'DM Mono\',monospace;color:var(--fg-accent)">'+r.order_id+'</td><td style="padding:7px 10px;font-size:11.5px;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="'+r.customer+'">'+r.customer+'</td><td style="padding:7px 10px;font-size:11.5px;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="'+r.product+'">'+r.product+'</td><td style="padding:7px 10px;font-size:11px">'+( r.sales_rep||'-')+'</td><td style="text-align:right;padding:7px 10px;font-size:11.5px;font-family:\'DM Mono\',monospace">'+sdN(r.ordered_qty)+'</td><td style="text-align:right;padding:7px 10px;font-size:11.5px;font-family:\'DM Mono\',monospace;font-weight:600;color:var(--danger)">'+sdN(r.pending_qty)+'</td><td style="text-align:right;padding:7px 10px;font-size:11.5px;font-family:\'DM Mono\',monospace">'+sdAmt(r.pending_amount)+'</td><td style="padding:7px 10px;font-size:11px;font-family:\'DM Mono\',monospace;'+dateStyle+'">'+sdDate(r.planned_date)+'</td><td style="padding:7px 10px"><span style="font-size:10px;font-weight:600;color:var(--ink-3)">'+r.order_status+'</span></td></tr>';
  }).join('') || '<tr><td colspan="9" style="text-align:center;padding:24px;color:var(--ink-4)">No pending orders</td></tr>';
}
