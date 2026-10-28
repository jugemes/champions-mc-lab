'use strict';
/**
 * P0 Showdown mechanics oracle: **fully specified hypothetical** teams only.
 *
 * This module is intentionally NOT wired into preview/turn-policy bots.
 * The Battle instance holds private sets by design; it may only be used
 * offline with an independently constructed, explicitly supplied hypothesis.
 * Never pass an active real opponent Battle object, access a hidden team, or
 * interpret an assumed opponent item/move as an observed fact.
 *
 * M-C source of truth: the pinned Showdown Battle / BattleActions.getDamage /
 * Pokemon.getActionSpeed APIs, NOT damage.js or lab.js custom formulas.
 */
const {normalize}=require('./lab');
const FORMAT='gen9championsbssregmc';
const DEFAULT_SEED=[2026,10,28,1];

function assertTeam(sim,team,label){
  if(!Array.isArray(team)||team.length!==6)throw Error(label+': explicit six sets required');
  const errors=sim.TeamValidator.get(FORMAT).validateTeam(normalize(team))||[];
  if(errors.length)throw Error(label+': illegal hypothetical team: '+errors.join(' | '));
}
function previewChoice(team,leadName){
  const i=team.findIndex(s=>s.species===leadName);
  if(i<0)throw Error('Hypothesis does not contain lead '+leadName);
  const ids=[i,...team.map((_,j)=>j).filter(j=>j!==i)].slice(0,3);
  return 'team '+ids.map(n=>n+1).join('');
}
/**
 * Construct an isolated battle, with both sets explicitly passed by caller.
 * Neither this function nor its callers infer anything from a real rival's
 * hidden move/item/points. One may use this for scenario-validation only.
 */
function createHypotheticalBattle(sim,ourSix,assumedOpponentSix,{
  ourLead,opponentLead,seed=DEFAULT_SEED
}={}){
  assertTeam(sim,ourSix,'own');
  assertTeam(sim,assumedOpponentSix,'assumed opponent');
  if(!Array.isArray(seed)||seed.length!==4)throw Error('4-number seed required');
  const battle=new sim.Battle({
    formatid:FORMAT,seed,
    p1:{name:'ResearchOwn',team:normalize(ourSix)},
    p2:{name:'ResearchHypothesis',team:normalize(assumedOpponentSix)}
  });
  try{
    // This is an isolated laboratory situation. Never take a Battle object
    // from a live ongoing game; doing so could leak hidden opponent state.
    battle.makeChoices(previewChoice(ourSix,ourLead),previewChoice(assumedOpponentSix,opponentLead));
    const source=battle.p1.active[0],target=battle.p2.active[0];
    if(!source||!target||source.fainted||target.fainted)
      throw Error('Showdown did not initialize chosen leads');
    return battle;
  }catch(error){battle.destroy();throw error;}
}
/**
 * Sample Showdown's real attack code in a *single specified scenario*.
 * Probability of holding items/forms is NOT inferred. Crits are disabled for
 * the queried move, to compare ordinary hits. Accuracy and future turns are
 * not modelled by getDamage: those require a genuine Battle turn simulation.
 */
