'use strict';
// PR #104 comment #6626001313. Blind gyarados public-six selection search:
// two FULL sixes already built, five three/lead plans EACH, same public six,
// enemy A or B hidden 3, rational A switch or B attack vs autonomous.
// 2 builds x 5 plans x 2 enemy trios x 2 enemy T1 policies x 2 seeds x 2 sides
// = 160 pinned M-C full Battles, no hidden information to our selection.
const test=require('node:test'),assert=require('node:assert/strict');
const {load,normalize,prelim,hashSeed}=require('../lab');
const {builders}=require('../m8-open1-20261104');
const {groups}=require('../environment-m7-teams');
const {battle,rivalScript,earlyLines}=require('../encore-lead-audit');
const clone=x=>structuredClone(x),skip=!process.env.SHOWDOWN_DIR&&'SHOWDOWN_DIR unavailable';
const six=()=>groups[8].team; // Gyarados/GarchompZ/Mimikyu/Gholdengo/Corviknight/Baxcalibur
const rivals=[['Gyarados','Garchomp','Mimikyu'],['Mimikyu','Gholdengo','Corviknight']];
const plans={
 O1_megaMence_flexible:[
  ['Rotom-Heat','Mimikyu','Gholdengo'],
  ['Mimikyu','Rotom-Heat','Gholdengo'],
  ['Gholdengo','Rotom-Heat','Mimikyu'],
  ['Salamence','Rotom-Heat','Mimikyu'],
  ['Primarina','Mimikyu','Rotom-Heat']],
 O2_megaMetagross_unaware:[
  ['Rotom-Wash','Baxcalibur','Gholdengo'],
  ['Baxcalibur','Rotom-Wash','Gholdengo'],
  ['Gholdengo','Rotom-Wash','Baxcalibur'],
  ['Skeledirge','Rotom-Wash','Baxcalibur'],
  ['Metagross','Rotom-Wash','Baxcalibur']]
};
test('M8 OPEN1 10 blind gyarados lead alternatives legal, same published opponent six',{skip},()=>{
 const v=load().TeamValidator.get('gen9championsbssregmc');
 assert.ok(!v.validateTeam(normalize(six()))?.length,'foe six legal');
 for(const [name,arr] of Object.entries(plans)){
  const own=builders[name]();prelim(own,name);
  assert.ok(!v.validateTeam(normalize(own))?.length,name+' own legal');
  assert.equal(arr.length,5);
  for(const t of arr){
   assert.equal(t.length,3);
   assert.equal(new Set(t).size,3);
   assert.ok(t.every(p=>own.some(s=>s.species===p)),name+' three of public own six');
  }
 }
});
test('M8 OPEN1 gyarados 2 full six x 5 fixed 3+lead x 2 enemy 3 x 2 T1 policies x seed2 x side2: 160 full',{skip},async t=>{
 const sim=load(),dex=sim.Dex.mod('champions'),rows=[];let games=0,errors=0;
 for(const [name,choices] of Object.entries(plans))
 for(const [pi,ourThree] of choices.entries())
 for(const [ei,foeThree] of rivals.entries())
 for(const policy of ['autonomous','rationalAlternative']){
  const script=policy==='autonomous'?null:rivalScript(ei===0?'switch':'attack','stay',dex);
  const obs=[];
  for(let si=0;si<2;si++)for(const reverse of [false,true]){
   const seed=hashSeed(12310000+ei*1000+si);
   const r=await battle(sim,clone(builders[name]()),clone(six()),seed,{
    ownThree,foeThree,reverse,script,rivalImmuneAware:true,choiceAudit:true});
   games++;errors+=r.errors;assert.equal(r.errors,0,name+' p'+pi+' enemy'+ei+policy);
   obs.push({won:r.won,firstLoss:!r.won?earlyLines(r.log,r.ownSide,6).slice(0,29):undefined});
  }
  rows.push({build:name,plan:pi,ownThree,enemy3:ei,policy,wins:obs.filter(o=>o.won).length,
   firstLoss:obs.find(o=>!o.won)?.firstLoss});
 }
 assert.equal(games,160);assert.equal(errors,0);assert.equal(rows.length,40);
 t.diagnostic('M8_OPEN1_GYARA_PLANS_160 '+JSON.stringify({
  preregistered:'PR #104 issuecomment #6626001313',games,errors,rows,
  noHiddenOpponentSelectionAtOwnPreview:true,
  rationalA:'T1 Gyarados to Garchomp',rationalB:'T1 strongest legal public attack',
  perCell:'2 seeds x side swap, NOT 4 independent human actions'}));
});
