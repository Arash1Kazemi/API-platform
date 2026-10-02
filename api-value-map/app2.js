
/* ---------- Chart: price (log x) against quality (Elo, y) ---------- */
var NS = 'http://www.w3.org/2000/svg';
function se(name, attrs, parent, text){
  var e = document.createElementNS(NS, name);
  for(var k in attrs){ e.setAttribute(k, attrs[k]); }
  if(text!=null) e.textContent = text;
  if(parent) parent.appendChild(e);
  return e;
}
var mctx = document.createElement('canvas').getContext('2d');
function textW(s, font){ mctx.font = font; return mctx.measureText(s).width; }
var LABEL_FONT_B = '500 11.5px "IBM Plex Sans", system-ui, sans-serif';
var LABEL_FONT_N = '400 11.5px "IBM Plex Sans", system-ui, sans-serif';

var charts = {};

function yTicks(lo, hi){
  var c = [10,20,25,50,100,200], step = 200, i;
  for(i=0;i<c.length;i++){ if((hi-lo)/c[i] <= 7){ step = c[i]; break; } }
  var t = [];
  for(var v=Math.ceil(lo/step)*step; v<=hi; v+=step) t.push(v);
  return t;
}
function xTicks(lo, hi, X){
  var out = [], seq = [1,2,5], e, i;
  for(e=Math.floor(Math.log10(lo)); e<=Math.ceil(Math.log10(hi)); e++){
    for(i=0;i<seq.length;i++){
      var v = seq[i]*Math.pow(10,e);
      if(v>=lo*0.999 && v<=hi*1.001) out.push(v);
    }
  }
  var kept = [], lastPx = -1e9;
  out.forEach(function(v){
    var px = X(v);
    if(px-lastPx >= 58){ kept.push(v); lastPx = px; }
  });
  return kept;
}
function hitRect(a,b){ return a.x<b.x+b.w && a.x+a.w>b.x && a.y<b.y+b.h && a.y+a.h>b.y; }

