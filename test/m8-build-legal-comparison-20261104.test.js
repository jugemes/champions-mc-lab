'use strict';
// M-8 construction gate: compare actually legal complete sixes before making
// any claim of improved ranked strength. No scripted rival or simulated wins.
// This is a construction gate; strategic superiority needs separate battle evidence.
const test=require('node:test');
const assert=require('node:assert/strict');
const {load,prelim,normalize}=require('../lab');
const {reportedLive}=require('../reported-live-roster-20261027');
const skip=!process.env.SHOWDOWN_DIR&&'SHOWDOWN_DIR unavailable';
function byName(s){return reportedLive().find(p=>p.species===s);}
function replaceMove(team,species,oldMove,newMove){
 const p=team.find(x=>x.species===species);assert.ok(p,species);
 assert.ok(p.moves.includes(oldMove),species+': missing '+oldMove);
 p.moves=p.moves.map(m=>m===oldMove?newMove:m);
 return team;
}
function heat(team){
 const p=team.find(x=>x.species==='Rotom-Wash');assert.ok(p);
 p.species='Rotom-Heat';p.moves=p.moves.map(m=>m==='Hydro Pump'?'Overheat':m);
 return team;
}
function mimikyu(team,replaced){
 const i=team.findIndex(x=>x.species===replaced);assert.ok(i>=0);
 team[i]={species:'Mimikyu',item:'Lum Berry',ability:'Disguise',
  nature:'Jolly',evs:{hp:2,atk:32,spe:32},
  moves:['Play Rough','Shadow Sneak','Swords Dance','Shadow Claw']};
 return team;
}
const variants={
 A_reported:()=>reportedLive(),
 A_nastyPlot:()=>replaceMove(reportedLive(),'Hydreigon','Flash Cannon','Nasty Plot'),
 A_calmMind:()=>replaceMove(reportedLive(),'Primarina','Aqua Jet','Calm Mind'),
 H_heat:()=>heat(reportedLive()),
 H_nastyPlot:()=>replaceMove(heat(reportedLive()),'Hydreigon','Flash Cannon','Nasty Plot'),
 M_noSand:()=>mimikyu(reportedLive(),'Tyranitar'),
 TM_sand_noHydreigon:()=>mimikyu(reportedLive(),'Hydreigon'),
 TM_sand_noScarfGarchomp:()=>mimikyu(reportedLive(),'Garchomp')
};
test('M-8: validate full six, items, 66-point builds and moves under pinned Champions M-C',{skip},t=>{
 const sim=load(),validator=sim.TeamValidator.get('gen9championsbssregmc');
 const rows=[];
 for(const [name,make] of Object.entries(variants)){
  const team=make();
  assert.equal(team.length,6,name);
  assert.doesNotThrow(()=>prelim(team,name),name);
  const problems=validator.validateTeam(normalize(team));
  assert.ok(!problems?.length,name+': '+JSON.stringify(problems));
  rows.push({name,hasSand:team.some(p=>p.ability==='Sand Stream'),
   hasWash:team.some(p=>p.species==='Rotom-Wash'),
   hasHeat:team.some(p=>p.species==='Rotom-Heat'),
   hasMimikyu:team.some(p=>p.species==='Mimikyu'),
   hasChoiceScarf:team.some(p=>p.item==='Choice Scarf'),
   hasSetupMove:team.some(p=>p.moves.some(m=>['Nasty Plot','Calm Mind','Swords Dance'].includes(m))),
   species:team.map(p=>p.species),
   setup:team.flatMap(p=>p.moves.filter(m=>['Nasty Plot','Calm Mind','Swords Dance'].includes(m)).map(m=>p.species+':'+m))});
 }
 // Recorded, Nasty Plot and Heat options preserve sand without breeding a new species.
 for(const name of ['A_reported','A_nastyPlot','A_calmMind','H_heat','H_nastyPlot']){
  assert.equal(rows.find(x=>x.name===name).hasSand,true);
 }
 assert.equal(rows.find(x=>x.name==='M_noSand').hasSand,false);
 for(const name of ['TM_sand_noHydreigon','TM_sand_noScarfGarchomp']){
  const r=rows.find(x=>x.name===name);assert.ok(r.hasSand&&r.hasMimikyu);
 }
 t.diagnostic('M8_BUILD_LEGALITY '+JSON.stringify({engine:'pinned Showdown Champions M-C',
  evaluations:rows,notPerformanceTest:true,adoption:'none'}));
});
