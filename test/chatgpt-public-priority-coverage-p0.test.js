'use strict';
// PR #104 pre-registration #6559812495: public-six PRIORITY screening audit.
// Research-only: no claim about occurrence, active terrain or ranked wins.
const test=require('node:test');
const assert=require('node:assert/strict');
const {load}=require('../lab');
const {reportedLive}=require('../reported-live-roster-20261027');
const {candidates,publicCoverageBand}=require('../public-coverage-band');
const skip=!process.env.SHOWDOWN_DIR&&'SHOWDOWN_DIR unavailable';

test('P0 public six retains legal low-BP and terrain-conditional priority moves',{skip},t=>{
  const sim=load(),dex=sim.Dex.mod('champions');
  const own=reportedLive().find(p=>p.species==='Hydreigon');
  const checks=[
    ['Rillaboom','Grassy Glide','grassyterrain'],
    ['Dragonite','Extreme Speed',null],
    ['Lucario','Bullet Punch',null]
  ];
  const rows=[];
  for(const [foe,move,conditional] of checks){
    const m=dex.moves.get(move);
    assert.ok(m.exists&&m.category!=='Status',move+' must exist in pinned M-C');
    const c=candidates(sim,foe);
    const entry=c.legal.find(x=>x.move===move);
    assert.ok(entry,foe+' '+move+' must survive priority screening in a coherent legal four-move hypothesis');
    assert.equal(entry.priority,m.priority,'must preserve actual pinned priority');
    assert.equal(entry.conditionalPriority,conditional,'conditional priority is not unconditional');
    const band=publicCoverageBand(sim,own,foe);
    assert.ok(band.priorityThreats.some(x=>x.move===move),
      'priority risk must be visible even outside top-eight damage coverage');
    assert.ok(band.priorityThreats.every(x=>Number.isFinite(x.upperRatio)),
      'priority possibilities must not create NaN risk values');
    rows.push({foe,move,basePower:m.basePower,priority:m.priority,
      conditional,upperRatio:band.priorityThreats.find(x=>x.move===move).upperRatio});
  }
  t.diagnostic('P0 PUBLIC PRIORITY SCREEN '+JSON.stringify(rows));
});
