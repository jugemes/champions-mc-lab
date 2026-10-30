#!/usr/bin/env node
'use strict';
// Paired, same-seed comparison of the turn policies on the pinned Showdown.
// Gate order (decided BEFORE looking at win counts):
//   1. blunder counters of the candidate side must not increase and the
//      targeted ones (setup at +6, repeated immune hits) must drop;
//   2. only then report paired win counts with a Wilson 95% interval.
// Both sides pick 3 from the other's PUBLIC six (legacy chooseThree); no
// forced selection. AI vs AI counts are NOT ladder win rates.
const {game,load,hashSeed}=require('./lab');
const {reportedLive}=require('./reported-live-roster-20261027');
const {opponents:holdout}=require('./holdout-opponents');
const {archetypes}=require('./fixtures');
const {metrics}=require('./rational-cases');
function wilson(k,n,z=1.96){
  if(!n)return [0,0];
  const p=k/n,d=1+z*z/n,c=p+z*z/(2*n),r=z*Math.sqrt(p*(1-p)/n+z*z/(4*n*n));
  return [(c-r)/d,(c+r)/d];
}
const OPPONENTS={...holdout,rain:archetypes.rain,setup:archetypes.setup,stall:archetypes.stall};
const CONDITIONS=[
  {name:'baseline-vs-baseline',cand:'baseline',opp:'baseline'},
  {name:'rational-vs-baseline',cand:'rational',opp:'baseline'},
  {name:'baseline-vs-rational',cand:'baseline',opp:'rational'},
  {name:'rational-vs-rational',cand:'rational',opp:'rational'},
];
const KEYS=['helmetChip','helmetFaints','immuneHits','setupAtCap','movesWhileEncored'];
async function main(){
  const sim=load(),n=Number(process.argv[2]||10),dex=sim.Dex.mod('champions');
  const team=reportedLive(),summary={};
  for(const cond of CONDITIONS){
    const s={wins:0,games:0,errors:0,cand:Object.fromEntries(KEYS.map(k=>[k,0])),opp:Object.fromEntries(KEYS.map(k=>[k,0])),byOpp:{}};
    for(const [oname,opp] of Object.entries(OPPONENTS)){
      let w=0;
      for(let i=0;i<n;i++){
        const seed=hashSeed(900000+Object.keys(OPPONENTS).indexOf(oname)*1000+i),reverse=Boolean(i%2);
        const opt={candidateDecisionPolicy:cond.cand,opponentDecisionPolicy:cond.opp};
        const g=reverse?await game(sim,opp,team,seed,true,null,true,opt):await game(sim,team,opp,seed,true,null,false,opt);
        const won=reverse?g.winner==='opponent':g.winner==='candidate';
        const cs=reverse?'p2':'p1',os=reverse?'p1':'p2';
        const mc=metrics(g.log,cs,dex),mo=metrics(g.log,os,dex);
        for(const k of KEYS){s.cand[k]+=mc[k];s.opp[k]+=mo[k];}
        s.errors+=g.trace.errors.length;w+=Number(won);s.games++;
      }
      s.wins+=w;s.byOpp[oname]=w+'/'+n;
    }
    s.wilson=wilson(s.wins,s.games).map(x=>+x.toFixed(3));
    summary[cond.name]=s;
    console.log(cond.name,'wins',s.wins+'/'+s.games,'CI95',s.wilson.join('-'),'errors',s.errors,'cand',JSON.stringify(s.cand),'opp',JSON.stringify(s.opp));
    console.log('  by opponent',JSON.stringify(s.byOpp));
  }
  if(process.argv[3])require('node:fs').writeFileSync(process.argv[3],JSON.stringify({n,seedBase:900000,summary},null,1));
}
if(require.main===module)main().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
module.exports={wilson,OPPONENTS,CONDITIONS};
