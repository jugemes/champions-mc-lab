'use strict';
// PR #100 request item 4: legality of the immune-aware rival's re-decision.
// Reproduce the ChatGPT synthetic counterexample on the ORIGINAL pr98/pr96
// wrappers, fix it in pr100-legal.js, and check on the pinned Showdown that
// the fixed wrapper sends no illegal choice and never re-sends a masked slot.
const test=require('node:test'),assert=require('node:assert/strict');
const haveSD=!!process.env.SHOWDOWN_DIR;
const skip=!haveSD&&'SHOWDOWN_DIR not set';
const X=require('../pr96-paired');
const Y=require('../pr98-timing');
const Z=require('../pr100-legal');

const mvs=(names,extra={})=>names.map(m=>({move:m,id:m.toLowerCase().replace(/[^a-z]/g,''),pp:8,maxpp:8,target:'normal',disabled:false,...(extra[m]||{})}));
const mkReq=(moves,{trapped=false,bench=true,item='Focus Sash',ability='moldbreaker'}={})=>({active:[{moves,...(trapped?{trapped:true}:{})}],
  side:{pokemon:[{active:true,ability,item,condition:'100/100',details:'Excadrill, L50'},{active:false,condition:bench?'100/100':'0 fnt',details:'Hydreigon, L50'}]}});
const bot0=()=>({foeActive:'Garchomp',foeItem:'Air Balloon',foeAbility:'',switches:0,terrain:'',dex:null});
// a script that IGNORES `disabled` (the ChatGPT counterexample): always move 1
const stubborn=()=>'move 1';

test('legalUnder100: moves, Mega, pp, disabled, switches, trapped',()=>{
  const r=mkReq(mvs(['Earthquake','Iron Head'],{'Iron Head':{pp:0}}));
  assert.equal(Z.legalUnder100(r,'move 1'),true);
  assert.equal(Z.legalUnder100(r,'move 2'),false,'pp 0');
  assert.equal(Z.legalUnder100(r,'move 3'),false,'no slot');
  assert.equal(Z.legalUnder100(r,'move 1 mega'),false,'cannot Mega');
  assert.equal(Z.legalUnder100(r,'switch 2'),true);
  assert.equal(Z.legalUnder100(r,'switch 1'),false,'active');
  assert.equal(Z.legalUnder100(mkReq(mvs(['Earthquake']),{bench:false}),'switch 2'),false,'fainted');
  assert.equal(Z.legalUnder100(mkReq(mvs(['Earthquake']),{trapped:true}),'switch 2'),false,'trapped');
  for(const c of [null,'default','',undefined])assert.equal(Z.legalUnder100(r,c),false);
  const d=mkReq(mvs(['Earthquake','Iron Head'],{Earthquake:{disabled:true}}));assert.equal(Z.legalUnder100(d,'move 1'),false);
});

test('new P1 reproduced on the ORIGINAL pr98 and pr96 wrappers, fixed in pr100',{skip},()=>{
  const {load}=require('../lab');const dex=load().Dex.mod('champions');
  const req=mkReq(mvs(['Earthquake','Iron Head']));
  // pr98: Earthquake (slot 1) masked by the public balloon, script still returns move 1
  {const rec={},out=Y.immuneAware98(stubborn,dex,rec)(structuredClone(req),{...bot0(),dex},{turn:3});
    assert.equal(out,'move 1','pr98 sends the masked slot (the P1)');assert.equal(rec.masked[0].replacement,'move:Earthquake');}
  // pr96 has the same shape (without Mold Breaker the balloon is in its list too)
  {const rec={},r=mkReq(mvs(['Earthquake','Iron Head']),{ability:'sandrush'});
    assert.equal(X.immuneAware(stubborn,dex,rec)(r,{...bot0(),dex},{turn:3}),'move 1');assert.equal(rec.masked[0].replacement,'move:Earthquake');}
  // pr100: rejected, the base AI on req2 picks the only unmasked move
  {const rec={},b={...bot0(),dex};Object.setPrototypeOf(b,require('../lab').Bot.prototype);
    Object.assign(b,{team:[{species:'Excadrill',moves:['Earthquake','Iron Head'],item:'Focus Sash',ability:'Mold Breaker',evs:{atk:32,spe:32,hp:2},nature:'Jolly'},...require('../reported-live-roster-20261027').reportedLive().filter(x=>x.species==='Hydreigon')],
      side:'p2',foe:'p1',boosts:{},foeBoosts:{},hazards:{},seenMoves:{},lastStatuses:{},errors:0,random:()=>0.5,turn:3,foeHP:1});
    const out=Z.immuneAware100(stubborn,dex,rec)(structuredClone(req),b,{turn:3});
    assert.equal(out,'move 2');assert.deepEqual(rec.rejected,[{turn:3,choice:'move 1',masked:['Earthquake']}]);
    assert.equal(rec.masked[0].replacement,'move:Iron Head');assert.equal(rec.masked[0].via,'base');}
});

