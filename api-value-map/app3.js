
/* ---------- Panels: picks, chart card, table ---------- */
var eloScaleCache = {};
function eloScale(cat){
  if(eloScaleCache[cat]) return eloScaleCache[cat];
  var es = DB[cat].filter(function(m){ return m.elo!=null; }).map(function(m){ return m.elo; });
  var lo = Math.min.apply(null,es)-40, hi = Math.max.apply(null,es);
  return (eloScaleCache[cat] = {lo:lo, hi:hi});
}
function copyText(text, label){
  function ok(){ toast('Copied '+(label||'endpoint name')); }
  function fallback(){
    try{
      var ta = h('textarea',{readonly:true,style:'position:fixed;opacity:0;left:-999px'}); ta.value = text;
      document.body.appendChild(ta); ta.select();
      var done = document.execCommand && document.execCommand('copy');
      ta.remove();
      if(done) ok(); else toast('Select the text and copy it');
    }catch(e){ toast('Select the text and copy it'); }
  }
  try{
    if(navigator.clipboard && navigator.clipboard.writeText){ navigator.clipboard.writeText(text).then(ok, fallback); }
    else fallback();
  }catch(e){ fallback(); }
}

function buildPanel(cat){
  var C = CATS[cat];
  var sec = h('section',{'class':'panel',id:'panel-'+cat,role:'tabpanel','aria-labelledby':'tab-'+cat,hidden:true});

  var picks = h('div',{'class':'picks'});
  C.picks.forEach(function(p){
    var m = ALL[p.id], pp = priceParts(m);
    var card = h('button',{type:'button','class':'pick'+(p.value?' is-value':''),dataset:{id:m.id}},[
      h('span',{'class':'k',text:p.k}),
      h('span',{'class':'n',text:m.name}),
      h('span',{'class':'v'},[h('b',{text:pp.main}), h('b',{text:m.elo!=null ? 'Elo '+m.elo : 'Not ranked yet'})]),
      h('span',{'class':'w',text:p.why})
    ]);
    card.addEventListener('click', function(){ select(m.id); });
    card.addEventListener('mouseenter', function(){ setHover(m.id,'pick'); });
    card.addEventListener('mouseleave', function(){ setHover(null); });
    picks.appendChild(card);
  });
  sec.appendChild(picks);

  var legend = h('div',{'class':'legend'},[
    h('span',{},[h('i',{'class':'dot f'}), 'Best value']),
    h('span',{},[h('i',{'class':'dot d'}), 'Beaten by a model that is cheaper or equal and scores higher']),
    h('span',{},[h('i',{'class':'stair'}), 'Best score you can get at or below each price'])
  ]);
  sec.appendChild(h('div',{'class':'card'},[
    h('div',{'class':'chart-head'},[h('h2',{text:C.title+': price against quality'}), legend]),
    h('div',{'class':'chart',id:'chart-'+cat}),
    h('p',{'class':'chart-foot'},[C.board+(C.anchor?' ('+C.anchor+')':'')+'. A 50-point gap means the higher model is preferred about 57% of the time. '+C.foot, h('span',{id:'nudge-'+cat})])
  ]));

  var cols = [
    {k:'name',t:'Model'},{k:'price',t:'Price on fal'},{k:'elo',t:'Quality (Elo)'},
    {k:null,t:'Verdict'},{k:null,t:'My budget buys'},{k:null,t:'API endpoint'}
  ];
  var tr = h('tr');
  cols.forEach(function(c){
    var th = h('th',{scope:'col'});
    if(c.k){
      var b = h('button',{type:'button',text:c.t,dataset:{sort:c.k}});
      b.addEventListener('click', function(){
        if(state.sort.key===c.k) state.sort.dir = -state.sort.dir;
        else { state.sort.key = c.k; state.sort.dir = (c.k==='elo') ? -1 : 1; }
        renderTables();
      });
      th.appendChild(b);
    } else th.textContent = c.t;
    tr.appendChild(th);
  });
  sec.appendChild(h('div',{'class':'card'},[
    h('div',{'class':'tbl-head'},[h('h2',{text:'All '+C.title.toLowerCase()+' models'}), h('p',{id:'tnote-'+cat})]),
    h('div',{'class':'scroll'},[h('table',{'class':'tbl',id:'tbl-'+cat},[h('thead',{},[tr]), h('tbody')])])
  ]));
  return sec;
}

