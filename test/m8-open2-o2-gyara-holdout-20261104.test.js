'use strict';
// Pre-registered BEFORE results: PR #104 comment #6626217009.
// Independent holdout for O2 team with fixed preview pick:
// Mega Metagross LEAD / Rotom-Wash / Baxcalibur.
// Public six is constant regardless of which hidden enemy 3 is simulated.
// 6 enemy 3s x 2 T1/T2 policies x 2 fresh seeds x both sides = 48 battles.
const test=require('node:test'),assert=require('node:assert/strict');
const {load,prelim,normalize,hashSeed,matchup}=require('../lab');
const {builders}=require('../m8-open1-20261104');
const {groups}=require('../environment-m7-teams');
const {battle,rivalScript,earlyLines}=require('../encore-lead-audit');
const skip=!process.env.SHOWDOWN_DIR&&'SHOWDOWN_DIR unavailable';
const copy=x=>structuredClone(x);
const ourThree=['Metagross','Rotom-Wash','Baxcalibur'];
const rivals=[
 ['Gyarados','Garchomp','Mimikyu'],
 ['Garchomp','Gyarados','Mimikyu'],
 ['Mimikyu','Gyarados','Garchomp'],
 ['Gyarados','Garchomp','Gholdengo'],
 ['Gyarados','Garchomp','Baxcalibur'],
 ['Mimikyu','Gholdengo','Corviknight']
];
function foePublicSix(){return groups[8].team;}
function rationalT1T2(dex){
 const forceSwitch=rivalScript('switch','stay',dex);
 return (req,bot,info)=>{
  if(req.teamPreview||req.forceSwitch||!req.active?.[0]||!info)return null;
  const a=req.side.pokemon.find(p=>p.active);
  if(!a)return null;
  const active=String(a.details||'').split(',')[0];
  // Opponent voluntarily switches its own Gyarados to its own Garchomp
  // using only its available bench and the PUBLIC opponent active.
  if(info.turn===1&&active==='Gyarados')return forceSwitch(req,bot,info);
  if(info.turn!==1&&info.turn!==2)return null;
  const self=bot.getSet(a),publicEnemy=bot.foeActive,legal=req.active[0].moves
   .map((m,i)=>({m,i})).filter(x=>!x.m.disabled&&x.m.pp>0&&dex.moves.get(x.m.id||x.m.move).category!=='Status')
   .map(x=>({...x,score:matchup(dex,self,publicEnemy,x.m.id||x.m.move)}))
   .sort((a,b)=>b.score-a.score||a.i-b.i);
  const best=legal[0];
  return best?'move '+(best.i+1)+(req.active[0].canMegaEvo?' mega':''):null;
 };
}
test('M8 O2 Gyarados holdout: six M-C legal and fixed public preview before rival trios',{skip},()=>{
 const val=load().TeamValidator.get('gen9championsbssregmc'),own=builders.O2_megaMetagross_unaware(),foe=foePublicSix();
 assert.doesNotThrow(()=>prelim(own,'O2'));assert.ok(!val.validateTeam(normalize(own))?.length);
 assert.ok(!val.validateTeam(normalize(foe))?.length);
 assert.deepEqual(ourThree,['Metagross','Rotom-Wash','Baxcalibur']);
 assert.ok(ourThree.every(x=>own.some(y=>y.species===x)));
 assert.equal(rivals.length,6);
 for(const three of rivals){
  assert.equal(new Set(three).size,3);
  assert.ok(three.every(x=>foe.some(y=>y.species===x)));
 }
});
test('M8 O2 Gyarados 6 new enemy leads/trios x 2 rational T1/T2 x 2 fresh seed x side: 48 full Battles',{skip},async t=>{
 const sim=load(),dex=sim.Dex.mod('champions'),rows=[];let games=0,errors=0;
 for(const [ci,foeThree] of rivals.entries())
 for(const policy of ['autonomous','publicRationalT1T2']){
  const script=policy==='autonomous'?null:rationalT1T2(dex);
  const obs=[];
  for(let si=0;si<2;si++)for(const reverse of [false,true]){
   const seed=hashSeed(12190000+ci*100+si);
   const r=await battle(sim,copy(builders.O2_megaMetagross_unaware()),copy(foePublicSix()),seed,{
    ownThree:ourThree,foeThree,reverse,script,rivalImmuneAware:true,choiceAudit:true});
   games++;errors+=r.errors;assert.equal(r.errors,0,'case'+ci+'/'+policy+'/'+si+'/'+reverse);
   const firstChoices=r.choiceTrace.filter(x=>x.requestKind==='normal'&&x.turn<=2)
    .map(x=>({turn:x.turn,who:x.side===r.ownSide?'OWN':'RIVAL',choice:x.choice}));
   obs.push({won:r.won,turns:r.turns,opening:earlyLines(r.log,r.ownSide,6).slice(0,42),
    choices:firstChoices.slice(0,7)});
  }
  rows.push({enemyCase:ci,foeThree,policy,ownThree:ourThree,
    wins:obs.filter(o=>o.won).length,losses:obs.filter(o=>!o.won).length,
    firstLoss:obs.find(o=>!o.won)?.opening,
    firstWin:obs.find(o=>o.won)?.opening,
    choices:obs.map(o=>o.choices)});
 }
 assert.equal(games,48);assert.equal(errors,0);assert.equal(rows.length,12);
 t.diagnostic('M8_O2_GYARA_HOLDOUT_48 '+JSON.stringify({
  preregistered:'PR #104 issuecomment #6626217009',games,errors,rows,
  note:'One known public-six with SIX prospective opponent trios/leads, not a full universe; 2 seeds x reversed side.',
  ownThreeDoesNotReadEnemyThree:true,postSelectionHoldout:true,notHumanWinRate:true}));
});
