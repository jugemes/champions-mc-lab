#!/usr/bin/env node
'use strict';
// Hybrid-01 audit (Issue #2): small, deterministic reproductions of why the
// heuristic preview/decision AI does not behave like a rational human, using
// only the pinned Showdown engine. No large match batches are run here.
//
// Every opposing set below is a HYPOTHESIS used to ask "is this possible in
// M-C, and what does the engine do if so?". None of them is a claim about what
// a real opponent held. Observed facts are kept in REAL_CASES, separately.
const {provisional}=require('./provisional-rank-roster-20261018');
const {reportedLive}=require('./reported-live-roster-20261027');
const {normalize,matchup,load}=require('./lab');
const {choosePreview,seededRandom}=require('./preview-policy');
const {chooseStrategicPreview}=require('./preview-strategic');
const {opponents:threatSixes}=require('./threat-scenarios-20261014');
const {teams:cycle3}=require('./cycle3-teams');
const FORMAT='gen9championsbssregmc';
const set=(species,item,ability,nature,evs,moves)=>({species,item,ability,nature,
 evs:{hp:0,atk:0,def:0,spa:0,spd:0,spe:0,...evs},moves});

// Only what the user reported. Unknowns stay unknown.
const REAL_CASES={
 B_indeedee:{
  opponentSix:['Indeedee','Hippowdon','Garchomp','Umbreon','Gengar','Gyarados'],
  ownThree:['Hydreigon','Metagross','Rotom-Wash'],ownLead:'Hydreigon',
  observed:['Indeedee led','Indeedee moved before Hydreigon','Dazzling Gleam KOed Hydreigon'],
  unknown:['Indeedee item','Indeedee form/nature/points','other two opposing picks','full turn log']
 },
 E_charizard_y:{
  opponentSix:['Raichu','Meowscarada','Charizard','Garchomp','Basculegion','Corviknight'],
  ownThree:['Starmie','Primarina','Rillaboom'],
  observed:['Mega Charizard Y swept the selected three'],
  unknown:['Charizard moves/points','Basculegion gender form','other two opposing picks','turn log']
 },
 C_gyarados_chandelure:{
  opponentSix:null,
  observed:['Sitrus (non-Mega) Gyarados beat Golisopod+Garchomp+Primarina',
   'Chandelure beat Primarina+Garchomp+Gholdengo'],
  unknown:['both opposing sixes','all moves/items except Gyarados Sitrus','turn logs']
 }
};

// HYPOTHESES (legal in M-C, checked by tests). Not observed sets.
const INDEEDEE_HYPOTHESES={
 scarf_timid_c32:set('Indeedee','Choice Scarf','Psychic Surge','Timid',{hp:2,spa:32,spe:32},
  ['Dazzling Gleam','Expanding Force','Mystical Fire','Trick']),
 scarf_timid_c0:set('Indeedee','Choice Scarf','Psychic Surge','Timid',{hp:32,def:2,spe:32},
  ['Dazzling Gleam','Expanding Force','Mystical Fire','Trick']),
 sash_timid_c32:set('Indeedee','Focus Sash','Psychic Surge','Timid',{hp:2,spa:32,spe:32},
  ['Dazzling Gleam','Expanding Force','Mystical Fire','Trick Room']),
 quickclaw_timid_c32:set('Indeedee','Quick Claw','Psychic Surge','Timid',{hp:2,spa:32,spe:32},
  ['Dazzling Gleam','Expanding Force','Mystical Fire','Trick'])
};
const CHARIZARD_Y_HYPOTHESIS=set('Charizard','Charizardite Y','Blaze','Timid',{hp:2,spa:32,spe:32},
 ['Flamethrower','Solar Beam','Air Slash','Roost']);
const GYARADOS_SITRUS_HYPOTHESIS=set('Gyarados','Sitrus Berry','Intimidate','Jolly',{hp:2,atk:32,spe:32},
 ['Dragon Dance','Waterfall','Earthquake','Taunt']);

// One engine battle with full teams of six; picks the listed slots and
// returns the omniscient log after the given choices. Engine-only harness.
function engineBattle(sim,p1,p2,seed,turns,pick1='123',pick2='123'){
 const b=new sim.Battle({formatid:FORMAT,seed});
 b.setPlayer('p1',{name:'p1',team:normalize(p1)});
 b.setPlayer('p2',{name:'p2',team:normalize(p2)});
 b.choose('p1','team '+pick1);b.choose('p2','team '+pick2);
 for(const [c1,c2] of turns){if(b.ended)break;b.choose('p1',c1);b.choose('p2',c2);}
 return b;
}
// Pad a lead set to six legal-looking members so team preview works.
function padTo6(lead,filler){
 const out=[lead];
 for(const p of filler){if(out.length===6)break;
  if(!out.some(x=>x.species===p.species||x.item===p.item))out.push(structuredClone(p));}
 if(out.length!==6)throw Error('could not pad '+lead.species);
 return out;
}
const FILLER=()=>[...provisional(),...cycle3().C_rill_gholdengo_for_gengar];