function sortedRows(cat){
  var list = DB[cat].filter(function(m){ return state.show!=='value' || m.front; });
  var s = state.sort, dir = s.dir;
  list.sort(function(a,b){
    if(s.key==='name') return dir*a.name.localeCompare(b.name);
    if(s.key==='elo'){
      if(a.elo==null && b.elo==null) return a.x-b.x;
      if(a.elo==null) return 1; if(b.elo==null) return -1;
      return dir*(a.elo-b.elo) || (a.x-b.x);
    }
    return dir*(a.x-b.x) || (b.elo||0)-(a.elo||0);
  });
  return list;
}

function rowFor(cat, m){
  var pp = priceParts(m), sc = eloScale(cat);
  var tr = h('tr',{'class':'row',dataset:{id:m.id},tabindex:'0'});
  tr.appendChild(h('td',{},[h('div',{'class':'mname',text:m.name}), h('div',{'class':'mmaker',text:m.maker})]));
  tr.appendChild(h('td',{},[h('span',{'class':'pmain',text:pp.main}), h('span',{'class':'psub',text:pp.sub})]));
  var eloTd = h('td');
  if(m.elo!=null){
    var pct = Math.max(2, Math.min(100, (m.elo-sc.lo)/(sc.hi-sc.lo)*100));
    var bar = h('span',{'class':'bar'+(m.front?' f':'')},[h('i',{style:'width:'+pct.toFixed(1)+'%'})]);
    eloTd.appendChild(h('div',{'class':'elo'},[h('span',{'class':'n',text:String(m.elo)}), h('span',{'class':'ci',text:m.ci?'±'+m.ci:''}), bar]));
  } else eloTd.appendChild(h('span',{'class':'unr',text:'Not ranked yet'}));
  tr.appendChild(eloTd);
  var vTd = h('td');
  if(m.elo==null) vTd.appendChild(h('span',{'class':'unr',text:'Unscored, not on the chart'}));
  else if(m.front) vTd.appendChild(h('span',{'class':'pill',text:'Best value'}));
  else vTd.appendChild(h('span',{'class':'beat',text:'Beaten by '+shortName(m.beatenBy)}));
  tr.appendChild(vTd);
  tr.appendChild(h('td',{},[h('span',{'class':'buys',text:buys(m,state.budget)})]));
  var cp = h('button',{type:'button','class':'copy',text:'Copy','aria-label':'Copy endpoint name for '+m.name});
  cp.addEventListener('click', function(e){ e.stopPropagation(); copyText(m.endpoint); });
  tr.appendChild(h('td',{},[h('div',{'class':'ep'},[h('code',{title:m.endpoint,text:m.endpoint}), cp])]));
  tr.addEventListener('click', function(){ select(m.id); });
  tr.addEventListener('keydown', function(e){ if(e.key==='Enter' || (e.key===' ' && e.target===tr)){ e.preventDefault(); select(m.id); } });
  tr.addEventListener('mouseenter', function(){ setHover(m.id,'table'); });
  tr.addEventListener('mouseleave', function(){ setHover(null); });
  return tr;
}

function renderTable(cat){
  var tbl = $('#tbl-'+cat); if(!tbl) return;
  var tb = $('tbody', tbl); tb.textContent = '';
  var rows = sortedRows(cat);
  rows.forEach(function(m){ tb.appendChild(rowFor(cat,m)); });
  $$('th', tbl).forEach(function(th){
    var b = $('button', th);
    if(!b){ th.removeAttribute('aria-sort'); return; }
    th.setAttribute('aria-sort', state.sort.key===b.dataset.sort ? (state.sort.dir>0?'ascending':'descending') : 'none');
  });
  var n = DB[cat].length, ranked = DB[cat].filter(function(m){ return m.elo!=null; }).length;
  var note = $('#tnote-'+cat);
  if(note) note.textContent = (state.show==='value' ? rows.length+' best-value models' : n+' models, '+ranked+' with a quality score')+'. Click a row for details. Budget: '+money(state.budget).replace(/\.00$/,'')+'.';
  renderDetail();
  syncHL();
}
function renderTables(){ renderTable(state.tab); }

