'use strict';
// PR #96 request (ChatGPT review #5721799952 of PR #95), items 1 / 2 / 5.
// pr94-t1t2.js / pr94-cover-preview.js are NOT changed (PR #95 stays
// reproducible). Research opt-in, NOT adopted.
//
// P0-2 (unpaired rational filter). pr94 cellValues dropped, PER CANDIDATE,
// the guard games that failed rational94 and fell back to all games when a
// cell had none, so two candidates were scored on different game sets.
// Fix here: the rival does not need a post-hoc filter because it no longer
// plays the irrational move.
//   immune-aware rival  every rival decision (any turn, any branch, base AI or
//     branch script) is first computed as before; if it is a damaging (or
//     immunity-checked status) move into an immunity of OUR VISIBLE forme
//     that the rival can know from public information -- type chart, the
//     forme's ONLY possible ability, our ability once revealed, a revealed
//     Air Balloon -- the decision is recorded as 'masked' and RE-DECIDED by
//     the same rival logic with those moves disabled (it may pick another
//     move or switch; nothing is forced to a fixed string). The rival's own
//     ability (Mold Breaker / Scrappy / -ate) is the rival's own knowledge.
//     Our hidden ability (2+ possible) / hidden item is never assumed.
//   paired values  every candidate is scored on ALL games of the same jobs
//     (same rival 3 / lead / branch / seed / side); nothing is dropped per
//     candidate and there is no fallback. Per cell we report games, masked
//     re-decisions, residual public-immune hits and pr86-irrational games.
//     A 'pairedIntersection' sensitivity drops a (cell, branch, seed, side)
//     job for EVERY candidate if it was irrational for ANY candidate.
// P0-1 (T2 key ignores rival-side hazards). keyOf96 = keyOf (pr94) plus the
// hazards on the RIVAL side with layer counts (Stealth Rock / Spikes x n /
// Toxic Spikes x n / Sticky Web), which change what our Volt Switch / a rival
// switch costs. Our-side hazards also carry layer counts now. Nothing hidden
// (rival item / moves / three) is a key field; checkObs still throws.
// Heuristic AI vs heuristic AI on constructed sets. NOT a ladder win rate.
const {fork}=require('node:child_process');
const {load,hashSeed}=require('./lab');
const M=require('./pr82-switch-utility-t1t2');
const T=require('./pr94-t1t2');
const id=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
const mean=a=>a.length?a.reduce((s,v)=>s+v,0)/a.length:null;

