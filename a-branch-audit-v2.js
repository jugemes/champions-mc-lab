#!/usr/bin/env node
'use strict';
// PR #74 P0-B (ChatGPT review #5715279320 of PR #73): a-branch-audit's
// "plausible" tag was not checked. classify() passed every Status move except
// Swords Dance, `ai` and `ratSwitch` were plausible unconditionally, and an
// unusable scripted move fell back to the base AI but was logged as `ai`.
// This audit replays the SAME games as a-branch-audit.js (same scripted
// choices, same seeds, the base AI choice is computed once exactly as before)
// and records two labels per rival T1/T2 action:
//   old  the PR #73 label, recomputed by the PR #73 rules (reproduces bits)
//   new  decision-time label from the RIVAL's public knowledge, for the action
//        it ACTUALLY chose (ai and fallbacks included), then checked against
//        the executed protocol line of that turn:
//        move    PR #73 damaging rules; Status: Encore that the PR #73 'speed'
//                guard (rival's public view) says fails -> blunder, that only
//                'speedSafe' rejects -> weak; heal at full HP,
//                Stealth Rock already up, a boost move at +6 -> blunder;
//                Swords Dance rules as before
//        switch  riskOf (public threat of our active incl. seen moves, Rocks)
//                on the switch-in: >=1 blunder, worse than staying weak
//        log     executed move/switch target differs from the choice (e.g. our
//                Encore overrides it) -> unknown; pre-empted (fainted, Emergency
//                Exit before acting) keeps the decision-time label;
//                a publicly plausible move that ends in -fail/-immune -> unknown
//                (hindsight; a failed Sucker Punch stays a legitimate guess)
//        forced  Encore-locked with no switch: not a rival decision, unknown
// worstRational counts only games where both T1 and T2 are plausible
// (unknown excluded), and is also shown with unknown counted as plausible.
// Heuristic AI vs heuristic AI, NOT a ladder win rate.
//   SHOWDOWN_DIR=... OWN=Tyranitar>Metagross/Primarina SEEDN=2 OUT=... node a-branch-audit-v2.js
const fs=require('node:fs');
const path=require('node:path');
const {load,Bot}=require('./lab');
const {reportedLive}=require('./reported-live-roster-20261027');
const {battle,nameOf}=require('./encore-lead-audit');
const {ratSwitch,riskOf}=require('./encore-turn-p0-audit');
const {estimateDamage,incomingRisk}=require('./damage');
const {classify}=require('./a-branch-audit');
const {hypotheses,SEEDS,OWN_AI}=require('./a-preview-matrix-audit');
const BR=['ai','m1','m2','m3','m4','ratSwitch'];

