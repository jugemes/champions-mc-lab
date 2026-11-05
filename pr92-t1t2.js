'use strict';
// PR #92 request item 4: an executable human policy for the chosen 3+lead.
// T1 and T2 decisions keyed ONLY by what is public at that moment:
//   T1 key  rival lead species (base name)
//   T2 key  rival lead | our active | rival active   (all on the field)
// Our own request (moves / PP / bench) is our own information. No rival item,
// move list, three, set hypothesis, branch, seed or result is read by the
// script (obs is built from bot.foeActive and req only; checkObs throws on
// anything else).
// The table is BUILT offline from the selector's public-derived scenario
// teams and cells (role-template hypotheses from the six public species), by
// forcing each legal action in turn and keeping it only when it beats our base
// AI on the same jobs by MIN_GAIN with n >= MIN_N; otherwise 'ai' (= base AI).
// It is then EXECUTED in pinned-Showdown battles against the evaluated rival's
// real sets (pr92-eval.js), which the builder never sees.
// Heuristic AI vs heuristic AI on constructed sets. NOT a ladder win rate.
const {fork}=require('node:child_process');
const {load,hashSeed}=require('./lab');
const M=require('./pr82-switch-utility-t1t2');
const T1T2={branches:['ai','attack'],seeds:2,minN:8,minGain:0.10,t2Branches:['ai'],t2Seeds:1};
const OBS=new Set(['turn','rivalLead','rivalActive','ownActive','legal']);
const base=s=>M.baseName(s||'');
function checkObs(o){for(const k of Object.keys(o))if(!OBS.has(k))throw Error('T1/T2 obs: non-public field '+k);return o;}
function keyOf(o){checkObs(o);return o.turn===1?'T1|'+base(o.rivalActive):'T2|'+base(o.rivalLead)+'|'+base(o.ownActive)+'|'+base(o.rivalActive);}
// Own-side script: forced label (table building) or table rule (execution).
function planScript(plan,rec){
  let lead=null;rec.keys={};rec.used={};
  return (req,bot,info)=>{
    if(info.turn>2||req.forceSwitch)return null;
    if(info.turn===1)lead=bot.foeActive;
    const legal=M.legalActions(req);
    const obs={turn:info.turn,rivalLead:lead,rivalActive:bot.foeActive,ownActive:M.baseName(req.side.pokemon.find(p=>p.active).details),legal:legal.map(a=>a.label)};
    const key=keyOf(obs);rec.keys[info.turn]=key;
    let label=null;
    if(plan.force&&plan.force.turn===info.turn)label=plan.force.label;
    else if(plan.table&&plan.table[key]&&plan.table[key]!=='ai')label=plan.table[key];
    if(!label)return null;
    const a=legal.find(x=>x.label===label);
    rec.used[info.turn]=a?label:'unavailable:'+label;
    return a?a.choice:null;
  };
}
// Our executed action in one turn, from the public log: the first own move or
// voluntary switch line (a switch after a faint is a replacement, not a choice).
function ownAction(lines,side){
  for(const l of lines||[]){const a=l.split('|');
    if(a[1]==='faint')return null;
    if(a[2]&&a[2].startsWith(side+'a: ')){if(a[1]==='move')return 'move:'+a[3];if(a[1]==='switch')return 'switch:'+M.baseName(a[3]);}}
  return null;
}
function workerMain(){
  const {battle}=require('./encore-lead-audit');
  const {OWN_AI,rivalScript}=require('./public-six-general');
  const sim=load(),dex=sim.Dex.mod('champions');
  const T13=/^\|(turn|move|switch|drag|faint|cant|-mega|-weather|-boost|-damage|-heal|-enditem|-activate|-start|win)\|/;
  process.on('message',async({own,teams,jobs})=>{
    const out=[];
    for(const j of jobs){
      const requested=[],rec={};
      const rs=j.branch==='utility'?rivalScript('utility',dex,requested):M.rivalScriptV2(j.branch,dex,requested);
      const g=await battle(sim,structuredClone(own),structuredClone(teams[j.team]),j.seed,
        {ownThree:j.own,foeThree:j.foe,reverse:j.reverse,script:rs,ownOptions:{...OWN_AI,script:planScript(j.plan||{},rec)}});
      if(g.errors)throw Error('choice errors '+JSON.stringify(j));
      const util=M.utilityAudit(g.log,g.foeSide,dex),T=M.splitTurns(g.log);
      out.push({id:j.id,won:g.won?1:0,turns:g.turns,keys:rec.keys,used:rec.used,side:g.ownSide,act:{1:ownAction(T[1],g.ownSide),2:ownAction(T[2],g.ownSide)},
        aceMega:g.log.includes('|detailschange|'+g.foeSide+'a: '),
        irrational:util.filter(u=>u.rational==='irrational').map(u=>u.turn+':'+u.move),
        lines:j.keepLines?[1,2,3].flatMap(t=>(T[t]||[]).filter(x=>T13.test(x)).map(x=>'T'+t+' '+x)).slice(0,40):null});
    }
    process.send(out);
  });
}
async function runGamesPR92(own,teams,jobs,{workers=4}={}){
  if(!jobs.length)return [];
  jobs.forEach((j,i)=>{j.id=i;});
  const W=Math.max(1,Math.min(workers,jobs.length)),chunks=[...Array(W)].map(()=>[]);
  jobs.forEach((j,i)=>chunks[i%W].push(j));
  const parts=await Promise.all(chunks.map(c=>new Promise((res,rej)=>{
    const w=fork(__filename,['--pr92-worker'],{env:process.env});
    w.on('message',m=>{res(m);w.kill();});w.on('error',rej);
    w.on('exit',code=>{if(code)rej(Error('worker exit '+code));});
    w.send({own,teams,jobs:c});
  })));
  const byId=[];for(const r of parts.flat())byId[r.id]=r;
  return byId;
}
const mean=a=>a.length?a.reduce((s,v)=>s+v,0)/a.length:null;
// Static labels of our three (moves of each member, switch to each member);
// the request decides at run time which are legal.
function ownLabels(dex,own,pick){
  const sets=pick.map(s=>own.find(p=>p.species===s));
  const moves=sets.flatMap(p=>p.moves.map(m=>'move:'+dex.moves.get(m).name));
  return {lead:[...sets[0].moves.map(m=>'move:'+dex.moves.get(m).name),...pick.slice(1).map(s=>'switch:'+s)],
    all:[...new Set([...moves,...pick.map(s=>'switch:'+s)])]};
}
// teams / cells: the SELECTOR's public-derived scenario teams and rival cells.
async function buildT1T2({sim,own,pick,teams,cells,seedBase,workers=4,opts={}}){
  const o={...T1T2,...opts},dex=sim.Dex.mod('champions'),t0=Date.now();
  if(cells.some(c=>!Number.isInteger(c.si)||!Array.isArray(c.foe)))throw Error('cells must be selector cells {si,foe}');
  const L=ownLabels(dex,own,pick),jobs=[];
  const jobBase=(c,ci,branch,bi,s)=>({team:c.si,own:pick,foe:c.foe,branch,seed:hashSeed(seedBase+ci*64+bi*8+s),reverse:(s+ci)%2===1,ci});
  // T1: every lead label + base AI, same jobs
  cells.forEach((c,ci)=>o.branches.forEach((br,bi)=>{for(let s=0;s<o.seeds;s++){
    jobs.push({...jobBase(c,ci,br,bi,s),phase:1,label:'ai',plan:{}});
    for(const lab of L.lead)jobs.push({...jobBase(c,ci,br,bi,s),phase:1,label:lab,plan:{force:{turn:1,label:lab}}});}}));
  const r1=await runGamesPR92(own,teams,jobs,{workers});
  const t1=tableFrom(jobs.map((j,i)=>({j,r:r1[i]})),1,o);
  // T2: T1 fixed to the T1 table; every T2 label + base AI, grouped by the
  // observed T2 key afterwards (the key is only known after T1).
  const t1Table=Object.fromEntries(Object.entries(t1).map(([k,v])=>[k,v.action]));
  const j2=[];
  cells.forEach((c,ci)=>o.t2Branches.forEach((br,bi)=>{for(let s=0;s<o.t2Seeds;s++){
    j2.push({...jobBase(c,ci,br,bi+4,s),phase:2,label:'ai',plan:{table:t1Table}});
    for(const lab of L.all)j2.push({...jobBase(c,ci,br,bi+4,s),phase:2,label:lab,plan:{table:t1Table,force:{turn:2,label:lab}}});}}));
  const r2=await runGamesPR92(own,teams,j2,{workers});
  const t2=tableFrom(j2.map((j,i)=>({j,r:r2[i]})),2,o);
  const table={...t1Table,...Object.fromEntries(Object.entries(t2).map(([k,v])=>[k,v.action]))};
  return {pick:pick.join('>'),table,stats:{T1:t1,T2:t2},games:jobs.length+j2.length,seconds:+((Date.now()-t0)/1000).toFixed(1),params:o};
}
// For each observed key: base AI value vs each forced label that was actually
// executed (paired on the same job); keep the best only past MIN_GAIN / MIN_N.
function tableFrom(rows,turn,o){
  const by={};
  const pk=j=>[j.ci,j.branch,j.seed,j.reverse].join('|');
  const ai={},aiAct={};
  for(const {j,r} of rows)if(j.label==='ai'&&r.keys[turn]){ai[pk(j)]={key:r.keys[turn],won:r.won};
    const a=r.act?.[turn];if(a){const m=aiAct[r.keys[turn]]||(aiAct[r.keys[turn]]={});m[a]=(m[a]||0)+1;}}
  for(const {j,r} of rows){
    if(j.label==='ai'||!r.keys[turn]||r.used[turn]!==j.label)continue;
    const a=ai[pk(j)];if(!a||a.key!==r.keys[turn])continue;// paired with base AI in the same observed state
    const k=r.keys[turn],x=((by[k]||(by[k]={}))[j.label]||(by[k][j.label]={w:[],b:[]}));x.w.push(r.won);x.b.push(a.won);
  }
  const out={};
  for(const [k,v] of Object.entries(by)){
    const rowsK=Object.entries(v).map(([lab,x])=>({label:lab,n:x.w.length,v:mean(x.w),ai:mean(x.b)})).filter(x=>x.n>=o.minN)
      .sort((a,b)=>b.v-b.ai-(a.v-a.ai)||b.v-a.v||a.label.localeCompare(b.label));
    const best=rowsK[0];
    const modal=Object.entries(aiAct[k]||{}).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))[0];
    out[k]={action:best&&best.v-best.ai>=o.minGain-1e-9?best.label:'ai',aiAction:modal?{label:modal[0],share:+(modal[1]/Object.values(aiAct[k]).reduce((a,b)=>a+b,0)).toFixed(2)}:null,best:best?{label:best.label,n:best.n,v:+best.v.toFixed(3),ai:+best.ai.toFixed(3)}:null,
      options:rowsK.slice(0,4).map(x=>({label:x.label,n:x.n,v:+x.v.toFixed(3),ai:+x.ai.toFixed(3)}))};
  }
  return out;
}
// Human-readable rules. 'ai' keys show what the base AI did there (modal
// executed action and its share) so a human still gets a concrete action;
// they are marked 'AI default' (no forced action beat it by MIN_GAIN).
function humanRules(table,stats){
  const st={...(stats?.T1||{}),...(stats?.T2||{})};
  return Object.entries(table).sort().map(([k,a])=>{
    const p=k.split('|'),s=st[k];
    const act=a!=='ai'?a+' (forced rule'+(s?.best?': '+s.best.v+' vs AI '+s.best.ai+', n '+s.best.n:'')+')':
      'AI default'+(s?.aiAction?': '+s.aiAction.label+' ('+Math.round(s.aiAction.share*100)+'%)':'');
    return (p[0]==='T1'?'T1: rival lead '+p[1]:'T2: rival lead '+p[1]+', our '+p[2]+' vs rival '+p[3])+' -> '+act;
  });
}
if(process.argv.includes('--pr92-worker'))workerMain();
module.exports={T1T2,keyOf,checkObs,planScript,runGamesPR92,buildT1T2,tableFrom,humanRules,ownLabels,ownAction};
