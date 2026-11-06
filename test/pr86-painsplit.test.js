'use strict';
// PR #86 / PR #84 comment #6537030779: Pain Split by actual HP, public bounds only.
const test=require('node:test'),assert=require('node:assert/strict');
const path=require('node:path');
const sim=require(path.join(process.env.SHOWDOWN_DIR,'dist/sim/index.js'));
const M=require('../pr82-switch-utility-t1t2');
const P=require('../pr86-painsplit');
const C=require('../pr84-public-cond-entry');
const dex=sim.Dex.mod('champions');

test('ChatGPT counterexamples: PR #83 fraction label is reversed; V2 by actual HP',()=>{
  // user 90/200 (45%), target 80/100 (80%): average 85 -> user -5 HP
  assert.equal(M.rationalityFromState('Pain Split',{user:{hp:0.45},target:{hp:0.8}})[0],'rational','PR #83 label reproduced');
  assert.equal(P.painSplitRationality(90,0.8,[100,100])[0],'irrational');
  // user 80/100 (80%), target 100/200 (50%): average 90 -> user +10 HP
  assert.equal(M.rationalityFromState('Pain Split',{user:{hp:0.8},target:{hp:0.5}})[0],'irrational','PR #83 label reproduced');
  assert.equal(P.painSplitRationality(80,0.5,[200,200])[0],'rational');
});
test('max HP not public: bracketing range -> unknown, never a guessed max HP',()=>{
  const r=P.maxHPRange(dex,'Garchomp');assert.deepEqual(r,[108+75,108+75+32]);
  assert.equal(P.painSplitRationality(150,0.8,r)[0],'unknown');     // 147..172
  assert.equal(P.painSplitRationality(100,0.8,r)[0],'rational');
  assert.equal(P.painSplitRationality(180,0.8,r)[0],'irrational');
  assert.equal(P.painSplitRationality(100,null,r)[0],'unknown');
});
test('Pain Split is legal in M-C (HX_sand Rotom-Heat set validates) and real HP matches the formula',()=>{
  const v=sim.TeamValidator.get('gen9championsbssregmc');
  const set={species:'Rotom-Heat',item:'Sitrus Berry',ability:'Levitate',nature:'Bold',moves:['Will-O-Wisp','Overheat','Volt Switch','Pain Split'],evs:{hp:32,def:32,spa:2},level:50};
  assert.equal(v.validateSet(set,{}),null);
  const b=new sim.Battle({formatid:'gen9championsbssregmc'});
  b.setPlayer('p1',{team:[set]});b.setPlayer('p2',{team:[{...set,evs:{def:32,spa:32}}]});
  const [lo,hi]=P.maxHPRange(dex,'Rotom-Heat');
  assert.equal(b.p1.pokemon[0].maxhp,hi);assert.equal(b.p2.pokemon[0].maxhp,lo);
});
test('decideEarlyV3 without legal: tabled rule is not returned (PR #84 comment boundary)',()=>{
  const six=['A','B','C','D','E','F'],own=['X','Y','Z'];
  const o={publicSix:six,ownThree:own,turn:1,rivalActive:'A',legal:['move:Moonblast']};
  const t={rules:{[C.obsKeyV3(o)]:{status:'rule',action:'move:Moonblast'}}};
  assert.equal(C.decideEarlyV3(t,o).status,'rule');
  const {legal,...noLegal}=o;
  assert.notEqual(C.decideEarlyV3(t,noLegal).status,'rule');
});
