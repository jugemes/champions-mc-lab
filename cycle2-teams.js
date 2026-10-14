'use strict';
// Cycle 2: specific roster countermeasures, NOT random swaps.
// C is weak into rain/Swampert and Archaludon; E often loses to boosted
// Gholdengo/Volcarona. Retain unchanged C/E as paired controls.
const {pool}=require('./optimize');
const {variants}=require('./fixtures');
function teams(){
  const base=pool(),C=base.C_master,E=base.E_megagolisopod;
  const replace=(team,remove,addition)=>{
    if(!team.some(p=>p.species===remove))throw Error('Not on team '+remove);
    return team.map(p=>structuredClone(p.species===remove?addition:p));
  };
  const rill=variants.A_rillaboom.find(p=>p.species==='Rillaboom');
  const elec=variants.B_eelektross.find(p=>p.species==='Eelektross');
  const star=variants.A_rillaboom.find(p=>p.species==='Starmie');
  const hydro=structuredClone(E);
  const s=hydro.find(p=>p.species==='Starmie');
  s.moves=s.moves.map(m=>m==='Trick'?'Thunderbolt':m);
  return {
    C_control:structuredClone(C),
    C_with_rillaboom:replace(C,'Corviknight',rill),
    C_with_eelektross:replace(C,'Corviknight',elec),
    C_with_starmie:replace(C,'Garchomp',star),
    E_control:structuredClone(E),
    E_with_eelektross_for_gold:replace(E,'Gholdengo',elec),
    E_with_eelektross_for_primarina:replace(E,'Primarina',elec),
    E_starmie_thunderbolt:hydro,
    B_control:structuredClone(base.B_eelektross)
  };
}
module.exports={teams};