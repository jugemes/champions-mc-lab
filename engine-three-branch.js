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
function matchesExpectedActive(p,expected){
  const form=p?.species.name||'';
  // A publicly observed forme change (e.g. Mimikyu -> Mimikyu-Busted)
  // must not be mistaken for a different opposing active or free switch.
  return form===expected||p?.species.baseSpecies===expected||
    form.startsWith(expected+'-Mega');
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
    if(!matchesExpectedActive(battle.p1.active[0],ownThree[0])||
       !matchesExpectedActive(battle.p2.active[0],foeThree[0]))
      throw Error('team preview lead mismatch');
    return battle;
  }catch(e){battle.destroy();throw e;}
}
function sides(battle){
  const snapshot=side=>({
    active:side.active[0]?.species.name,
    pokemon:side.pokemon.slice(0,3).map(p=>({
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
function actionChoice(side,name,mega=false){
  if(typeof name==='string'&&name.startsWith('switch:')){
    if(mega)throw Error('switch choice cannot Mega');
    const target=name.slice('switch:'.length);
    const i=side.pokemon.findIndex(p=>p.species.name===target||
      p.species.baseSpecies===target);
    if(i<0)throw Error('switch target not on selected side: '+target);
    const mon=side.pokemon[i];
    if(mon.fainted||mon.active)throw Error('switch target is fainted or already active: '+target);
    return 'switch '+(i+1);
  }
  return moveChoice(side,name,mega);
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
    b.makeChoices(actionChoice(b.p1,ownMove1,ownMega),
      actionChoice(b.p2,foeMove1,foeMega));
    const firstAfter=sides(b),firstLog=b.log.slice(logIndex);
    const plannedOwn=ownMove1.startsWith('switch:')?ownMove1.slice(7):ownThree[0];
    const plannedFoe=foeMove1.startsWith('switch:')?foeMove1.slice(7):foeThree[0];
    const positionChanged=
      !matchesExpectedActive(b.p1.active[0],plannedOwn)||
      !matchesExpectedActive(b.p2.active[0],plannedFoe);
    // Pivot / Emergency Exit / replacement beyond an explicitly scheduled
    // switch invalidates a pre-written next action. Stop rather than leak
    // a counterfactual outcome for a new, unmodelled active.
    const resolved=Boolean(b.p1.active[0]?.fainted||
      b.p2.active[0]?.fainted||b.ended||positionChanged);
    let secondAfter=null,secondLog=[],secondSkipReason='';
    if(second&&!resolved){
      if(b.requestState&&b.requestState!=='move'){
        // A pivot, Emergency Exit or a faint can force a mandatory switch
        // request before any second-turn attacks become legal.
        secondSkipReason='pending-'+b.requestState+'-request';
      }else{
        const n=b.log.length;
        try{
          b.makeChoices(actionChoice(b.p1,second.own,Boolean(second.ownMega)),
            actionChoice(b.p2,second.foe,Boolean(second.foeMega)));
          secondAfter=sides(b);
          secondLog=b.log.slice(n);
        }catch(e){
          // A fixed script can become illegal due to Choice lock, Encore,
          // Disable, forced switches or another mechanic. Preserve the fact
          // it was NOT executed. Do not invent a future turn.
          if(!/Not all choices done|Can't|invalid|unavailable|disabled/i.test(String(e.message)))
            throw e;
          secondSkipReason='mechanics-rejected-second-choice: '+String(e.message);
        }
      }
    }
    return {
      chosen:{ownThree:[...ownThree],assumedFoeThree:[...foeThree]},
      first:{own:ownMove1,foe:foeMove1,ownMega,foeMega},
      second:second?{own:second.own,foe:second.foe,
        executed:Boolean(secondAfter),notExecutedReason:secondSkipReason||
          (positionChanged?'lead-changed-or-forced-replacement':resolved?'faint-or-game-end':'')}:null,
      initial,firstAfter,secondAfter,ended:b.ended,winner:b.winner,
      events:{first:firstLog,second:secondLog},
      caveat:'Two explicit synthetic Showdown turns, with selected three on each side. Non-lead opponents/unknown actions are NOT inferred as real choices.'
    };
  }finally{b.destroy();}
}
module.exports={selectedIndices,makeThreeBattle,twoTurnBranch};
