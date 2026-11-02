'use strict';
// Research-only, preregistered intervention at the SAME turn-3 legal request
// after the observed T1/T2 Psychic Fangs vs Roost prefix. Existing U-L is
// diagnostic (NOT an unseen holdout), and no ladder/selection claims follow.
// The opposing complete set is a legal fixture, not public knowledge of an
// actual opponent. Only one decision at T3 changes per arm. All other choices
// revert to the same heuristic Bots, with opponent-only immuneAware100.
// Neither the M-7 roster nor default Bot behavior is modified.
const test=require('node:test');
const assert=require('node:assert/strict');
const {load,hashSeed,normalize}=require('../lab');
const {reportedLive}=require('../reported-live-roster-20261027');
const {archetypes}=require('../fixtures');
const {battle}=require('../encore-lead-audit');
const {executedEvents,eventSignature}=require('../public-execution-audit');
const clone=x=>structuredClone(x);
const find=(team,s)=>clone(team.find(p=>p.species===s));
const skip=!process.env.SHOWDOWN_DIR&&'SHOWDOWN_DIR unavailable';
const own=reportedLive();
const foe=['Salamence','Volcarona','Gholdengo','Toxapex','Skarmory','Rillaboom']
  .map(s=>find(s==='Toxapex'||s==='Skarmory'?archetypes.stall:archetypes.setup,s));
const ourThree=['Metagross','Hydreigon','Rotom-Wash'];
const foeThree=['Salamence','Volcarona','Gholdengo'];
const arms=[
 {id:'baseline'},
 {id:'own-meteor-mash-T3',ownMove:'meteormash'},
 {id:'own-thunder-punch-T3',ownMove:'thunderpunch'},
 {id:'own-switch-hydreigon-T3',ownSwitch:'Hydreigon'},
 {id:'own-switch-rotom-T3',ownSwitch:'Rotom-Wash'},
 {id:'rival-double-edge-T3',foeMove:'doubleedge'},
 {id:'rival-earthquake-T3',foeMove:'earthquake'},
 {id:'rival-switch-gholdengo-T3',foeSwitch:'Gholdengo'}
];
const id=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
const activeName=req=>String(req.side.pokemon.find(p=>p.active)?.details||'').split(',')[0];
function snapshot(req,bot,info){
 return {turn:info.turn,active:activeName(req),foePublic:bot.foeActive,
  hp:req.side.pokemon.find(p=>p.active)?.condition,
  moves:(req.active?.[0]?.moves||[]).map(m=>({id:m.id,pp:m.pp,disabled:!!m.disabled})),
  bench:req.side.pokemon.filter(p=>!p.active&&!String(p.condition).endsWith(' fnt'))
    .map(p=>String(p.details).split(',')[0])};
}
function script(which,arm,record){
 return (req,bot,info)=>{
  if(info.turn!==3||req.teamPreview||req.forceSwitch||!req.active?.[0])return null;
  record.push(snapshot(req,bot,info));
  const move=which==='own'?arm.ownMove:arm.foeMove;
  const target=which==='own'?arm.ownSwitch:arm.foeSwitch;
  if(move){
   const index=req.active[0].moves.findIndex(m=>id(m.id)===id(move)&&!m.disabled&&m.pp>0);
   assert.ok(index>=0,'T3 forced move must be legal: '+arm.id);
   return 'move '+(index+1)+(req.active[0].canMegaEvo?' mega':'');
  }
  if(target){
   assert.ok(!req.active[0].trapped&&!req.active[0].maybeTrapped,'T3 switch not trapped');
   const index=req.side.pokemon.findIndex(p=>!p.active&&!String(p.condition).endsWith(' fnt')&&
      String(p.details).startsWith(target+','));
   assert.ok(index>=0,'T3 target must be available: '+arm.id);
   return 'switch '+(index+1);
  }
  return null;
 };
}
const beforeT3=log=>String(log).split('\n').slice(0,
 String(log).split('\n').findIndex(l=>l==='|turn|3')).join('\n');
