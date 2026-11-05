'use strict';
// M8: public-information-only selection minimax. NOT a battle simulator.
// Scenario values must be pre-registered independent of the chosen selection.
// This module must never receive the actual hidden enemy three at decision time.
function choices(team) {
 if (!Array.isArray(team) || team.length !== 6) throw Error('exactly six required');
 const out=[];
 for(let a=0;a<4;a++)for(let b=a+1;b<5;b++)for(let c=b+1;c<6;c++){
  const three=[a,b,c];
  for(const lead of three)out.push({three,lead});
 }
 return out; // 20 triples x 3 leads = 60 public choices
}
function chooseRobust(team, publicSix, scenarios, evaluate) {
 if(!Array.isArray(publicSix)||publicSix.length!==6)throw Error('public enemy six required');
 if(!Array.isArray(scenarios)||!scenarios.length)throw Error('pre-registered scenarios required');
 if(typeof evaluate!=='function')throw Error('evaluation function required');
 const all=choices(team).map(choice=>{
  const scores=scenarios.map((scenario,index)=>{
   // Scenario represents an independent, rational enemy hypothesis. No
   // enemy three is exposed to the selection policy: evaluate is an offline
   // research oracle, not a deployable team-preview policy.
   const value=evaluate({team,publicSix,choice,scenario,index});
   if(!Number.isFinite(value)||value<0||value>1)throw Error('score must be in [0,1]');
   return value;
  });
  const worst=Math.min(...scores);
  const mean=scores.reduce((x,y)=>x+y,0)/scores.length;
  return {...choice,worst,mean,scores};
 });
 // Maximise the worst rational branch, then the average, with stable tie-break.
 all.sort((a,b)=>b.worst-a.worst||b.mean-a.mean||
  a.three.join(',').localeCompare(b.three.join(','))||a.lead-b.lead);
 return {selected:all[0],alternatives:all,scenarioCount:scenarios.length,
  caveat:'Offline scenario oracle only. Scores are not human win probabilities; scenarios and oracle require independent audit.'};
}
module.exports={choices,chooseRobust};
