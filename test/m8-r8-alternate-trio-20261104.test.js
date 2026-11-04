'use strict';
// Preregistered at PR #104 comment #6622494951 before observing any result.
// R8's three formerly 0/4 opponent triples, under same PUBLIC six.
// Own three and lead fixed without hidden rival three; vary opponent T1
// autonomous vs legal-public-damage move. Synthetic AI is not human.
const test=require('node:test'),assert=require('node:assert/strict');
const {load,normalize,hashSeed,matchup}=require('../lab');
const {build}=require('../m8-r8-dual-setup-lucario');
const {groups}=require('../environment-m7-teams');
const {battle,earlyLines}=require('../encore-lead-audit');
const clone=x=>structuredClone(x),skip=!process.env.SHOWDOWN_DIR&&'SHOWDOWN_DIR unavailable';
const cases=[
 {id:'sun',six:()=>groups[2].team,
  foe:[['Charizard','Garchomp','Mimikyu'],['Garchomp','Primarina','Gholdengo']],
  own:{
   S0:['Rotom-Heat','Garchomp','Mimikyu'],
   S1:['Garchomp','Rotom-Heat','Lucario'],
   S2:['Garchomp','Rotom-Heat','Primarina'],
   S3:['Mimikyu','Garchomp','Primarina']
  }},
 {id:'gyarados',six:()=>groups[8].team,
  foe:[['Gyarados','Garchomp','Mimikyu'],['Mimikyu','Gholdengo','Corviknight']],
  own:{
   G0:['Rotom-Heat','Garchomp','Lucario'],
   G1:['Rotom-Heat','Mimikyu','Rillaboom'],
   G2:['Rillaboom','Rotom-Heat','Mimikyu'],
   G3:['Rotom-Heat','Garchomp','Mimikyu']
  }},
 {id:'charX',six:()=>groups[3].team,
  foe:[['Charizard','Garchomp','Mimikyu'],['Primarina','Baxcalibur','Gholdengo']],
  own:{
   X0:['Garchomp','Mimikyu','Primarina'],
   X1:['Mimikyu','Garchomp','Lucario'],
   X2:['Primarina','Mimikyu','Lucario'],
   X3:['Mimikyu','Garchomp','Primarina']
  }}
];
function publicAttack(req,bot,info){
 if(info.turn!==1||req.teamPreview||req.forceSwitch)return null;
 const a=req.active?.[0],self=req.side?.pokemon?.find(x=>x.active);
 if(!a||!self)return null;
 const p=bot.getSet(self),foe=bot.foeActive;
 const moves=a.moves.map((m,i)=>({m,i})).filter(x=>!x.m.disabled&&x.m.pp>0&&bot.dex.moves.get(x.m.id||x.m.move).category!=='Status')
  .map(x=>({...x,value:matchup(bot.dex,p,foe,x.m.id||x.m.move)}))
  .sort((x,y)=>y.value-x.value||x.i-y.i);
 return moves.length?'move '+(moves[0].i+1)+(a.canMegaEvo?' mega':''):null;
}
test('R8 public-six-only 3+lead alternatives and rival triples M-C legal',{skip},()=>{
 const v=load().TeamValidator.get('gen9championsbssregmc'),team=build();
 assert.ok(!v.validateTeam(normalize(team))?.length,'R8 full six');
 assert.equal(cases.length,3);
 for(const c of cases){
  const enemy=c.six();assert.ok(!v.validateTeam(normalize(enemy))?.length,c.id+' rival');
  assert.equal(Object.keys(c.own).length,4);assert.equal(c.foe.length,2);
  for(const t of Object.values(c.own)){
   assert.equal(new Set(t).size,3);
   assert.ok(t.every(s=>team.some(p=>p.species===s)),c.id+' own');
  }
  for(const t of c.foe){
   assert.equal(new Set(t).size,3);
   assert.ok(t.every(s=>enemy.some(p=>p.species===s)),c.id+' foe');
  }
 }
});
test('R8 three 0/4 branches: 192 predeclared full Battles with fixed public six, two rival actions',{skip},async t=>{
 const sim=load(),team=build(),rows=[];let games=0,errors=0;
 for(const [ci,c] of cases.entries())for(const [ei,foeThree] of c.foe.entries())
 for(const [label,ourThree] of Object.entries(c.own))
 for(const policy of ['autonomous','public-attack-T1']){
  const obs=[];
  for(let si=0;si<2;si++)for(const reverse of [false,true]){
   const seed=hashSeed(11050200+ci*1000+ei*100+si);
   const r=await battle(sim,clone(team),clone(c.six()),seed,{
    ownThree:ourThree,foeThree,reverse,
    script:policy==='public-attack-T1'?publicAttack:null,
    rivalImmuneAware:true});
   games++;errors+=r.errors;assert.equal(r.errors,0,c.id+'/'+label+'/'+policy);
   obs.push({won:r.won,turns:r.turns,early:earlyLines(r.log,r.ownSide,4)});
  }
  rows.push({publicSix:c.id,foeThree,label,ourThree,policy,
   wins:obs.filter(x=>x.won).length,losses:obs.filter(x=>!x.won).length,
   firstLoss:obs.find(x=>!x.won)?.early?.slice(0,30)});
 }
 assert.equal(games,192);assert.equal(errors,0);assert.equal(rows.length,48);
 t.diagnostic('M8_R8_ALTERNATE_192 '+JSON.stringify({
  preregistered:'PR104 #6622494951',games,errors,rows,
  noHiddenEnemyThreeAtSelection:true,notHumanWinRate:true,
  heuristicOpponentNotCertified:true}));
});
