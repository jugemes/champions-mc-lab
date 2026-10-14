'use strict';
// E revised team; Starmie Choice Scarf fourth move only.
const {teams}=require('./cycle3-teams');
function variants(){
 const original=teams().E_ee_primarina_for_skeledirge;
 const altered=structuredClone(original);
 const st=altered.find(p=>p.species==='Starmie');
 if(!st||st.moves.filter(m=>m==='Trick').length!==1)throw Error('Unexpected Starmie base set');
 st.moves=st.moves.map(m=>m==='Trick'?'Psychic':m);
 return {E_trick:structuredClone(original),E_psychic:altered};
}
module.exports={variants};