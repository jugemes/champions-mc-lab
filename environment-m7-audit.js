#!/usr/bin/env node
'use strict';
// Synthetic population, ranked-Pokémon-informed, not a ladder sample.
// Uses both rational (old) and rational-risk opt-in, three opposing 6-to-3
// scenarios (their rational AI, two distinct preselected plausible trios).
const fs=require('node:fs'),path=require('node:path');
const {load,game,hashSeed,prelim,normalize}=require('./lab');
const {reportedLive,UNVERIFIED}=require('./reported-live-roster-20261027');
const {groups}=require('./environment-m7-teams');
const sim=load(),validator=sim.TeamValidator.get('gen9championsbssregmc');
const count=Number((process.argv[2]||'12'));
if(!Number.isInteger(count)||count<1||count>40)throw Error('Expected repetitions per cell 1..40');
const own=reportedLive();
function validate(){
 const errors=[];
 for(const row of groups){
  try{
   prelim(row.team,row.name);
   const e=validator.validateTeam(normalize(row.team));
   if(e?.length)errors.push(row.name+': '+e.join(' | '));
   for(const forced of [row.forcedA,row.forcedB]){
    if(new Set(forced).size!==3||forced.some(x=>!row.team.some(p=>p.species===x)))errors.push('Invalid forced three '+row.name+JSON.stringify(forced));
   }
  }catch(e){errors.push(row.name+': '+e.message);}
 }
 const ownE=validator.validateTeam(normalize(own));
 if(ownE?.length)errors.push('own reported six: '+ownE.join('|'));
 if(errors.length)throw Error('INVALID M-7 FIXTURES:\n'+errors.join('\n'));
 console.log('LEGAL M7 constructed opponents '+groups.length);
}
const top=(map,n=4)=>[...map].sort((a,b)=>b[1]-a[1]).slice(0,n).map(([k,v])=>({name:k,n:v}));
const inc=(m,k)=>m.set(k,(m.get(k)||0)+1);
async function run(){
 validate();
 const policies=['rational','rational-risk'], modes=['rational-opponent','forced-pressure','forced-alternative'];
 const rows=[];
 for(const grp of groups){
  for(const mode of modes){
   for(const policy of policies){
    let wins=0,turns=0,invalid=0,oppMega=0,oppUsed3=new Map(),oppLeads=new Map(),myLeads=new Map(),myPicks=new Map(),winnerSays=[];
    for(let k=0;k<count;k++){
     const seed=hashSeed(730000+groups.indexOf(grp)*10000+modes.indexOf(mode)*1000+k);
     const reverse=Boolean(k%2);
     const options={megaAware:true,
       candidatePreviewPolicy:policy,opponentPreviewPolicy:'rational',
       candidateDecisionPolicy:'v3',opponentDecisionPolicy:'v3'};
     if(mode!=='rational-opponent')options.opponentForced=mode==='forced-pressure'?grp.forcedA:grp.forcedB;
     const g=await game(sim,reverse?grp.team:own,reverse?own:grp.team,seed,false,null,reverse,options);
     if(g.trace.errors.length)invalid+=g.trace.errors.length;
     const winner=reverse?'opponent':'candidate';
     wins+=Number(g.winner===winner);turns+=g.turns;
     const mine=g.trace.selections.find(x=>x.side===(reverse?'p2':'p1'));
     const theirs=g.trace.selections.find(x=>x.side===(reverse?'p1':'p2'));
     if(!mine||!theirs)throw Error('missing picks '+grp.name);
     inc(myLeads,mine.lead);inc(oppLeads,theirs.lead);
     inc(myPicks,mine.chosen.slice().sort().join('/'));
     inc(oppUsed3,theirs.chosen.slice().sort().join('/'));
     winnerSays.push(Number(g.winner===winner));
    }
    const result={team:grp.name,tags:grp.tags,mode,policy,n:count,wins,
      winrate:wins/count,avgTurns:+(turns/count).toFixed(1),
      errors:invalid,myLeadTop:top(myLeads),myPickTop:top(myPicks),
      opposingLeadTop:top(oppLeads),opposingThreeTop:top(oppUsed3),
      winsPerSeed:winnerSays,
      forcedThree:mode==='forced-pressure'?grp.forcedA:mode==='forced-alternative'?grp.forcedB:null};
    rows.push(result);
    console.log('META_CELL '+JSON.stringify({team:result.team,mode,policy,
      n:count,wins,avgTurns:result.avgTurns,errors:invalid,
      ownLead:result.myLeadTop,oppLead:result.opposingLeadTop,
      oppThree:result.opposingThreeTop.slice(0,2)}));
   }
  }
 }
 for(const mode of modes){
  for(const policy of policies){
   const pool=rows.filter(r=>r.mode===mode&&r.policy===policy);
   let games=0,wins=0;
   for(const r of pool){games+=r.n;wins+=r.wins;}
   // Equal weighting of deliberately constructed examples (not usage estimates).
   console.log('META_SUMMARY '+JSON.stringify({mode,policy,games,wins,rate:+(wins/games).toFixed(4),
    warning:'Not a ranked win rate: constructed opponent six, synthetic sets, heuristic bots, equal template weights'}));
   const topHeavy=pool.filter(r=>r.tags.includes('top-heavy'));
   const n=topHeavy.reduce((s,x)=>s+x.n,0),w=topHeavy.reduce((s,x)=>s+x.wins,0);
   console.log('META_TOPHEAVY '+JSON.stringify({mode,policy,games:n,wins:w,rate:+(w/n).toFixed(4)}));
  }
 }
 const dir=path.join(__dirname,'output','m7-environment');fs.mkdirSync(dir,{recursive:true});
 fs.writeFileSync(path.join(dir,'m7-benchmark.json'),JSON.stringify({
  date:'2026-10-28',format:'gen9championsbssregmc',
  showdown:'3a766f2cfb5e51c1e428cfe87d0dba91a8f01640',perCell:count,
  assumption:'opponent team is constructed, not a sampled ladder team; no usage/team-frequency weights',
  source:['https://pokenavi.jp/ranking/','https://www.pokemon-zone.com/champions/ranked-seasons/singles/'],
  ownKnownUnknown:UNVERIFIED,results:rows
 },null,2));
 if(rows.some(r=>r.errors))throw Error('Battle AI illegal choices observed: see rows');
}
run().catch(e=>{console.error(e.stack||String(e));process.exitCode=1;});
