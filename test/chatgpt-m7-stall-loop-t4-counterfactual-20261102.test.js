'use strict';
// Independent ChatGPT counterfactual: predeclared PR104 #6571881036.
// Same existing U-L legal six, same 3+lead, same T1-T3 engine state.
// T3 OWN switch to Rotom-Wash in ALL arms; then only T4 decisions change.
// Opponent has private knowledge of its own legal 3 but not OUR hidden sets.
// Not a previously unseen holdout; does not certify human win probability.
const test=require('node:test');
const assert=require('node:assert/strict');
const {load,hashSeed,normalize}=require('../lab');
const {reportedLive}=require('../reported-live-roster-20261027');
const {archetypes}=require('../fixtures');
const {battle}=require('../encore-lead-audit');
const {executedEvents,eventSignature}=require('../public-execution-audit');
const copy=x=>structuredClone(x),skip=!process.env.SHOWDOWN_DIR&&'SHOWDOWN_DIR unavailable';
const own=reportedLive();
const foe=['Salamence','Volcarona','Gholdengo','Toxapex','Skarmory','Rillaboom'].map(n=>
 copy((n==='Toxapex'||n==='Skarmory'?archetypes.stall:archetypes.setup).find(p=>p.species===n)));
const ownThree=['Metagross','Hydreigon','Rotom-Wash'];
const foeThree=['Salamence','Volcarona','Gholdengo'];
const ARMS=[
 {id:'A-autonomous'},
 {id:'B-rival-Gholdengo',foeSwitch:'Gholdengo'},
 {id:'C-rival-Gholdengo-own-Wisp',foeSwitch:'Gholdengo',ownMove:'willowisp'},
 {id:'D-rival-Gholdengo-own-Thunderbolt',foeSwitch:'Gholdengo',ownMove:'thunderbolt'},
 {id:'E-rival-Gholdengo-own-HydroPump',foeSwitch:'Gholdengo',ownMove:'hydropump'},
 {id:'F-rival-Gholdengo-own-VoltSwitch',foeSwitch:'Gholdengo',ownMove:'voltswitch'},
 {id:'G-rival-DoubleEdge-own-Thunderbolt',foeMove:'doubleedge',ownMove:'thunderbolt'},
 {id:'H-rival-DoubleEdge-own-Wisp',foeMove:'doubleedge',ownMove:'willowisp'}
];
const noPunc=x=>String(x||'').toLowerCase().replace(/[^a-z0-9]/g,'');
function snap(req,bot,info){
 const active=req.side.pokemon.find(p=>p.active);
 return {turn:info.turn,name:String(active?.details).split(',')[0],hp:active?.condition,
  foePublic:bot.foeActive, moves:(req.active?.[0]?.moves||[]).map(m=>({id:m.id,pp:m.pp,disabled:!!m.disabled})),
  bench:req.side.pokemon.filter(p=>!p.active&&!String(p.condition).endsWith(' fnt'))
   .map(p=>({name:String(p.details).split(',')[0],hp:p.condition}))};
}
function command(req,arm,side,turn,record,bot,info){
 if(info.turn!==turn||req.teamPreview||req.forceSwitch||!req.active?.[0])return null;
 record.push(snap(req,bot,info));
 const move=side==='own'?arm.ownMove:arm.foeMove;
 const target=side==='own'?arm.ownSwitch:arm.foeSwitch;
 if(move){
  const ix=req.active[0].moves.findIndex(m=>noPunc(m.id)===noPunc(move)&&m.pp>0&&!m.disabled);
  assert.ok(ix>=0,arm.id+' : requested move available at T4');
  return 'move '+(ix+1)+(req.active[0].canMegaEvo?' mega':'');
 }
 if(target){
  assert.ok(!req.active[0].trapped&&!req.active[0].maybeTrapped,arm.id+' : switch legal');
  const ix=req.side.pokemon.findIndex(p=>!p.active&&!String(p.condition).endsWith(' fnt')&&String(p.details).startsWith(target+','));
  assert.ok(ix>=0,arm.id+' : switch-in available at T4');
  return 'switch '+(ix+1);
 }
 return null;
}
function ownScript(arm,t4){
 return (req,bot,info)=>{
  if(req.teamPreview||req.forceSwitch||!req.active?.[0])return null;
  if(info.turn===3){
   assert.ok(!req.active[0].trapped&&!req.active[0].maybeTrapped);
   const ix=req.side.pokemon.findIndex(p=>!p.active&&!String(p.condition).endsWith(' fnt')&&
    String(p.details).startsWith('Rotom-Wash,'));
   assert.ok(ix>=0,'Rotom available at T3');
   return 'switch '+(ix+1);
  }
  return command(req,arm,'own',4,t4,bot,info);
 };
}
function foeScript(arm,t4){
 return (req,bot,info)=>command(req,arm,'foe',4,t4,bot,info);
}
function beforeTurn(log,turn){
 const lines=String(log).split('\n');
 const i=lines.findIndex(l=>l==='|turn|'+turn);
 assert.ok(i>0,'must reach turn '+turn);
 return lines.slice(0,i).filter(l=>!l.startsWith('|t:|')).join('\n');
}
function eventsFor(log,ours,turn){
 const them=ours==='p1'?'p2':'p1';
 const e=executedEvents(log,ours,them,turn);
 return {our:eventSignature(e.own,turn),enemy:eventSignature(e.rival,turn)};
}
function lastLines(log,from=3,to=7){
 const lines=[];let turn=0;
 for(const l of log.split('\n')){
  const a=l.split('|');
  if(a[1]==='turn'){turn=Number(a[2]);if(turn>to)break}
  if(turn>=from&&turn<=to&&['turn','switch','move','-immune','-status','-damage','-heal','-miss','faint','-boost','-fail','-supereffective'].includes(a[1]))
   lines.push(l.replace(/p[12]a: /g,''));
 }
 return lines.slice(0,55);
}
test('T3 same-state M-7 T4 counterfactual has legal opponent and player teams',{skip},()=>{
 const sim=load(),v=sim.TeamValidator.get('gen9championsbssregmc');
 assert.equal(v.validateTeam(normalize(own)),null);
 assert.equal(v.validateTeam(normalize(foe)),null);
 assert.ok(ARMS.length===8);
 assert.deepEqual(foeThree,['Salamence','Volcarona','Gholdengo']);
 assert.ok(ownThree.every(n=>own.some(x=>x.species===n)));
 assert.ok(foeThree.every(n=>foe.some(x=>x.species===n)));
});
test('T4 public Gholdengo pivot challenges the T3 Rotom rescue on identical history',{skip},async t=>{
 const sim=load(),all=[];
 for(let s=0;s<2;s++)for(const reverse of [false,true]){
  const seed=hashSeed(11027000+s),pair=[];
  for(const arm of ARMS){
   const ownT4=[],rivalT4=[];
   const r=await battle(sim,copy(own),copy(foe),seed,{
    ownThree,foeThree,reverse,rivalImmuneAware:true,
    ownOptions:{script:ownScript(arm,ownT4)},
    script:foeScript(arm,rivalT4)
   });
   assert.equal(r.errors,0,'no engine choice errors '+arm.id);
   assert.ok(ownT4.length>=1&&rivalT4.length>=1,'both legal T4 requests');
   const prefix=beforeTurn(r.log,4),third=eventsFor(r.log,r.ownSide,3),fourth=eventsFor(r.log,r.ownSide,4);
   assert.match(third.our,/switch:Rotom/,'all T3 own switch to Rotom');
   if(pair.length){
    assert.equal(prefix,pair[0].prefix,'same legal engine history until T4');
    assert.deepEqual(ownT4[0],pair[0].ourT4,'same public own HP/PP at T4');
    assert.deepEqual(rivalT4[0],pair[0].theirT4,'same rival HP/PP at T4');
   }
   if(arm.foeSwitch)assert.match(fourth.enemy,/switch:Gholdengo/,'rival must execute T4 public switch');
   if(arm.foeMove)assert.match(fourth.enemy,/move:Salamence:Double-Edge/,'rival must execute intended T4 attack');
   if(arm.ownMove)assert.ok(fourth.our.includes('move:Rotom:'),'Rotom must use legal T4 move');
   pair.push({arm:arm.id,seed,reverse,won:r.won,turns:r.turns,
    prefix,ourT4:ownT4[0],theirT4:rivalT4[0],third,fourth,
    trace:lastLines(r.log)});
  }
  all.push(...pair);
 }
 assert.equal(all.length,32);
 const summary=ARMS.map(arm=>{
  const cells=all.filter(x=>x.arm===arm.id);
  return {arm:arm.id,wins:cells.filter(x=>x.won).length,games:4,
   executedT3:[...new Set(cells.map(x=>x.third.our+' | '+x.third.enemy))],
   executedT4:[...new Set(cells.map(x=>x.fourth.our+' | '+x.fourth.enemy))],
   turns:cells.map(x=>x.turns),example:cells[0].trace};
 });
 t.diagnostic('M7_STALL_LOOP_T4_PUBLIC_PIVOT '+JSON.stringify({
  status:'existing U-L diagnostic, two independent seeds x both seat reversals, not human winning rate',
  declaration:'PR104 comment #6571881036',enginedGames:32,
  opponentRationalityCertified:false,comparableT4State:true,
  ownThree,foeThree,
  note:'Opponent own Gholdengo switch is a legal public-six counter-branch; it is not necessarily optimal. After T4, both Bots decide autonomously, so wins can reflect later errors.',
  summary
 }));
});