function renderDetail(){
  $$('tr.detail').forEach(function(r){ r.remove(); });
  $$('tr.row').forEach(function(r){ r.removeAttribute('aria-expanded'); });
  if(!state.sel) return;
  var m = ALL[state.sel]; if(!m || m.cat!==state.tab) return;
  var row = $('#tbl-'+m.cat+' tr.row[data-id="'+m.id+'"]'); if(!row) return;
  row.setAttribute('aria-expanded','true');
  var kind = CATS[m.cat].kind;
  var tiers = m.tiers.map(function(t){
    var p = kind==='vid' ? money(t.price)+'/s' : kind==='tts' ? money(t.price)+' per 1k chars' : money(t.price);
    return h('span',{},[t.label+' ', h('b',{text:p})]);
  });
  var left = [h('h3',{text:'About'}), h('p',{text:m.note})];
  if(m.elo!=null && !m.front && m.beatenBy){
    left.push(h('p',{'class':'note',text:'Beaten by '+m.beatenBy.name+': it scores '+m.beatenBy.elo+' against '+m.elo+' and costs '+priceParts(m.beatenBy).main+'.'}));
  }
  var cp = h('button',{type:'button','class':'copy',text:'Copy'});
  cp.addEventListener('click', function(){ copyText(m.endpoint); });
  var wrap = h('div',{'class':'dwrap'},[h('div',{'class':'dgrid'},[
    h('div',{},left),
    h('div',{},[h('h3',{text:'Every published price'}), h('div',{'class':'tiers'},tiers),
      h('p',{'class':'note',style:'margin-top:8px',text:'Chart price: '+m.basis+(m.approx?' (estimate)':'')+'.'})]),
    h('div',{'class':'dfull'},[h('h3',{text:'API endpoint'}), h('div',{'class':'ep'},[h('code',{text:m.endpoint}), cp])])
  ])]);
  var tr = h('tr',{'class':'detail'},[h('td',{colspan:'6'},[wrap])]);
  row.parentNode.insertBefore(tr, row.nextSibling);
}

/* ---------- Tabs, best-value strip, filters ---------- */
function setTab(id){
  if(validTabs.indexOf(id)<0) id = 't2i';
  state.tab = id; state.sel = null; state.hov = null;
  LS.set('tab', id);
  validTabs.forEach(function(t){
    var on = t===id, b = $('#tab-'+t), p = $('#panel-'+t);
    if(b){ b.setAttribute('aria-selected', on?'true':'false'); b.tabIndex = on?0:-1; }
    if(p) p.hidden = !on;
  });
  var isPlan = id==='plan';
  $('#f-show').hidden = isPlan; $('#f-label').hidden = isPlan;
  if(isPlan){ if(typeof renderPlanner==='function') renderPlanner(); }
  else { drawChart(id); renderTable(id); }
}

function buildTabs(){
  var tabs = $('#tabs');
  validTabs.forEach(function(id, i){
    var b = h('button',{type:'button',role:'tab',id:'tab-'+id,'aria-controls':'panel-'+id,'aria-selected':'false',tabindex:'-1',
      text: id==='plan' ? 'Cost planner' : CATS[id].tab});
    b.addEventListener('click', function(){ setTab(id); });
    b.addEventListener('keydown', function(e){
      var j = null;
      if(e.key==='ArrowRight') j = (i+1)%validTabs.length;
      else if(e.key==='ArrowLeft') j = (i-1+validTabs.length)%validTabs.length;
      else if(e.key==='Home') j = 0; else if(e.key==='End') j = validTabs.length-1;
      if(j!=null){ e.preventDefault(); setTab(validTabs[j]); $('#tab-'+validTabs[j]).focus(); }
    });
    tabs.appendChild(b);
  });
}

function buildBest(){
  var box = $('#best');
  BEST.forEach(function(b){
    var m = ALL[b.id], pp = priceParts(m);
    var btn = h('button',{type:'button'},[
      h('span',{'class':'job',text:'Best value: '+b.job}),
      h('span',{'class':'nm',text:m.name}),
      h('span',{'class':'pr'},[h('b',{text:pp.main}), ' · Elo '+m.elo])
    ]);
    btn.addEventListener('click', function(){
      setTab(b.cat); state.sel = m.id; renderDetail(); syncHL();
      var sec = $('#tabs'); if(sec && sec.scrollIntoView) sec.scrollIntoView({block:'start',behavior:'smooth'});
    });
    box.appendChild(btn);
  });
}

function bindFilters(){
  var bi = $('#budget'); bi.value = String(state.budget);
  bi.addEventListener('input', function(){
    var v = parseFloat(bi.value);
    state.budget = (isFinite(v) && v>=0) ? v : 0;
    LS.set('budget', state.budget);
    if(state.tab==='plan'){ if(typeof renderPlanner==='function') renderPlanner(true); }
    else renderTable(state.tab);
  });
  $$('#f-show button').forEach(function(b){
    b.addEventListener('click', function(){
      state.show = b.dataset.v;
      $$('#f-show button').forEach(function(x){ x.setAttribute('aria-pressed', x===b ? 'true':'false'); });
      if(state.tab!=='plan'){ drawChart(state.tab); renderTable(state.tab); }
    });
  });
  $('#labelAll').addEventListener('change', function(e){
    state.labelAll = e.target.checked;
    if(state.tab!=='plan') drawChart(state.tab);
  });
}
