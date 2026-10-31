'use strict';
// PR #94 request (ChatGPT review #5721596824 of PR #93), items 1 / 2 / 5.
// pr92-t1t2.js is NOT changed (PR #93 results stay reproducible).
//
// P0 fixed here: pr92 keyOf used M.baseName, which strips -Mega(-X|-Y), and
// its OBS allow-list had only turn/rivalLead/rivalActive/ownActive/legal, so
// Charizard / Charizard-Mega-X / Charizard-Mega-Y and different HP / status /
// weather / boosts / Encore / legal sets all collided on one T2 key.
//
// Observation (built from Bot fields that are parsed from the PUBLIC protocol
// log, and from our own request). Nothing else is accepted (checkObs throws):
//   turn, rivalLead          rival lead as it switched in (T1)
//   rivalActive, ownActive   the visible forme (Charizard-Mega-Y stays -Y; a
//                            NOT-yet-Mega'd rival stays its base forme: an
//                            unrevealed Mega is never assumed)
//   ownHP, rivalHP           fractions (public HP bar / own request)
//   ownStatus, rivalStatus   public status
//   weather, terrain, trickRoom
//   ownBoosts, rivalBoosts   public boost stages
//   ownEncored, rivalEncored public -start/-end Encore
//   ownHazards, rivalHazards public side conditions
//   legal                    our legal labels from the request (own Choice
//                            lock, Encore, PP 0, disabled moves, trapped)
// Not in the observation: rival item (also when revealed), rival move list,
// rival three / bench, hypothesis, branch, seed, result.
//
// Key (minimal: only fields that change what an action does):
//   T1  rivalActive forme | weather | terrain | legal signature
//   T2  rivalLead base | ownActive forme | rivalActive forme | weather |
//       terrain | trickRoom | HP band own/rival (H >1/2, M >1/4, L) |
//       status own/rival | nonzero boosts own/rival | Encore own/rival |
//       hazards on our side | legal signature
// A rival's unknown item / moves / three that do not change any public field
// give the SAME key (and so the same decision).
//
// Table: a forced action becomes a RULE only if, paired with base AI on the
// same job (same pre-decision state), it gains >= MIN_GAIN with n >= MIN_N
// over >= MIN_CELLS distinct (scenario, rival cell) pairs. Otherwise the key
// is ABSTAIN: base AI plays, and the base AI's modal action is shown as
// information only, NOT as a recommendation. Unseen keys abstain too.
// Heuristic AI vs heuristic AI on constructed sets. NOT a ladder win rate.
const {fork}=require('node:child_process');
const {load,hashSeed}=require('./lab');
const M=require('./pr82-switch-utility-t1t2');
const T94={t1Branches:['ai','attack','setup','switch'],t1Seeds:2,t2Branches:['ai','attack','setup','switch'],t2Seeds:2,minN:8,minGain:0.10,minCells:2};
const OBS=new Set(['turn','rivalLead','rivalActive','ownActive','ownHP','rivalHP','ownStatus','rivalStatus','weather','terrain','trickRoom',
  'ownBoosts','rivalBoosts','ownEncored','rivalEncored','ownHazards','rivalHazards','legal']);
