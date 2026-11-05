#!/usr/bin/env node
'use strict';
// PR #90 request: re-run the guarded selector with the V2 fixes (same-seed
// sides, eligible filter, hard deadline) on the PR #88 DEV and FINAL sixes and
// compare the pick with the saved pr88 guarded pick. Selection only; the
// search seeds are the ones pr88-selection-eval used (SEL_SEARCH_SEED_BASE +
// ui*1000, ui = index within the phase), so only the guard step differs.
// FINAL sixes are NOT used to tune anything: if a FINAL pick changes, that is
// reported, and any claim about it needs a new predeclared unseen six.
//   PHASE=DEV|FINAL  BUDGET=seconds (hard)  WORKERS=n
// Selectors see only the six public species strings. NOT a ladder win rate.
const fs=require('node:fs');
const {load}=require('./lab');
const H=require('./holdout-20261031-pr88');
const V2=require('./pr90-guarded-preview-v2');
const {sixesFor}=require('./pr88-selection-eval');
async function main(){
  const sim=load(),dex=sim.Dex.mod('champions');
  const own=require('./reported-live-roster-20261027').reportedLive();
  const PHASE=process.env.PHASE||'DEV',W=Number(process.env.WORKERS||4),BUDGET=Number(process.env.BUDGET||90);
  const saved=JSON.parse(fs.readFileSync('reports/data/pr88-selection-'+PHASE.toLowerCase()+'.json','utf8'));
  const out={};
  for(const [ui,x] of sixesFor(PHASE).entries()){
    const publicSix=Object.values(x.hyps)[0].map(p=>p.species);
    const g=await V2.guardedPreviewHard({dex,own,publicSix:publicSix.slice(),seedBase:H.SEL_SEARCH_SEED_BASE+ui*1000,workers:W,budgetSeconds:BUDGET});
    const old=saved.sixes[x.id].selection.guarded;
    out[x.id]={publicSix,pr88:{pick:old.pick.join('>'),seconds:old.seconds,status:old.status},
      v2:{pick:g.pick.join('>'),label:g.label??null,status:g.status,seconds:g.seconds,reason:g.reason,eligible:g.eligible??null,games:g.games??null,
        scores:(g.scores||[]).map(s=>({pick:s.pick,legacy:s.legacy,worst:s.worst,mean:s.mean,left:s.left,right:s.right,sideSplit:s.sideSplit,pairs:s.pairs}))},
      changed:g.pick.join('>')!==old.pick.join('>')};
    console.log(x.id,'pr88',old.pick.join('>'),'| v2',g.pick.join('>'),g.status,g.seconds+'s',out[x.id].changed?'CHANGED':'same');
  }
  const result={showdown:'3a766f2cfb5e51c1e428cfe87d0dba91a8f01640',format:'gen9championsbssregmc',phase:PHASE,workers:W,budgetSeconds:BUDGET,
    searchSeedBase:H.SEL_SEARCH_SEED_BASE,guard:V2.GUARD_V2,sixes:out,
    note:'Selection only. Guard games: each seed on both sides. AI vs AI on constructed sets, NOT a ladder win rate.'};
  fs.writeFileSync(process.env.OUT||'reports/data/pr90-selection-'+PHASE.toLowerCase()+'.json',JSON.stringify(result,null,1));
}
if(require.main===module)main().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