test('pr100 fallbacks: no unmasked move -> switch; trapped / no bench -> forced with a reason; Choice/Encore one-move request',{skip},()=>{
  const {load}=require('../lab');const dex=load().Dex.mod('champions');
  const bot=()=>({...bot0(),dex});
  // only Earthquake has PP left: switch
  {const rec={},r=mkReq(mvs(['Earthquake','Iron Head'],{'Iron Head':{pp:0}}));
    assert.equal(Z.immuneAware100(stubborn,dex,rec)(r,bot(),{turn:2}),'switch 2');assert.equal(rec.masked[0].replacement,'switch');}
  // trapped: forced, original sent, reason recorded
  {const rec={},r=mkReq(mvs(['Earthquake','Iron Head'],{'Iron Head':{pp:0}}),{trapped:true});
    assert.equal(Z.immuneAware100(stubborn,dex,rec)(r,bot(),{turn:2}),'move 1');assert.deepEqual([rec.masked[0].replacement,rec.masked[0].reason],['none (no alternative)','trapped']);}
  // Choice / Encore lock: Showdown disables the other slots in the request; last mon: forced
  {const rec={},r=mkReq(mvs(['Earthquake','Iron Head'],{'Iron Head':{disabled:true}}),{bench:false});
    assert.equal(Z.immuneAware100(stubborn,dex,rec)(r,bot(),{turn:4}),'move 1');assert.equal(rec.masked[0].reason,'no bench');}
  // same lock with a bench: switch (and pr98 agrees here: null-safe path)
  {const rec={},r=mkReq(mvs(['Earthquake','Iron Head'],{'Iron Head':{disabled:true}}));
    assert.equal(Z.immuneAware100(stubborn,dex,rec)(r,bot(),{turn:4}),'switch 2');
    const r8={};assert.equal(Y.immuneAware98(stubborn,dex,r8)(structuredClone(r),bot(),{turn:4}),'switch 2');}
  // identity with pr98 for a script that respects `disabled`
  {const polite=req=>{const i=req.active[0].moves.findIndex(m=>!m.disabled&&m.pp>0);return 'move '+(i+1);};
    const a={},b={},r=mkReq(mvs(['Earthquake','Iron Head']));
    assert.equal(Z.immuneAware100(polite,dex,a)(structuredClone(r),bot(),{turn:1}),Y.immuneAware98(polite,dex,b)(structuredClone(r),bot(),{turn:1}));
    assert.deepEqual(a,b);}
});

