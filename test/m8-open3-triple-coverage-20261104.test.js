'use strict';
// Pre-registered at PR #104 issuecomment #6626410551 BEFORE results.
// O2 uses fixed same three (Metagross/Skeledirge/Baxcalibur) against two
// public sixes, regardless of the rival's hidden 3. Only our LEAD varies.
// 3 leads x (8 Gyara rival 3 + 4 Goli rival 3) x 2 rival T1/T2 policies
// x 2 fresh seeds x side reversal = 288 pinned M-C full Battles.
const test=require('node:test'),assert=require('node:assert/strict');
const {load,normalize,prelim,hashSeed,matchup}=require('../lab');
const {builders}=require('../m8-open1-20261104');
const {groups}=require('../environment-m7-teams');
const {battle,earlyLines,switchTo}=require('../encore-lead-audit');
const clone=x=>structuredClone(x);
const skip=!process.env.SHOWDOWN_DIR&&'SHOWDOWN_DIR unavailable';
const choose=[
 ['Metagross','Skeledirge','Baxcalibur'],
 ['Skeledirge','Metagross','Baxcalibur'],
 ['Baxcalibur','Metagross','Skeledirge']
];
const scenarios=[
 {id:'gyarados',team:()=>groups[8].team,rival:[
  ['Gyarados','Garchomp','Mimikyu'],['Garchomp','Gyarados','Mimikyu'],
  ['Mimikyu','Gyarados','Garchomp'],['Gyarados','Garchomp','Gholdengo'],
  ['Gyarados','Garchomp','Baxcalibur'],['Mimikyu','Gholdengo','Corviknight'],
  ['Corviknight','Garchomp','Gyarados'],['Garchomp','Gholdengo','Mimikyu']]},
 {id:'megaGolisopod',team:()=>groups[0].team,rival:[
  ['Golisopod','Garchomp','Mimikyu'],['Hippowdon','Primarina','Gholdengo'],
  ['Garchomp','Golisopod','Gholdengo'],['Mimikyu','Gholdengo','Golisopod']]}
];
function rationalPublic(dex){
 return (req,bot,info)=>{
  if(req.teamPreview||req.forceSwitch||!req.active?.[0]||!info)return null;
  const p=req.side.pokemon.find(x=>x.active);
  if(!p)return null;
  const species=String(p.details||'').split(',')[0];
  const bench=req.side.pokemon.filter(x=>!x.active&&!/ fnt$/.test(x.condition));
  if(info.turn===1&&['Gyarados','Golisopod'].includes(species)&&
    bench.some(x=>String(x.details||'').startsWith('Garchomp')))
    return switchTo(req,'Garchomp');
  if(info.turn!==1&&info.turn!==2)return null;
  const me=bot.getSet(p),foePublic=bot.foeActive,poss=req.active[0].moves
   .map((m,i)=>({m,i})).filter(x=>!x.m.disabled&&x.m.pp>0&&dex.moves.get(x.m.id||x.m.move).category!=='Status')
   .map(x=>({...x,value:matchup(dex,me,foePublic,x.m.id||x.m.move)}))
   .sort((a,b)=>b.value-a.value||a.i-b.i);
  const best=poss[0];
  return best?'move '+(best.i+1)+(req.active[0].canMegaEvo?' mega':''):null;
 };
}
test('M8 O2 triple-role plan all previews and rival hypotheses legal without any hidden choice',{skip},()=>{
 const v=load().TeamValidator.get('gen9championsbssregmc'),own=builders.O2_megaMetagross_unaware();
 prelim(own,'O2');assert.ok(!v.validateTeam(normalize(own))?.length);
 const expected=['Metagross','Skeledirge','Baxcalibur'];
 assert.equal(choose.length,3);
 for(const c of choose){assert.deepEqual([...c].sort(),[...expected].sort());}
 for(const pub of scenarios){
  const foe=pub.team();assert.ok(!v.validateTeam(normalize(foe))?.length,pub.id);
  for(const trio of pub.rival){
   assert.equal(new Set(trio).size,3);
   assert.ok(trio.every(s=>foe.some(p=>p.species===s)),pub.id+' enemy 3');
  }
 }
});
test('M8 O2 dual public6 three leads vs 12 rival 3 x rational/public Bot policy: 288 full Battles',{skip},async t=>{
 const sim=load(),dex=sim.Dex.mod('champions'),rows=[];let games=0,errors=0;
 for(const [ci,c] of scenarios.entries())
 for(const [pi,ourThree] of choose.entries())
 for(const [ei,foeThree] of c.rival.entries())
 for(const policy of ['autonomous','rationalT1T2']){
  const obs=[];
  for(let si=0;si<2;si++)for(const reverse of [false,true]){
   const seed=hashSeed(12400300+ci*10000+ei*100+si);
   const r=await battle(sim,clone(builders.O2_megaMetagross_unaware()),clone(c.team()),seed,{
    ownThree:ourThree,foeThree,reverse,script:policy==='autonomous'?null:rationalPublic(dex),
    rivalImmuneAware:true,choiceAudit:true});
   games++;errors+=r.errors;assert.equal(r.errors,0,c.id+'/'+pi+'/'+ei+'/'+policy);
   obs.push({won:r.won,turns:r.turns,opening:earlyLines(r.log,r.ownSide,7).slice(0,38),
    ownChoices:r.choiceTrace.filter(x=>x.side===r.ownSide&&x.requestKind==='normal'&&x.turn<=2)
     .map(x=>({turn:x.turn,choice:x.choice}))});
  }
  rows.push({case:c.id,plan:pi,lead:ourThree[0],ownThree,foeThree,enemy3:ei,policy,
   wins:obs.filter(o=>o.won).length,losses:obs.filter(o=>!o.won).length,
   firstLoss:obs.find(o=>!o.won)?.opening,
   firstWin:obs.find(o=>o.won)?.opening,
   ownDecisions:obs.map(o=>o.ownChoices)});
 }
 assert.equal(games,288);assert.equal(errors,0);assert.equal(rows.length,72);
 t.diagnostic('M8_O2_TRIPLE_COVERAGE_288 '+JSON.stringify({
  preregistered:'PR #104 comment #6626410551',games,errors,rows,
  ownThreePublicOnly:true,notHumanWinRate:true,oneOwnTeamSix:true,
  enemyCoverage:'two fixed public 6, 8 plus 4 hidden3, fresh seeds2 both sides',
  note:'Heuristic bot and a simplified scripted-public-damage policy, must audit for irrationality'}));
});
