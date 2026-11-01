'use strict';
// Cross-archetype evaluator audit. Do not change the legacy tag or saved results.
// A repeated setup move under an active Encore is mechanically forced if the
// player remains in. Whether refusing to switch was rational is a separate issue.
const test=require('node:test');
const assert=require('node:assert/strict');
const {load,normalize}=require('../lab');
const {reportedLive}=require('../reported-live-roster-20261027');
const {archetypes}=require('../fixtures');
const {misplays}=require('../legal-search-compare');
const skip=!process.env.SHOWDOWN_DIR&&'SHOWDOWN_DIR unavailable';

function run(sim,encore){
 const own=structuredClone(reportedLive()),foe=structuredClone(archetypes.setup);
 const validator=sim.TeamValidator.get('gen9championsbssregmc');
 assert.ok(!validator.validateTeam(normalize(own))?.length,'reported six legal');
 assert.ok(!validator.validateTeam(normalize(foe))?.length,'setup six legal');
 const battle=new sim.Battle({formatid:'gen9championsbssregmc',seed:[11,23,37,41]});
 battle.setPlayer('p1',{name:'p1',team:normalize(own)});
 battle.setPlayer('p2',{name:'p2',team:normalize(foe)});
 // Reported Primarina (slot 3) vs setup Salamence (slot 1).
 battle.choose('p1','team 312');
 battle.choose('p2','team 123');
 for(let turn=1;turn<=3;turn++){
  battle.choose('p1',encore&&turn===1?'move 4':'move 3'); // Encore / Aqua Jet
  battle.choose('p2','move 1'); // Dragon Dance
 }
 const log=battle.log.join('\n');
 const setup=log.split('\n').filter(x=>x.startsWith('|move|p2a: Salamence|Dragon Dance')).length;
 const encoreStart=log.split('\n').some(x=>x.startsWith('|-start|p2a: Salamence|Encore'));
 return {log,setup,encoreStart,tag:misplays(log).p2};
}

test('pinned Showdown: forced Encore setup and voluntary setup are conflated by legacy misplay tag',{skip},t=>{
 const sim=load();
 const forced=run(sim,true),voluntary=run(sim,false);
 assert.equal(forced.setup,3,'three actual setup moves under Encore');
 assert.equal(voluntary.setup,3,'three actual setup moves without Encore');
 assert.equal(forced.encoreStart,true,'Showdown confirms the Encore volatile');
 assert.equal(voluntary.encoreStart,false);
 assert.ok(forced.tag.setupSpam>0,'legacy tag marks repeated setup even when Encore is active');
 assert.ok(voluntary.tag.setupSpam>0,'legacy tag also marks voluntary repetition');
 t.diagnostic('ENCORE MISPLAY LABEL CONFOUND '+JSON.stringify({
  encore:{setup:forced.setup,encoreActive:true,tag:forced.tag},
  noEncore:{setup:voluntary.setup,encoreActive:false,tag:voluntary.tag},
  meaning:'setupSpam does not distinguish Encore-forced moves from freely selected setup; switching may still be rational'
 }));
});