const base=s=>M.baseName(s||'');
// visible forme: species part of the details string, Mega suffix KEPT
const forme=s=>String(s||'').split(',')[0].trim();
function checkObs(o){for(const k of Object.keys(o))if(!OBS.has(k))throw Error('T1/T2 obs: non-public field '+k);return o;}
const band=h=>h==null?'?':h>0.5?'H':h>0.25?'M':'L';
const boostSig=b=>Object.entries(b||{}).filter(([,v])=>v).sort().map(([k,v])=>k+(v>0?'+':'')+v).join(',')||'-';
const hazSig=h=>Object.keys(h||{}).filter(k=>h[k]).sort().join(',')||'-';
const legalSig=l=>(l||[]).slice().sort().join(',');
function keyOf(o){
  checkObs(o);
  const w=o.weather||'-',t=o.terrain||'-';
  if(o.turn===1)return ['T1',forme(o.rivalActive),w,t,legalSig(o.legal)].join('|');
  return ['T2',base(o.rivalLead),forme(o.ownActive),forme(o.rivalActive),w,t,o.trickRoom?'TR':'-',
    band(o.ownHP)+band(o.rivalHP),(o.ownStatus||'-')+'/'+(o.rivalStatus||'-'),boostSig(o.ownBoosts)+'/'+boostSig(o.rivalBoosts),
    (o.ownEncored?'E':'-')+(o.rivalEncored?'E':'-'),hazSig(o.ownHazards),legalSig(o.legal)].join('|');
}
function ownCondition(req){
  const p=req.side.pokemon.find(x=>x.active),m=String(p.condition||'').match(/^(\d+)\/(\d+)\S*(?: (\w+))?/);
  return {forme:forme(p.details),hp:/ fnt$|^0/.test(p.condition)?0:m?Number(m[1])/Number(m[2]):1,status:m?.[3]||''};
}
// Observation from the Bot (public-log fields) and our request only.
function obsFrom(req,bot,turn,lead){
  const c=ownCondition(req),legal=M.legalActions(req);
  return checkObs({turn,rivalLead:lead,rivalActive:forme(bot.foeActive),ownActive:c.forme,ownHP:c.hp,rivalHP:bot.foeHP,
    ownStatus:c.status,rivalStatus:bot.foePublicStatus||'',weather:bot.weather||'',terrain:bot.terrain||'',trickRoom:!!bot.trickRoom,
    ownBoosts:{...bot.boosts},rivalBoosts:{...bot.foeBoosts},ownEncored:!!bot.ownEncored,rivalEncored:!!bot.foeEncored,
    ownHazards:{...bot.ownHazards},rivalHazards:{...bot.hazards},legal:legal.map(a=>a.label)});
}
// Own-side script. plan.force = {turn,label} (table building) or plan.table =
// {key: {action:'rule:<label>'|'abstain'}} (execution). rec records the key,
// what was forced (or why not) and forced replacements, per turn.
function planScript(plan,rec){
  let lead=null;Object.assign(rec,{keys:{},used:{},forcedSwitch:{}});
  return (req,bot,info)=>{
    if(info.turn>2)return null;
    if(req.forceSwitch){rec.forcedSwitch[info.turn]=true;return null;}// replacement after a faint: base AI, counted apart
    if(info.turn===1&&!lead)lead=forme(bot.foeActive);
    const obs=obsFrom(req,bot,info.turn,lead),key=keyOf(obs),legal=M.legalActions(req);
    rec.keys[info.turn]=key;
    let label=null;
    if(plan.force&&plan.force.turn===info.turn)label=plan.force.label;
    else if(plan.table){const e=plan.table[key];
      if(!e){rec.used[info.turn]='abstain:unseen';return null;}
      if(!e.action.startsWith('rule:')){rec.used[info.turn]='abstain';return null;}
      label=e.action.slice(5);}
    if(!label)return null;
    const a=legal.find(x=>x.label===label);
    rec.used[info.turn]=a?(plan.force?label:'rule:'+label):'unavailable:'+label;
    return a?a.choice:null;
  };
}
function ownAction(lines,side){
  for(const l of lines||[]){const a=l.split('|');
    if(a[1]==='faint')return null;
    if(a[2]&&a[2].startsWith(side+'a: ')){if(a[1]==='move')return 'move:'+a[3];if(a[1]==='switch')return 'switch:'+M.baseName(a[3]);}}
  return null;
}
// Rival attacks in T1..maxTurn that hit an immunity of our visible forme that
// is PUBLIC: the type chart, or the forme's only possible ability (Levitate
// Rotom-Wash / Hydreigon). A hidden-ability immunity is not listed.
const ABILITY_IMMUNE={levitate:'Ground',flashfire:'Fire',voltabsorb:'Electric',waterabsorb:'Water',lightningrod:'Electric',stormdrain:'Water',
  sapsipper:'Grass',motordrive:'Electric',dryskin:'Water',eartheater:'Ground',wellbakedbody:'Fire'};
