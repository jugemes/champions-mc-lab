'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const {variants}=require('../starmie-trick-psychic-variants');
const {extractStarmieUse,validate,args}=require('../starmie-trick-psychic-audit');
const sim=require(path.join(process.env.SHOWDOWN_DIR,'dist/sim/index.js'));
test('Trick vs Psychic is one legal move difference, everything else stays identical',()=>{
 const v=variants();
 assert.doesNotThrow(()=>validate(sim,v));
 const a=v.E_trick,b=v.E_psychic;
 assert.equal(a.length,6);assert.equal(b.length,6);
 for(let i=0;i<6;i++){
  if(a[i].species==='Starmie'){
   const x=structuredClone(a[i]),y=structuredClone(b[i]);
   x.moves=[];y.moves=[];
   assert.deepEqual(x,y);
   assert.deepEqual(a[i].moves.filter(m=>!b[i].moves.includes(m)),['Trick']);
   assert.deepEqual(b[i].moves.filter(m=>!a[i].moves.includes(m)),['Psychic']);
  }else assert.deepEqual(a[i],b[i]);
 }
});
test('real move log extracts a successful and failed Scarf Trick without counting opponent moves',()=>{
 const s='|move|p2a: Starmie|Trick|p1a: Toxapex\n|-activate|p2a: Starmie|move: Trick\n|-item|p1a: Toxapex|Choice Scarf|[from] move: Trick\n|-item|p2a: Starmie|Rocky Helmet|[from] move: Trick\n|move|p1a: Starmie|Trick|p2a: Starmie\n|move|p2a: Starmie|Psychic|p1a: Gengar\n|move|p2a: Starmie|Trick||[still]\n|-fail|p2a: Starmie';
 assert.deepEqual(extractStarmieUse(s,'p2'),{trick:2,swap:1,failed:1,psychic:1,targets:['p1a: Toxapex','']});
});
test('trial constraints',()=>{assert.equal(args(['--per-pair','100']).perPair,100);assert.throws(()=>args(['--per-pair','0']));});
