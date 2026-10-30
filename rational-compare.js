#!/usr/bin/env node
'use strict';
// Old/new comparison for PR #54: baseline vs PR #51 'rational' vs 'rational2'
// on every rational-cases scenario, with the labelled opponent script AND an
// unscripted follow-up (opponent plays the baseline policy) so a success that
// only exists because a script keeps repeating a punishable line is visible.
// Same seed / same side / forced selections as rational-cases. Behaviour
// checks on single battles, NOT ladder win rates.
const {load,hashSeed,normalize}=require('./lab');
const {CASES,runCase}=require('./rational-cases');
const FORMAT='gen9championsbssregmc';
const KEYS=['helmetChip','helmetFaints','immuneHits','setupAtCap','movesWhileEncored','switches'];
async function main(){
  const sim=load(),n=Number(process.argv[2]||10);
  const v=sim.TeamValidator.get(FORMAT);
  for(const [name,c] of Object.entries(CASES))for(const t of [c.own(),c.opp]){const p=v.validateTeam(normalize(t));if(p?.length)throw Error(name+': '+p.join('; '));}
  const rows=[],diffs=[];
  for(const name of Object.keys(CASES))for(const mode of ['scripted','unscripted']){
    for(let i=0;i<n;i++){
      const seed=hashSeed(700000+i),reverse=Boolean(i%2),by={};
      for(const policy of ['baseline','rational','rational2']){
        const r=await runCase(sim,name,{policy,seed,reverse,script:mode==='unscripted'?null:undefined});
        by[policy]=r;
        rows.push({case:name,mode,policy,seed:r.seed,side:r.side,win:r.win,turns:r.turns,errors:r.errors,metrics:r.metrics,
          rational:r.rational,choices:r.candidateChoices});
      }
      if(by.rational.candidateChoices.join()!==by.rational2.candidateChoices.join())
        diffs.push({case:name,mode,seed:by.rational.seed,side:by.rational.side,rational:{win:by.rational.win,choices:by.rational.candidateChoices,reasons:by.rational.rational},
          rational2:{win:by.rational2.win,choices:by.rational2.candidateChoices,reasons:by.rational2.rational}});
    }
  }
  const agg={};
  for(const r of rows){const k=[r.case,r.mode,r.policy].join(' ');const a=agg[k]||(agg[k]={wins:0,games:0,errors:0,...Object.fromEntries(KEYS.map(x=>[x,0]))});
    a.games++;a.wins+=Number(r.win);a.errors+=r.errors;for(const x of KEYS)a[x]+=r.metrics[x];}
  for(const [k,a] of Object.entries(agg))console.log(k.padEnd(50),'W '+a.wins+'/'+a.games,KEYS.map(x=>x+' '+a[x]).join(' '),'err '+a.errors);
  console.log('rational vs rational2 choice differences:',diffs.length);
  for(const d of diffs)console.log(' ',d.case,d.mode,d.seed,d.side,'r1',d.rational.win?'W':'L',d.rational.choices.join(' '),'| r2',d.rational2.win?'W':'L',d.rational2.choices.join(' '));
  if(process.argv[3])require('node:fs').writeFileSync(process.argv[3],JSON.stringify({n,seedBase:700000,aggregate:agg,diffs,rows},null,1));
}
if(require.main===module)main().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
