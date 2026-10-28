'use strict';
/**
 * Real user-reported loss (2026-10-27 docs, Case B):
 * Indeedee's Dazzling Gleam acted before our Timid Hydreigon and KO'd.
 * Reported public six:
 * Indeedee/Hippowdon/Garchomp/Umbreon/Gengar/Gyarados.
 *
 * Opponent held item/moves/stats were NOT observed beyond the one move;
 * distinguish the known observed event from multiple LEGAL hypotheses.
 * The OTHER FIVE opponent sets are constructed placeholders and are not
 * claims about the actual opposing player's hidden sets or chosen three.
 */
const {load}=require('./lab');
const {reportedLive}=require('./reported-live-roster-20261027');
const {archetypes,variants}=require('./fixtures');
const {groups}=require('./environment-m7-teams');
const {opponents}=require('./threat-scenarios-20261014');
const {engineDamageSample,engineTurnSample}=require('./engine-reference');
const copy=structuredClone;
const fallback=(name)=>[
  ...Object.values(archetypes).flat(),
  ...Object.values(variants).flat(),
  ...groups.flatMap(g=>g.team),
  ...Object.values(opponents).flat()
].find(p=>p.species===name);
const publicSix=['Indeedee','Hippowdon','Garchomp','Umbreon','Gengar','Gyarados'];
const knownMove='Dazzling Gleam';
function hypotheticalEnemySix(item){
 if(!['Choice Scarf','Focus Sash'].includes(item))throw Error('Only two declared item hypotheses');
 const indeedee=copy(opponents.psychic_terrain_singles[0]);
 indeedee.item=item;
 indeedee.moves=['Dazzling Gleam','Expanding Force','Mystical Fire','Encore'];
 indeedee.nature='Timid';
 indeedee.evs={hp:2,spa:32,spe:32};
 const placeholderItems={
  Hippowdon:'Leftovers',Garchomp:'Life Orb',
  Umbreon:'Rocky Helmet',Gengar:'Gengarite',
  Gyarados:'Sitrus Berry'
 };
 const team=[indeedee,...publicSix.slice(1).map(name=>{
  const p=fallback(name);
  if(!p)throw Error('No documented valid hypothetical set for '+name);
  const x=copy(p);
  // M-C item clause: no duplicates across six, even the five completely
  // unobserved sets. These choices are NOT attributed to the real user rival.
  x.item=placeholderItems[name];
  return x;
 })];
 if(team.map(p=>p.species).join('/')!==publicSix.join('/'))
  throw Error('Mismatch with user-recorded six');
 return team;
}
function runInference(){
 const sim=load(),ourSix=reportedLive();
 const results={};
 for(const item of ['Focus Sash','Choice Scarf']){
  const foeSix=hypotheticalEnemySix(item);
  // Damage oracle sees each side's exact hypothetical set only.
  const incoming=engineDamageSample(sim,foeSix,ourSix,{
    ourLead:'Indeedee',opponentLead:'Hydreigon',
    move:knownMove,ourMega:false,opponentMega:false,
    seed:[2026,10,28,66]
  });
  const turn=engineTurnSample(sim,ourSix,foeSix,{
    ourLead:'Hydreigon',opponentLead:'Indeedee',ourMove:'Dark Pulse',
    opponentMove:knownMove,seed:[2026,10,28,66]
  });
  results[item]={
    assumedItem:item,
    speedOfIndeedee:incoming.ourSpeed,speedOfHydreigon:incoming.opponentSpeed,
    incomingDazzlingGleamFraction:incoming.fraction,
    hydreigonFaintedBeforeActing:turn.ourAfter.fainted,
    hydreigonMoveSeen:turn.events.some(e=>e.includes('|move|p1a:')&&e.includes('Dark Pulse')),
    engineEvents:turn.events,
    unknown:'Actual opponent item and other five sets remain unknown.'
  };
 }
 return {
  observedFromHumanReport:'Indeedee moved first and KOed our Hydreigon with Dazzling Gleam; item unknown',
  publicSix,ownMoveForScenario:'Dark Pulse (hypothesis, user did not report their chosen move)',
  results,
  interpretation:'Mechanics-counterfactual only. Not proof of real opponent item or six-set; independent legal hypothesis validation.',
 };
}
module.exports={publicSix,hypotheticalEnemySix,runInference};
if(require.main===module){
 try{console.log('REAL_BATTLE_B_MECHANICS '+JSON.stringify(runInference()));}
 catch(e){console.error(e.stack||e);process.exitCode=1;}
}
