'use strict';
// M8 R9 comparison candidate, preregistered in PR #104 comment #6623251885.
// Only difference from R8: Heat Rotom => the user's reported live Wash Rotom.
// Research-only: NOT an adopted ladder roster.
const {build:buildR8,publicPlans:r8Plans}=require('./m8-r8-dual-setup-lucario');
const {reportedLive}=require('./reported-live-roster-20261027');
const copy=x=>structuredClone(x);
function build(){
 const six=buildR8(),wash=reportedLive().find(p=>p.species==='Rotom-Wash');
 if(!wash)throw Error('Live Wash Rotom fixture missing');
 const ix=six.findIndex(p=>p.species==='Rotom-Heat');
 if(ix<0)throw Error('R8 Heat Rotom role missing');
 six[ix]=copy(wash);
 return six;
}
const publicPlans=Object.fromEntries(Object.entries(r8Plans).map(([k,a])=>
 [k,k==='sun'?['Garchomp','Rotom-Wash','Lucario']:
      k==='charX'?['Mimikyu','Garchomp','Lucario']:
      a.map(s=>s==='Rotom-Heat'?'Rotom-Wash':s)]));
const pairedR8Plans=Object.fromEntries(Object.entries(r8Plans).map(([k,a])=>
 [k,k==='sun'?['Garchomp','Rotom-Heat','Lucario']:
      k==='charX'?['Mimikyu','Garchomp','Lucario']:a.slice()]));
module.exports={build,publicPlans,pairedR8Plans};
