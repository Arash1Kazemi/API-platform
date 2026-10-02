
/* ---------- Cost planner ---------- */
var PLAN = [
  {cat:'t2i', label:'Images from text', unit:'images', aria:'images', model:'grok-img-2', vol:150},
  {cat:'edit', label:'Image edits', unit:'edits', aria:'edits', model:'grok-img-2-edit', vol:40},
  {cat:'t2v', label:'Video from text', unit:'seconds', aria:'seconds of video', model:'h3-max-t2v', vol:0},
  {cat:'i2v', label:'Video from images', unit:'seconds', aria:'seconds of video', model:'h3-max-i2v', vol:60},
  {cat:'tts', label:'Speech', unit:'× 1,000 chars', aria:'thousands of characters', model:'gemini-3-8-flash-lite-tts', vol:30}
];
/* price first, so a long setting name is the part that gets cut off in a narrow dropdown */
function optLabel(cat, t){
  var k = CATS[cat].kind;
  if(k==='tts') return money(t.price)+' per 1,000 characters';
  return (k==='vid' ? money(t.price)+'/s' : money(t.price))+' · '+t.label;
}
/* the models each preset puts in every row */
var PRESETS = [
  {k:'budget', t:'Budget pick', id:function(cat){ return CATS[cat].picks[0].id; }},
  {k:'value', t:'Best value', id:function(cat){ return CATS[cat].picks.filter(function(p){ return p.value; })[0].id; }},
  {k:'top', t:'Best quality', id:function(cat){
    return DB[cat].filter(function(m){ return m.elo!=null; }).sort(function(a,b){ return b.elo-a.elo; })[0].id;
  }}
];
var planRefs = {};
function fmtCost(c){
  if(c>0 && c<0.01) return '<$0.01';
  return '$'+(c>=1000 ? fmtInt(c) : c.toFixed(2));
}
var planState = LS.get('plan', null);
if(!planState || typeof planState!=='object' || !planState.rows) planState = {users:100, rows:{}};
planState.users = Math.max(1, Number(planState.users)||100);
PLAN.forEach(function(r){
  var s = planState.rows[r.cat], ok = s && ALL[s.model] && ALL[s.model].cat===r.cat;
  if(!ok){ var m = ALL[r.model]; s = planState.rows[r.cat] = {model:r.model, tier:m.defTier, vol:r.vol}; }
  var tl = ALL[s.model].tiers.length;
  if(!(s.tier>=0 && s.tier<tl)) s.tier = ALL[s.model].defTier;
  s.vol = Math.max(0, Number(s.vol)||0);
});
var planBuilt = false;