function drawChart(cat){
  var host = $('#chart-'+cat);
  if(!host || !host.clientWidth) return;
  var old = $('svg', host); if(old) old.remove();
  var W = Math.max(300, Math.floor(host.clientWidth) - 12);
  var H = W<560 ? 360 : 470;
  var M = {l:48, r:18, t:30, b:50};
  var ranked = DB[cat].filter(function(m){ return m.elo!=null; });
  var xs = ranked.map(function(m){ return m.x; }), es = ranked.map(function(m){ return m.elo; });
  var xmin = Math.min.apply(null,xs), xmax = Math.max.apply(null,xs);
  var lo = xmin/1.4, hi = xmax*1.6;
  var emin = Math.min.apply(null,es), emax = Math.max.apply(null,es);
  var rng = Math.max(40, emax-emin);
  var ylo = Math.floor((emin-rng*0.08-6)/10)*10, yhi = Math.ceil((emax+rng*0.08+6)/10)*10;
  var iw = W-M.l-M.r, ih = H-M.t-M.b;
  var lx0 = Math.log(lo), lx1 = Math.log(hi);
  function X(v){ return M.l + (Math.log(v)-lx0)/(lx1-lx0)*iw; }
  function Y(e){ return M.t + (1-(e-ylo)/(yhi-ylo))*ih; }

  var front = ranked.filter(function(m){ return m.front; }).sort(function(a,b){ return a.x-b.x; });
  var svg = se('svg',{viewBox:'0 0 '+W+' '+H, width:W, height:H, role:'img',
    'aria-label':'Scatter chart of '+ranked.length+' models, price on the horizontal axis and quality on the vertical axis. Best-value models: '+front.map(shortName).join(', ')+'. Every value is also in the table below.'});
  host.insertBefore(svg, host.firstChild);

  /* grid and axes */
  yTicks(ylo,yhi).forEach(function(v){
    se('line',{x1:M.l,x2:W-M.r,y1:Y(v),y2:Y(v),'class':'gl'},svg);
    se('text',{x:M.l-8,y:Y(v)+4,'text-anchor':'end','class':'ax-t'},svg,String(v));
  });
  xTicks(lo,hi,X).forEach(function(v){
    se('line',{x1:X(v),x2:X(v),y1:M.t,y2:H-M.b,'class':'gl','stroke-opacity':'.55'},svg);
    se('text',{x:X(v),y:H-M.b+17,'text-anchor':'middle','class':'ax-t'},svg,axisMoney(v));
  });
  se('line',{x1:M.l,x2:W-M.r,y1:H-M.b,y2:H-M.b,'class':'axl'},svg);
  var xt = W<480 ? CATS[cat].xTitle.replace(' on fal','') : CATS[cat].xTitle;
  se('text',{x:M.l+iw/2,y:H-10,'text-anchor':'middle','class':'ax-title'},svg,xt);
  se('text',{x:2,y:14,'class':'ax-title'},svg,'Quality (Elo), higher is better');

  /* best-value staircase: the best score available at or below each price */
  var stairBoxes = [];
  if(front.length){
    var d = 'M'+X(front[0].x)+','+Y(front[0].elo), i;
    for(i=1;i<front.length;i++){
      d += ' L'+X(front[i].x)+','+Y(front[i-1].elo)+' L'+X(front[i].x)+','+Y(front[i].elo);
    }
    d += ' L'+(W-M.r)+','+Y(front[front.length-1].elo);
    se('path',{d:d+' L'+(W-M.r)+','+(H-M.b)+' L'+X(front[0].x)+','+(H-M.b)+' Z','class':'stair-fill'},svg);
    se('path',{d:d,'class':'stair-line'},svg);
    /* thin boxes along the line, so no label is ever printed on top of it */
    for(i=0;i<front.length;i++){
      var ax = X(front[i].x), ay = Y(front[i].elo);
      var bx = (i+1<front.length) ? X(front[i+1].x) : (W-M.r);
      stairBoxes.push({x:ax, y:ay-3, w:Math.max(0,bx-ax), h:6});
      if(i+1<front.length){
        var by = Y(front[i+1].elo);
        stairBoxes.push({x:bx-3, y:Math.min(ay,by), w:6, h:Math.abs(by-ay)});
      }
    }
  }

  /* points: beaten models first, best-value on top */
  var pts = {}, valueOnly = state.show==='value';
  var order = ranked.slice().sort(function(a,b){ return (a.front?1:0)-(b.front?1:0); });
  var list = order.map(function(m){ return {x:X(m.x), y:Y(m.elo), r:m.front?6.5:5, m:m}; });
  /* two models with the same price and almost the same score would hide each other:
     a dot that lands on another one slides sideways until both can be seen (best-value dots never move) */
  var nudged = 0;
  list.forEach(function(p, i){
    if(p.m.front) return;
    for(var tries=0; tries<8; tries++){
      var other = null, j;
      for(j=0;j<list.length;j++){
        var q = list[j];
        if(j===i || !(q.m.front || j<i)) continue;
        if(Math.hypot(q.x-p.x, q.y-p.y) < q.r+p.r+1.5){ other = q; break; }
      }
      if(!other) break;
      var dy = Math.abs(other.y-p.y), gap = q_gap(other.r+p.r+1.5, dy);
      p.x = other.x + gap; nudged++;
    }
  });
  function q_gap(min, dy){ return Math.sqrt(Math.max(0, min*min-dy*dy)); }
  list.forEach(function(p){
    var m = p.m;
    pts[m.id] = p;
    var cls = (m.front?'pt-f':'pt-d') + ((valueOnly && !m.front)?' pt-off':'');
    se('circle',{cx:p.x,cy:p.y,r:p.r,'class':cls,'data-id':m.id},svg);
  });
  var nn = $('#nudge-'+cat);
  if(nn) nn.textContent = nudged ? ' Dots that would sit on top of each other are moved sideways by a few pixels so every model can be seen.' : '';

  /* direct labels: best-value models first, then others if asked, skipping any that would collide */
  var bounds = {l:M.l, r:W-M.r, t:M.t-6, b:H-M.b-2};
  var dots = Object.keys(pts).map(function(k){ var p=pts[k]; return {id:k, x:p.x-p.r-2, y:p.y-p.r-2, w:2*p.r+4, h:2*p.r+4}; });
  var placed = [];
  var cands = ranked.filter(function(m){ return m.front; }).sort(function(a,b){ return b.elo-a.elo; });
  if(state.labelAll && !valueOnly){
    cands = cands.concat(ranked.filter(function(m){ return !m.front; }).sort(function(a,b){ return b.elo-a.elo; }));
  }
  cands.forEach(function(m){
    var p = pts[m.id], txt = shortName(m), font = m.front ? LABEL_FONT_B : LABEL_FONT_N;
    var w = textW(txt, font)+2, hh = 13;
    /* a best-value dot has the line running out of it to the right, so its label goes above or below that run */
    var spots = m.front ? [
      {dx:p.r+4, dy:-8, a:'start'}, {dx:p.r+4, dy:p.r+10, a:'start'},
      {dx:-p.r-4, dy:-8, a:'end'}, {dx:-p.r-4, dy:p.r+10, a:'end'},
      {dx:0, dy:-p.r-7, a:'middle'}, {dx:0, dy:p.r+16, a:'middle'}
    ] : [
      {dx:p.r+5, dy:4, a:'start'}, {dx:p.r+5, dy:-6, a:'start'},
      {dx:-p.r-5, dy:4, a:'end'}, {dx:-p.r-5, dy:-6, a:'end'},
      {dx:0, dy:-p.r-6, a:'middle'}, {dx:0, dy:p.r+15, a:'middle'}
    ];
    for(var s=0;s<spots.length;s++){
      var c = spots[s];
      var x0 = p.x + c.dx - (c.a==='end' ? w : c.a==='middle' ? w/2 : 0);
      var box = {x:x0-2, y:p.y+c.dy-10, w:w+4, h:hh+1};
      if(box.x<bounds.l-40 || box.x+box.w>bounds.r+14 || box.y<bounds.t || box.y+box.h>bounds.b) continue;
      if(placed.some(function(q){ return hitRect(box,q); })) continue;
      if(stairBoxes.some(function(q){ return hitRect(box,q); })) continue;
      if(dots.some(function(q){ return q.id!==m.id && hitRect(box,q); })) continue;
      placed.push(box);
      se('text',{x:p.x+c.dx,y:p.y+c.dy,'text-anchor':c.a,'class':'lab'+(m.front?'':' d')},svg,txt);
      break;
    }
  });

  /* rings for hover and selection */
  var ringSel = se('circle',{'class':'ring sel',r:0,cx:0,cy:0,style:'display:none'},svg);
  var ringHov = se('circle',{'class':'ring',r:0,cx:0,cy:0,style:'display:none;opacity:.6'},svg);

  /* pointer layer: the nearest point within reach wins, so small dots are easy to hit */
  var hit = se('rect',{x:M.l-10,y:M.t-6,width:iw+20,height:ih+12,fill:'transparent'},svg);
  function nearest(e){
    var r = svg.getBoundingClientRect(), sx = W/r.width;
    var px = (e.clientX-r.left)*sx, py = (e.clientY-r.top)*sx, best = null, bd = 1e9;
    Object.keys(pts).forEach(function(k){
      var p = pts[k]; if(valueOnly && !p.m.front) return;
      var dd = Math.hypot(p.x-px, p.y-py);
      if(dd<bd){ bd = dd; best = p; }
    });
    return (best && bd<=36) ? best : null;
  }
  hit.addEventListener('pointermove', function(e){ var p = nearest(e); setHover(p ? p.m.id : null, 'chart'); });
  /* on a touch screen the finger lifting counts as leaving, so the readout stays until the next tap */
  hit.addEventListener('pointerleave', function(e){ if(e.pointerType!=='touch') setHover(null); });
  hit.addEventListener('click', function(e){
    var p = nearest(e);
    if(p){ setHover(p.m.id, 'chart'); select(p.m.id); } else setHover(null);
  });

  /* keyboard access: one focus target per point, same readout as hover */
  ranked.forEach(function(m){
    if(valueOnly && !m.front) return;
    var p = pts[m.id];
    var kf = se('circle',{cx:p.x,cy:p.y,r:13,'class':'kf',tabindex:'0',role:'button',
      'aria-label':m.name+', '+priceParts(m).main+', Elo '+m.elo+(m.front?', on the best-value line':'')},svg);
    kf.addEventListener('focus', function(){ setHover(m.id, 'chart'); });
    kf.addEventListener('blur', function(){ setHover(null); });
    kf.addEventListener('keydown', function(e){ if(e.key==='Enter' || e.key===' '){ e.preventDefault(); select(m.id); } });
  });

  var tip = $('.tip', host);
  if(!tip){ tip = h('div',{'class':'tip',role:'presentation'}); host.appendChild(tip); }
  charts[cat] = {svg:svg, pts:pts, ringSel:ringSel, ringHov:ringHov, tip:tip, host:host, W:W, H:H};
  syncHL();
}