function publicImmune(log,foeSide,dex,{maxTurn=2}={}){
  const me=foeSide==='p1'?'p2':'p1',L=log.split('\n'),out=[];let turn=0,active='';
  for(let i=0;i<L.length;i++){const a=L[i].split('|');
    if(a[1]==='turn'){turn=Number(a[2]);if(turn>maxTurn)break;continue;}
    if(['switch','drag','replace','detailschange'].includes(a[1])&&a[2]?.startsWith(me+'a:'))active=forme(a[3]);
    if(turn<1||a[1]!=='move'||!a[2]?.startsWith(foeSide+'a:')||!a[4]?.startsWith(me+'a:'))continue;
    const mv=dex.moves.get(a[3]);if(mv.category==='Status')continue;
    let imm=false;for(let k=i+1;k<L.length&&!/^\|(move|turn|upkeep)(\||$)/.test(L[k]);k++)if(L[k].startsWith('|-immune|'+me+'a:'))imm=true;
    if(!imm)continue;
    const sp=dex.species.get(active),abs=Object.values(sp.abilities||{}).map(x=>x.toLowerCase().replace(/[^a-z]/g,''));
    const why=!dex.getImmunity(mv.type,sp.types)?'type':abs.length===1&&ABILITY_IMMUNE[abs[0]]===mv.type?'only ability '+abs[0]:null;
    if(why)out.push({turn,move:mv.name,target:active,why});
  }
  return out;
}
function workerMain(){
  const {battle}=require('./encore-lead-audit');
  const {OWN_AI,rivalScript}=require('./public-six-general');
  const sim=load(),dex=sim.Dex.mod('champions');
  const T13=/^\|(turn|move|switch|drag|faint|cant|-mega|-weather|-boost|-unboost|-damage|-heal|-enditem|-activate|-start|-status|-crit|-supereffective|win)\|/;
  process.on('message',async({own,teams,jobs})=>{
    const out=[];
    for(const j of jobs){
      const requested=[],rec={},t0=Date.now();
      const rs=j.branch==='utility'?rivalScript('utility',dex,requested):M.rivalScriptV2(j.branch,dex,requested);
      const g=await battle(sim,structuredClone(own),structuredClone(teams[j.team]),j.seed,
        {ownThree:j.own,foeThree:j.foe,reverse:j.reverse,script:rs,ownOptions:{...OWN_AI,script:j.plan?.table92?require('./pr92-t1t2').planScript({table:j.plan.table92},rec):planScript(j.plan||{},rec)}});
      if(g.errors)throw Error('choice errors '+JSON.stringify(j));
      const util=M.utilityAudit(g.log,g.foeSide,dex),T=M.splitTurns(g.log);
      out.push({id:j.id,won:g.won?1:0,turns:g.turns,ms:Date.now()-t0,keys:rec.keys,used:rec.used,forcedSwitch:rec.forcedSwitch,side:g.ownSide,
        act:{1:ownAction(T[1],g.ownSide),2:ownAction(T[2],g.ownSide)},
        aceMega:g.log.includes('|detailschange|'+g.foeSide+'a: '),
        irrational:util.filter(u=>u.rational==='irrational').map(u=>u.turn+':'+u.move),
        immune:publicImmune(g.log,g.foeSide,dex),
        lines:j.keepLines?[1,2,3].flatMap(t=>(T[t]||[]).filter(x=>T13.test(x)).map(x=>'T'+t+' '+x)).slice(0,40):null});
    }
    process.send(out);
  });
}
async function runGames94(own,teams,jobs,{workers=4}={}){
  if(!jobs.length)return [];
  jobs.forEach((j,i)=>{j.id=i;});
  const W=Math.max(1,Math.min(workers,jobs.length)),chunks=[...Array(W)].map(()=>[]);
  jobs.forEach((j,i)=>chunks[i%W].push(j));
  const parts=await Promise.all(chunks.map(c=>new Promise((res,rej)=>{
    const w=fork(__filename,['--pr94-worker'],{env:process.env});
    w.on('message',m=>{res(m);w.kill();});w.on('error',rej);
    w.on('exit',code=>{if(code)rej(Error('worker exit '+code));});
    w.send({own,teams,jobs:c});
  })));
  const byId=[];for(const r of parts.flat())byId[r.id]=r;
  return byId;
}
const mean=a=>a.length?a.reduce((s,v)=>s+v,0)/a.length:null;
function ownLabels(dex,own,pick){
  const sets=pick.map(s=>own.find(p=>p.species===s));
  const moves=sets.flatMap(p=>p.moves.map(m=>'move:'+dex.moves.get(m).name));
  return {lead:[...sets[0].moves.map(m=>'move:'+dex.moves.get(m).name),...pick.slice(1).map(s=>'switch:'+s)],
    all:[...new Set([...moves,...pick.map(s=>'switch:'+s)])]};
}
// Seeds include the cell and the branch (P1 of review #5721596824): no two
// (cell, branch, s) jobs share a seed.
const jobSeed=(seedBase,ci,bi,s)=>hashSeed(seedBase+ci*1000+bi*50+s);
// teams / cells: the SELECTOR's public-derived scenario teams and rival cells.
async function buildT1T2({sim,own,pick,teams,cells,seedBase,workers=4,opts={}}){
  const o={...T94,...opts},dex=sim.Dex.mod('champions'),t0=Date.now();
  if(cells.some(c=>!Number.isInteger(c.si)||!Array.isArray(c.foe)))throw Error('cells must be selector cells {si,foe}');
  const L=ownLabels(dex,own,pick),jobs=[];
  const jobBase=(c,ci,branch,bi,s)=>({team:c.si,own:pick,foe:c.foe,branch,seed:jobSeed(seedBase,ci,bi,s),reverse:(s+ci)%2===1,ci});
  cells.forEach((c,ci)=>o.t1Branches.forEach((br,bi)=>{for(let s=0;s<o.t1Seeds;s++){
    jobs.push({...jobBase(c,ci,br,bi,s),label:'ai',plan:{}});
    for(const lab of L.lead)jobs.push({...jobBase(c,ci,br,bi,s),label:lab,plan:{force:{turn:1,label:lab}}});}}));
  const r1=await runGames94(own,teams,jobs,{workers});
  const t1=tableFrom(jobs.map((j,i)=>({j,r:r1[i]})),1,o);
  const j2=[];
  cells.forEach((c,ci)=>o.t2Branches.forEach((br,bi)=>{for(let s=0;s<o.t2Seeds;s++){
    j2.push({...jobBase(c,ci,br,bi+10,s),label:'ai',plan:{table:t1}});
    for(const lab of L.all)j2.push({...jobBase(c,ci,br,bi+10,s),label:lab,plan:{table:t1,force:{turn:2,label:lab}}});}}));
  const r2=await runGames94(own,teams,j2,{workers});
  const t2=tableFrom(j2.map((j,i)=>({j,r:r2[i]})),2,o);
  const table={...t1,...t2};
  return {pick:pick.join('>'),table,games:jobs.length+j2.length,seconds:+((Date.now()-t0)/1000).toFixed(1),params:o,
    rules:Object.values(table).filter(e=>e.action.startsWith('rule:')).length,keys:Object.keys(table).length};
}
// Paired: a forced label counts only when it was executed and the base-AI job
// with the same (cell, branch, seed, side) reached the SAME key.
function tableFrom(rows,turn,o){
  const by={},pk=j=>[j.ci,j.branch,String(j.seed),j.reverse].join('|'),ai={},aiAct={};
  for(const {j,r} of rows)if(j.label==='ai'&&r.keys[turn]){ai[pk(j)]={key:r.keys[turn],won:r.won};
    const a=r.act?.[turn];if(a){const m=aiAct[r.keys[turn]]||(aiAct[r.keys[turn]]={});m[a]=(m[a]||0)+1;}}
  for(const {j,r} of rows){
    if(j.label==='ai'||!r.keys[turn]||r.used[turn]!==j.label)continue;
    const a=ai[pk(j)];if(!a||a.key!==r.keys[turn])continue;
    const x=((by[r.keys[turn]]||(by[r.keys[turn]]={}))[j.label]||(by[r.keys[turn]][j.label]={w:[],b:[],cells:new Set()}));
    x.w.push(r.won);x.b.push(a.won);x.cells.add(j.ci);
  }
  const out={};
  for(const k of new Set([...Object.keys(by),...Object.keys(aiAct)])){
    const rowsK=Object.entries(by[k]||{}).map(([lab,x])=>({label:lab,n:x.w.length,cells:x.cells.size,v:mean(x.w),ai:mean(x.b)}))
      .sort((a,b)=>b.v-b.ai-(a.v-a.ai)||b.v-a.v||a.label.localeCompare(b.label));
    const ok=rowsK.filter(x=>x.n>=o.minN&&x.cells>=o.minCells&&x.v-x.ai>=o.minGain-1e-9);
    const modal=Object.entries(aiAct[k]||{}).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))[0];
    const nAI=Object.values(aiAct[k]||{}).reduce((a,b)=>a+b,0);
    out[k]={action:ok.length?'rule:'+ok[0].label:'abstain',
      why:ok.length?'gain '+(ok[0].v-ok[0].ai).toFixed(3)+' n '+ok[0].n+' cells '+ok[0].cells:
        rowsK.length?'no label with n>='+o.minN+', cells>='+o.minCells+', gain>='+o.minGain:'no paired forced label',
      aiInfo:modal?{label:modal[0],share:+(modal[1]/nAI).toFixed(2),n:nAI}:null,
      options:rowsK.slice(0,4).map(x=>({label:x.label,n:x.n,cells:x.cells,v:+x.v.toFixed(3),ai:+x.ai.toFixed(3)}))};
  }
  return out;
}
// Human-readable table. A rule is a concrete action; abstain is NOT one.
function humanRules(table){
  return Object.entries(table).sort().map(([k,e])=>k+' -> '+(e.action.startsWith('rule:')?'DO '+e.action.slice(5)+' ('+e.why+')':
    'ABSTAIN ('+e.why+')'+(e.aiInfo?'; base AI did '+e.aiInfo.label+' '+Math.round(e.aiInfo.share*100)+'% of '+e.aiInfo.n+' [info only, not a recommendation]':'')));
}
// Executed-use summary over evaluation games (counts what really happened).
function useSummary(rs){
  const s={n:rs.length};
  for(const t of [1,2]){
    const reached=rs.filter(r=>r.keys?.[t]),rule=reached.filter(r=>String(r.used?.[t]).startsWith('rule:'));
    s['T'+t]={reached:reached.length,forcedRule:rule.length,ruleWin:mean(rule.map(r=>r.won)),
      abstain:reached.filter(r=>r.used?.[t]==='abstain').length,unseen:reached.filter(r=>r.used?.[t]==='abstain:unseen').length,
      unavailable:reached.filter(r=>String(r.used?.[t]).startsWith('unavailable')).length,
      forcedReplacementBefore:rs.filter(r=>r.forcedSwitch?.[t]).length};
  }
  return s;
}
if(process.argv.includes('--pr94-worker'))workerMain();
module.exports={publicImmune,T94,OBS,keyOf,checkObs,obsFrom,planScript,runGames94,buildT1T2,tableFrom,humanRules,useSummary,ownLabels,jobSeed,forme};