// ---------- P0-1: T2 key with public hazards on both sides ----------
const band=h=>h==null?'?':h>0.5?'H':h>0.25?'M':'L';
const boostSig=b=>Object.entries(b||{}).filter(([,v])=>v).sort().map(([k,v])=>k+(v>0?'+':'')+v).join(',')||'-';
const hazSig96=h=>Object.entries(h||{}).filter(([,v])=>v).sort().map(([k,v])=>k+(v>1?'x'+v:'')).join(',')||'-';
const legalSig=l=>(l||[]).slice().sort().join(',');
function keyOf96(o){
  T.checkObs(o);
  const w=o.weather||'-',t=o.terrain||'-';
  if(o.turn===1)return ['T1',T.forme(o.rivalActive),w,t,legalSig(o.legal)].join('|');
  return ['T2',M.baseName(o.rivalLead||''),T.forme(o.ownActive),T.forme(o.rivalActive),w,t,o.trickRoom?'TR':'-',
    band(o.ownHP)+band(o.rivalHP),(o.ownStatus||'-')+'/'+(o.rivalStatus||'-'),boostSig(o.ownBoosts)+'/'+boostSig(o.rivalBoosts),
    (o.ownEncored?'E':'-')+(o.rivalEncored?'E':'-'),'own:'+hazSig96(o.ownHazards),'riv:'+hazSig96(o.rivalHazards),legalSig(o.legal)].join('|');
}
// Same contract as pr94 planScript, with a pluggable key.
function planScript96(plan,rec,keyFn=keyOf96){
  let lead=null;Object.assign(rec,{keys:{},used:{},forcedSwitch:{},obs:{}});
  return (req,bot,info)=>{
    if(info.turn>2)return null;
    if(req.forceSwitch){rec.forcedSwitch[info.turn]=true;return null;}
    if(info.turn===1&&!lead)lead=T.forme(bot.foeActive);
    const obs=T.obsFrom(req,bot,info.turn,lead),key=keyFn(obs),legal=M.legalActions(req);
    rec.keys[info.turn]=key;rec.obs[info.turn]={rivalHazards:obs.rivalHazards,ownHazards:obs.ownHazards};
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

// ---------- P0-2: immune-aware rival ----------
const ABILITY_IMMUNE={levitate:'Ground',flashfire:'Fire',voltabsorb:'Electric',waterabsorb:'Water',lightningrod:'Electric',stormdrain:'Water',
  sapsipper:'Grass',motordrive:'Electric',dryskin:'Water',eartheater:'Ground',wellbakedbody:'Fire'};
const BREAKER=new Set(['moldbreaker','teravolt','turboblaze']);
const ATE={pixilate:'Fairy',aerilate:'Flying',refrigerate:'Ice',galvanize:'Electric',normalize:'Normal'};
// Indices of the rival's enabled moves that hit a PUBLIC immunity of our
// visible forme. `bot` is the rival's Bot: foeActive / foeAbility / foeItem
// are what the rival saw in the public log.
function publicImmuneMoves(dex,req,bot){
  const out=[],act=req.active?.[0],cur=req.side.pokemon.find(p=>p.active);
  const tgt=dex.species.get(T.forme(bot.foeActive));if(!act||!cur||!tgt.exists)return out;
  const ownAb=id(cur.ability||cur.baseAbility);
  const known=id(bot.foeAbility),abs=known?[known]:Object.values(tgt.abilities||{}).map(id);
  const abImm=abs.length===1&&!BREAKER.has(ownAb)?ABILITY_IMMUNE[abs[0]]:null;
  const balloon=id(bot.foeItem)==='airballoon'&&!BREAKER.has(ownAb);
  act.moves.forEach((m,i)=>{
    if(m.disabled)return;
    const mv=dex.moves.get(m.id||m.move);if(!mv.exists||!['normal','any','adjacentFoe','allAdjacentFoes','allAdjacent','randomNormal'].includes(mv.target))return;
    if(mv.category==='Status'&&mv.ignoreImmunity!==false)return;// status moves only when immunity-checked (Thunder Wave)
    let type=mv.type;if(type==='Normal'&&ATE[ownAb])type=ATE[ownAb];
    if(['weatherball','terrainpulse','judgment','multiattack','technoblast','revelationdance','naturalgift','hiddenpower'].includes(mv.id))return;// type depends on state: never masked
    const ign=mv.ignoreImmunity===true||(mv.ignoreImmunity&&mv.ignoreImmunity[type]);
    const scrappy=['scrappy','mindseye'].includes(ownAb)&&['Normal','Fighting'].includes(type);
    const typeImm=!ign&&!scrappy&&!dex.getImmunity(type,tgt.types);
    const abilityImm=mv.category!=='Status'&&abImm===type&&mv.id!=='thousandarrows';
    const balloonImm=balloon&&type==='Ground'&&mv.id!=='thousandarrows';
    if(typeImm||abilityImm||balloonImm)out.push({i,move:mv.name,type,why:typeImm?'type':abilityImm?'ability '+abs[0]:'airballoon'});
  });
  return out;
}
// Wrap a rival script (or null = base AI) so that a public-immunity move is
// re-decided. rec.masked collects {turn, move, why, replacement}.
function immuneAware(script,dex,rec){
  const {Bot}=require('./lab');
  const base=(bot,req)=>Bot.prototype.decide.call(bot,req);
  const decideWith=(req,bot,info)=>(script&&script(req,bot,info))||base(bot,req);
  return (req,bot,info)=>{
    const imm=publicImmuneMoves(dex,req,bot);
    if(!imm.length)return script?script(req,bot,info):null;
    const sw=bot.switches;
    const orig=decideWith(req,bot,info),m=/^move (\d+)/.exec(orig||'');
    const hit=m&&imm.find(x=>x.i===Number(m[1])-1);
    if(!hit)return orig;
    bot.switches=sw;
    const req2=structuredClone(req);for(const x of imm)req2.active[0].moves[x.i].disabled=true;
    const left=req2.active[0].moves.some(x=>!x.disabled&&x.pp>0);
    const canSwitch=!req.active[0].trapped&&!req.active[0].maybeTrapped&&req.side.pokemon.some(p=>!p.active&&!/ fnt$/.test(p.condition));
    if(!left&&!canSwitch){(rec.masked||(rec.masked=[])).push({turn:info.turn,move:hit.move,why:hit.why,replacement:'none (no alternative)'});return orig;}
    let c2=left?decideWith(req2,bot,info):null;
    if(!c2||c2==='default'){const b=req.side.pokemon.map((p,i)=>({p,i})).filter(x=>!x.p.active&&!/ fnt$/.test(x.p.condition));c2='switch '+(b[0].i+1);}
    const m2=/^move (\d+)/.exec(c2);
    (rec.masked||(rec.masked=[])).push({turn:info.turn,move:hit.move,why:hit.why,replacement:m2?'move:'+req.active[0].moves[Number(m2[1])-1].move:c2.startsWith('switch')?'switch':c2});
    return c2;
  };
}


// Rival attacks into a PUBLIC immunity of the forme that was OUR active when
// the turn started (the rival chose against it). pr94 publicImmune used the
// target at hit time, so a rival move into a mon WE switched in that turn
// (our switch is not known when it chooses) was counted as irrational.
function publicImmune96(log,foeSide,dex,{maxTurn=99}={}){
  const me=foeSide==='p1'?'p2':'p1',L=log.split('\n'),out=[];let turn=0,active='',start='';
  for(let i=0;i<L.length;i++){const a=L[i].split('|');
    if(a[1]==='turn'){turn=Number(a[2]);if(turn>maxTurn)break;start=active;continue;}
    if(['switch','drag','replace','detailschange'].includes(a[1])&&a[2]?.startsWith(me+'a:')){
      const f=T.forme(a[3]);if(a[1]==='detailschange'&&M.baseName(f)===M.baseName(start))start=f;active=f;}
    if(turn<1||a[1]!=='move'||!a[2]?.startsWith(foeSide+'a:')||!a[4]?.startsWith(me+'a:'))continue;
    if(active!==start)continue;// target switched in this turn: not a choice against it
    const mv=dex.moves.get(a[3]);if(mv.category==='Status')continue;
    let imm=false;for(let k=i+1;k<L.length&&!/^\|(move|turn|upkeep)(\||$)/.test(L[k]);k++)if(L[k].startsWith('|-immune|'+me+'a:'))imm=true;
    if(!imm)continue;
    const sp=dex.species.get(active),abs=Object.values(sp.abilities||{}).map(id);
    const why=!dex.getImmunity(mv.type,sp.types)?'type':abs.length===1&&ABILITY_IMMUNE[abs[0]]===mv.type?'only ability '+abs[0]:null;
    if(why)out.push({turn,move:mv.name,target:active,why});
  }
  return out;
}
// ---------- worker ----------
function workerMain(){
  const {battle}=require('./encore-lead-audit');
  const {OWN_AI,rivalScript}=require('./public-six-general');
  const sim=load(),dex=sim.Dex.mod('champions');
  const T13=/^\|(turn|move|switch|drag|faint|cant|-mega|-weather|-boost|-unboost|-damage|-heal|-enditem|-activate|-start|-status|-crit|-supereffective|-immune|-sidestart|win)\|/;
  process.on('message',async({own,teams,jobs})=>{
    const out=[];
    for(const j of jobs){
      const rec={},rrec={},t0=Date.now();
      const rs0=j.branch==='utility'?rivalScript('utility',dex,[]):M.rivalScriptV2(j.branch,dex,[]);
      const rs=j.immuneAware===false?rs0:immuneAware(rs0,dex,rrec);
      const keyFn=j.keyVer==='pr94'?T.keyOf:keyOf96;
      const ownScript=j.plan?.table92?require('./pr92-t1t2').planScript({table:j.plan.table92},rec):planScript96(j.plan||{},rec,keyFn);
      const g=await battle(sim,structuredClone(own),structuredClone(teams[j.team]),j.seed,
        {ownThree:j.own,foeThree:j.foe,reverse:j.reverse,script:rs,ownOptions:{...OWN_AI,script:ownScript}});
      if(g.errors)throw Error('choice errors '+JSON.stringify(j));
      const util=M.utilityAudit(g.log,g.foeSide,dex),TT=M.splitTurns(g.log);
      const lead=(g.log.match(new RegExp('\\|switch\\|'+g.foeSide+'a: [^|]*\\|([^|,]*)'))||[])[1]||null;
      out.push({id:j.id,won:g.won?1:0,turns:g.turns,ms:Date.now()-t0,keys:rec.keys,used:rec.used,forcedSwitch:rec.forcedSwitch,obs:rec.obs,side:g.ownSide,
        rivalLead:lead,masked:rrec.masked||[],
        irrational:util.filter(u=>u.rational==='irrational').map(u=>u.turn+':'+u.move),
        immune:publicImmune96(g.log,g.foeSide,dex),immune94:T.publicImmune(g.log,g.foeSide,dex,{maxTurn:2}),
        lines:j.keepLines?[1,2,3].flatMap(t=>(TT[t]||[]).filter(x=>T13.test(x)).map(x=>'T'+t+' '+x)).slice(0,40):null});
    }
    process.send(out);
  });
}
async function runGames96(own,teams,jobs,{workers=4}={}){
  if(!jobs.length)return [];
  jobs.forEach((j,i)=>{j.id=i;});
  const W=Math.max(1,Math.min(workers,jobs.length)),chunks=[...Array(W)].map(()=>[]);
  jobs.forEach((j,i)=>chunks[i%W].push(j));
  const parts=await Promise.all(chunks.map(c=>new Promise((res,rej)=>{
    const w=fork(__filename,['--pr96-worker'],{env:process.env});
    w.on('message',m=>{res(m);w.kill();});w.on('error',rej);
    w.on('exit',code=>{if(code)rej(Error('worker exit '+code));});
    w.send({own,teams,jobs:c});
  })));
  const byId=[];for(const r of parts.flat())byId[r.id]=r;
  return byId;
}
// pr86 rational (utility moves) + rational94 (public immune hit) per game.
const irrationalGame=(j,r)=>j.branch==='utility'||r.irrational.some(x=>Number(x.split(':')[0])<=2)||(r.immune||[]).some(x=>x.turn<=2);
// Paired cell values: ALL games of each candidate on the SAME jobs.
// jobs carry k (candidate) and ci (cell); pairKey identifies the shared job.
function cellValues96(nCand,cells,jobs,res,{intersection=false}={}){
  const pk=j=>[j.ci,j.branch,String(j.seed),j.reverse].join('|');
  const drop=new Set();
  if(intersection)jobs.forEach((j,i)=>{if(irrationalGame(j,res[i]))drop.add(pk(j));});
  const vals=[...Array(nCand)].map(()=>cells.map(()=>[])),audit=[...Array(nCand)].map(()=>cells.map(()=>({n:0,masked:0,immune:0,irr:0,dropped:0})));
  jobs.forEach((j,i)=>{const a=audit[j.k][j.ci],r=res[i];
    a.masked+=r.masked.filter(x=>x.turn<=2).length?1:0;a.immune+=(r.immune||[]).some(x=>x.turn<=2)?1:0;a.irr+=irrationalGame(j,r)?1:0;
    if(drop.has(pk(j))){a.dropped++;return;}a.n++;vals[j.k][j.ci].push(r.won);});
  // pairing check: every candidate has the same number of games per cell
  cells.forEach((c,ci)=>{const ns=new Set(vals.map(v=>v[ci].length));if(ns.size>1)throw Error('cellValues96: unpaired cell '+ci);});
  return {values:vals.map(v=>v.map(x=>x.length?mean(x):null)),audit};
}

// ---------- selector: pr94 cover pipeline, immune-aware rival, paired values ----------
// Same scenarios / cells / candidates / decision rule as pr94 coverPreview94
// (decision 'floor', frozen in PR #95: no new variant is chosen here). Only
// the rival behaviour and the cell values change.
async function coverPreview96({sim,own,publicSix,seedBase,workers=4,budgetSeconds=300,opts={}}){
  const P=require('./pr92-rational-cover-preview'),C=require('./pr94-cover-preview'),GP=require('./pr88-guarded-preview');
  const {picks,label}=require('./a-preview-matrix-audit');
  P.assertPublicSix(publicSix);
  const t0=Date.now(),dex=sim.Dex.mod('champions'),o={...C.COVER94,decision:'floor',...opts},ownSpecies=own.map(p=>p.species);
  const leg=GP.legacyPick(dex,own,publicSix);
  const O=picks(own),legLabel=label(O.find(p=>p[0]===leg[0]&&p.slice().sort().join()===leg.slice().sort().join()));
  const {teams,coverage}=C.scenarioTeamsPR94(sim,publicSix,o);
  const alt=o.altRatio?GP.altCategoryScenarios(sim,publicSix,teams[0],o.altRatio):[];
  for(const a of alt)teams.push(a.team);
  const cells=[];
  teams.forEach((t,si)=>{for(const c of P.rivalCellsRational(dex,t,ownSpecies,o))cells.push({si,...c});});
  const sj=[];
  O.forEach((pk,k)=>cells.forEach((c,ci)=>sj.push({k,ci,team:c.si,own:pk,foe:c.foe,branch:'ai',seed:T.jobSeed(seedBase,ci,0,0),reverse:ci%2===1,plan:{}})));
  const sr=await runGames96(own,teams,sj,{workers});
  const sv=cellValues96(O.length,cells,sj,sr).values;
  const screen=O.map(label).map((pick,k)=>({pick,cvar:+P.cvar(sv[k],o.cvarQ).toFixed(3),mean:+mean(sv[k]).toFixed(3)}))
    .sort((a,b)=>b.cvar-a.cvar||b.mean-a.mean||a.pick.localeCompare(b.pick));
  const cand=[legLabel,...screen.map(s=>s.pick).filter(p=>p!==legLabel).slice(0,o.k)];
  const jobs=[];
  cand.forEach((pk,k)=>cells.forEach((c,ci)=>o.branches.forEach((branch,bi)=>{for(let s=0;s<o.seeds;s++)
    jobs.push({k,ci,team:c.si,own:pk.split(/[>/]/),foe:c.foe,branch,seed:T.jobSeed(seedBase+500000,ci,bi,s),reverse:(s+ci)%2===1,plan:{}});})));
  const gr=await runGames96(own,teams,jobs,{workers});
  const {values:cv,audit}=cellValues96(cand.length,cells,jobs,gr);
  const inter=cellValues96(cand.length,cells,jobs,gr,{intersection:true}).values;
  const scores=cand.map((pick,k)=>{
    const r=cv[k],w=r.map((v,ci)=>({v,ci})).sort((a,b)=>a.v-b.v);
    const ri=inter[k].filter(v=>v!=null);
    return {pick,legacy:k===0,cvar:+P.cvar(r,o.cvarQ).toFixed(3),mean:+mean(r).toFixed(3),worst:+w[0].v.toFixed(3),zeroCells:r.filter(v=>v===0).length,
      sensitivityIntersection:{mean:ri.length?+mean(ri).toFixed(3):null,cellsLeft:ri.length},
      masked:audit[k].reduce((s,a)=>s+a.masked,0),residualImmune:audit[k].reduce((s,a)=>s+a.immune,0),irrational:audit[k].reduce((s,a)=>s+a.irr,0),games:audit[k].reduce((s,a)=>s+a.n,0),
      worstCells:w.slice(0,3).map(x=>({v:+x.v.toFixed(3),scenario:cells[x.ci].si,rival:cells[x.ci].foe.join('/'),src:cells[x.ci].src,audit:audit[k][x.ci]}))};
  });
  const seconds=+((Date.now()-t0)/1000).toFixed(1);
  const meta={legacy:legLabel,seconds,budgetSeconds,opts:{decision:o.decision,megaAbility:o.megaAbility,immuneAware:true,paired:true},
    games:{screen:sj.length,guard:jobs.length,guardMasked:gr.filter(r=>r.masked.some(x=>x.turn<=2)).length,guardResidualImmune:gr.filter(r=>(r.immune||[]).some(x=>x.turn<=2)).length},
    scenarios:teams.length,coverage,cells:cells.length,screenTop:screen.slice(0,8),scores};
  if(seconds>budgetSeconds)return {status:'abstain',pick:leg,label:legLabel,reason:'over budget '+seconds+'s > '+budgetSeconds+'s: legacy pick, NOT a safety claim',...meta};
  const d=C.decidePR94(scores,o);
  return {status:d.pick===legLabel?'legacy':'cover96',pick:d.pick.split(/[>/]/),label:d.pick,reason:d.reason,eligible:d.eligible,...meta,_teams:teams,_cells:cells};
}
// ---------- T1/T2 table (pr94 buildT1T2 with keyOf96 and the immune-aware rival) ----------
async function buildT1T2_96({sim,own,pick,teams,cells,seedBase,workers=4,opts={},keyVer='pr96'}){
  const o={...T.T94,...opts},dex=sim.Dex.mod('champions'),t0=Date.now();
  const L=T.ownLabels(dex,own,pick),jobs=[];
  const jobBase=(c,ci,branch,bi,s)=>({team:c.si,own:pick,foe:c.foe,branch,seed:T.jobSeed(seedBase,ci,bi,s),reverse:(s+ci)%2===1,ci,keyVer});
  cells.forEach((c,ci)=>o.t1Branches.forEach((br,bi)=>{for(let s=0;s<o.t1Seeds;s++){
    jobs.push({...jobBase(c,ci,br,bi,s),label:'ai',plan:{}});
    for(const lab of L.lead)jobs.push({...jobBase(c,ci,br,bi,s),label:lab,plan:{force:{turn:1,label:lab}}});}}));
  const r1=await runGames96(own,teams,jobs,{workers});
  const t1=T.tableFrom(jobs.map((j,i)=>({j,r:r1[i]})),1,o);
  const j2=[];
  cells.forEach((c,ci)=>o.t2Branches.forEach((br,bi)=>{for(let s=0;s<o.t2Seeds;s++){
    j2.push({...jobBase(c,ci,br,bi+10,s),label:'ai',plan:{table:t1}});
    for(const lab of L.all)j2.push({...jobBase(c,ci,br,bi+10,s),label:lab,plan:{table:t1,force:{turn:2,label:lab}}});}}));
  const r2=await runGames96(own,teams,j2,{workers});
  const t2=T.tableFrom(j2.map((j,i)=>({j,r:r2[i]})),2,o);
  const table={...t1,...t2};
  const t2keys=Object.keys(t2),hazKeys=t2keys.filter(k=>!/\|riv:-\|/.test(k)&&/\|riv:/.test(k));
  return {pick:pick.join('>'),table,games:jobs.length+j2.length,seconds:+((Date.now()-t0)/1000).toFixed(1),params:o,keyVer,
    rules:Object.values(table).filter(e=>e.action.startsWith('rule:')).length,keys:Object.keys(table).length,t2Keys:t2keys.length,t2KeysWithRivalHazard:hazKeys.length,
    t2RulesWithRivalHazard:hazKeys.filter(k=>t2[k].action.startsWith('rule:')).length};
}
if(process.argv.includes('--pr96-worker'))workerMain();
module.exports={publicImmune96,coverPreview96,buildT1T2_96,keyOf96,hazSig96,planScript96,publicImmuneMoves,immuneAware,runGames96,cellValues96,irrationalGame,ABILITY_IMMUNE};
