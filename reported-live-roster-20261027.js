'use strict';
// The six the user REPORTED using on ladder since 2026-10-18, transcribed from
// docs/REAL-BATTLE-CASES-2026-10-27.md. It is a record of the user's report,
// NOT a new proposal and NOT a re-photographed in-game check.
// provisional-rank-roster-20261018.js is intentionally left unchanged so that
// anything run with it stays reproducible; the two differ only where listed in
// DIFF_FROM_PROVISIONAL below.
const {provisional}=require('./provisional-rank-roster-20261018');
function reportedLive(){
 const team=provisional();
 const metagross=team.find(p=>p.species==='Metagross');
 if(!metagross||!metagross.moves.includes('Zen Headbutt'))
  throw Error('provisional roster changed; re-audit before deriving the live roster');
 metagross.moves=metagross.moves.map(m=>m==='Zen Headbutt'?'Psychic Fangs':m);
 return team;
}
const DIFF_FROM_PROVISIONAL=[
 {species:'Metagross',field:'moves',provisional:'Zen Headbutt',reported:'Psychic Fangs',
  source:'user screenshot reported to ChatGPT (docs/REAL-BATTLE-CASES-2026-10-27.md)'}
];
// Fields that are in the code but were NOT confirmed by the report. They are
// placeholders copied from the provisional file, not observations.
const UNVERIFIED=[
 {species:'Metagross',field:'ability',value:'Clear Body',
  note:'pre-Mega ability only; Clear Body and Light Metal are both legal. After Mega it is Tough Claws regardless.'},
 {species:'Hydreigon',field:'item',value:'Life Orb',
  note:'set the user asked to train; holding it in battle not yet directly evidenced.'},
 {species:'*',field:'ivs',value:'31 all',note:'not reported; lab.normalize() always assumes 31.'}
];
module.exports={reportedLive,DIFF_FROM_PROVISIONAL,UNVERIFIED};
