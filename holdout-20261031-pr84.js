'use strict';
// PR #84 request item 3: rival 3+lead cells that the PR #83 T1/T2 tables were
// NOT trained on, within the same known public sixes. Declared and committed
// BEFORE pr84-reaudit.js was run; not used to tune anything.
//   reLead   the rival's own legacy three (chooseThree, as in PR #83) with its
//            SECOND member leading: same three a rational rival already brings,
//            a different public lead.
//   aceAlt   the first pick (by a fixed hash of the label) among picks that
//            contain the case ace, have the ace in the back, and are none of the
//            PR #83 cells nor reLead: the ace is held back instead of led.
// Seeds: fresh HOLD seeds hashSeed(8450000+ci*100+{0,1}), both sides; never
// used by PR #82/#83 (train 8200000+, test 8250000+).
const crypto=require('node:crypto');
const h=s=>crypto.createHash('sha256').update(s).digest('hex');
function holdoutCells({picks,label,legacy,ace,used}){
  const usedSet=new Set(used.map(p=>p.join('/')));
  const reLead=[legacy[1],legacy[0],legacy[2]];
  const out=[];
  if(!usedSet.has(reLead.join('/'))){out.push({src:'reLead',foe:reLead});usedSet.add(reLead.join('/'));}
  const cand=picks.filter(p=>p.includes(ace)&&p[0]!==ace&&!usedSet.has(p.join('/')))
    .sort((a,b)=>h(label(a))<h(label(b))?-1:1);
  if(cand[0])out.push({src:'aceAlt',foe:cand[0]});
  return out;
}
const HOLD_SEED_BASE=8450000;
module.exports={holdoutCells,HOLD_SEED_BASE};