function engineDamageSample(sim,ourSix,assumedOpponentSix,{
  ourLead,opponentLead,move,ourMega=false,opponentMega=false,seed=DEFAULT_SEED
}={}){
  if(!move||!ourLead||!opponentLead)throw Error('move and both leads required');
  const own=ourSix.find(x=>x.species===ourLead);
  if(!own||!own.moves.includes(move))throw Error('Query move must be on our explicitly known set');
  const battle=createHypotheticalBattle(sim,ourSix,assumedOpponentSix,{ourLead,opponentLead,seed});
  try{
    const source=battle.p1.active[0],target=battle.p2.active[0];
    if(ourMega&&!battle.actions.runMegaEvo(source))throw Error('Our required Mega unavailable');
    if(opponentMega&&!battle.actions.runMegaEvo(target))throw Error('Hypothetical opposing Mega unavailable');
    const activeMove=battle.dex.getActiveMove(move);
    // Avoid cross-run probabilistic criticals. This is NOT a complete
    // damage range and is NOT a forecast of the unknown opposing actual set.
    activeMove.willCrit=false;
    battle.setActiveMove(activeMove,source,target);
    const raw=battle.actions.getDamage(source,target,activeMove,true);
    battle.clearActiveMove(true);
    const numeric=typeof raw==='number'?raw:0;
    return {
      assumption:'explicit-fully-specified-hypothetical-set',
      engine:'showdown-BattleActions.getDamage',
      format:FORMAT,seed,move,
      ourForm:source.species.name,opponentForm:target.species.name,
      ourSpeed:source.getActionSpeed(),opponentSpeed:target.getActionSpeed(),
      ourAbility:source.getAbility().name,opponentAbility:target.getAbility().name,
      ourItem:source.getItem().name,opponentItem:target.getItem().name,
      weather:battle.field.weather||'',
      rawDamage: numeric,opponentMaxHP:target.maxhp,
      fraction:numeric/target.maxhp,immune:raw===false,
      // No accuracy, switch-in response, multi-turn assumptions made.
      limitation:'single queried hit, no critical hit; actual rival set is unknown'
    };
  }finally{battle.destroy();}
}

/**
 * Execute one REAL Showdown turn from a fully specified synthetic situation.
 * Unlike getDamage(), this captures move order, actual Mega timing, status
 * moves, damage, fainting and on-hit events. All choices are supplied as
 * *scenario hypotheses*, never derived from hidden state of an actual rival.
 */
function engineTurnSample(sim,ourSix,assumedOpponentSix,{
  ourLead,opponentLead,ourMove,opponentMove,ourMega=false,opponentMega=false,
  seed=DEFAULT_SEED
}={}){
  if(!ourMove||!opponentMove)throw Error('both fully specified turn actions required');
  const own=ourSix.find(s=>s.species===ourLead);
  const foe=assumedOpponentSix.find(s=>s.species===opponentLead);
  if(!own?.moves.includes(ourMove))throw Error('Our move missing from known set');
  if(!foe?.moves.includes(opponentMove))throw Error('Opponent scenario move missing from explicit hypothesis');
  const battle=createHypotheticalBattle(sim,ourSix,assumedOpponentSix,{ourLead,opponentLead,seed});
  try{
    const source=battle.p1.active[0],target=battle.p2.active[0];
    const start=battle.log.length;
    const ownChoice='move '+(own.moves.indexOf(ourMove)+1)+(ourMega?' mega':'');
    const foeChoice='move '+(foe.moves.indexOf(opponentMove)+1)+(opponentMega?' mega':'');
    battle.makeChoices(ownChoice,foeChoice);
    if(battle.p1.choice.error||battle.p2.choice.error)
      throw Error('Showdown rejected a hypothetical turn action: '+
        (battle.p1.choice.error||'')+' / '+(battle.p2.choice.error||''));
    const eventTypes=new Set(['move','detailschange','faint','cant','turn',
      '-damage','-boost','-fail','-formechange','-activate']);
    const events=battle.log.slice(start).filter(line=>eventTypes.has(line.split('|')[1]));
    return {
      assumption:'fully specified hypothetical scenario only',
      engine:'showdown-Battle.makeChoices',
      format:FORMAT,seed,
      ownChoice:{species:ourLead,move:ourMove,mega:ourMega},
      assumedOpponentChoice:{species:opponentLead,move:opponentMove,mega:opponentMega},
      ourAfter:{form:source.species.name,hp:source.hp,maxhp:source.maxhp,fainted:source.fainted,
        boosts:{...source.boosts}},
      opponentAfter:{form:target.species.name,hp:target.hp,maxhp:target.maxhp,
        fainted:target.fainted,boosts:{...target.boosts}},
      ended:battle.ended,winner:battle.winner||null,events,
      limitation:'one full engine turn of an explicit opponent hypothesis; not known rival actions'
    };
  }finally{battle.destroy();}
}

module.exports={FORMAT,createHypotheticalBattle,engineDamageSample,engineTurnSample};