const moveSeq=(log,side)=>executedEvents(log,side,side==='p1'?'p2':'p1',Infinity);
function turn3Events(log,side){
 const events=moveSeq(log,side);
 return {own:eventSignature(events.own,3),rival:eventSignature(events.rival,3)};
}
function progress(log,side){
 const lines=String(log).split('\n');let turn=0;
 const rows=[];
 for(const line of lines){
  const p=line.split('|');
  if(p[1]==='turn'){turn=Number(p[2]);continue;}
  if(turn>=2&&turn<=5&&['move','-damage','-heal','-boost','-unboost','switch','faint','-fail','-miss'].includes(p[1]))
   rows.push({turn,kind:p[1],who:String(p[2]||'').startsWith(side)?'own':
    /^p[12]a:/.test(p[2]||'')?'rival':'other',event:p.slice(2,5).join('|')});
 }
 return rows;
}
test('M-7 T3 stall-loop intervention: same legal T1/T2 state, full 3v3 pinned Battle',{skip},async t=>{
 const sim=load(),validator=sim.TeamValidator.get('gen9championsbssregmc');
 assert.equal(validator.validateTeam(normalize(own)),null);
 assert.equal(validator.validateTeam(normalize(foe)),null);
 const rows=[];
 for(let s=0;s<2;s++)for(const reverse of [false,true]){
  const seed=hashSeed(11029200+s),pair=[];
  for(const arm of arms){
   const ownRequests=[],foeRequests=[];
   const r=await battle(sim,clone(own),clone(foe),seed,{
    ownThree:ourThree,foeThree,reverse,rivalImmuneAware:true,
    ownOptions:{script:script('own',arm,ownRequests)},
    script:script('foe',arm,foeRequests)
   });
   assert.equal(r.errors,0,'all choices must be accepted: '+arm.id);
   assert.equal(ownRequests.length,1,'own T3 legal decision request: '+arm.id);
   assert.equal(foeRequests.length,1,'rival T3 legal decision request: '+arm.id);
   const before=beforeT3(r.log);
   assert.ok(before.includes('|turn|2'),'two turns must complete before intervention');
   const events=moveSeq(r.log,r.ownSide);
   const oursT1=eventSignature(events.own,1),oursT2=eventSignature(events.own,2);
   const foeT2=eventSignature(events.rival,2);
   if(arm.id==='baseline'){
    assert.match(oursT1,/Psychic Fangs/);
    assert.match(oursT2,/Psychic Fangs/);
    assert.match(foeT2,/Roost/);
   }else{
    assert.equal(before,pair[0].prefix,'the legal pre-T3 history must be identical');
    assert.deepEqual(ownRequests[0],pair[0].ownRequest,'same own HP/PP/moves at T3');
    assert.deepEqual(foeRequests[0],pair[0].foeRequest,'same foe HP/PP/moves at T3');
   }
   const row={seed,reverse,arm:arm.id,won:r.won,turns:r.turns,
    prefix:before,ownRequest:ownRequests[0],foeRequest:foeRequests[0],
    t3:turn3Events(r.log,r.ownSide),progress:progress(r.log,r.ownSide),
    ownMoveT1:oursT1,ownMoveT2:oursT2,foeMoveT2:foeT2};
   pair.push(row);
  }
  rows.push(...pair);
 }
 assert.equal(rows.length,32);
 const summary=arms.map(a=>{
  const subset=rows.filter(r=>r.arm===a.id);
  return {arm:a.id,games:subset.length,wins:subset.filter(r=>r.won).length,
   turns:subset.map(r=>r.turns),t3:subset.map(r=>r.t3),
   exampleProgress:subset[0].progress,
   t3OwnHP:subset.map(r=>r.ownRequest.hp),
   t3FoeHP:subset.map(r=>r.foeRequest.hp),
   t3OwnPP:subset[0].ownRequest.moves.map(m=>m.id+':'+m.pp),
   t3FoePP:subset[0].foeRequest.moves.map(m=>m.id+':'+m.pp)};
 });
 t.diagnostic('M7_STALL_LOOP_T3_COUNTERFACTUAL '+JSON.stringify({
  scope:'already used synthetic U-L, NOT holdout or human win rate',
  protocol:'same T1/T2 and same T3 request HP/PP per seed/seat, one legal T3 choice changes',
  opponent:'Salamence/Volcarona/Gholdengo; other six public; fixture sets NOT known to player',
  own:ourThree,seedCount:2,seatReversals:2,distinctPolicyArms:arms.length,
  note:'T3 intervention effects include subsequent heuristic Bot choices; a win is not proof of a robust human strategy. Repeated Roost or attacks are NOT automatically misplays.',
  summary
 }));
});