test('public grounding: Gravity / public Iron Ball remove Ground immunities from the mask (type, Levitate, Air Balloon)',{skip},()=>{
  const {load}=require('../lab');const dex=load().Dex.mod('champions');
  const r=mkReq(mvs(['Earthquake','Iron Head']),{ability:'sandrush'}),im=(f,b)=>f(dex,r,{foeAbility:'',foeItem:'',terrain:'',...b}).map(x=>x.move);
  for(const b of [{foeActive:'Rotom-Wash'},{foeActive:'Garchomp',foeItem:'Air Balloon'},{foeActive:'Corviknight'}]){
    assert.deepEqual(im(Y.publicImmuneMoves98,b),['Earthquake']);assert.deepEqual(im(Z.publicImmuneMoves100,b),['Earthquake'],'not grounded: unchanged');
    assert.deepEqual(im(Z.publicImmuneMoves100,{...b,terrain:'gravity'}),[]);
    assert.deepEqual(im(Z.publicImmuneMoves100,{...b,foeItem:'Iron Ball'}),[]);}
  // non-Ground immunities are unaffected by grounding
  const g=mkReq(mvs(['Shadow Ball','Thunderbolt']),{ability:'sandrush'});
  assert.deepEqual(Z.publicImmuneMoves100(dex,g,{foeActive:'Snorlax',foeAbility:'',foeItem:'',terrain:'gravity'}).map(x=>x.move),['Shadow Ball']);
});

// ---------- pinned Showdown battles ----------
const validate=(sim,team)=>{const {normalize}=require('../lab');return sim.TeamValidator.get('gen9championsbssregmc').validateTeam(normalize(team))||[];};
const forceMove=(name,turns)=>(req,bot,info)=>{if(!turns.includes(info.turn))return null;
  const i=req.active?.[0]?.moves.findIndex(m=>m.move===name&&!m.disabled);return i>=0?'move '+(i+1):null;};
// ignores `disabled` on the listed turns (the counterexample shape)
const forceMoveIgnoringDisabled=(name,turns)=>(req,bot,info)=>{if(!turns.includes(info.turn))return null;
  const i=req.active?.[0]?.moves.findIndex(m=>m.move===name);return i>=0?'move '+(i+1):null;};

test('pinned Showdown: a disabled-ignoring rival script into a public Air Balloon; pr98 re-sends Earthquake, pr100 does not',{skip},async()=>{
  const {load,hashSeed}=require('../lab');const {battle}=require('../encore-lead-audit');
  const sim=load(),dex=sim.Dex.mod('champions');
  const live=require('../reported-live-roster-20261027').reportedLive();
  // TEST-ONLY variants (same as test/pr98.test.js; not a breeding recommendation)
  const own=live.map(p=>p.species==='Garchomp'?{...p,item:'Air Balloon',moves:['Earthquake','Dragon Claw','Rock Slide','Swords Dance']}:p);
  const exc={species:'Excadrill',item:'Focus Sash',ability:'Mold Breaker',nature:'Jolly',moves:['Earthquake','Iron Head','Rock Slide','Swords Dance'],evs:{hp:2,atk:32,spe:32}};
  const rival=live.map(p=>p.species==='Tyranitar'?exc:p);
  assert.deepEqual(validate(sim,own),[]);assert.deepEqual(validate(sim,rival),[]);
  const out={};
  for(const v of ['pr98','pr100']){
    const rec={},rs=forceMoveIgnoringDisabled('Earthquake',[1]);
    const script=v==='pr98'?Y.immuneAware98(rs,dex,rec):Z.immuneAware100(rs,dex,rec);
    const g=await battle(sim,structuredClone(own),structuredClone(rival),hashSeed(10000100),{ownThree:['Garchomp','Rotom-Wash','Metagross'],foeThree:['Excadrill','Hydreigon','Primarina'],
      script,ownOptions:{script:forceMove('Swords Dance',[1])}});
    const L=g.log.split('\n'),t1=L.indexOf('|turn|1'),t2=L.indexOf('|turn|2'),T1=L.slice(t1,t2>0?t2:undefined);
    out[v]={errors:g.errors,eq:T1.some(l=>/\|move\|[^|]*Excadrill\|Earthquake\|/.test(l)),imm:T1.some(l=>l.startsWith('|-immune|'+g.ownSide+'a: Garchomp')),
      masked:(rec.masked||[]).filter(m=>m.turn===1),rejected:rec.rejected||[]};
  }
  assert.equal(out.pr98.errors,0,'the engine accepts it: the slot is not disabled in the real request');
  assert.ok(out.pr98.eq&&out.pr98.imm,'pr98: Earthquake into the public balloon still happens (P1 on the real engine)');
  assert.equal(out.pr98.masked[0].replacement,'move:Earthquake','pr98 record claims a replacement that is the masked move');
  assert.equal(out.pr100.errors,0);assert.ok(!out.pr100.eq,'pr100: no T1 Earthquake');
  assert.deepEqual(out.pr100.rejected.map(x=>[x.turn,x.choice]),[[1,'move 1']]);
  assert.notEqual(out.pr100.masked[0].replacement,'move:Earthquake');
});

