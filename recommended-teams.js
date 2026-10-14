'use strict';
// Current LADDER TRIAL recommendation. Do not mutate fixtures.js,
// cycle3-teams.js or prior experimental baselines: those files are the
// reproducible definitions for reports written before 2026-10-14.
const {teams}=require('./cycle3-teams');
function currentTeams(){
 const t=teams();
 const C=structuredClone(t.C_rill_gholdengo_for_gengar);
 const E=structuredClone(t.E_ee_primarina_for_skeledirge);
 const st=E.find(p=>p.species==='Starmie');
 if(!st||!st.moves.includes('Trick'))throw Error('Historical Trick baseline unexpectedly changed');
 st.moves=st.moves.map(m=>m==='Trick'?'Psychic':m);
 return {C_final:C,E_final:E};
}
module.exports={currentTeams};
