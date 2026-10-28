'use strict';
/**
 * Next season M-C baseline. ALL 14 adversary public-six patterns are
 * constructed research hypotheses; none is ladder usage frequency.
 * Freeze the reported live six and measure both old-turn and observed
 * immunity-aware BOTH-SIDES AI conditions before proposing expensive
 * species/EV changes.
 */
function createCases(groups){
 if(groups.length!==14)throw Error('Expected the 14 documented M-7 synthetic environment groups');
 const out=[];
 for(const g of groups){
  const names=g.team.map(p=>p.species);
  if(names.length!==6||new Set(names).size!==6)throw Error('Opponent public six invalid: '+g.name);
  for(const forcedKind of ['forcedA','forcedB']){
   const forced=g[forcedKind];
   if(!Array.isArray(forced)||forced.length!==3||
      new Set(forced).size!==3||forced.some(x=>!names.includes(x)))
     throw Error('Invalid '+forcedKind+' on '+g.name);
   for(const reversed of [false,true]){
    out.push({group:g.name,tags:g.tags,forcedKind,
      enemySix:g.team,publicSix:names,enemyThree:[...forced],reversed});
   }
  }
 }
 return out;
}
function aggregate(rows){
 const groups=new Map();
 for(const row of rows){
  const key=row.group;
  if(!groups.has(key))groups.set(key,{group:key,tags:row.tags,
    cases:0,oldWins:0,mutualLearningWins:0,
    changedResults:0,ownImmunityObservations:0,foeImmunityObservations:0,
    selections:new Map(),issues:[]});
  const obj=groups.get(key);
  obj.cases++;
  obj.oldWins+=Number(row.old.won);
  obj.mutualLearningWins+=Number(row.mutualLearning.won);
  obj.changedResults+=Number(row.old.won!==row.mutualLearning.won);
  obj.ownImmunityObservations+=row.mutualLearning.ownLearned;
  obj.foeImmunityObservations+=row.mutualLearning.foeLearned;
  const name=row.old.selected.join('/')+' | lead '+row.old.lead;
  obj.selections.set(name,(obj.selections.get(name)||0)+1);
  if(row.old.won!==row.mutualLearning.won)obj.issues.push({
    forcedKind:row.forcedKind,reversed:row.reversed,
    oldWon:row.old.won,newWon:row.mutualLearning.won,
    ownThree:row.old.selected,enemyThreeAfterwards:row.enemyThreeAfterwards,
    reason:'unattributed outcome divergence; inspect both action sequences'
  });
 }
 return [...groups.values()].map(row=>({
  ...row,selections:[...row.selections].map(([three,n])=>({three,n}))
 })).sort((a,b)=>a.mutualLearningWins-b.mutualLearningWins||
   a.oldWins-b.oldWins||a.group.localeCompare(b.group));
}
function summarize(rows){
 const groups=aggregate(rows);
 const winOld=rows.filter(x=>x.old.won).length,
   winBoth=rows.filter(x=>x.mutualLearning.won).length;
 return {cases:rows.length,groups:groups.length,winOld,
   winBoth,changedResults:rows.filter(x=>x.old.won!==x.mutualLearning.won).length,
   groupsRankedForReview:groups,
   limitations:[
    'Opponent six and selected three are explicitly constructed stress teams, not usage-based rank samples',
    'Win counters are equal-seed synthetic BOT outcomes; neither this nor AI move choice validates real human counterplay',
    'No live six species, points, items or moves were edited; no candidate swap has yet been proven beneficial',
    'Both AI sides are given the same observed-immunity fix for the corrected variant; further rationality tests are necessary'
   ]};
}
module.exports={createCases,aggregate,summarize};
