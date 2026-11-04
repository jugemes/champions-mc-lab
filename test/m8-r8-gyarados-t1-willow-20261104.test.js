'use strict';
// Preregistered at PR104 #6622588510. Same opponent public-six at preview,
// choose own three and lead before seeing the opponent's actual hidden three.
// Test whether heat-Rotom initial Will-O-Wisp can cover Gyarados setup and
// a Garchomp switch; no claims of human viability from heuristic Bot.
const test=require('node:test'),assert=require('node:assert/strict');
const {load,normalize,hashSeed,matchup}=require('../lab');
const {build}=require('../m8-r8-dual-setup-lucario');
const {groups}=require('../environment-m7-teams');
const {battle,earlyLines}=require('../encore-lead-audit');
const copy=x=>structuredClone(x);
const skip=!process.env.SHOWDOWN_DIR&&'SHOWDOWN_DIR unavailable';
const foe=()=>groups[8].team;
const foeThree=[['Gyarados','Garchomp','Mimikyu'],['Mimikyu','Gholdengo','Corviknight']];
const own={
 G0:['Rotom-Heat','Garchomp','Lucario'],
 G4:['Rotom-Heat','Mimikyu','Lucario'],
 G5:['Garchomp','Rotom-Heat','Lucario']
};
function publicAttack(req,bot,info){
 if(info.turn!==1||req.teamPreview||req.forceSwitch)return null;
 const a=req.active?.[0],p=req.side?.pokemon?.find(x=>x.active);
 if(!a||!p)return null;
 const me=bot.getSet(p),enemy=bot.foeActive;
 const candidates=a.moves.map((m,i)=>({m,i}))
  .filter(x=>!x.m.disabled&&x.m.pp>0&&bot.dex.moves.get(x.m.id||x.m.move).category!=='Status')
  .map(x=>({...x,score:matchup(bot.dex,me,enemy,x.m.id||x.m.move)}))
  .sort((x,y)=>y.score-x.score||x.i-y.i);
 return candidates.length?'move '+(candidates[0].i+1)+(a.canMegaEvo?' mega':''):null;
}
function willowScript(calls){
 return (req,bot,info)=>{
  if(info.turn!==1||req.teamPreview||req.forceSwitch)return null;
  const self=req.side?.pokemon?.find(p=>p.active);
  if(!self||!String(self.details).startsWith('Rotom-Heat'))return null;
  if(!['Gyarados','Mimikyu'].includes(bot.foeActive))return null;
  const moves=req.active?.[0]?.moves||[];
  const i=moves.findIndex(m=>m.id==='willowisp'||m.move==='Will-O-Wisp');
  if(i<0)return null;
  calls.push({foe:bot.foeActive,move:'Will-O-Wisp'});
  return 'move '+(i+1);
 };
}
test('R8 gyarados-garch-mimikyu alternatives and all opponent 3 are M-C legal',{skip},()=>{
 const v=load().TeamValidator.get('gen9championsbssregmc'),ours=build(),rival=foe();
 assert.ok(!v.validateTeam(normalize(ours))?.length,'R8');
 assert.ok(!v.validateTeam(normalize(rival))?.length,'rival');
 assert.equal(Object.keys(own).length,3);assert.equal(foeThree.length,2);
 for(const t of Object.values(own)){
  assert.equal(new Set(t).size,3);
  assert.ok(t.every(s=>ours.some(p=>p.species===s)),'our preview');
 }
 for(const t of foeThree){
  assert.equal(new Set(t).size,3);
  assert.ok(t.every(s=>rival.some(p=>p.species===s)),'foe preview');
 }
});
test('R8 gyara public six: 96 full Battles comparing three leads with T1 Will-O-Wisp counterplay',{skip},async t=>{
 const sim=load(),team=build(),rows=[];let games=0,errors=0;
 for(const [ei,enemy3] of foeThree.entries())
 for(const [id,three] of Object.entries(own))
 for(const [op,ourPolicy] of ['autonomous','willow-if-heat'].entries())
 for(const rivalPolicy of ['autonomous','public-attack-T1']){
  const obs=[];let totalWillows=0;
  for(let si=0;si<2;si++)for(const reverse of [false,true]){
   const seed=hashSeed(11050300+ei*100+si);
   const calls=[];
   const r=await battle(sim,copy(team),copy(foe()),seed,{
    ownThree:three,foeThree:enemy3,reverse,
    ownOptions:ourPolicy==='willow-if-heat'?{script:willowScript(calls)}:{},
    script:rivalPolicy==='public-attack-T1'?publicAttack:null,
    rivalImmuneAware:true});
   games++;errors+=r.errors;assert.equal(r.errors,0,id+'/'+ourPolicy);
   totalWillows+=calls.length;
   obs.push({won:r.won,early:earlyLines(r.log,r.ownSide,4),turns:r.turns});
  }
  rows.push({rivalThree:enemy3,ownSelection:id,ownThree:three,
   ownT1:ourPolicy,foeT1:rivalPolicy,willowOverrides:totalWillows,
   wins:obs.filter(x=>x.won).length,losses:obs.filter(x=>!x.won).length,
   lossExample:obs.find(x=>!x.won)?.early?.slice(0,38),
   winExample:obs.find(x=>x.won)?.early?.slice(0,25)});
 }
 assert.equal(games,96);assert.equal(errors,0);assert.equal(rows.length,24);
 t.diagnostic('M8_R8_GYARA_T1_COUNTERPLAY '+JSON.stringify({
  preregistered:'PR104 #6622588510',games,errors,rows,
  noOpponentThreeAtOwnSelection:true,botNotHuman:true}));
});
