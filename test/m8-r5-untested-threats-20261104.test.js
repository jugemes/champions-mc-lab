'use strict';
// Predeclared independently of results: PR #104 comment #6621255081.
// R5 vs four previously untested public-six families. Both own choices are
// frozen per public six; opponent hidden trio is never input to own decision.
// Synthetic sets, heuristic bot: this is NOT human ranked performance evidence.
const test=require('node:test');
const assert=require('node:assert/strict');
const {load,normalize,prelim,hashSeed,matchup}=require('../lab');
const {build}=require('../m8-r5-balanced-threat-rebuild');
const {groups}=require('../environment-m7-teams');
const {battle,earlyLines}=require('../encore-lead-audit');
const skip=!process.env.SHOWDOWN_DIR&&'SHOWDOWN_DIR unavailable';
const clone=x=>structuredClone(x);
const cases=[
 {id:'lucarioZ',team:()=>groups[1].team,
  rival:[['Lucario','Garchomp','Mimikyu'],['Corviknight','Primarina','Archaludon']],
  own:[['Metagross','Rotom-Heat','Primarina'],['Metagross','Baxcalibur','Gholdengo']]},
 {id:'psychic',team:()=>groups[10].team,
  rival:[['Indeedee','Gengar','Dragonite'],['Gholdengo','Volcarona','Rillaboom']],
  own:[['Rotom-Heat','Gholdengo','Metagross'],['Gholdengo','Primarina','Baxcalibur']]},
 {id:'gyarados',team:()=>groups[8].team,
  rival:[['Gyarados','Garchomp','Mimikyu'],['Mimikyu','Gholdengo','Corviknight']],
  own:[['Rillaboom','Baxcalibur','Metagross'],['Rotom-Heat','Primarina','Gholdengo']]},
 {id:'volcarona',team:()=>groups[13].team,
  rival:[['Salamence','Volcarona','Dragonite'],['Gholdengo','Skeledirge','Rillaboom']],
  own:[['Baxcalibur','Rotom-Heat','Metagross'],['Primarina','Rotom-Heat','Gholdengo']]}
];
// Rival action variant uses *only* its own legal moves and the public opposing
// active species. Status moves are excluded. Do not leak own hidden set/bench.
function publicAttack(req,bot,info){
 if(info.turn!==1||req.teamPreview||req.forceSwitch)return null;
 const act=req.active?.[0],self=req.side?.pokemon?.find(x=>x.active);
 if(!act||!self)return null;
 const me=bot.getSet(self),opponent=bot.foeActive;
 const rows=act.moves.map((m,i)=>({m,i}))
  .filter(x=>!x.m.disabled&&x.m.pp>0&&bot.dex.moves.get(x.m.id||x.m.move).category!=='Status')
  .map(x=>({...x,score:matchup(bot.dex,me,opponent,x.m.id||x.m.move)}));
 rows.sort((a,b)=>b.score-a.score||a.i-b.i);
 return rows.length?'move '+(rows[0].i+1)+(act.canMegaEvo?' mega':''):null;
}
test('M8 R5 new threat families and all public-six-only three choices are legal',{skip},()=>{
 const v=load().TeamValidator.get('gen9championsbssregmc'),team=build();
 assert.doesNotThrow(()=>prelim(team,'R5'));
 assert.ok(!v.validateTeam(normalize(team))?.length,'R5 legal');
 assert.equal(cases.length,4);
 for(const c of cases){
  const other=c.team();
  assert.ok(!v.validateTeam(normalize(other))?.length,c.id+' foe');
  assert.equal(other.length,6,c.id);
  assert.equal(c.own.length,2,c.id);
  assert.equal(c.rival.length,2,c.id);
  for(const three of c.own){
   assert.equal(new Set(three).size,3,c.id);
   assert.ok(three.every(s=>team.some(p=>p.species===s)),c.id+' own');
  }
  for(const three of c.rival){
   assert.equal(new Set(three).size,3,c.id);
   assert.ok(three.every(s=>other.some(p=>p.species===s)),c.id+' rival');
  }
 }
});
test('M8 R5 unseen threats, public-only previews, actual 128 full Battles',{skip},async t=>{
 const sim=load(),team=build(),rows=[];let games=0,errors=0;
 for(const [ci,c] of cases.entries())
 for(const [ri,foeThree] of c.rival.entries())
 for(const [oi,ownThree] of c.own.entries())
 for(const [pi,policy] of ['autonomous','public-attack-T1'].entries()){
  const obs=[];
  for(let si=0;si<2;si++)for(const reverse of [false,true]){
   const seed=hashSeed(11049600+ci*1000+ri*100+si);
   const r=await battle(sim,clone(team),clone(c.team()),seed,{
    ownThree,foeThree,reverse,
    script:policy==='public-attack-T1'?publicAttack:null,
    rivalImmuneAware:true
   });
   games++;errors+=r.errors;assert.equal(r.errors,0,c.id+'/'+policy);
   const lines=r.log.split('\n');
   obs.push({won:r.won,reverse,turns:r.turns,
    ownFaint:lines.filter(x=>x.startsWith('|faint|'+r.ownSide+'a:')).length,
    foeFaint:lines.filter(x=>x.startsWith('|faint|'+r.foeSide+'a:')).length,
    early:earlyLines(r.log,r.ownSide,3)});
  }
  rows.push({preview:c.id,rivalThree:foeThree,ownThree,policy,
   wins:obs.filter(x=>x.won).length,losses:obs.filter(x=>!x.won).length,
   lossExample:obs.find(x=>!x.won)?.early?.slice(0,35),
   winExample:obs.find(x=>x.won)?.early?.slice(0,25)});
 }
 assert.equal(games,128);assert.equal(errors,0);assert.equal(rows.length,32);
 t.diagnostic('M8_R5_NEW_THREATS '+JSON.stringify({
  preregistered:'PR104 issuecomment 6621255081',games,errors,rows,
  notHumanWinRate:true,opponentRationalityNotCertified:true,
  samePublicSixUsedForBothHiddenTrioHypotheses:true}));
});
