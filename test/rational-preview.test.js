'use strict';
// Issue #4 (P0-A): own Mega form / own weather at team preview, one Mega per
// trio, no hidden opposing information, and reproducibility of old policies.
const test=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const {ownForm,ownMatchup,ownExposure,megaFormOf,ownStat}=require('../own-form');
const R=require('../preview-rational');
const {rankPreview,seededRandom}=require('../preview-policy');
const {matchup,game,hashSeed,Bot}=require('../lab');
const {opponents:threatSixes}=require('../threat-scenarios-20261014');
const {teams:cycle3}=require('../cycle3-teams');
const {reportedLive}=require('../reported-live-roster-20261027');
const A=require('../hybrid01-audit');
const sim=require(path.join(process.env.SHOWDOWN_DIR,'dist/sim/index.js'));
const dex=sim.Dex.mod('champions');
const sun=threatSixes.sun_charizard_y;
const charX=A.set('Charizard','Charizardite X','Blaze','Jolly',{hp:2,atk:32,spe:32},
 ['Dragon Dance','Flare Blitz','Dragon Claw','Earthquake']);
const sunX=sun.map(p=>p.species==='Charizard'?structuredClone(charX):structuredClone(p));

test('the held stone fixes our own Mega form, ability, typing and stats (X and Y differ)',()=>{
 const y=ownForm(dex,A.CHARIZARD_Y_HYPOTHESIS),x=ownForm(dex,charX);
 assert.deepEqual([y.species,y.ability,y.types.join('/')],['Charizard-Mega-Y','Drought','Fire/Flying']);
 assert.deepEqual([x.species,x.ability,x.types.join('/')],['Charizard-Mega-X','Tough Claws','Fire/Dragon']);
 assert.equal(ownForm(dex,A.CHARIZARD_Y_HYPOTHESIS,{mega:false}).species,'Charizard');
 assert.equal(megaFormOf(dex,{...A.CHARIZARD_Y_HYPOTHESIS,item:'Life Orb'}),'');
 const meta=reportedLive()[0];
 assert.equal(ownForm(dex,meta).species,'Metagross-Mega');
 assert.equal(ownStat(dex,meta,'spe'),178);
 assert.equal(ownStat(dex,meta,'spe',{mega:false}),134);
});
test('own Drought boosts own Fire and halves own Water; Solar Beam is halved without sun',()=>{
 const cz=A.CHARIZARD_Y_HYPOTHESIS;
 const plain=ownMatchup(dex,cz,'Rillaboom','Flamethrower',{weather:''});
 assert.ok(Math.abs(ownMatchup(dex,cz,'Rillaboom','Flamethrower',{weather:'sunnyday'})/plain-1.5)<1e-9);
 assert.ok(Math.abs(ownMatchup(dex,cz,'Swampert','Solar Beam',{weather:''})/
  ownMatchup(dex,cz,'Swampert','Solar Beam',{weather:'sunnyday'})-0.5)<1e-9);
 assert.ok(plain>matchup(dex,cz,'Rillaboom','Flamethrower')*1.4,'Mega-Y SpA instead of base');
 const pri=reportedLive()[2];
 assert.ok(ownMatchup(dex,pri,'Garchomp','Sparkling Aria',{weather:'sunnyday'})<
  ownMatchup(dex,pri,'Garchomp','Sparkling Aria',{weather:''}));
});
test('own sand raises our Rock Sp. Def; our known Levitate blocks Ground unless Mold Breaker is possible',()=>{
 const ttar=reportedLive()[4],rotom=reportedLive()[5];
 assert.ok(ownExposure(dex,ttar,'Primarina',{weather:'sandstorm'})<ownExposure(dex,ttar,'Primarina',{weather:''}));
 assert.ok(ownExposure(dex,rotom,'Hippowdon')<ownExposure(dex,{...rotom,ability:''},'Hippowdon'));
 assert.ok(ownExposure(dex,rotom,'Excadrill')>=ownExposure(dex,{...rotom,ability:''},'Excadrill'),
  'Excadrill may have Mold Breaker');
});
test('one Mega per trio: a trio with two stone holders is scored with exactly one Mega',()=>{
 const two=[A.CHARIZARD_Y_HYPOTHESIS,reportedLive()[0],...reportedLive().slice(1,5)];
 const ranked=R.rankRationalPreview(dex,two,cycle3().E_ee_primarina_for_skeledirge.map(p=>p.species));
 const both=ranked.find(c=>c.three.includes(0)&&c.three.includes(1));
 assert.ok([0,1].includes(both.mega));
 const other=both.mega===0?1:0;
 assert.ok(!R.explain(dex,two,cycle3().E_ee_primarina_for_skeledirge.map(p=>p.species),both).three
  .includes(undefined));
 assert.equal(ownForm(dex,two[other],{mega:false}).isMega,false);
});
test('rational preview reads only public species of the other side',()=>{
 const E=cycle3().E_ee_primarina_for_skeledirge;
 const a=R.rankRationalPreview(dex,sun,E.map(p=>p.species));
 const tampered=E.map(p=>({...p,item:'Leftovers',moves:['Splash']}));
 const b=R.rankRationalPreview(dex,sun,tampered.map(p=>p.species));
 assert.deepEqual(a.map(c=>[c.three,c.score,c.mega]),b.map(c=>[c.three,c.score,c.mega]));
});
test('no species special-casing: objective equals the stochastic policy where no Mega/weather/Solar Beam is involved',()=>{
 const noStone=sun.map(p=>p.species==='Charizard'?{...p,item:'Life Orb'}:p);
 const ci=noStone.findIndex(p=>p.species==='Charizard');
 const six=reportedLive().map(p=>p.species);
 const rational=R.rankRationalPreview(dex,noStone,six);
 const legacy=rankPreview(dex,noStone,six,matchup);
 const key=c=>c.three.join();
 let compared=0;
 for(const c of rational){
  if(c.three.includes(ci)){assert.equal(c.mega,null);continue;} // Solar Beam is halved without sun
  const l=legacy.find(x=>key(x)===key(c));
  assert.ok(Math.abs(c.score-l.score)<1e-6,key(c));compared++;
 }
 assert.equal(compared,10);
});
test('Y vs X hypotheses for the same public six give different, explained choices (no rate target)',()=>{
 const live=reportedLive().map(p=>p.species);
 const y=R.compareInclusion(dex,sun,live,'Charizard'),x=R.compareInclusion(dex,sunX,live,'Charizard');
 assert.notEqual(y.margin,x.margin);
 for(const c of [y.with,y.without,x.with,x.without]){
  assert.equal(c.three.length,3);
  assert.equal(c.counterRisk.length,3);
  assert.ok(c.weakestAnswer.foe);
 }
 const py=R.probabilityIncluding(R.rankRationalPreview(dex,sun,live),sun,'Charizard');
 const px=R.probabilityIncluding(R.rankRationalPreview(dex,sunX,live),sunX,'Charizard');
 assert.ok(py>=0&&py<=1&&px>=0&&px<=1);
});
test('chooseRationalPreview is seed reproducible and returns three distinct slots',()=>{
 const six=reportedLive().map(p=>p.species);
 for(let i=0;i<30;i++){
  const s=hashSeed(4040+i);
  const a=R.chooseRationalPreview(dex,sun,six,seededRandom(s,'p2'));
  assert.deepEqual(a,R.chooseRationalPreview(dex,sun,six,seededRandom(s,'p2')));
  assert.equal(new Set(a).size,3);
 }
});
test('after Mega Evolution the bot uses the Mega form ability (Mold Breaker), not the pre-Mega one',()=>{
 const gy=A.set('Gyarados','Gyaradosite','Intimidate','Jolly',{hp:2,atk:32,spe:32},
  ['Dragon Dance','Waterfall','Earthquake','Crunch']);
 const bot=new Bot(null,dex,A.padTo6(gy,A.FILLER()),'p1',{choices:[],selections:[],errors:[]});
 const v=bot.activeView({details:'Gyarados-Mega, L50, M',active:true,condition:'170/170'},{canMegaEvo:false});
 assert.deepEqual([v.my.species,v.my.ability],['Gyarados-Mega','Mold Breaker']);
});
test('lab runs the rational policy and a forced opponent three through Showdown',async()=>{
 const live=reportedLive();
 const forced=['Charizard','Garchomp','Primarina'];
 const g=await game(sim,live,sun,hashSeed(77),false,null,false,
  {previewPolicy:'rational',decisionPolicy:'v2',megaAware:true,opponentForced:forced});
 assert.deepEqual(g.trace.selections.find(s=>s.side==='p2').chosen,forced);
 assert.equal(g.trace.selections.find(s=>s.side==='p1').chosen.length,3);
 assert.equal(g.trace.errors.length,0);
});
