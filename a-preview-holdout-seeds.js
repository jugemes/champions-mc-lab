#!/usr/bin/env node
'use strict';
// PR #72: out-of-sample check of a-preview-matrix. Equilibrium picks chosen on
// 12 games per cell overfit noise (winner's curse). Re-play our equilibrium
// picks (weight >= 5%) and reference picks against the rival's equilibrium
// picks on FRESH seeds (bases 8150000/8250000/8450000, never used before in this
// repo) x side reversal, and compare the value vs the rival's equilibrium mix
// in-sample vs out-of-sample. Rival: baseline + ratSwitch when Encore-locked. Heuristic AI vs heuristic AI, NOT a ladder win rate.
//   SHOWDOWN_DIR=... MATRIX=reports/data/a-preview-matrix-20261030.json OUT=... node a-preview-holdout-seeds.js
const fs=require('node:fs');
const path=require('node:path');
const {hashSeed,load}=require('./lab');
const {reportedLive}=require('./reported-live-roster-20261027');
const {battle}=require('./encore-lead-audit');
const {hypotheses,encoreRat,OWN_AI}=require('./a-preview-matrix-audit');
const FRESH=()=>[8150000,8250000,8450000].flatMap(b=>[0,1].map(s=>hashSeed(b+s*10)));
const REF=['Primarina>Metagross/Garchomp','Garchomp>Metagross/Primarina','Primarina>Garchomp/Rotom-Wash'];
const parse=l=>{const [lead,rest]=l.split('>');return [lead,...rest.split('/')];};
async function main(){
  const sim=load(),H=hypotheses(),own=reportedLive(),rival=encoreRat(sim.Dex.mod('champions'));
  const matrix=JSON.parse(fs.readFileSync(process.env.MATRIX||path.join(__dirname,'reports','data','a-preview-matrix-20261030.json'),'utf8'));
  const out={showdown:'3a766f2cfb5e51c1e428cfe87d0dba91a8f01640',format:'gen9championsbssregmc',seeds:FRESH().map(s=>s.join('-')),ownAI:OWN_AI.new,results:{}};
  for(const hyp of ['H0','H1']){
    const a=matrix.grids[hyp+'|new'].analysis;
    const foe=a.foeEq.filter(x=>x.p>=0.05),z=foe.reduce((s,x)=>s+x.p,0);
    const picks=[...new Set([...a.ownEq.filter(x=>x.p>=0.05).map(x=>x.pick),...REF])];
    const res=out.results[hyp]={rivalMix:foe.map(x=>({pick:x.pick,w:+(x.p/z).toFixed(3)})),own:[]};
    for(const op of picks){
      const row={pick:op,inSample:a.own.find(o=>o.pick===op).vsEq,cells:{}};let v=0;
      for(const f of foe){
        let w=0,n=0;
        for(const seed of FRESH())for(const reverse of [false,true]){
          const r=await battle(sim,structuredClone(own),structuredClone(H[hyp]),seed,{ownThree:parse(op),foeThree:parse(f.pick),reverse,script:rival,ownOptions:OWN_AI.new});
          if(r.errors)throw Error('choice errors');w+=r.won;n++;
        }
        row.cells[f.pick]=w+'/'+n;v+=f.p/z*w/n;
      }
      row.outOfSample=+v.toFixed(3);res.own.push(row);
      console.log(hyp,op.padEnd(34),'in-sample vsEq',row.inSample,'fresh seeds',row.outOfSample,JSON.stringify(row.cells));
    }
  }
  const file=process.env.OUT||path.join(__dirname,'output','a-preview-holdout-seeds.json');
  fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(out,null,1));
}
if(require.main===module)main().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