function buildPlanner(){
  var sec = h('section',{'class':'panel',id:'panel-plan',role:'tabpanel','aria-labelledby':'tab-plan',hidden:true});
  var head = h('div',{'class':'plan-head'},[h('span',{text:'Job'}),h('span',{text:'Model'}),h('span',{text:'Setting'}),h('span',{text:'Volume per month'}),h('span',{'class':'cost',text:'Cost'})]);
  var box = h('div',{'class':'plan'},[head]);
  PLAN.forEach(function(r){
    var st = planState.rows[r.cat];
    var msel = h('select',{id:'pm-'+r.cat,'aria-label':r.label+', model'});
    DB[r.cat].slice().sort(function(a,b){ return a.x-b.x; }).forEach(function(m){
      msel.appendChild(h('option',{value:m.id,text:m.name+(m.elo!=null ? ' (Elo '+m.elo+')' : ' (not ranked)')}));
    });
    msel.value = st.model;
    var tsel = h('select',{id:'pt-'+r.cat,'aria-label':r.label+', setting'});
    function fillTiers(){
      tsel.textContent = '';
      ALL[msel.value].tiers.forEach(function(t,i){ tsel.appendChild(h('option',{value:String(i),text:optLabel(r.cat,t)})); });
      tsel.value = String(st.tier);
    }
    fillTiers();
    var vol = h('input',{type:'number',id:'pv-'+r.cat,min:'0',step:'any',inputmode:'decimal','aria-label':r.label+', volume per month in '+r.aria});
    vol.value = String(st.vol);
    planRefs[r.cat] = {msel:msel, fill:fillTiers};
    msel.addEventListener('change', function(){ st.model = msel.value; st.tier = ALL[st.model].defTier; fillTiers(); persistPlan(); updatePlanner(); });
    tsel.addEventListener('change', function(){ st.tier = Number(tsel.value); persistPlan(); updatePlanner(); });
    vol.addEventListener('input', function(){ var v = parseFloat(vol.value); st.vol = (isFinite(v) && v>=0) ? v : 0; persistPlan(); updatePlanner(); });
    box.appendChild(h('div',{'class':'plan-row'},[
      h('span',{'class':'lbl',text:r.label}), msel, tsel,
      h('div',{'class':'vol'},[vol, h('small',{text:r.unit})]),
      h('span',{'class':'cost',id:'pc-'+r.cat})
    ]));
  });
  var users = h('input',{id:'p-users',type:'number',min:'1',step:'1',inputmode:'numeric'});
  users.value = String(planState.users);
  users.addEventListener('input', function(){ var v = parseFloat(users.value); planState.users = (isFinite(v) && v>=1) ? v : 1; persistPlan(); updatePlanner(); });
  var total = h('div',{'class':'plan-total'},[
    h('div',{'class':'tot-row'},[
      h('div',{},[h('div',{'class':'tot-sub',text:'Estimated cost per month'}), h('div',{'class':'tot-big',id:'p-total'})]),
      h('div',{'class':'status',id:'p-status'})
    ]),
    h('div',{'class':'meter',id:'p-meter',role:'img'},[h('i')]),
    h('div',{'class':'tot-row'},[
      h('div',{'class':'tot-sub',id:'p-left'}),
      h('div',{'class':'users'},[h('label',{'for':'p-users',text:'Active users per month'}), users, h('span',{id:'p-peruser'})])
    ]),
    h('div',{'class':'tot-sub',id:'p-runway'}),
    h('p',{'class':'note',text:'The volumes above are examples, so replace them with your own plan. For speech, one unit is 1,000 characters, about one minute of audio. Costs use the prices in the other tabs and ignore free credits and discounts. The budget is the one at the top of the page.'})
  ]);
  var presets = h('div',{'class':'presets',role:'group','aria-label':'Fill every row with one kind of model'},[h('span',{text:'Try the same volumes with'})]);
  PRESETS.forEach(function(pr){
    var b = h('button',{type:'button','class':'btn','aria-pressed':'false',text:pr.t,dataset:{preset:pr.k}});
    b.addEventListener('click', function(){
      PLAN.forEach(function(r){
        var id = pr.id(r.cat), st = planState.rows[r.cat], ref = planRefs[r.cat];
        st.model = id; st.tier = ALL[id].defTier;
        ref.msel.value = id; ref.fill();
      });
      persistPlan(); updatePlanner();
    });
    presets.appendChild(b);
  });
  sec.appendChild(h('div',{'class':'card'},[
    h('div',{'class':'tbl-head'},[h('h2',{text:'What would your app cost each month?'}), h('p',{text:'Pick a model and a setting for each job, then enter how much you expect to use.'})]),
    presets, box, total
  ]));
  planBuilt = true;
  return sec;
}
function persistPlan(){ LS.set('plan', planState); }
function updatePlanner(){
  if(!planBuilt) return;
  var total = 0;
  PLAN.forEach(function(r){
    var st = planState.rows[r.cat], m = ALL[st.model], t = m.tiers[st.tier] || m.tiers[0];
    var c = st.vol * t.price; total += c;
    $('#pc-'+r.cat).textContent = fmtCost(c);
  });
  $$('.presets .btn').forEach(function(btn){
    var pr = PRESETS.filter(function(x){ return x.k===btn.dataset.preset; })[0];
    var on = PLAN.every(function(r){ var st = planState.rows[r.cat]; return st.model===pr.id(r.cat) && st.tier===ALL[st.model].defTier; });
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
  var b = state.budget;
  $('#p-total').textContent = fmtCost(total);
  var meter = $('#p-meter'), fill = $('i', meter), status = $('#p-status'), left = $('#p-left');
  status.className = 'status';
  if(b>0){
    var pct = total/b*100;
    fill.style.width = Math.min(100, pct).toFixed(1)+'%';
    meter.classList.toggle('over', total>b);
    meter.setAttribute('aria-label', Math.round(pct)+'% of your budget');
    if(total<=b){
      status.classList.add('ok'); status.textContent = '✓ Within budget';
      left.textContent = fmtCost(b-total)+' left of '+fmtCost(b)+' ('+Math.round(pct)+'% used)';
    } else {
      status.classList.add('over'); status.textContent = '! Over budget';
      left.textContent = fmtCost(total-b)+' over your '+fmtCost(b)+' budget';
    }
  } else {
    fill.style.width = '0%'; meter.classList.remove('over');
    meter.setAttribute('aria-label','No budget set');
    status.textContent = ''; left.textContent = 'Set a budget at the top of the page to compare.';
  }
  $('#p-peruser').textContent = '= '+fmtCost(total/planState.users)+' per user';
  var rw = $('#p-runway');
  if(total>0 && b>0){
    var days = b/total*30;
    rw.textContent = 'If '+fmtCost(b)+' is a one-time balance, it lasts about '+(days>=60 ? (days/30).toFixed(1)+' months' : Math.max(1,Math.round(days))+' days')+' at this usage.';
  } else rw.textContent = '';
}
function renderPlanner(){ updatePlanner(); }

/* ---------- Data export (CSV and JSON) ---------- */
var UNITS = {t2i:'USD per image', edit:'USD per edit', t2v:'USD per second', i2v:'USD per second', tts:'USD per 1,000 characters'};
function csvEsc(v){ v = (v==null) ? '' : String(v); return /[",\n]/.test(v) ? '"'+v.replace(/"/g,'""')+'"' : v; }
function buildCSV(){
  var cols = ['category','model','maker','endpoint_id','chart_price_usd','price_unit','price_per_minute_usd','price_basis','price_is_estimate','all_published_prices','quality_elo','elo_ci95','best_value','beaten_by','quality_board','note','checked'];
  var out = [cols.join(',')];
  ORDER.forEach(function(cat){
    DB[cat].forEach(function(m){
      var vid = CATS[cat].kind==='vid';
      out.push([
        CATS[cat].title, m.name, m.maker, m.endpoint, m.price, UNITS[cat], vid ? +(m.price*60).toFixed(4) : '',
        m.basis, m.approx ? 'yes':'no',
        m.tiers.map(function(t){ return t.label+': '+t.price; }).join('; '),
        m.elo!=null ? m.elo : '', m.ci!=null ? m.ci : '',
        m.elo==null ? '' : (m.front ? 'yes' : 'no'), m.beatenBy ? m.beatenBy.name : '',
        CATS[cat].board, m.note, '2026-10-02'
      ].map(csvEsc).join(','));
    });
  });
  return out.join('\n')+'\n';
}
function buildJSON(){
  var o = {
    checked:'2026-10-02', currency:'USD',
    about:'fal.ai prices from each model page, quality from Artificial Analysis arena Elo. Compare Elo only within one category.',
    categories:{}
  };
  ORDER.forEach(function(cat){
    o.categories[cat] = {
      label:CATS[cat].title, price_unit:UNITS[cat], quality_board:CATS[cat].board, elo_anchor:CATS[cat].anchor||null,
      models: DB[cat].map(function(m){
        return {
          id:m.id, name:m.name, maker:m.maker, endpoint_id:m.endpoint,
          chart_price_usd:m.price, price_is_estimate:!!m.approx, price_basis:m.basis,
          price_per_minute_usd: CATS[cat].kind==='vid' ? +(m.price*60).toFixed(4) : null,
          published_prices:m.tiers, elo:m.elo, elo_ci95:m.ci,
          best_value: m.elo==null ? null : m.front, beaten_by: m.beatenBy ? m.beatenBy.id : null, note:m.note
        };
      })
    };
  });
  return JSON.stringify(o, null, 2)+'\n';
}
function initDownloads(){
  if(!(window.claude && typeof window.claude.use==='function')) return;
  window.claude.use('downloads').then(function(dl){
    if(!dl) return;
    $('#dl').hidden = false;
    $$('#dl button').forEach(function(b){
      b.addEventListener('click', function(){
        var fmt = b.dataset.fmt;
        var data = fmt==='csv' ? buildCSV() : buildJSON();
        dl.save({filename:'fal-models-2026-10-02.'+fmt, data:data}).then(function(){
          toast('Saved '+fmt.toUpperCase());
        }, function(err){
          toast(err && err.code==='declined' ? 'Download cancelled' : 'Download is not available here');
        });
      });
    });
  }, function(){});
}

/* ---------- Start ---------- */
(function init(){
  buildTabs(); buildBest(); bindFilters();
  var panels = $('#panels');
  ORDER.forEach(function(cat){ panels.appendChild(buildPanel(cat)); });
  panels.appendChild(buildPlanner());
  setTab(state.tab);
  var lastW = panels.clientWidth, raf = 0;
  function redraw(){
    var w = panels.clientWidth;
    if(Math.abs(w-lastW)<2) return;
    lastW = w; cancelAnimationFrame(raf);
    raf = requestAnimationFrame(function(){ if(state.tab!=='plan') drawChart(state.tab); });
  }
  if(window.ResizeObserver) new ResizeObserver(redraw).observe(panels);
  else window.addEventListener('resize', redraw);
  if(document.fonts && document.fonts.ready){ document.fonts.ready.then(function(){ if(state.tab!=='plan') drawChart(state.tab); }); }
  /* a tap anywhere outside the chart closes a readout that a tap opened */
  document.addEventListener('pointerdown', function(e){
    if(e.pointerType==='touch' && state.hov && state.hovSrc==='chart' && !(e.target.closest && e.target.closest('.chart'))) setHover(null);
  });
  initDownloads();
})();

})();
