'use strict';
// PR #72 request: public Mega ability (PR #57 audit, opt-in publicMegaAbility)
// and encoreGuard boundaries, against the pinned Showdown engine. Bots are fed
// the PUBLIC protocol only (|split| secret lines removed).
const test=require('node:test'),assert=require('node:assert/strict');
const path=require('node:path');
const sim=require(path.join(process.env.SHOWDOWN_DIR,'dist/sim/index.js'));
const {Bot,hashSeed,fixedMegaAbility}=require('../lab');
const {incomingRisk,estimateDamage}=require('../damage');
const {battle,bench,nameOf}=require('../encore-lead-audit');
const {caseList}=require('../legal-search-v2-compare');
const {reportedLive}=require('../reported-live-roster-20261027');
const dex=sim.Dex.mod('champions');
const A=caseList().find(c=>c.id==='A_golisopod');
const own=reportedLive();
const streamOf=text=>({async *[Symbol.asyncIterator](){yield text;}});
// Public view of an omniscient/engine log: drop |split| markers and the secret line after each.
function publicLog(lines){
  const out=[];for(let i=0;i<lines.length;i++){if(lines[i].startsWith('|split|')){i++;continue;}out.push(lines[i]);}
  return out;
}
async function feed(lines,side,team,options){
  const b=new Bot(streamOf(lines.join('\n')),dex,team,side,{choices:[],selections:[],errors:[]},null,null,options);
  await b.run();return b;
}
const upTo=(lines,re)=>{const i=lines.findIndex(l=>re.test(l));assert.ok(i>=0,'missing '+re);return lines.slice(0,i+1);};

test('fixed Mega abilities in the pinned champions mod',()=>{
  assert.equal(fixedMegaAbility(dex,'Golisopod-Mega'),'Tough Claws');
  assert.equal(fixedMegaAbility(dex,'Garchomp-Mega-Z'),'Levitate');
  assert.equal(fixedMegaAbility(dex,'Golisopod'),'','base forme: ability not public');
});
test('protocol: Mega-Z detailschange overwrites a seen ability; re-entry re-infers; non-Mega forme clears; default off unchanged',async()=>{
  const L=['|switch|p2a: Garchomp|Garchomp, L50|185/185','|-ability|p2a: Garchomp|Sand Veil','|detailschange|p2a: Garchomp|Garchomp-Mega-Z, L50'];
  let b=await feed(L,'p1',own,{publicMegaAbility:true});
  assert.equal(b.foeAbility,'Levitate');
  assert.equal(estimateDamage(dex,own.find(x=>x.species==='Garchomp'),b.foeActive,'Earthquake',{foeAbility:b.foeAbility}).immune,true);
  b=await feed([...L,'|switch|p2a: Rotom|Rotom-Wash, L50|157/157','|switch|p2a: Garchomp|Garchomp-Mega-Z, L50|185/185'],'p1',own,{publicMegaAbility:true});
  assert.equal(b.foeAbility,'Levitate');
  b=await feed(['|switch|p2a: Zoroark|Zoroark, L50|150/150','|-ability|p2a: Zoroark|Illusion','|detailschange|p2a: Zoroark|Garchomp, L50'],'p1',own,{publicMegaAbility:true});
  assert.equal(b.foeAbility,'');
  b=await feed([...L,'|-endability|p2a: Garchomp'],'p1',own,{publicMegaAbility:true});
  assert.equal(b.foeAbility,'','Gastro Acid style suppression is public');
  b=await feed(L,'p1',own,{});
  assert.equal(b.foeAbility,'Sand Veil','option off: legacy behaviour kept for reproducibility');
});
test('real Battle A: Mega Golisopod -> switch out -> re-entry is public Tough Claws; Tough Claws raises public incoming risk',async()=>{
  // Rival: T1 SD + Mega, T2 to Mimikyu, T3 back to Golisopod.
  const plan={1:'Swords Dance',2:'Mimikyu',3:'Golisopod'};
  const s=(req,bot,info)=>{const p=plan[info.turn];if(!p)return null;const act=req.active[0];
    if(p==='Swords Dance'){const i=act.moves.findIndex(m=>m.move===p&&!m.disabled);return i>=0?'move '+(i+1)+(act.canMegaEvo?' mega':''):null;}
    const x=bench(req).find(y=>nameOf(y.p.details).startsWith(p));return x?'switch '+(x.i+1):null;};
  const r=await battle(sim,reportedLive(),structuredClone(A.team),hashSeed(7400000),{ownThree:['Metagross','Garchomp','Primarina'],foeThree:A.forcedA,reverse:false,script:s});
  const lines=publicLog(r.log.split('\n'));
  assert.ok(lines.some(l=>/^\|detailschange\|p2a: Golisopod\|Golisopod-Mega/.test(l)),'engine shows Mega forme');
  const atMega=await feed(upTo(lines,/^\|detailschange\|p2a: Golisopod/),'p1',own,{publicMegaAbility:true});
  assert.equal(atMega.foeAbility,'Tough Claws');
  const back=await feed(upTo(lines,/^\|switch\|p2a: Golisopod\|Golisopod-Mega/),'p1',own,{publicMegaAbility:true});
  assert.equal(back.foeActive,'Golisopod-Mega');assert.equal(back.foeAbility,'Tough Claws','re-entry from bench');
  const legacy=await feed(upTo(lines,/^\|switch\|p2a: Golisopod\|Golisopod-Mega/),'p1',own,{});
  assert.equal(legacy.foeAbility,'');
  const prim=own.find(x=>x.species==='Primarina');
  const base=incomingRisk(dex,prim,'Golisopod-Mega',{seenMoves:['Leech Life']});
  const claws=incomingRisk(dex,prim,'Golisopod-Mega',{seenMoves:['Leech Life'],attackerAbility:'Tough Claws'});
  assert.ok(claws>base*1.2&&claws<base*1.4,base+' -> '+claws);
});
test('real Battle A: the rival Bot reads only public lines (no foe set / unselected mon leaks into Bot state)',async()=>{
  const r=await battle(sim,reportedLive(),structuredClone(A.team),hashSeed(7500000),{ownThree:['Rotom-Wash','Metagross','Garchomp'],foeThree:A.forcedA,reverse:false,script:null,ownOptions:{publicMegaAbility:true,encoreGuard:'speed'}});
  const lines=publicLog(r.log.split('\n'));
  assert.equal(lines.some(l=>/Golisopite|Choice Scarf|Life Orb/.test(l)&&/^\|(switch|poke)\|/.test(l)),false);
  const b=await feed(lines,'p1',own,{publicMegaAbility:true});
  assert.deepEqual([...new Set(b.opp)].sort(),A.team.map(p=>p.species).sort(),'public preview six only');
});
// encoreGuard boundaries. Engine rule (sim/pokemon.ts clearVolatile, moveUsed):
// lastMove is cleared on switch-in and set only by a used move.
const custom=(p1,p2,seed=[1,2,3,4])=>{
  const b=new sim.Battle({formatid:'gen9customgame',seed});
  b.setPlayer('p1',{team:p1});b.setPlayer('p2',{team:p2});b.makeChoices('team 1','team 1');return b;
};
const mon=(species,moves,extra={})=>({species,moves,ability:extra.ability||'No Ability',evs:{hp:0,atk:0,def:0,spa:0,spd:0,spe:extra.spe??252},level:50,...extra});
const encoreResult=(b,t)=>{const l=b.log.slice(b.log.indexOf('|turn|'+t));
  return l.some(x=>/^\|-start\|p2a: .*\|Encore$/.test(x))?'start':l.some(x=>x==='|-fail|p1a: Ambipom'||/^\|-fail\|/.test(x))?'fail':'none';};
