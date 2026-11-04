'use strict';
// Predeclared PR #104 comment #6621342503. R5 public-six preview decisions
// must not access opponent actual selected three or unrevealed item/moves.
const test=require('node:test'),assert=require('node:assert/strict');
const {load,normalize,hashSeed,matchup}=require('../lab');
const {build}=require('../m8-r5-balanced-threat-rebuild');
const {groups}=require('../environment-m7-teams');
const {battle,earlyLines}=require('../encore-lead-audit');
const skip=!process.env.SHOWDOWN_DIR&&'SHOWDOWN_DIR unavailable';
// Research-only; no rank adoption or policy change.\nconst clone=x=>structuredClone(x);
const cases=[
 {id:'lucarioZ',team:()=>groups[1].team,
  rival:[['Lucario','Garchomp','Mimikyu'],['Corviknight','Primarina','Archaludon']],
  own:[['Primarina','Metagross','Rotom-Heat'],
       ['Rotom-Heat','Primarina','Gholdengo'],
       ['Gholdengo','Metagross','Rotom-Heat']]},
 {id:'gyarados',team:()=>groups[8].team,
  rival:[['Gyarados','Garchomp','Mimikyu'],['Mimikyu','Gholdengo','Corviknight']],
  own:[['Rotom-Heat','Baxcalibur','Metagross'],
       ['Metagross','Baxcalibur','Rotom-Heat'],
       ['Primarina','Baxcalibur','Metagross']]}
];
function publicAttack(req,bot,info){
 if(info.turn!==1||req.teamPreview||req.forceSwitch)return null;
 const act=req.active?.[0],p=req.side?.pokemon?.find(x=>x.active);
 if(!act||!p)return null;
 const self=bot.getSet(p),foe=bot.foeActive;
 const rows=act.moves.map((m,i)=>({m,i})).filter(x=>!x.m.disabled&&x.m.pp>0&&bot.dex.moves.get(x.m.id||x.m.move).category!=='Status')
  .map(x=>({...x,score:matchup(bot.dex,self,foe,x.m.id||x.m.move)}));
 rows.sort((a,b)=>b.score-a.score||a.i-b.i);
 return rows.length?'move '+(rows[0].i+1)+(act.canMegaEvo?' mega':''):null;
}
test('M8 R5 targeted selected-three counterfactual only uses own legal preview',{skip},()=>{
 const v=load().TeamValidator.get('gen9championsbssregmc'),team=build();
 assert.ok(!v.validateTeam(normalize(team))?.length);
 for(const c of cases){
  const rival=c.team();assert.ok(!v.validateTeam(normalize(rival))?.length,c.id);
  for(const three of c.own){
   assert.equal(new Set(three).size,3);
   assert.ok(three.every(s=>team.some(p=>p.species===s)));
  }
  for(const three of c.rival){
   assert.equal(new Set(three).size,3);
   assert.ok(three.every(s=>rival.some(p=>p.species===s)));
  }
 }
});
test('M8 R5 Lucario/Gyarados: 96 frozen alternative preview three-and-lead full Battles',{skip},async t=>{
 const sim=load(),own=build(),rows=[];let battles=0,errors=0;
 for(const [ci,c] of cases.entries())
 for(const [ei,foeThree] of c.rival.entries())
 for(const [oi,ownThree] of c.own.entries())
 for(const [pi,policy] of ['autonomous','public-attack-T1'].entries()){
  const obs=[];
  for(let si=0;si<2;si++)for(const reverse of [false,true]){
   const seed=hashSeed(11049700+ci*1000+ei*100+si);
   const r=await battle(sim,clone(own),clone(c.team()),seed,{
    ownThree,foeThree,reverse,
    script:policy==='public-attack-T1'?publicAttack:null,rivalImmuneAware:true});
   battles++;errors+=r.errors;assert.equal(r.errors,0,c.id+'/'+ownThree.join('/'));
   obs.push({won:r.won,turns:r.turns,early:earlyLines(r.log,r.ownSide,3)});
  }
  rows.push({publicSix:c.id,foeThree,ourThree:ownThree,lead:ownThree[0],policy,
   wins:obs.filter(x=>x.won).length,losses:obs.filter(x=>!x.won).length,
   sampleLoss:obs.find(x=>!x.won)?.early?.slice(0,35)});
 }
 assert.equal(battles,96);assert.equal(errors,0);
 t.diagnostic('M8_R5_LUCARIO_GYARADOS_PREVIEW '+JSON.stringify({
  registered:'PR104 #6621342503',battles,errors,rows,
  noOpponentHiddenSelectionAtPreview:true,notHumanWinRate:true,
  botRationalityNotCertified:true}));
});
