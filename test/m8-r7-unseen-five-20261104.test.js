'use strict';
// Predeclared before results: PR104 comment #6622278243.
// R7T versus R5 on five additional, previously R7-untested opponent sixes.
// Same own three per public-six across both hidden rival trio hypotheses.
// This is a synthetic counterexample audit, not a ranked win rate.
const test=require('node:test'),assert=require('node:assert/strict');
const {load,normalize,hashSeed,prelim,matchup}=require('../lab');
const {build:r5}=require('../m8-r5-balanced-threat-rebuild');
const {build:r7}=require('../m8-r7-grassy-scarf');
const {groups}=require('../environment-m7-teams');
const {battle,earlyLines}=require('../encore-lead-audit');
const clone=x=>structuredClone(x);
const skip=!process.env.SHOWDOWN_DIR&&'SHOWDOWN_DIR unavailable';
const cases=[
 {id:'megaGolisopod',six:()=>groups[0].team,
  rival:[['Golisopod','Garchomp','Mimikyu'],['Hippowdon','Primarina','Gholdengo']],
  own:{R5:['Primarina','Rotom-Heat','Metagross'],R7:['Rotom-Heat','Garchomp','Metagross']}},
 {id:'psychic',six:()=>groups[10].team,
  rival:[['Indeedee','Gengar','Dragonite'],['Gholdengo','Volcarona','Rillaboom']],
  own:{R5:['Gholdengo','Primarina','Baxcalibur'],R7:['Gholdengo','Primarina','Garchomp']}},
 {id:'volcarona',six:()=>groups[13].team,
  rival:[['Salamence','Volcarona','Dragonite'],['Gholdengo','Skeledirge','Rillaboom']],
  own:{R5:['Baxcalibur','Rotom-Heat','Metagross'],R7:['Garchomp','Rotom-Heat','Metagross']}},
 {id:'stall',six:()=>groups[12].team,
  rival:[['Toxapex','Umbreon','Corviknight'],['Slowbro','Skarmory','Gholdengo']],
  own:{R5:['Gholdengo','Rotom-Heat','Rillaboom'],R7:['Gholdengo','Rotom-Heat','Rillaboom']}},
 {id:'charX',six:()=>groups[3].team,
  rival:[['Charizard','Garchomp','Mimikyu'],['Primarina','Baxcalibur','Gholdengo']],
  own:{R5:['Rotom-Heat','Baxcalibur','Primarina'],R7:['Rotom-Heat','Garchomp','Primarina']}}
];
function publicAttack(req,bot,info){
 if(info.turn!==1||req.teamPreview||req.forceSwitch)return null;
 const act=req.active?.[0],p=req.side?.pokemon?.find(x=>x.active);
 if(!act||!p)return null;
 const me=bot.getSet(p),foe=bot.foeActive;
 const options=act.moves.map((m,i)=>({m,i}))
  .filter(x=>!x.m.disabled&&x.m.pp>0&&bot.dex.moves.get(x.m.id||x.m.move).category!=='Status')
  .map(x=>({...x,score:matchup(bot.dex,me,foe,x.m.id||x.m.move)}))
  .sort((a,b)=>b.score-a.score||a.i-b.i);
 return options.length?'move '+(options[0].i+1)+(act.canMegaEvo?' mega':''):null;
}
test('M8 R7 unseen-five public sixes / our trios / rival trios are fully M-C legal',{skip},()=>{
 const v=load().TeamValidator.get('gen9championsbssregmc');
 const builds={R5:r5(),R7:r7(true)};
 for(const [label,team] of Object.entries(builds)){
  assert.doesNotThrow(()=>prelim(team,label));
  assert.ok(!v.validateTeam(normalize(team))?.length,label+' our six legal');
 }
 for(const c of cases){
  const enemy=c.six();
  assert.ok(!v.validateTeam(normalize(enemy))?.length,c.id+' enemy six legal');
  for(const t of c.rival){
   assert.equal(new Set(t).size,3);
   assert.ok(t.every(s=>enemy.some(p=>p.species===s)));
  }
  for(const [label,t] of Object.entries(c.own)){
   assert.equal(new Set(t).size,3);
   assert.ok(t.every(s=>builds[label].some(p=>p.species===s)));
  }
 }
});
test('M8 R7 five additional blinded sixes versus R5: 160 full Battles',{skip},async t=>{
 const sim=load(),builds={R5:r5(),R7:r7(true)},rows=[];
 let games=0,errors=0;
 for(const [ci,c] of cases.entries())
 for(const [ei,foeThree] of c.rival.entries())
 for(const [label,team] of Object.entries(builds))
 for(const policy of ['autonomous','public-attack-T1']){
  const three=c.own[label],obs=[];
  for(let si=0;si<2;si++)for(const reverse of [false,true]){
   const seed=hashSeed(11050000+ci*1000+ei*100+si);
   const r=await battle(sim,clone(team),clone(c.six()),seed,{
    ownThree:three,foeThree,reverse,
    script:policy==='public-attack-T1'?publicAttack:null,rivalImmuneAware:true});
   games++;errors+=r.errors;
   assert.equal(r.errors,0,c.id+'/'+label+'/'+policy);
   obs.push({won:r.won,turns:r.turns,early:earlyLines(r.log,r.ownSide,3)});
  }
  rows.push({publicSix:c.id,foeThree,build:label,ownThree:three,policy,
   wins:obs.filter(x=>x.won).length,losses:obs.filter(x=>!x.won).length,
   lossExample:obs.find(x=>!x.won)?.early?.slice(0,30)});
 }
 assert.equal(games,160);assert.equal(errors,0);assert.equal(rows.length,40);
 t.diagnostic('M8_R7_UNSEEN_FIVE '+JSON.stringify({
  preregistered:'PR104 #6622278243',games,errors,rows,
  publicOnlyOwnSelection:true,heuristicOpponent:true,notHumanWinRate:true}));
});