const ambi=[mon('Ambipom',['Fake Out','Encore','Spore','Tackle'],{item:'',ability:'Technician'})];
test('Encore boundary: fresh foe that flinched (|cant| flinch, no |move|) -> engine fails, guard v1/speed both block',async()=>{
  const b=custom(ambi,[mon('Snorlax',['Tackle','Splash'],{spe:0,ability:'Thick Fat'})]);
  b.makeChoices('move Fake Out','move Tackle');
  assert.ok(b.log.some(l=>/^\|cant\|p2a: Snorlax\|flinch/.test(l)));
  const bot=await feed(publicLog(b.log),'p1',[{species:'Ambipom',moves:['Fake Out','Encore','Spore','Tackle'],evs:{spe:32},nature:'Jolly'}],{encoreGuard:'speed'});
  assert.equal(bot.foeLastMoveTurn<0,true);
  const side=[{active:true,condition:'100/100',details:'Ambipom, L50',item:''}];
  assert.equal(bot.encoreWouldFail(bot.team[0],side),true);
  b.makeChoices('move Encore','move Tackle');assert.equal(encoreResult(b,2),'fail');
});
test('Encore boundary: foe moved, then fell asleep (|cant| slp) -> lastMove kept, engine starts Encore, guard allows',async()=>{
  const b=custom(ambi,[mon('Snorlax',['Splash','Tackle'],{spe:0,ability:'Thick Fat'})]);
  b.makeChoices('move Tackle','move Splash');b.makeChoices('move Spore','move Splash');
  assert.ok(b.log.some(l=>/^\|cant\|p2a: Snorlax\|slp/.test(l)));
  const bot=await feed(publicLog(b.log),'p1',[{species:'Ambipom',moves:['Fake Out','Encore','Spore','Tackle'],evs:{spe:32},nature:'Jolly'}],{encoreGuard:true});
  assert.equal(bot.encoreWouldFail(bot.team[0],[{active:true,condition:'100/100',details:'Ambipom, L50'}]),false);
  b.makeChoices('move Encore','move Splash');assert.equal(encoreResult(b,3),'start');
});
test('Encore boundary: failed Sucker Punch still shows |move| and sets lastMove -> engine starts Encore, guard allows',async()=>{
  const b=custom(ambi,[mon('Absol',['Sucker Punch','Splash'],{spe:0,ability:'Pressure'})]);
  b.makeChoices('move Spore','move Sucker Punch');
  assert.ok(b.log.some(l=>/^\|move\|p2a: Absol\|Sucker Punch/.test(l)));
  const bot=await feed(publicLog(b.log),'p1',[{species:'Ambipom',moves:['Fake Out','Encore','Spore','Tackle'],evs:{spe:32},nature:'Jolly'}],{encoreGuard:true});
  assert.equal(bot.encoreWouldFail(bot.team[0],[{active:true,condition:'100/100',details:'Ambipom, L50'}]),false);
  b.makeChoices('move Encore','move Splash');
  // Absol is asleep from Spore, which does not matter: lastMove = Sucker Punch.
  assert.equal(encoreResult(b,2),'start');
});
test('Encore boundary (v1 false positive, real champions Battle): slow Primarina into a fresh, surely faster Garchomp -> Encore starts; v1 blocks, speed guard allows',async()=>{
  let pre=null;
  const ours=(req,bot,info)=>{if(info.turn!==1)return null;
    const side=req.side.pokemon,my=bot.getSet(side.find(p=>p.active)),g=bot.encoreGuard;
    bot.encoreGuard=true;const v1=bot.encoreWouldFail(my,side);bot.encoreGuard='speed';const v2=bot.encoreWouldFail(my,side);bot.encoreGuard=g;
    pre={v1,v2,foe:bot.foeActive};
    return 'move '+(req.active[0].moves.findIndex(m=>m.move==='Encore')+1);};
  const rival=(req,bot,info)=>{if(info.turn!==1)return null;return 'move '+(req.active[0].moves.findIndex(m=>m.move==='Earthquake')+1);};
  const r=await battle(sim,reportedLive(),structuredClone(A.team),hashSeed(7600000),
    {ownThree:['Primarina','Metagross','Garchomp'],foeThree:['Garchomp','Golisopod','Mimikyu'],reverse:false,script:rival,ownOptions:{script:ours}});
  assert.deepEqual(pre,{v1:true,v2:false,foe:'Garchomp'});
  const t1=r.log.split('\n');const i=t1.indexOf('|turn|1'),j=t1.indexOf('|turn|2');const seg=t1.slice(i,j>0?j:undefined);
  const eq=seg.findIndex(l=>/^\|move\|p2a: Garchomp\|Earthquake/.test(l)),enc=seg.findIndex(l=>/^\|move\|p1a: Primarina\|Encore/.test(l));
  assert.ok(eq>=0&&enc>eq,'Garchomp moves first');
  assert.ok(seg.some(l=>/^\|-start\|p2a: Garchomp\|Encore$/.test(l)),'Encore starts: '+seg.join(' / '));
});
test('#71 audit count: encore-turn-p0-audit runs 3552 Battles (1776 per own AI); the saved JSON has 3552 rows',()=>{
  const {OWN_AI}=require('../encore-turn-p0-audit');
  const T1=7,T2=6,ENC=2,SEEDS=6,SIDES=2,LEADS=2,AIS=Object.keys(OWN_AI).length;
  const normal=(T1-1)*T2*ENC*SEEDS*SIDES*LEADS*AIS,ref=1*1*ENC*SEEDS*SIDES*LEADS*AIS;
  assert.equal(normal+ref,3552);assert.equal((normal+ref)/AIS,1776);
  const saved=require('../reports/data/encore-turn-p0-audit-20261030.json');
  assert.equal(saved.rows.length,3552);
  assert.equal(saved.rows.filter(r=>r.ai==='guard').length,1776);
});
test('preview matrix: equilibrium solver on rock-paper-scissors and a dominated row; picks are 60 fixed strategies',()=>{
  const {equilibrium,picks}=require('../a-preview-matrix-audit');
  const rps=equilibrium([[0.5,0,1],[1,0.5,0],[0,1,0.5]],5000);
  assert.ok(Math.abs(rps.value-0.5)<0.01);for(const p of rps.x)assert.ok(Math.abs(p-1/3)<0.03);
  const dom=equilibrium([[0.8,0.6],[0.2,0.1]],5000);
  assert.ok(dom.x[0]>0.95&&Math.abs(dom.value-0.6)<0.02);
  const P=picks(own);assert.equal(P.length,60);assert.equal(new Set(P.map(p=>p.join())).size,60);
  for(const p of P)assert.equal(new Set(p).size,3);
});
