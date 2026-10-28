'use strict';
/**
 * Preregistered six-visible counterfactual, NOT a production policy.
 *
 * Focus conditions came from the original environment catalog; new holdouts
 * intentionally mix Golisopod with other credible six-species archetypes,
 * including a BASE (non-Mega) Golisopod case.
 *
 * A lead/trio is selected from ONLY: user's own known six and the opposing
 * publicly displayed six SPECIES. Never change it based on the opposing
 * three that are independently assigned during the subsequent game.
 */
const {groups}=require('./environment-m7-teams');
const clone=structuredClone;
const lookup=(group,species)=>{
 const found=groups.find(x=>x.name===group)?.team.find(p=>p.species===species);
 if(!found)throw Error('Missing documented synthetic set '+group+'/'+species);
 return clone(found);
};
function customHoldouts(){
 const goli=lookup('01_M7_golisopod_balance','Golisopod');
 const holdouts=[
  {
   name:'HO_A_golisopod_plus_charizardY',
   six:[
    goli,lookup('03_M7_charizardY_offense','Charizard'),
    lookup('01_M7_golisopod_balance','Mimikyu'),
    lookup('07_M7_baxcalibur_offense','Baxcalibur'),
    lookup('01_M7_golisopod_balance','Gholdengo'),
    lookup('01_M7_golisopod_balance','Primarina')
   ],
   a:['Golisopod','Charizard','Mimikyu'],
   b:['Charizard','Baxcalibur','Primarina'],
   reason:'two different high-pressure Mega choices, both visible'
  },
  {
   name:'HO_B_golisopod_plus_lucarioZ',
   six:[
    goli,lookup('02_M7_lucarioZ_offense','Lucario'),
    lookup('01_M7_golisopod_balance','Garchomp'),
    lookup('01_M7_golisopod_balance','Primarina'),
    lookup('02_M7_lucarioZ_offense','Archaludon'),
    lookup('02_M7_lucarioZ_offense','Corviknight')
   ],
   a:['Golisopod','Lucario','Garchomp'],
   b:['Primarina','Archaludon','Corviknight'],
   reason:'fighting and fairy type responses matter as much as the Mega bug'
  },
  {
   name:'HO_C_golisopod_plus_rain',
   six:[
    goli,lookup('12_M7_rain','Pelipper'),
    lookup('12_M7_rain','Swampert'),
    lookup('12_M7_rain','Archaludon'),
    lookup('12_M7_rain','Gholdengo'),
    lookup('12_M7_rain','Rillaboom')
   ],
   a:['Golisopod','Pelipper','Swampert'],
   b:['Archaludon','Gholdengo','Rillaboom'],
   reason:'rain invalidates simplistic fire-only response, and rival backline is uncertain'
  },
  {
   name:'HO_D_base_golisopod',
   six:[
    {...goli,item:'Heavy-Duty Boots'},
    lookup('01_M7_golisopod_balance','Garchomp'),
    lookup('01_M7_golisopod_balance','Primarina'),
    lookup('01_M7_golisopod_balance','Mimikyu'),
    lookup('01_M7_golisopod_balance','Hippowdon'),
    lookup('01_M7_golisopod_balance','Gholdengo')
   ],
   a:['Golisopod','Garchomp','Mimikyu'],
   b:['Hippowdon','Primarina','Gholdengo'],
   reason:'same displayed six but a legal non-Mega item hypothesis; do not assume 100 percent Golisopodite'
  }
 ];
 return holdouts.map(x=>({
  name:x.name,tags:['new-holdout','golisopod'],team:x.six,
  forcedA:x.a,forcedB:x.b,holdoutReason:x.reason
 }));
}
const expectedSix=[
 'Metagross','Hydreigon','Primarina','Garchomp','Tyranitar','Rotom-Wash'
];
function publicGolisopodHypothesis(ownSix,opponentPublicSix,kind='fairy-steel-dragon'){
 if(ownSix.map(p=>p.species).join('/')!==expectedSix.join('/'))
  return null; // user did not approve use on another six
 if(!opponentPublicSix.includes('Golisopod'))return null;
 if(kind==='fairy-steel-dragon')return ['Primarina','Metagross','Hydreigon'];
 if(kind==='fairy-steel-ground')return ['Primarina','Metagross','Garchomp'];
 throw Error('Unknown declared pilot treatment: '+kind);
}
function allScenarios(){
 const focusNames=['01_M7_golisopod_balance',
  '06_M7_golisopod_basculegion','07_M7_baxcalibur_offense'];
 const focus=groups.filter(g=>focusNames.includes(g.name))
   .map(g=>({...g,isHoldout:false}));
 const out=customHoldouts().map(g=>({...g,isHoldout:true}));
 return [...focus,...out];
}
module.exports={customHoldouts,publicGolisopodHypothesis,allScenarios};
