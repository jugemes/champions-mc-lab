'use strict';
/**
 * Preview-facing diagnostic, NOT a deployed 3v3 policy.
 * Both prospective own and enemy leads are generated from six publicly known
 * species and synthetic catalog. The candidate never receives actual hidden
 * opponent three/items. It uses full hypothetical scenarios only offline.
 *
 * First- and second-turn scripts test the opponent's **specified** actions;
 * they do not predict action frequencies, search a full game tree or grant
 * perfect knowledge to the live agent. The score is descriptive, NOT winrate.
 */
const {publicHypotheses}=require('./public-hypotheses');
const {rankRationalPreview}=require('./preview-rational');
const {twoTurnBranch}=require('./engine-three-branch');
function opponentLeadHypotheses(sim,ownSix,publicSix,{hypothesisLimit=1,maxScenes=6}={}){
 const dex=sim.Dex.mod('champions');
 const sets=publicHypotheses(sim,publicSix,{limit:hypothesisLimit}).assumptions;
 const scenarios=[],seen=new Set();
 // Each species of the PUBLIC SIX is considered an opposing lead. The
 // old shortlist omitted Garchomp/Mimikyu etc because opponent preview AI
 // wasn't reliable; that systematically hid adversarial opening lines.
 for(let h=0;h<sets.length;h++){
  const six=sets[h].team;
  const ranked=rankRationalPreview(dex,six,ownSix.map(p=>p.species));
  for(const enemy of publicSix){
   const selected=ranked.find(candidate=>candidate.three.some(i=>
     six[i].species===enemy));
   if(!selected)throw Error('no hypothetical opponent trio contains '+enemy);
   const lead=selected.three.find(i=>six[i].species===enemy);
   const trio=[lead,...selected.three.filter(i=>i!==lead)].map(i=>six[i].species);
   const key=JSON.stringify([h,trio]);
   if(seen.has(key))continue;
   seen.add(key);
   scenarios.push({
     source:'all-public-opponent-leads hypothetical, not true opponent selection',
     assumedTeam:six,assumedThree:trio,assumedLead:enemy,
     isMegaThreat:Boolean(dex.items.get(six[lead].item).megaStone),
     candidateRank:ranked.indexOf(selected),
     evidence:'every visible opposing species can potentially lead; backing 3 is a separate legal constructed rational heuristic hypothesis, not known actual'
   });
   if(scenarios.length>=maxScenes)return scenarios;
  }
 }
 return scenarios;
}
function scriptedFirstMoves(dex,foe){
 const all=foe.moves.map(move=>({move,m:dex.moves.get(move)}));
 const attacks=all.filter(x=>x.m.category!=='Status');
 const highest=attacks.sort((a,b)=>(b.m.basePower||0)-(a.m.basePower||0))[0]?.move;
 const setup=all.find(x=>['swordsdance','dragondance','quiverdance',
   'nastyplot','bulkup','calmmind'].includes(x.m.id))?.move;
 return [...new Set([highest,setup].filter(Boolean))];
}
function pressureScore(branch){
 const first=branch.firstAfter,after=branch.secondAfter||first;
 const leadUs=after.own.pokemon[0],leadFoe=after.assumedFoe.pokemon[0];
 const metric=side=>({
   fainted:side.pokemon.filter(p=>p.fainted).length,
   meanHP:side.pokemon.reduce((sum,p)=>sum+p.hp/p.maxhp,0)/side.pokemon.length
 });
 const us=metric(after.own),foe=metric(after.assumedFoe);
 return {
   ownLeadFainted:leadUs.fainted,foeLeadFainted:leadFoe.fainted,
   ownRemaining:+(leadUs.hp/leadUs.maxhp).toFixed(3),
   foeRemaining:+(leadFoe.hp/leadFoe.maxhp).toFixed(3),
   ownFaintedCount:us.fainted,foeFaintedCount:foe.fainted,
   ownTeamRemaining:+us.meanHP.toFixed(3),foeTeamRemaining:+foe.meanHP.toFixed(3),
   foeAttackBoost:leadFoe.boosts.atk||0,
   secondExecuted:branch.second?.executed||false,
   secondSkipped:branch.second?.notExecutedReason||''
 };
}
function checkOpeningBranches(sim,ownSix,publicSix,{
  ownLead,ownThree,seed=[2026,10,28,1],maxScenes=6
}={}){
 const dex=sim.Dex.mod('champions');
 if(!Array.isArray(ownThree)||ownThree[0]!==ownLead)
   throw Error('own preview trio must include its declared lead first');
 const scenarios=opponentLeadHypotheses(sim,ownSix,publicSix,{maxScenes});
 const our=ownSix.find(x=>x.species===ownLead);
 if(!our)throw Error('own lead missing');
 const results=[];
 for(const scene of scenarios){
  const them=scene.assumedTeam.find(x=>x.species===scene.assumedLead);
  const foeFirstMoves=scriptedFirstMoves(dex,them);
  const foeAttack=scriptedFirstMoves(dex,them).find(m=>dex.moves.get(m).category!=='Status')||them.moves[0];
  const usAttack=scriptedFirstMoves(dex,our).find(m=>dex.moves.get(m).category!=='Status')||our.moves[0];
  for(const theirMega of (scene.isMegaThreat?[false,true]:[false])){
   for(const foeFirst of foeFirstMoves){
    for(const ownFirst of [...our.moves,...ownThree.slice(1).map(x=>'switch:'+x)]){
     const switchInto=ownFirst.startsWith('switch:')?ownFirst.slice(7):null;
     const actor=switchInto?ownSix.find(x=>x.species===switchInto):our;
     const oursMega=!switchInto&&Boolean(dex.items.get(our.item).megaStone);
     // On turn 2, an openly selected teammate can act. This is a script,
     // not an unknown rival's actual choice or hidden set.
     const ownAttack=scriptedFirstMoves(dex,actor)
       .find(m=>dex.moves.get(m).category!=='Status')||actor.moves[0];
     const ownSecond=!switchInto&&our.item==='Choice Scarf'?ownFirst:ownAttack;
     const r=twoTurnBranch(sim,ownSix,scene.assumedTeam,{
       ownThree,foeThree:scene.assumedThree,seed,
       first:{own:ownFirst,foe:foeFirst,ownMega:oursMega,foeMega:theirMega},
       second:{own:ownSecond,foe:foeAttack}
     });
     results.push({
       assumedEnemyThree:scene.assumedThree,
       assumedEnemyLead:scene.assumedLead,
       enemyMega:theirMega,enemyFirstMove:foeFirst,
       ourFirstMove:ownFirst,
       ownSecond,foeSecond:foeAttack,
       ...pressureScore(r)
     });
    }
   }
  }
 }
 return {publicSix:[...publicSix],ownThree:[...ownThree],
   ownLead,opponentScenes:scenarios.map(s=>({three:s.assumedThree,
    lead:s.assumedLead,megaThreat:s.isMegaThreat,rank:s.candidateRank})),
   results,warning:'Full Showdown two-turn scripts of selected 3v3, not complete 3v3 matches. Opponent move, item, mega and three are HYPOTHESES, not known or probable.'};
}
module.exports={opponentLeadHypotheses,scriptedFirstMoves,pressureScore,checkOpeningBranches};
