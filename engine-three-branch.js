'use strict';
/**
 * P0-4: two-turn battle branch of fully specified opponent hypotheses.
 * Opponent's private in-game team is NEVER read. In preview, the caller knows
 * own six and only public opposing species; publicHypotheses() constructs
 * separate explicitly synthetic sets. All engine state belongs to this test.
 */
const {normalize}=require('./lab');
const {FORMAT}=require('./engine-reference');

function selectedIndices(six,three) {
  if(!Array.isArray(three)||three.length!==3||new Set(three).size!==3)
    throw Error('three distinct selected species required');
  return three.map(species=>{
    const index=six.findIndex(set=>set.species===species);
    if(index<0)throw Error('selected species absent from given six: '+species);
    return index;
  });
}
function makeThreeBattle(sim,ownSix,assumedFoeSix,{
  ownThree,foeThree,seed=[2026,10,28,1]
}={}){
  if(!Array.isArray(ownSix)||ownSix.length!==6||
     !Array.isArray(assumedFoeSix)||assumedFoeSix.length!==6)
    throw Error('both full six explicit sets required');
  const validator=sim.TeamValidator.get(FORMAT);
  for(const [label,team] of [['own',ownSix],['hypothetical foe',assumedFoeSix]]){
    const failures=validator.validateTeam(normalize(team))||[];
    if(failures.length)throw Error(label+' not M-C legal: '+failures.join(' | '));
  }
  const a=selectedIndices(ownSix,ownThree),b=selectedIndices(assumedFoeSix,foeThree);
  const battle=new sim.Battle({
    formatid:FORMAT,seed,
    p1:{name:'ResearchOwn',team:normalize(ownSix)},
    p2:{name:'ResearchAssumedFoe',team:normalize(assumedFoeSix)}
  });
  try{
    battle.makeChoices('team '+a.map(i=>i+1).join(''),'team '+b.map(i=>i+1).join(''));
    if(battle.p1.active[0]?.species.baseSpecies!==ownThree[0]||
       battle.p2.active[0]?.species.baseSpecies!==foeThree[0])
      throw Error('team preview lead mismatch');
    return battle;
  }catch(e){battle.destroy();throw e;}
}
function sides(battle){
  const snapshot=side=>({
    active:side.active[0]?.species.name,
    pokemon:side.pokemon.map(p=>({
      species:p.species.name,hp:p.hp,maxhp:p.maxhp,
      fainted:p.fainted,boosts:{...p.boosts},item:p.getItem().name
    }))
  });
  return {own:snapshot(battle.p1),assumedFoe:snapshot(battle.p2)};
}
function moveChoice(side,name,mega=false){
  const active=side.active[0];
  if(!active||active.fainted)throw Error('fainted active cannot use move in the hypothesis branch');
  const moves=active.moveSlots||[];
  const i=moves.findIndex(s=>s.id===side.battle.dex.moves.get(name).id);
  if(i<0)throw Error('move not on explicitly hypothesized current active: '+name);
  return 'move '+(i+1)+(mega?' mega':'');
}
function twoTurnBranch(sim,ownSix,assumedFoeSix,{
  ownThree,foeThree,
  first:{own:ownMove1,foe:foeMove1,ownMega=false,foeMega=false},
  second=null,
  seed=[2026,10,28,1]
}){
  const b=makeThreeBattle(sim,ownSix,assumedFoeSix,{ownThree,foeThree,seed});
  try{
    const logIndex=b.log.length,initial=sides(b);
    b.makeChoices(moveChoice(b.p1,ownMove1,ownMega),
      moveChoice(b.p2,foeMove1,foeMega));
    const firstAfter=sides(b),firstLog=b.log.slice(logIndex);
    const resolved=firstAfter.own.pokemon[0].fainted||
      firstAfter.assumedFoe.pokemon[0].fainted||b.ended;
    let secondAfter=null,secondLog=[];
    if(second&&!resolved){
      const n=b.log.length;
      b.makeChoices(moveChoice(b.p1,second.own,Boolean(second.ownMega)),
        moveChoice(b.p2,second.foe,Boolean(second.foeMega)));
      secondAfter=sides(b);
      secondLog=b.log.slice(n);
    }
    return {
      chosen:{ownThree:[...ownThree],assumedFoeThree:[...foeThree]},
      first:{own:ownMove1,foe:foeMove1,ownMega,foeMega},
      second:second?{own:second.own,foe:second.foe,
        executed:Boolean(secondAfter),notExecutedReason:resolved?'faint-or-game-end':''}:null,
      initial,firstAfter,secondAfter,ended:b.ended,winner:b.winner,
      events:{first:firstLog,second:secondLog},
      caveat:'Two explicit synthetic Showdown turns, with selected three on each side. Non-lead opponents/unknown actions are NOT inferred as real choices.'
    };
  }finally{b.destroy();}
}
module.exports={selectedIndices,makeThreeBattle,twoTurnBranch};
