'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {policyStatusScore,shouldScriptedSetup,shouldScriptedRegen}=require('../tactics');
const context={ratio:1,turn:2,boosts:{},foeBoosts:{},foeSpecies:'Toxapex',foeHP:1,foeStatus:'',foeLastMove:'',foeLastMoveTurn:-100,ownItem:'Choice Scarf',lastStatuses:{},hazards:{}};
test('never recover at full health',()=>assert.equal(policyStatusScore('Recover',context),0));
test('recovery becomes attractive at low health',()=>assert.ok(policyStatusScore('Recover',{...context,ratio:0.30})>=180));
test('Haze requires observed enemy boosting',()=>{
  assert.equal(policyStatusScore('Haze',context),0);
  assert.ok(policyStatusScore('Haze',{...context,foeBoosts:{atk:2}})>130);
});
test('Encore only if opponent used a lockable move recently',()=>{
  assert.equal(policyStatusScore('Encore',context),0);
  assert.ok(policyStatusScore('Encore',{...context,foeLastMove:'Quiver Dance',foeLastMoveTurn:1})>150);
  assert.equal(policyStatusScore('Encore',{...context,foeLastMove:'Quiver Dance',foeLastMoveTurn:-3}),0);
});
test('Do not use setup when already +2 with a double-boost move',()=>{
  assert.ok(policyStatusScore('Swords Dance',{...context,foeSpecies:'Umbreon'})>80);
  assert.equal(policyStatusScore('Swords Dance',{...context,boosts:{atk:2}}),0);
  assert.equal(policyStatusScore('Nasty Plot',{...context,foeAbility:'Unaware'}),0);
});
test('Do not repeat Toxic Spikes once recorded',()=>{
  assert.ok(policyStatusScore('Toxic Spikes',context)>30);
  assert.equal(policyStatusScore('Toxic Spikes',{...context,hazards:{toxicspikes:1}}),0);
});
test('Trick becomes attractive into known passive defenders, not after use',()=>{
  assert.ok(policyStatusScore('Trick',context)>120);
  assert.equal(policyStatusScore('Trick',{...context,lastStatuses:{trickDone:true}}),0);
});
test('Scripted setup only targets the opposing stall/setup scenario',()=>{
  assert.equal(shouldScriptedSetup({scenario:'setup',ownSpecies:'Salamence',stage:{},ratio:1,turn:1}),'dragondance');
  assert.equal(shouldScriptedSetup({scenario:'setup',ownSpecies:'Volcarona',stage:{},ratio:1,turn:1}),'quiverdance');
  assert.equal(shouldScriptedSetup({scenario:'setup',ownSpecies:'Salamence',stage:{atk:1},ratio:1,turn:1}),null);
  assert.equal(shouldScriptedSetup({scenario:'rain',ownSpecies:'Salamence',stage:{},ratio:1,turn:1}),null);
});
test('Regenerator script only swaps a damaged Toxapex',()=>{
  assert.equal(shouldScriptedRegen({scenario:'stall',ownSpecies:'Toxapex',ratio:.6,turn:2,switches:0}),true);
  assert.equal(shouldScriptedRegen({scenario:'stall',ownSpecies:'Toxapex',ratio:1,turn:2,switches:0}),false);
  assert.equal(shouldScriptedRegen({scenario:'setup',ownSpecies:'Toxapex',ratio:.6,turn:2,switches:0}),false);
});
