'use strict';
// M8-OPEN1 preregistered in PR #104 comment #6625760347.
// Fully new structural competition; no preferred species is mandatory.
// All six member sets are from previously pinned M-C fixture hypotheses.
// Still research-only, NOT a team for the user's active ranked roster.
const {groups}=require('./environment-m7-teams');
const {variants,archetypes}=require('./fixtures');
const {reportedLive}=require('./reported-live-roster-20261027');
const {build:r5}=require('./m8-r5-balanced-threat-rebuild');
const c=x=>structuredClone(x);
function pick(team,species,item){
 const p=team.find(x=>x.species===species&&(!item||x.item===item));
 if(!p)throw Error('M8 OPEN1 fixture missing: '+species+' '+(item||''));
 return c(p);
}
const src={
 megaMence:()=>pick(groups[4].team,'Salamence','Salamencite'),
 heat:()=>pick(r5(),'Rotom-Heat'),
 wash:()=>pick(reportedLive(),'Rotom-Wash'),
 meta:()=>pick(reportedLive(),'Metagross','Metagrossite'),
 prim:()=>pick(reportedLive(),'Primarina'),
 rilla:()=>pick(variants.A_rillaboom,'Rillaboom'),
 gold:()=>pick(variants.A_rillaboom,'Gholdengo'),
 mimi:()=>pick(groups[0].team,'Mimikyu','Life Orb'),
 ske:()=>pick(archetypes.setup,'Skeledirge','Sitrus Berry'),
 bax:()=>pick(groups[6].team,'Baxcalibur','Focus Sash'),
 goli:()=>pick(groups[0].team,'Golisopod','Golisopite'),
 star:()=>pick(variants.A_rillaboom,'Starmie','Choice Scarf'),
 ttar:()=>pick(reportedLive(),'Tyranitar','Chople Berry'),
 corvi:()=>pick(variants.C_master,'Corviknight','Rocky Helmet'),
 garchZ:()=>pick(groups[8].team,'Garchomp','Garchompite Z')
};
const builders={
 O1_megaMence_flexible:()=>[src.megaMence(),src.heat(),src.prim(),src.rilla(),src.gold(),src.mimi()],
 O2_megaMetagross_unaware:()=>[src.meta(),src.wash(),src.ske(),src.rilla(),src.gold(),src.bax()],
 O3_megaGoli_sandTrick:()=>[src.goli(),src.star(),src.ske(),src.ttar(),src.rilla(),src.gold()],
 O4_megaGarchZ_antiSetup:()=>[src.garchZ(),src.heat(),src.corvi(),src.prim(),src.rilla(),src.mimi()]
};
// First name is our LEAD. Plans are keyed ONLY by the enemy's public-six ID,
// NOT by the enemy's selected trio, hidden sets, actual moves, or outcomes.
const plans={
 sun:{
  O1_megaMence_flexible:['Rotom-Heat','Salamence','Mimikyu'],
  O2_megaMetagross_unaware:['Metagross','Skeledirge','Rotom-Wash'],
  O3_megaGoli_sandTrick:['Tyranitar','Starmie','Skeledirge'],
  O4_megaGarchZ_antiSetup:['Rotom-Heat','Garchomp','Mimikyu']},
 rain:{
  O1_megaMence_flexible:['Rillaboom','Primarina','Gholdengo'],
  O2_megaMetagross_unaware:['Rillaboom','Rotom-Wash','Gholdengo'],
  O3_megaGoli_sandTrick:['Rillaboom','Starmie','Golisopod'],
  O4_megaGarchZ_antiSetup:['Rillaboom','Primarina','Garchomp']},
 mence:{
  O1_megaMence_flexible:['Mimikyu','Salamence','Gholdengo'],
  O2_megaMetagross_unaware:['Baxcalibur','Metagross','Gholdengo'],
  O3_megaGoli_sandTrick:['Starmie','Gholdengo','Skeledirge'],
  O4_megaGarchZ_antiSetup:['Mimikyu','Garchomp','Corviknight']},
 lucarioZ:{
  O1_megaMence_flexible:['Salamence','Rotom-Heat','Primarina'],
  O2_megaMetagross_unaware:['Skeledirge','Metagross','Rotom-Wash'],
  O3_megaGoli_sandTrick:['Skeledirge','Starmie','Gholdengo'],
  O4_megaGarchZ_antiSetup:['Garchomp','Primarina','Corviknight']},
 gyarados:{
  O1_megaMence_flexible:['Rotom-Heat','Mimikyu','Gholdengo'],
  O2_megaMetagross_unaware:['Rotom-Wash','Baxcalibur','Gholdengo'],
  O3_megaGoli_sandTrick:['Starmie','Skeledirge','Gholdengo'],
  O4_megaGarchZ_antiSetup:['Rotom-Heat','Mimikyu','Garchomp']},
 megaGolisopod:{
  O1_megaMence_flexible:['Rotom-Heat','Primarina','Gholdengo'],
  O2_megaMetagross_unaware:['Skeledirge','Metagross','Gholdengo'],
  O3_megaGoli_sandTrick:['Skeledirge','Golisopod','Starmie'],
  O4_megaGarchZ_antiSetup:['Rotom-Heat','Mimikyu','Garchomp']},
 psychic:{
  O1_megaMence_flexible:['Gholdengo','Primarina','Salamence'],
  O2_megaMetagross_unaware:['Gholdengo','Baxcalibur','Metagross'],
  O3_megaGoli_sandTrick:['Gholdengo','Skeledirge','Starmie'],
  O4_megaGarchZ_antiSetup:['Mimikyu','Corviknight','Garchomp']},
 volcarona:{
  O1_megaMence_flexible:['Salamence','Rotom-Heat','Gholdengo'],
  O2_megaMetagross_unaware:['Skeledirge','Baxcalibur','Gholdengo'],
  O3_megaGoli_sandTrick:['Tyranitar','Starmie','Gholdengo'],
  O4_megaGarchZ_antiSetup:['Rotom-Heat','Garchomp','Mimikyu']},
 stall:{
  O1_megaMence_flexible:['Gholdengo','Salamence','Rillaboom'],
  O2_megaMetagross_unaware:['Gholdengo','Skeledirge','Metagross'],
  O3_megaGoli_sandTrick:['Gholdengo','Starmie','Golisopod'],
  O4_megaGarchZ_antiSetup:['Garchomp','Rotom-Heat','Corviknight']},
 charX:{
  O1_megaMence_flexible:['Mimikyu','Primarina','Salamence'],
  O2_megaMetagross_unaware:['Baxcalibur','Rotom-Wash','Metagross'],
  O3_megaGoli_sandTrick:['Starmie','Tyranitar','Skeledirge'],
  O4_megaGarchZ_antiSetup:['Primarina','Garchomp','Mimikyu']},
 steelBunker:{
  O1_megaMence_flexible:['Gholdengo','Rotom-Heat','Rillaboom'],
  O2_megaMetagross_unaware:['Skeledirge','Gholdengo','Baxcalibur'],
  O3_megaGoli_sandTrick:['Skeledirge','Starmie','Gholdengo'],
  O4_megaGarchZ_antiSetup:['Garchomp','Rotom-Heat','Corviknight']},
 hazardShift:{
  O1_megaMence_flexible:['Gholdengo','Salamence','Rillaboom'],
  O2_megaMetagross_unaware:['Gholdengo','Skeledirge','Metagross'],
  O3_megaGoli_sandTrick:['Starmie','Gholdengo','Golisopod'],
  O4_megaGarchZ_antiSetup:['Garchomp','Corviknight','Mimikyu']},
 multiMega:{
  O1_megaMence_flexible:['Gholdengo','Salamence','Primarina'],
  O2_megaMetagross_unaware:['Metagross','Skeledirge','Baxcalibur'],
  O3_megaGoli_sandTrick:['Starmie','Golisopod','Skeledirge'],
  O4_megaGarchZ_antiSetup:['Garchomp','Primarina','Mimikyu']},
 rainPivot:{
  O1_megaMence_flexible:['Rillaboom','Primarina','Gholdengo'],
  O2_megaMetagross_unaware:['Rillaboom','Rotom-Wash','Gholdengo'],
  O3_megaGoli_sandTrick:['Rillaboom','Starmie','Golisopod'],
  O4_megaGarchZ_antiSetup:['Rillaboom','Primarina','Garchomp']},
 mixedElectric:{
  O1_megaMence_flexible:['Primarina','Salamence','Gholdengo'],
  O2_megaMetagross_unaware:['Baxcalibur','Metagross','Gholdengo'],
  O3_megaGoli_sandTrick:['Skeledirge','Starmie','Gholdengo'],
  O4_megaGarchZ_antiSetup:['Garchomp','Corviknight','Primarina']}
};
module.exports={builders,plans};
