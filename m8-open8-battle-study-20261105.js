'use strict';
// Prospective protocol: docs/M8-OPEN8-PROTOCOL-2026-11-05.md.
// Offline training over registered hypotheses; never feed actual enemy 3
// into a live selector. Frozen selection is evaluated on disjoint seeds.
const fs=require('node:fs');
const {execFileSync}=require('node:child_process');
const {load,normalize,prelim,hashSeed}=require('./lab');
const {combinations}=require('./m8-open7-public-three-minimax-20261105');
const {chooseByBranchOutcomes}=require('./m8-open8-branch-outcome-minimax-20261105');
const {reportedLive}=require('./reported-live-roster-20261027');
const {builders}=require('./m8-open1-20261104');
const {groups}=require('./environment-m7-teams');
const {archetypes}=require('./fixtures');
const {opponents}=require('./holdout-opponents');
const {battle,rivalScript,earlyLines}=require('./encore-lead-audit');
const {misplaysV3}=require('./misplay-tags-v3');
const PIN='3a766f2cfb5e51c1e428cfe87d0dba91a8f01640';
const FORMAT='gen9championsbssregmc';
const clone=x=>structuredClone(x);
function candidates(){
 const a=reportedLive(),np=reportedLive(),h=reportedLive();
 np.find(p=>p.species==='Hydreigon').moves[3]='Nasty Plot';
 const rot=h.find(p=>p.species==='Rotom-Wash');
 rot.species='Rotom-Heat';rot.moves=rot.moves.map(m=>m==='Hydro Pump'?'Overheat':m);
 return {A_reported:a,A_NP:np,H_heat:h,
  O1_selection_retest:builders.O1_megaMence_flexible(),
  O2_selection_retest:builders.O2_megaMetagross_unaware()};
}
function cases(){
 const raw=[
 ['sun',groups[2].team,['Charizard','Garchomp','Mimikyu'],['Garchomp','Primarina','Gholdengo']],
 ['rain',archetypes.rain,['Pelipper','Swampert','Archaludon'],['Pelipper','Gholdengo','Rillaboom']],
 ['mence',groups[4].team,['Salamence','Garchomp','Mimikyu'],['Hippowdon','Primarina','Gholdengo']],
 ['lucarioZ',groups[1].team,['Lucario','Garchomp','Mimikyu'],['Corviknight','Primarina','Archaludon']],
 ['gyarados',groups[8].team,['Gyarados','Garchomp','Mimikyu'],['Mimikyu','Gholdengo','Corviknight']],
 ['megaGolisopod',groups[0].team,['Golisopod','Garchomp','Mimikyu'],['Hippowdon','Primarina','Gholdengo']],
 ['psychic',groups[10].team,['Indeedee','Gengar','Dragonite'],['Gholdengo','Volcarona','Rillaboom']],
 ['volcarona',groups[13].team,['Salamence','Volcarona','Dragonite'],['Gholdengo','Skeledirge','Rillaboom']],
 ['stall',groups[12].team,['Toxapex','Umbreon','Corviknight'],['Slowbro','Skarmory','Gholdengo']],
 ['charX',groups[3].team,['Charizard','Garchomp','Mimikyu'],['Primarina','Baxcalibur','Gholdengo']],
 ['steelBunker',opponents.steel_bunker,['Gholdengo','Archaludon','Corviknight'],['Skeledirge','Garchomp','Gengar']],
 ['hazardShift',opponents.hazard_shift,['Toxapex','Skarmory','Dragonite'],['Slowbro','Gholdengo','Lucario']],
 ['multiMega',opponents.multi_mega_offense,['Gengar','Lucario','Golisopod'],['Starmie','Volcarona','Rillaboom']],
 ['rainPivot',opponents.rain_pivot,['Pelipper','Swampert','Archaludon'],['Toxapex','Volcarona','Starmie']],
 ['mixedElectric',opponents.mixed_electric,['Eelektross','Garchomp','Volcarona'],['Primarina','Rillaboom','Gholdengo']]
 ];
 return raw.map(([id,team,a,b])=>({id,team:clone(team),branches:[
  {id:'A',three:a,policy:'ai'},{id:'B',three:b,policy:'ai'},
  ...(id==='sun'?[
   {id:'Y_back_Garchomp',three:['Garchomp','Charizard','Mimikyu'],policy:'ai'},
   {id:'Y_back_Mimikyu',three:['Mimikyu','Charizard','Garchomp'],policy:'ai'}]:[]),
  ...(id==='gyarados'?[{id:'Gyarados_switch_Garchomp',three:a,policy:'switch'}]:[])
 ]}));
}
function validate(sim,team,label){
 prelim(team,label);
 const errors=sim.TeamValidator.get(FORMAT).validateTeam(normalize(team));
 if(errors?.length)throw Error(label+': '+errors.join('; '));
}
function choices(team){return combinations(team.map(p=>p.species)).flatMap(three=>three.map(lead=>({three,lead})));}
function order({three,lead}){return [lead,...three.filter(s=>s!==lead)];}
async function runOne(sim,team,c,selection,b,seed,reverse){
 const r=await battle(sim,clone(team),clone(c.team),seed,{
  ownThree:order(selection),foeThree:b.three,reverse,
  script:b.openingMove?((req,bot,info)=>{
   if(info.turn!==1)return null;
   const i=req.active?.[0]?.moves.findIndex(m=>!m.disabled&&m.move===b.openingMove);
   return i>=0?'move '+(i+1):null;
  }):b.policy==='switch'?rivalScript('switch','stay',sim.Dex.mod('champions')):null,
  rivalImmuneAware:true,choiceAudit:true});
 if(r.errors)throw Error('choice errors '+c.id+'/'+b.id);
 const actual=r.foe.map(x=>typeof x==='string'?x:x.species);
 // The runner's existing forced-three selection is audited in its tests;
 // retain the actual trace here to permit independent inspection.
 return {won:r.won,turns:r.turns,actualFoe:actual,
  tags:misplaysV3(r.log,{requests:r.reqLog}),
  early:earlyLines(r.log,r.ownSide,8),
  choices:r.choiceTrace.filter(x=>x.turn<=3),
  observedSun:r.log.includes('|-weather|SunnyDay'),
  observedRain:r.log.includes('|-weather|RainDance')};
}
async function study({sim=load(),teams=candidates(),scenarios=cases(),out='output/m8-open8-battle-study-20261105.json',enforcePin=true,seedOffset=0}={}){
 if(!Number.isSafeInteger(seedOffset)||seedOffset<0||seedOffset>5000000)throw Error('Invalid seed offset');
 const sha=execFileSync('git',['-C',process.env.SHOWDOWN_DIR,'rev-parse','HEAD'],{encoding:'utf8'}).trim();
 if(enforcePin&&sha!==PIN)throw Error('Wrong Showdown SHA '+sha);
 const result={protocol:'M8-OPEN8-20261105-v1',seedOffset,showdown:sha,format:FORMAT,
  limitations:['Offline fitted selections, not a hidden-information live policy','Known constructed opponent sets; new seeds are not unseen sets','Heuristic actions and script branches do not certify rational play','Bot outcomes are not human win rates','Official in-game legality still requires rule/roster cross-check','Claude OPEN8 independent audit not received'],teams,scenarios,rows:[],games:0,complete:false};
 const save=()=>{fs.mkdirSync(require('node:path').dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(result,null,2));};
 for(const [name,team] of Object.entries(teams))validate(sim,team,name);
 for(const c of scenarios)validate(sim,c.team,c.id);
 save();
 for(const [name,team] of Object.entries(teams))for(const [ci,c] of scenarios.entries()){
  const outcomes=[];
  for(const choice of choices(team))for(const [bi,b] of c.branches.entries()){
   let wins=0;
   for(const reverse of [false,true]){
    const r=await runOne(sim,team,c,choice,b,hashSeed(18081100+seedOffset+ci*100+bi),reverse);
    result.games++;wins+=Number(r.won);
   }
   outcomes.push({...choice,branch:b.id,score:wins/2});
  }
  const fitted=chooseByBranchOutcomes({ownSix:team.map(p=>p.species),publicSix:c.team.map(p=>p.species),branches:c.branches,outcomes});
  if(fitted.coverage.completeChoices!==60)throw Error('Incomplete training');
  const selected=clone(fitted.selected),held=[];
  // This choice is frozen BEFORE either independent seed or side is run.
  for(const [bi,b] of c.branches.entries()){
   const observations=[];
   for(let si=0;si<2;si++)for(const reverse of [false,true]){
    const seed=hashSeed(28082200+seedOffset+ci*1000+bi*100+si);
    const r=await runOne(sim,team,c,selected,b,seed,reverse);
    result.games++;observations.push({seed,reverse,...r});
   }
   held.push({branch:b.id,three:b.three,wins:observations.filter(r=>r.won).length,n:4,observations});
  }
  const row={candidate:name,publicSix:c.id,selected,coverage:fitted.coverage,trainingOutcomes:outcomes,held};
  result.rows.push(row);save();
  console.log(JSON.stringify({candidate:name,publicSix:c.id,three:order(selected),trainWorst:selected.worst,held:held.map(b=>[b.branch,b.wins,b.n]),games:result.games}));
 }
 result.complete=true;save();return result;
}
if(require.main===module)study().catch(e=>{console.error(e.stack);process.exitCode=1;});
module.exports={candidates,cases,choices,order,validate,runOne,study,PIN,FORMAT};
