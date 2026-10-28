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
function opponentLeadHypotheses(sim,ownSix,publicSix,{hypothesisLimit=1,maxScenes=5}={}){
 const dex=sim.Dex.mod('champions');
 const sets=publicHypotheses(sim,publicSix,{limit:hypothesisLimit}).assumptions;
 const scenarios=[],seen=new Set();
 for(let h=0;h<sets.length;h++){
  const six=sets[h].team;
  const ranked=rankRationalPreview(dex,six,ownSix.map(p=>p.species));
  // Opponent strategy is itself uncertain: top-ranked trios are hypotheses,
  // not the actual hidden opponent selection. Add potential Mega threat lead
  // even when an imperfect opponent AI omits it.
  const chosen=[...ranked.slice(0,2)];
  const mega=ranked.find(r=>r.three.some(i=>Boolean(dex.items.get(six[i].item).megaStone)));
  if(mega&&!chosen.includes(mega))chosen.push(mega);
  for(const candidate of chosen){
   const species=candidate.three.map(i=>six[i].species);
   const leads=[candidate.leads[0].i,
     ...candidate.three.filter(i=>Boolean(dex.items.get(six[i].item).megaStone))];
   for(const lead of new Set(leads)){
    const tr=[lead,...candidate.three.filter(i=>i!==lead)].map(i=>six[i].species);
    const key=JSON.stringify([h,tr]);
    if(seen.has(key))continue;seen.add(key);
    scenarios.push({
      source:'synthetic public-six hypothetical opponent selection',
      assumedTeam:six,assumedThree:tr,assumedLead:six[lead].species,
      isMegaThreat:Boolean(dex.items.get(six[lead].item).megaStone),
      candidateRank:ranked.indexOf(candidate),
      evidence:'rational heuristic top trios + explicit potential Mega holder, not hidden actual three'
    });
    if(scenarios.length>=maxScenes)return scenarios;
   }
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
 const us=after.own.pokemon[0],them=after.assumedFoe.pokemon[0];
 return {
   ownLeadFainted:us.fainted,foeLeadFainted:them.fainted,
   ownRemaining:+(us.hp/us.maxhp).toFixed(3),
   foeRemaining:+(them.hp/them.maxhp).toFixed(3),
   foeAttackBoost:them.boosts.atk||0,
   secondExecuted:branch.second?.executed||false
 };
}
function checkOpeningBranches(sim,ownSix,publicSix,{
  ownLead,ownThree,seed=[2026,10,28,1],maxScenes=4
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
    for(const ownFirst of our.moves){
     const oursMega=Boolean(dex.items.get(our.item).megaStone);
     // On turn 2 the action is still a declared script (no perfect foresight).
     // Same first move is required if our Choice Scarf locks it.
     const ownSecond=our.item==='Choice Scarf'?ownFirst:usAttack;
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