// WHAT-IF ONLY (not wired into any policy): the selecting side scores its OWN
// Mega holder with the Mega form and its Drought, i.e. information that side
// already knows. Used to test the root-cause hypothesis for Charizard cuts.
function ownMegaAwareMatchup(dex,p,foe,move){
 const stone=dex.items.get(p.item).megaStone;
 const form=stone&&(stone[p.species]||Object.values(stone)[0]);
 let v=matchup(dex,form?{...p,species:form}:p,foe,move);
 const ability=form?dex.species.get(form).abilities['0']:p.ability;
 const type=dex.moves.get(move).type;
 if(ability==='Drought')v*=type==='Fire'?1.5:type==='Water'?0.5:1;
 return v;
}
// Exact selection probability of the stochastic policy for a given scorer,
// mirroring choosePreview's constants (range 20, top 8, temperature 8).
function stochasticProbability(dex,team,otherSix,species,scorer){
 const {rankPreview}=require('./preview-policy');
 const ranked=rankPreview(dex,team,otherSix,scorer);
 const best=ranked[0].score,pl=ranked.filter(x=>x.score>=best-20).slice(0,8);
 const w=pl.map(x=>Math.exp((x.score-best)/8)),W=w.reduce((a,b)=>a+b,0);
 return pl.reduce((a,x,i)=>a+(x.three.some(k=>team[k].species===species)?w[i]/W:0),0);
}
// Preview choice frequencies through the REAL policy code paths (sampled).
function selectionRate(sim,team,otherSix,policy,species,n=400){
 const dex=sim.Dex.mod('champions');
 const pick=policy==='strategic'?chooseStrategicPreview:choosePreview;
 let hit=0;
 for(let i=0;i<n;i++){
  const chosen=pick(dex,team,otherSix,seededRandom([i+1,i+7,i+13,i+29],'p2'),matchup);
  hit+=Number(chosen.some(k=>team[k-1].species===species));
 }
 return hit/n;
}

function main(){
 const sim=load(),dex=sim.Dex.mod('champions');
 const {incomingRisk}=require('./damage');
 const {publicThreat}=require('./threat');
 const out=[];
 const live=reportedLive(),hyd=live.find(p=>p.species==='Hydreigon');
 out.push('# Hybrid-01 audit reproductions ('+FORMAT+')');
 out.push('\n## B: Indeedee vs reported Hydreigon (engine, 40 seeds each)');
 for(const [name,ind] of Object.entries(INDEEDEE_HYPOTHESES)){
  let first=0,ko=0;
  for(let i=0;i<40;i++){
   const b=engineBattle(sim,padTo6(hyd,FILLER()),padTo6(ind,FILLER()),[i+1,7,11,13],[['move 2','move 1']]);
   const moves=b.log.filter(l=>l.startsWith('|move|'));
   first+=Number(Boolean(moves[0]?.startsWith('|move|p2a')));
   ko+=Number(b.log.some(l=>l.startsWith('|faint|p1a: Hydreigon')));
  }
  out.push('- HYPOTHESIS '+name+': Indeedee acted first '+first+'/40, Hydreigon fainted on turn 1 '+ko+'/40');
 }
 out.push('- AI incomingRisk(Hydreigon<-Indeedee), nothing revealed: '+incomingRisk(dex,hyd,'Indeedee',{}).toFixed(2)+
  ' (1.00 = lethal); after Dazzling Gleam is seen: '+incomingRisk(dex,hyd,'Indeedee',{seenMoves:['Dazzling Gleam']}).toFixed(2));
 out.push('- preview publicThreat(Hydreigon<-Indeedee)='+publicThreat(dex,'Hydreigon','Indeedee').toFixed(0)+
  ' — STAB-only, no speed term anywhere in preview-policy/threat/damage/decision-v2');
 out.push('\n## Opponent preview: P(select own Charizard-Y) with repo stress six sun_charizard_y');
 const sun=threatSixes.sun_charizard_y;
 for(const [label,team] of [['E',cycle3().E_ee_primarina_for_skeledirge],['C',cycle3().C_rill_gholdengo_for_gengar],['reported live six',live]]){
  const six=team.map(p=>p.species);
  out.push('- vs '+label+': stochastic '+selectionRate(sim,sun,six,'stochastic','Charizard').toFixed(2)+
   ', strategic '+selectionRate(sim,sun,six,'strategic','Charizard').toFixed(2)+
   ' | exact stochastic '+stochasticProbability(dex,sun,six,'Charizard',matchup).toFixed(2)+
   ' -> WHAT-IF own-Mega/Drought-aware '+stochasticProbability(dex,sun,six,'Charizard',ownMegaAwareMatchup).toFixed(2));
 }
 const cz=sun.find(p=>p.species==='Charizard');
 out.push('- preview matchup(Charizard Flamethrower -> Rillaboom): base form '+matchup(dex,cz,'Rillaboom','Flamethrower').toFixed(0)+
  ' vs Mega-Y form '+matchup(dex,{...cz,species:'Charizard-Mega-Y'},'Rillaboom','Flamethrower').toFixed(0)+
  ' (Drought x1.5 not applied either way)');
 console.log(out.join('\n'));
}
if(require.main===module)main();
module.exports={REAL_CASES,INDEEDEE_HYPOTHESES,CHARIZARD_Y_HYPOTHESIS,GYARADOS_SITRUS_HYPOTHESIS,
 engineBattle,padTo6,FILLER,selectionRate,stochasticProbability,ownMegaAwareMatchup,set};
