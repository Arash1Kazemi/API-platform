(function(){
'use strict';

/* ---------- Category settings and editorial picks ---------- */
var CATS = {
  t2i:{tab:'Images',title:'Text to image',kind:'img',per:'image',
    xTitle:'Price per image on fal (USD, log scale)',
    board:'Artificial Analysis text-to-image board',anchor:'FLUX.2 [dev] is fixed at 1000',
    foot:'Prices are for about one megapixel (1024 x 1024). Models billed per megapixel are rounded up. Models without a score are in the table but not on the chart.',
    picks:[
      {k:'Drafts',id:'flux-2-turbo',why:'Roughly FLUX.2 [dev] quality for under a cent. Use it for previews and drafts.'},
      {k:'Cheap and good',id:'krea-2-medium-turbo',why:'22 points above FLUX.2 [dev] for $0.015. A solid default when volume matters.'},
      {k:'Best value',id:'grok-img-2',why:'Elo 1157 for $0.06. It beats Nano Banana 2 (1125) and costs $0.02 less.',value:true},
      {k:'Best quality',id:'gpt-image-2-5',why:'Highest score, but 3.5 times the price of Grok Imagine Image 2.0 for 38 more points.'}
    ]},
  edit:{tab:'Image editing',title:'Image editing',kind:'img',per:'edit',
    xTitle:'Price per edited image on fal (USD, log scale)',
    board:'Artificial Analysis image-editing board',anchor:'',
    foot:'Prices are for one edited image at about 1K. Grok Imagine adds $0.01 for each input image and the price shown includes one.',
    picks:[
      {k:'Cheapest ranked',id:'seedream-5-lite-edit',why:'$0.035 per edit with a published score of 1058.'},
      {k:'Best value',id:'grok-img-2-edit',why:'Scores 1107, level with Nano Banana 2 (1108), for $0.01 less. Extra input images cost $0.01 each.',value:true},
      {k:'Best quality',id:'gpt-image-2-5-edit',why:'Clear leader: 75 points above Grok Imagine Image 2.0 at 3 times the price.'}
    ]},
  t2v:{tab:'Text to video',title:'Text to video',kind:'vid',per:'second',
    xTitle:'Price per minute of video on fal (USD, log scale)',
    board:'Artificial Analysis text-to-video board',anchor:'Kling 3.0 Pro is fixed at 1000',
    foot:'Price per minute is the per-second price times 60, at the setting that matches the price Artificial Analysis lists (usually the default resolution). Lower resolutions cost less but were not ranked. Veo and Kling prices include generated audio, as Artificial Analysis lists them. fal\u2019s H3 Max page does not mention audio, so check that if your app needs sound.',
    picks:[
      {k:'Cheapest to try',id:'h3-max-turbo-t2v',why:'Half the price of H3 Max, but not ranked yet. Test it on your own prompts before you rely on it.'},
      {k:'Best value',id:'h3-max-t2v',why:'Elo 1134 for $4.80 a minute at 768p. Veo 3.1 Lite costs the same and scores 949.',value:true},
      {k:'Best quality',id:'wan-3-t2v',why:'Highest score, 23 points above H3 Max, for 2.5 times the price. At 720p it costs $6 a minute, but that setting was not ranked.'}
    ]},
  i2v:{tab:'Image to video',title:'Image to video',kind:'vid',per:'second',
    xTitle:'Price per minute of video on fal (USD, log scale)',
    board:'Artificial Analysis image-to-video board',anchor:'',
    foot:'Price per minute is the per-second price times 60, at the setting that matches the price Artificial Analysis lists (usually the default resolution). Lower resolutions cost less but were not ranked. Veo and Kling prices include generated audio, as Artificial Analysis lists them. fal\u2019s H3 Max page does not mention audio, so check that if your app needs sound.',
    picks:[
      {k:'Cheapest to try',id:'h3-max-turbo-i2v',why:'Half the price of H3 Max and not ranked yet. Test it on your own images first.'},
      {k:'Best value and best quality',id:'h3-max-i2v',why:'Number 1 on the board and the cheapest model in the top group. Nothing ranked beats it at any price.',value:true},
      {k:'Second opinion',id:'wan-3-i2v',why:'31 points lower for 2.5 times the price at 1080p. At 720p it costs $6 a minute, but that setting was not ranked.'}
    ]},
  tts:{tab:'Speech',title:'Text to speech',kind:'tts',per:'1,000 characters',
    xTitle:'Price per 1,000 characters on fal (USD, log scale)',
    board:'Artificial Analysis text-to-speech board',anchor:'',
    foot:'1,000 characters is roughly one minute of speech. Gemini TTS costs less on Google’s own API than on fal.',
    picks:[
      {k:'Cheapest good voice',id:'xai-tts',why:'$0.015 per 1,000 characters with a score of 1132. Kokoro costs more and ranks lower.'},
      {k:'Best value',id:'gemini-3-8-flash-lite-tts',why:'108 points above xAI TTS for twice the price, and ahead of ElevenLabs v3 and older.',value:true},
      {k:'Best quality',id:'eleven-v4',why:'Highest score, 80 points above Gemini Flash-Lite for 2.7 times the price.'}
    ]}
};
var ORDER = ['t2i','edit','t2v','i2v','tts'];
var BEST = [
  {job:'Images',cat:'t2i',id:'grok-img-2'},
  {job:'Image editing',cat:'edit',id:'grok-img-2-edit'},
  {job:'Video',cat:'i2v',id:'h3-max-i2v'},
  {job:'Speech',cat:'tts',id:'gemini-3-8-flash-lite-tts'}
];

/* ---------- Helpers ---------- */
function money(p){
  if(p>=1) return '$'+p.toFixed(2);
  var s = p.toFixed(4).replace(/0+$/,'');
  var parts = s.split('.');
  var d = (parts[1]||'');
  while(d.length<2) d += '0';
  return '$'+parts[0]+'.'+d;
}
function axisMoney(v){ return (v>=1 && Math.abs(v-Math.round(v))<1e-9) ? '$'+Math.round(v) : money(v); }
function fmtInt(n){ return Math.round(n).toLocaleString('en-US'); }
function shortName(m){ return m.name.replace(/\s*\(.*?\)\s*/g,' ').trim(); }
function $(sel, root){ return (root||document).querySelector(sel); }
function $$(sel, root){ return Array.prototype.slice.call((root||document).querySelectorAll(sel)); }
function h(tag, props, kids){
  var e = document.createElement(tag);
  if(props){ for(var k in props){
    if(k==='class') e.className = props[k];
    else if(k==='text') e.textContent = props[k];
    else if(k==='dataset'){ for(var d in props[k]) e.dataset[d] = props[k][d]; }
    else if(k.slice(0,2)==='on') e.addEventListener(k.slice(2), props[k]);
    else if(props[k]===true) e.setAttribute(k,'');
    else if(props[k]!==false && props[k]!=null) e.setAttribute(k, props[k]);
  }}
  (kids||[]).forEach(function(c){ if(c==null) return; e.appendChild(typeof c==='string' ? document.createTextNode(c) : c); });
  return e;
}
var LS = {
  get:function(k,d){ try{ var v = localStorage.getItem('fvm.'+k); return v==null ? d : JSON.parse(v); }catch(e){ return d; } },
  set:function(k,v){ try{ localStorage.setItem('fvm.'+k, JSON.stringify(v)); }catch(e){} }
};
var toastTimer = null;
function toast(msg){
  var t = $('#toast'); if(!t) return;
  t.textContent = msg; t.classList.add('on');
  clearTimeout(toastTimer); toastTimer = setTimeout(function(){ t.classList.remove('on'); }, 1800);
}

/* ---------- Prepare data: x value, best-value line, who beats whom ---------- */
var DB = {}, ALL = {};
ORDER.forEach(function(cat){
  var list = DATA[cat].map(function(m){
    var o = Object.assign({}, m);
    o.cat = cat;
    o.x = CATS[cat].kind==='vid' ? m.price*60 : m.price;
    o.defTier = Math.max(0, m.tiers.findIndex(function(t){ return Math.abs(t.price-m.price)<1e-9; }));
    return o;
  });
  var ranked = list.filter(function(m){ return m.elo!=null; });
  ranked.forEach(function(m){
    m.dominators = ranked.filter(function(o){
      return o!==m && o.elo>=m.elo && o.x<=m.x && (o.elo>m.elo || o.x<m.x);
    });
    m.front = m.dominators.length===0;
    m.beatenBy = null;
    if(m.dominators.length){
      m.beatenBy = m.dominators.slice().sort(function(a,b){ return (b.elo-a.elo) || (a.x-b.x); })[0];
    }
  });
  list.forEach(function(m){ if(m.elo==null){ m.front=false; m.beatenBy=null; m.dominators=[]; } ALL[m.id]=m; });
  DB[cat] = list;
});

function priceParts(m){
  var k = CATS[m.cat].kind, pre = m.approx ? '≈' : '';
  if(k==='vid') return {main: pre+money(m.price)+'/s', sub: money(m.price*60)+'/min · '+m.basis};
  if(k==='tts') return {main: pre+money(m.price)+' per 1k chars', sub: 'about '+money(m.price*60)+' per hour of speech'};
  return {main: pre+money(m.price)+' per '+CATS[m.cat].per, sub: m.basis};
}
function buys(m, budget){
  var k = CATS[m.cat].kind;
  if(!(budget>0)) return '–';
  if(k==='vid'){
    var s = budget/m.price;
    if(s<120) return fmtInt(Math.floor(s))+' s';
    if(s<7200) return (s/60).toFixed(1).replace(/\.0$/,'')+' min';
    return (s/3600).toFixed(1)+' h';
  }
  if(k==='tts'){
    var mins = budget/m.price;
    if(mins<120) return fmtInt(Math.floor(mins))+' min';
    return (mins/60).toFixed(1).replace(/\.0$/,'')+' h';
  }
  return fmtInt(Math.floor(budget/m.price))+' '+CATS[m.cat].per+'s';
}

/* ---------- Shared state ---------- */
var validTabs = ORDER.concat(['plan']);
var tab0 = LS.get('tab','t2i');
var state = {
  tab: validTabs.indexOf(tab0)>=0 ? tab0 : 't2i',
  budget: (function(){ var b = Number(LS.get('budget',20)); return b>=0 && isFinite(b) ? b : 20; })(),
  show:'all', labelAll:false,
  sort:{key:'price',dir:1},
  sel:null, hov:null
};