function showTip(c, m){
  var p = c.pts[m.id], tip = c.tip, pp = priceParts(m);
  tip.textContent = '';
  tip.appendChild(h('div',{'class':'t1'},[h('i',{'class':'key'+(m.front?' f':'')}), h('span',{text:m.name})]));
  tip.appendChild(h('span',{'class':'big',text:pp.main}));
  tip.appendChild(h('span',{'class':'big',text:'Elo '+m.elo+(m.ci?' ±'+m.ci:'')}));
  var v = m.front ? 'On the best-value line' : (m.beatenBy ? 'Beaten by '+shortName(m.beatenBy)+': higher score at a lower or equal price' : '');
  if(v) tip.appendChild(h('span',{'class':'sm',text:v}));
  tip.style.display = 'block';
  var ox = c.svg.offsetLeft, oy = c.svg.offsetTop;
  var tw = tip.offsetWidth, th = tip.offsetHeight;
  var left = ox + p.x + 16, top = oy + p.y - 16;
  if(left + tw > c.host.clientWidth - 4) left = ox + p.x - 16 - tw;
  if(left < 4) left = 4;
  if(top < 2) top = oy + p.y + 16;
  if(top + th > c.host.clientHeight - 2) top = c.host.clientHeight - th - 2;
  tip.style.left = left+'px'; tip.style.top = top+'px';
}