function hpRatio(p){const [h,m]=String(p.condition).split(' ')[0].split('/').map(Number);return m>0?h/m:0;}
function classifyMove(dex,req,bot,moveName){
  const base=classify(dex,req,bot,moveName),mv=dex.moves.get(moveName);
  if(mv.category!=='Status'||base!=='plausible')return base;
  const cur=req.side.pokemon.find(p=>p.active);
  if(mv.id==='encore'){
    // From the rival's public view: PR #73 'speed' says it surely fails -> blunder;
    // only the conservative 'speedSafe' (PR #74 P0-A) objects -> weak.
    const side=req.side.pokemon,my=bot.getSet(cur),g=bot.encoreGuard,v={};
    for(const m of ['speed','speedSafe']){bot.encoreGuard=m;v[m]=bot.encoreWouldFail(my,side);}
    bot.encoreGuard=g;
    if(v.speed)return 'blunder';
    if(v.speedSafe)return 'weak';
  }
  if(mv.flags.heal&&hpRatio(cur)>=1)return 'blunder';
  if(mv.id==='stealthrock'&&bot.hazards.stealthrock)return 'blunder';
  const ups=Object.keys(mv.boosts||{}).filter(s=>mv.boosts[s]>0);
  if(mv.target==='self'&&ups.length&&ups.every(s=>(bot.boosts[s]||0)>=6))return 'blunder';
  return 'plausible';
}
function classifySwitch(dex,req,bot,slot){
  const p=req.side.pokemon[slot],cur=req.side.pokemon.find(x=>x.active);
  const risk=riskOf(dex,bot,p),stay=riskOf(dex,bot,cur);
  return {cls:risk>=1?'blunder':risk>stay?'weak':'plausible',risk:+risk.toFixed(2),stay:+stay.toFixed(2)};
}
// The choice string the rival actually sends, labelled from its knowledge.
function labelChoice(dex,req,bot,choice){
  const m=/^move (\d)/.exec(choice||''),s=/^switch (\d)/.exec(choice||'');
  if(m){const name=req.active[0].moves[Number(m[1])-1].move;return {kind:'move',name,cls:classifyMove(dex,req,bot,name)};}
  if(s){const i=Number(s[1])-1;return {kind:'switch',name:nameOf(req.side.pokemon[i].details),...classifySwitch(dex,req,bot,i)};}
  return {kind:'other',name:String(choice),cls:'unknown'};
}
function script(plan,dex,log){
  return (req,bot,info)=>{
    const act=req.active[0],mega=act.canMegaEvo?' mega':'',t=info.turn;
    const baseAI=()=>Bot.prototype.decide.call(bot,req);
    const rec=(old,choice,src)=>{if(t<=2){log[t]={old,src,...labelChoice(dex,req,bot,choice)};}return choice;};
    if(info.lockReason==='encore'){
      if(!info.canSwitch){if(t<=2)log[t]={old:undefined,src:'forced',kind:'forced',name:'',cls:'unknown'};return null;}
      const c=ratSwitch(req,bot,dex,{encore:true});
      if(!c){if(t<=2)log[t]={old:undefined,src:'forced',kind:'forced',name:'',cls:'unknown'};return null;}
      return rec(undefined,c,'encoreSwitch');
    }
    const p=t===1?plan.t1:t===2?plan.t2:'ai';
    if(t>2)return null;
    if(p==='ai')return rec('ai',baseAI(),'ai');
    if(p==='ratSwitch'){const c=info.canSwitch?ratSwitch(req,bot,dex,{encore:false}):null;
      return c?rec('plausible',c,'ratSwitch'):rec('ai',baseAI(),'fallback');}
    const k=Number(p.slice(1))-1,mv=act.moves[k];
    if(!mv||mv.disabled||mv.pp<=0)return rec('ai',baseAI(),'fallback');
    const old=classify(dex,req,bot,mv.move);
    rec(old,'move '+(k+1),'scripted');log['n'+t]=mv.move;
    return 'move '+(k+1)+mega;
  };
}
// Executed rival action of turn t from the engine log (ex-post verification only).
// PR #75 version, kept to reproduce the saved PR #75 labels (opts.pr75).
// PR #76 P0-C fixes two boundaries:
//  - no |turn|t line: indexOf -1 -> slice(0) scanned from the start of the
//    game (a T1 move read as the T2 action). Now {kind:'noturn'} -> unknown.
//  - any |faint| stopped the scan, so when OUR mon fainted mid-turn (recoil,
//    Rocky Helmet, Life Orb) before the rival acted, the rival's executed move
//    was missed and the decision label stood. Now only the rival's own faint
//    or |upkeep| (end-of-turn replacements follow) ends the scan.
function executed(lines,t,side,{pr75=false}={}){
  const i=lines.indexOf('|turn|'+t),j=lines.indexOf('|turn|'+(t+1));
  if(i<0&&!pr75)return {kind:'noturn'};
  const seg=lines.slice(i+1,j>0?j:undefined);
  for(let k=0;k<seg.length;k++){
    const l=seg[k];
    if(pr75?l.startsWith('|faint|'):l.startsWith('|faint|'+side+'a:')||l==='|upkeep')break;// later switch lines are forced replacements
    if(l.startsWith('|switch|'+side+'a:'))return {kind:'switch',name:nameOf(l.split('|')[3])};
    if(l.startsWith('|cant|'+side+'a:'))return {kind:'cant',name:l.split('|')[3]};
    if(l.startsWith('|move|'+side+'a:')){
      const a=l.split('|'),rest=[];
      for(let q=k+1;q<seg.length&&!/^\|(move|switch|cant|upkeep)\|/.test(seg[q])&&seg[q]!=='|';q++)rest.push(seg[q]);
      const failed=rest.some(x=>x.startsWith('|-fail|'+side+'a:')||/^\|-immune\|/.test(x))||(rest.some(x=>/^\|-fail\|/.test(x))&&a[4]==='');
      return {kind:'move',name:a[3],failed};
    }
  }
  return {kind:'none'};
}
function finalLabel(rec,ex){
  if(!rec)return {cls:'none'};
  if(rec.kind==='forced'||rec.kind==='other')return {cls:'unknown',why:rec.kind};
  if(ex.kind==='noturn')return {cls:'unknown',why:'turn absent from log'};
  if(ex.kind==='cant')return {cls:rec.cls,why:'cant'};
  // Pre-empted: fainted / forced out (Emergency Exit) before acting. Nothing
  // executed to check, so the decision-time label stands.
  if(ex.kind==='none')return {cls:rec.cls,why:'preempted (no executed line)'};
  if(rec.kind==='move'&&ex.kind==='switch')return {cls:rec.cls,why:'preempted (forced switch-out before moving)'};
  if(rec.kind!==ex.kind||nameOf(rec.name)!==nameOf(ex.name)&&!(rec.kind==='switch'&&ex.name.startsWith(rec.name.split('-')[0])))
    return {cls:'unknown',why:'executed '+ex.kind+' '+ex.name+' != chosen '+rec.name};
  // Ex-post only: a move that the rival's public view rated plausible but that
  // failed (e.g. Encore into a switch) is not proof of a blunder -> unknown.
  if(rec.kind==='move'&&ex.failed&&rec.name!=='Sucker Punch')return rec.cls==='plausible'?{cls:'unknown',why:'executed and failed'}:{cls:rec.cls,why:'executed and failed'};
  return {cls:rec.cls};
}
const parse=l=>{const [lead,rest]=l.split('>');return [lead,...rest.split('/')];};
async function run({own:ownPicks,hyps,foePicks,seedIdx,ownAI,pr75=false}){
  const sim=load(),dex=sim.Dex.mod('champions'),H=hypotheses(),own=reportedLive(),rows=[];
  const S=SEEDS();
  for(const hyp of hyps)for(const op of ownPicks)for(const fp of foePicks[hyp])for(const t1 of BR)for(const t2 of BR)for(const si of seedIdx)for(const reverse of [false,true]){
    const log={};
    const r=await battle(sim,structuredClone(own),structuredClone(H[hyp]),S[si],{ownThree:parse(op),foeThree:parse(fp),reverse,
      script:script({t1,t2},dex,log),ownOptions:OWN_AI[ownAI]||ownAI});
    if(r.errors)throw Error('choice errors '+[hyp,op,fp,t1,t2,si,reverse]);
    const lines=r.log.split('\n'),lab={};
    for(const t of [1,2])lab[t]={...finalLabel(log[t],executed(lines,t,r.foeSide,{pr75})),src:log[t]?.src,act:log[t]?.name,old:log[t]?.old};
    // PR #76 P0-C: how often the corrected executed() differs on the same game.
    const diff={};
    for(const t of [1,2]){const a=executed(lines,t,r.foeSide,{pr75:true}),b=executed(lines,t,r.foeSide);
      if(JSON.stringify(a)!==JSON.stringify(b))diff[t]={pr75:a,pr76:b,rec:log[t]?.kind||null};}
    const oldOk=x=>x===undefined||x==='ai'||x==='plausible';
    rows.push({hyp,own:op,foe:fp,t1,t2,si,reverse,won:r.won,
      oldRational:oldOk(log[1]?.old)&&oldOk(log[2]?.old),
      l1:lab[1],l2:lab[2],...(Object.keys(diff).length?{executedDiff:diff}:{})});
  }
  return rows;
}
// Worst case over branches per seed/side, for one labelling.
function worst(rows,ok){
  const g={};let used=0;
  for(const r of rows){if(!ok(r))continue;used++;const k=r.si+(r.reverse?'r':'');if(!(k in g))g[k]=true;if(!r.won)g[k]=false;}
  return {won:Object.values(g).filter(Boolean).length,games:Object.keys(g).length,branchGames:used};
}
function summarise(rows){
  const isOk=(l,unknownOk)=>l.cls==='plausible'||l.cls==='none'||(unknownOk&&l.cls==='unknown');
  const by={};
  for(const r of rows)(by[[r.hyp,r.own,r.foe].join('|')]||(by[[r.hyp,r.own,r.foe].join('|')]=[])).push(r);
  const pairs=Object.entries(by).map(([k,rs])=>{
    const count={};for(const r of rs)for(const l of [r.l1,r.l2])count[l.cls]=(count[l.cls]||0)+1;
    return {pair:k,branchGames:rs.length,
      old:worst(rs,r=>r.oldRational),
      newStrict:worst(rs,r=>isOk(r.l1,false)&&isOk(r.l2,false)),
      newUnknownAsPlausible:worst(rs,r=>isOk(r.l1,true)&&isOk(r.l2,true)),
      labels:count,
      oldPlausibleNowExcluded:rs.filter(r=>r.oldRational&&!(isOk(r.l1,false)&&isOk(r.l2,false))).length,
      oldExcludedNowPlausible:rs.filter(r=>!r.oldRational&&isOk(r.l1,false)&&isOk(r.l2,false)).length};
  });
  const tot=f=>{const t={won:0,games:0};for(const p of pairs){t.won+=p[f].won;t.games+=p[f].games;}return t.won+'/'+t.games;};
  const why={};for(const r of rows)for(const l of [r.l1,r.l2])if(l.why){const w=l.why.replace(/^(executed \S+) .* != chosen .*/,'$1 != chosen');why[w]=(why[w]||0)+1;}
  const reasons={};for(const r of rows)for(const l of [r.l1,r.l2])if(l.cls==='blunder'||l.cls==='weak'){const k=l.src+':'+l.act+':'+l.cls+(l.why?'('+l.why+')':'');reasons[k]=(reasons[k]||0)+1;}
  return {totals:{old:tot('old'),newStrict:tot('newStrict'),newUnknownAsPlausible:tot('newUnknownAsPlausible')},pairs,why,
    topExcluded:Object.entries(reasons).sort((a,b)=>b[1]-a[1]).slice(0,25)};
}
// PR #76 P0-C: rows whose PR #75 and PR #76 executed() disagree, by kind.
function executedDiffSummary(rows){
  const out={rows:rows.length,rowsWithDiff:0,byKind:{},examples:[]};
  for(const r of rows){if(!r.executedDiff)continue;out.rowsWithDiff++;
    for(const [t,d] of Object.entries(r.executedDiff)){const k='T'+t+' '+d.pr75.kind+'->'+d.pr76.kind+(d.pr76.name?'':'');out.byKind[k]=(out.byKind[k]||0)+1;
      if(out.examples.length<8)out.examples.push({hyp:r.hyp,own:r.own,foe:r.foe,t1:r.t1,t2:r.t2,si:r.si,reverse:r.reverse,t:Number(t),...d});}}
  return out;
}
async function main(){
  const H=hypotheses(),saved=JSON.parse(fs.readFileSync(path.join(__dirname,'reports','data','a-branch-audit-20261030.json'),'utf8'));
  const own=(process.env.OWN||'Tyranitar>Metagross/Primarina').split(',');
  const hyps=(process.env.HYP||'H0').split(',');
  const seedIdx=[...Array(Number(process.env.SEEDN||2)).keys()];
  const ownAI=process.env.OWN_AI||'new';
  const pr75=Boolean(process.env.PR75);
  const rows=await run({own,hyps,foePicks:saved.candidates.foe,seedIdx,ownAI:ownAI==='speedSafe'?{...OWN_AI.new,encoreGuard:'speedSafe'}:ownAI,pr75});
  // Reproduction check against the PR #73 saved bits (same seeds/sides only).
  let match=0,cmp=0;
  if(ownAI==='new')for(const r of rows){const b=saved.bits[[r.hyp,r.own,r.foe].join('|')];if(!b)continue;
    const i=((BR.indexOf(r.t1)*BR.length+BR.indexOf(r.t2))*6+r.si)*2+(r.reverse?1:0);
    cmp++;if(b[i]===(r.oldRational?(r.won?'1':'0'):(r.won?'w':'l')))match++;}
  const res={showdown:'3a766f2cfb5e51c1e428cfe87d0dba91a8f01640',format:'gen9championsbssregmc',ownAI,own,hyps,
    seeds:seedIdx.map(i=>SEEDS()[i].join('-')),branches:BR,reproducesPR73Bits:ownAI==='new'?match+'/'+cmp:'n/a (different own AI)',
    note:'worst = seed/side games won under EVERY branch kept by the labelling. Heuristic AI vs heuristic AI, NOT a ladder win rate.',
    executedVersion:pr75?'PR #75 (reproduction)':'PR #76 (noturn + rival-only faint/upkeep boundary)',executedDiff:executedDiffSummary(rows),
    ...summarise(rows)};
  if(process.env.FULL_ROWS)res.rows=rows;
  if(process.env.OUT){fs.mkdirSync(path.dirname(process.env.OUT),{recursive:true});fs.writeFileSync(process.env.OUT,JSON.stringify(res,null,1));}
  console.log('reproduces PR73 bits',res.reproducesPR73Bits,'totals',res.totals,'executedDiff',JSON.stringify({rows:res.executedDiff.rows,rowsWithDiff:res.executedDiff.rowsWithDiff,byKind:res.executedDiff.byKind}));
  for(const p of res.pairs)console.log(p.pair.padEnd(70),'old',p.old.won+'/'+p.old.games,'new',p.newStrict.won+'/'+p.newStrict.games,'(unk ok',p.newUnknownAsPlausible.won+'/'+p.newUnknownAsPlausible.games+')',JSON.stringify(p.labels),'oldOK->excl',p.oldPlausibleNowExcluded,'excl->ok',p.oldExcludedNowPlausible);
  console.log(res.why);console.log(res.topExcluded);
}
if(require.main===module)main().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
module.exports={script,executed,executedDiffSummary,finalLabel,classifyMove,classifySwitch,summarise,worst,run};