test('pinned Showdown: Gravity grounds Levitate; pr98 masks the Earthquake, pr100 lets it hit',{skip},async()=>{
  const {load,hashSeed}=require('../lab');const {battle}=require('../encore-lead-audit');
  const sim=load(),dex=sim.Dex.mod('champions');
  const live=require('../reported-live-roster-20261027').reportedLive();
  // TEST-ONLY rival Forretress (legal Gravity + Earthquake user), our live six unchanged
  const gar={species:'Forretress',item:'Leftovers',ability:'Sturdy',nature:'Relaxed',moves:['Gravity','Earthquake','Gyro Ball','Rapid Spin'],evs:{hp:32,spd:32,atk:2}};
  const rival=live.map(p=>p.species==='Tyranitar'?gar:p.species==='Rotom-Wash'?{...p,item:'Sitrus Berry'}:p.species==='Primarina'?{...p,item:'Mystic Water'}:p);
  assert.deepEqual(validate(sim,live),[]);assert.deepEqual(validate(sim,rival),[]);
  const out={};
  for(const v of ['naive','pr98','pr100']){
    const rec={},rs=(req,bot,info)=>forceMove('Gravity',[1])(req,bot,info)||forceMove('Earthquake',[2])(req,bot,info);
    const script=v==='naive'?rs:v==='pr98'?Y.immuneAware98(rs,dex,rec):Z.immuneAware100(rs,dex,rec);
    const g=await battle(sim,structuredClone(live),structuredClone(rival),hashSeed(10000200),{ownThree:['Rotom-Wash','Hydreigon','Metagross'],foeThree:['Forretress','Hydreigon','Garchomp'],
      script,ownOptions:{script:forceMove('Will-O-Wisp',[1,2])}});
    const L=g.log.split('\n'),t2=L.indexOf('|turn|2'),t3=L.indexOf('|turn|3'),T2=L.slice(t2,t3>0?t3:undefined),me=g.ownSide;
    assert.ok(L.slice(0,t2).some(l=>/^\|-fieldstart\|move: Gravity/.test(l)),v+': Gravity public before the T2 choice');
    out[v]={errors:g.errors,eq:T2.some(l=>/\|move\|[^|]*Forretress\|Earthquake\|p.a: Rotom/.test(l)),imm:T2.some(l=>l.startsWith('|-immune|'+me+'a: Rotom')),
      dmg:T2.some(l=>l.startsWith('|-damage|'+me+'a: Rotom')),masked:(rec.masked||[]).filter(m=>m.turn===2)};
  }
  assert.ok(out.naive.eq&&!out.naive.imm&&out.naive.dmg,'engine: Earthquake hits Levitate Rotom-Wash under Gravity');
  assert.equal(out.pr98.masked.length,1,'pr98 over-masks a grounded target');assert.ok(!out.pr98.eq);
  assert.equal(out.pr100.masked.length,0);assert.ok(out.pr100.eq&&out.pr100.dmg);
  for(const v of Object.keys(out))assert.equal(out[v].errors,0);
});