/* hover and selection are shared by the chart, the table and the pick cards */
function setHover(id, src){
  state.hov = id; state.hovSrc = id ? (src||'table') : null;
  syncHL();
}
function select(id){
  state.sel = (state.sel===id) ? null : id;
  syncHL();
  if(typeof renderDetail==='function') renderDetail();
}
function syncHL(){
  var c = charts[state.tab];
  if(c){
    function ring(el, id, extra){
      var p = id && c.pts[id];
      if(!p || (state.show==='value' && !p.m.front)){ el.style.display = 'none'; return; }
      el.setAttribute('cx',p.x); el.setAttribute('cy',p.y); el.setAttribute('r',p.r+4+(extra||0));
      el.style.display = '';
    }
    ring(c.ringSel, state.sel, 1);
    ring(c.ringHov, state.hov, 0);
    var hm = state.hov && c.pts[state.hov] ? c.pts[state.hov].m : null;
    if(hm && state.hovSrc==='chart' && (state.show!=='value' || hm.front)) showTip(c, hm);
    else c.tip.style.display = 'none';
  }
  $$('tr.row').forEach(function(tr){
    tr.classList.toggle('is-sel', tr.dataset.id===state.sel);
    tr.classList.toggle('is-hov', tr.dataset.id===state.hov);
  });
}
