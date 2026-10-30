'use strict';
// PR #59 holdout opponent sixes, written BEFORE threat-aware-v2 was tuned or
// run against them. Constructed teams with legal M-C hypothesis sets, NOT
// sampled ladder rosters. Hidden sets are only used to RUN battles; preview
// policies receive species names only.
// Sets are copied from existing fixtures; Indeedee sets are the PR #46
// hypotheses (hybrid01-audit.js). Item clause forces some item swaps (noted).
const {variants,archetypes}=require('./fixtures');
const {opponents}=require('./threat-scenarios-20261014');
const {opponents:pool}=require('./preview-opponents');
const {groups}=require('./environment-m7-teams');
const {INDEEDEE_HYPOTHESES}=require('./hybrid01-audit');
const all=()=>[...Object.values(archetypes),...Object.values(variants),...Object.values(opponents),...Object.values(pool),...groups.map(g=>g.team)].flat();
const find=(species,pred=()=>true)=>{
  const p=all().find(x=>x.species===species&&pred(x));
  if(!p)throw Error('Missing fixture set '+species);
  return structuredClone(p);
};
const withItem=(p,item)=>({...p,item});
function teams(){
  const scarfChomp=find('Garchomp',p=>p.item==='Choice Scarf');
  const zChomp=find('Garchomp',p=>p.item==='Garchompite Z');
  const indeedeeSix=(indeedee,chomp)=>[structuredClone(indeedee),find('Hippowdon'),chomp,
    withItem(find('Umbreon'),'Rocky Helmet'), // Leftovers is on Hippowdon (item clause)
    find('Gengar'),find('Gyarados')];
  return {
    // docs/REAL-BATTLE-CASES-2026-10-27.md case B public six; Indeedee item unknown.
    realB_indeedee_scarf:{team:indeedeeSix(INDEEDEE_HYPOTHESES.scarf_timid_c32,zChomp),
      forcedA:['Indeedee','Garchomp','Gengar'],forcedB:['Gyarados','Hippowdon','Umbreon']},
    realB_indeedee_sash:{team:indeedeeSix(INDEEDEE_HYPOTHESES.sash_timid_c32,scarfChomp),
      forcedA:['Indeedee','Garchomp','Gengar'],forcedB:['Gyarados','Hippowdon','Umbreon']},
    realB_indeedee_quickclaw:{team:indeedeeSix(INDEEDEE_HYPOTHESES.quickclaw_timid_c32,scarfChomp),
      forcedA:['Indeedee','Garchomp','Gengar'],forcedB:['Gyarados','Hippowdon','Umbreon']},
    new_psychic_offense:{team:[find('Alakazam'),find('Sneasler'),find('Starmie'),find('Armarouge'),find('Swampert'),find('Gyarados')],
      forcedA:['Alakazam','Sneasler','Starmie'],forcedB:['Swampert','Armarouge','Gyarados']},
    new_sun_balance:{team:[find('Charizard',p=>p.item==='Charizardite Y'),find('Eelektross'),find('Dragonite'),
      withItem(find('Toxapex'),'Leftovers'), // Rocky Helmet is on Eelektross (Black Sludge is not in M-C)
      find('Basculegion'),find('Skarmory')],
      forcedA:['Charizard','Dragonite','Basculegion'],forcedB:['Toxapex','Skarmory','Eelektross']},
  };
}
module.exports={teams};
