'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const {estimateDamage,moveUtility}=require('../damage');
const {evaluateMove}=require('../decision-v2');
const {variants}=require('../fixtures');
const {Bot}=require('../lab');
const sim=require(path.join(process.env.SHOWDOWN_DIR,'dist/sim/index.js'));
const dex=sim.Dex.mod('champions');
const garchomp=variants.C_master.find(p=>p.species==='Garchomp');
test('Grassy Terrain reduces Earthquake but never Stomping Tantrum on grounded foes',()=>{
 const a=estimateDamage(dex,garchomp,'Gholdengo','Earthquake');
 const b=estimateDamage(dex,garchomp,'Gholdengo','Earthquake',{terrain:'Grassy Terrain'});
 const c=estimateDamage(dex,garchomp,'Gholdengo','Stomping Tantrum');
 const d=estimateDamage(dex,garchomp,'Gholdengo','Stomping Tantrum',{terrain:'Grassy Terrain'});
 assert.ok(a.mid>b.mid*1.7);
 assert.equal(c.mid,d.mid);
 assert.ok(moveUtility(dex,garchomp,'Gholdengo','Stomping Tantrum',{terrain:'Grassy Terrain'})>
   moveUtility(dex,garchomp,'Gholdengo','Earthquake',{terrain:'Grassy Terrain'}));
});
test('without terrain Earthquake can remain the better ground option',()=>{
 assert.ok(evaluateMove(dex,garchomp,'Gholdengo','Earthquake',{ratio:1,foeHP:1,available:garchomp.moves})>
   evaluateMove(dex,garchomp,'Gholdengo','Stomping Tantrum',{ratio:1,foeHP:1,available:garchomp.moves}));
});
test('v2 bot avoids Grass-weakened Earthquake when non-weak alternative is in moves',()=>{
 const bot=new Bot(null,dex,variants.C_master,'p1',{choices:[],selections:[],errors:[]},null,null,{decisionPolicy:'v2'});
 bot.foeActive='Gholdengo';bot.foeHP=1;bot.terrain='grassyterrain';
 const moves=['Earthquake','Stomping Tantrum','Dragon Claw','Poison Jab'];
 const req={active:[{trapped:true,moves:moves.map(move=>({move,id:move.toLowerCase().replace(/[^a-z]/g,''),pp:12,disabled:false}))}],
  side:{pokemon:[{details:'Garchomp, L50',active:true,condition:'185/185'}]}};
 assert.equal(bot.decide(req),'move 2');
});
