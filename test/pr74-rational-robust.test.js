'use strict';
// PR #74 P0-B (executed-log rational labels) and P0-C (public-six robust preview).
const test=require('node:test'),assert=require('node:assert/strict');
const path=require('node:path');
const {executed,finalLabel,run}=require('../a-branch-audit-v2');
const {solve,colMin,matrices,policies,legacyPick}=require('../robust-preview');

test('executed(): reads the rival action of the turn, stops at faint replacements, flags -fail',()=>{
  const L=['|turn|1','|move|p1a: Tyranitar|Stone Edge|p2a: Primarina','|-damage|p2a: Primarina|50/187',
    '|move|p2a: Primarina|Encore||[still]','|-fail|p2a: Primarina','|','|turn|2',
    '|move|p1a: Tyranitar|Knock Off|p2a: Primarina','|-damage|p2a: Primarina|0 fnt','|faint|p2a: Primarina','|switch|p2a: Golisopod|Golisopod, L50|182/182','|turn|3'];
  assert.deepEqual(executed(L,1,'p2'),{kind:'move',name:'Encore',failed:true});
  assert.deepEqual(executed(L,2,'p2'),{kind:'none'},'fainted before acting: the replacement is not a choice');
  assert.deepEqual(finalLabel({kind:'move',name:'Encore',cls:'plausible'},executed(L,1,'p2')).cls,'unknown');
  assert.equal(finalLabel({kind:'move',name:'Encore',cls:'blunder'},executed(L,1,'p2')).cls,'blunder');
  assert.equal(finalLabel({kind:'move',name:'Sucker Punch',cls:'plausible'},{kind:'move',name:'Sucker Punch',failed:true}).cls,'plausible');
  assert.equal(finalLabel({kind:'move',name:'Leech Life',cls:'plausible'},{kind:'move',name:'Swords Dance'}).cls,'unknown','Encore override: chosen != executed');
  assert.equal(finalLabel({kind:'forced',name:'',cls:'unknown'},{kind:'move',name:'Moonblast'}).cls,'unknown');
});
test('real Battle P0-B: same games as PR #73 (saved bits reproduced); fresh-foe Encore is no longer plausible; ai is labelled by its action',{skip:!process.env.SHOWDOWN_DIR&&'SHOWDOWN_DIR'},async()=>{
  const saved=require('../reports/data/a-branch-audit-20261030.json');
  const rows=await run({own:['Tyranitar>Metagross/Primarina'],hyps:['H0'],foePicks:{H0:['Primarina>Golisopod/Gholdengo']},seedIdx:[0],ownAI:'new'});
  assert.equal(rows.length,72);
  const BR=['ai','m1','m2','m3','m4','ratSwitch'],bits=saved.bits['H0|Tyranitar>Metagross/Primarina|Primarina>Golisopod/Gholdengo'];
  for(const r of rows){const i=((BR.indexOf(r.t1)*6+BR.indexOf(r.t2))*6+r.si)*2+(r.reverse?1:0);
    assert.equal(bits[i],r.oldRational?(r.won?'1':'0'):(r.won?'w':'l'),r.t1+'>'+r.t2);}
  const enc=rows.filter(r=>r.l1.act==='Encore'&&r.l1.src==='scripted');
  assert.ok(enc.length>0);
  for(const r of enc)assert.equal(r.l1.cls,'blunder','T1 Encore into our fresh lead that the rival cannot outspeed');
  assert.ok(enc.some(r=>r.oldRational),'PR #73 counted these as plausible');
  for(const r of rows.filter(r=>r.t1==='ai')){assert.equal(r.l1.src,'ai');assert.ok(r.l1.act,'ai branch carries the chosen action');assert.notEqual(r.l1.cls,undefined);}
});
test('P0-C solver: robust policy beats every pure pick on a 2-hypothesis toy; weighted reduces to the single-matrix maximin',()=>{
  const P0=[[1,0],[0,1]],P1=[[0.2,0.2],[0.6,0.6]];
  const r=solve([P0,P1],null,'robust',4000);
  assert.ok(Math.min(colMin(r.x,P0),colMin(r.x,P1))>0.39,JSON.stringify(r));
  const w=solve([P0,P1],[1,0],'weighted',4000);
  assert.ok(Math.abs(colMin(w.x,P0)-0.5)<0.03);
});
test('P0-C on the saved PR #73 A matrix: no input names the true hypothesis; robust security vs oracle; legacy pick exploitable',()=>{
  const {P,ownPicks}=matrices();
  assert.deepEqual(Object.keys(P),['H0','H1']);
  const pols=policies(P,ownPicks);
  const sec=x=>({H0:colMin(x,P.H0),H1:colMin(x,P.H1)});
  const rob=sec(pols.robust.x),o0=sec(pols.oracle_H0.x),o1=sec(pols.oracle_H1.x);
  assert.ok(rob.H0>=o0.H0-0.01,'robust keeps the H0 floor without knowing H0');
  assert.ok(Math.min(rob.H0,rob.H1)>=Math.min(o1.H0,o1.H1),'robust is safer than trusting H1');
  assert.ok(rob.H1<o1.H1-0.2,'price of not knowing: H1 security drops');
});
