'use strict';
// Simplified, auditable move valuation, NOT an expert or learned policy.
// No access to the opponent's hidden party, moves, item, or stats.
const BOOSTS={swordsdance:['atk',2],nastyplot:['spa',2],dragondance:['atk',1],quiverdance:['spa',1]};
const HEAL=new Set(['recover','slackoff','roost','softboiled','moonlight']);
const PASSIVE=new Set(['toxapex','umbreon','corviknight','skarmory','slowbro','blissey']);
const SETUP=new Set(['swordsdance','nastyplot','dragondance','quiverdance']);
const CONTROLS=new Set(['swordsdance','nastyplot','dragondance','quiverdance','recover','slackoff','roost','softboiled','moonlight','haze']);
const boost=(o,kind)=>Number(o?.[kind]||0);
const canonical=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
function policyStatusScore(move,{ratio,turn,boosts={},foeBoosts={},foeSpecies='',foeHP=1,foeStatus='',foeLastMove='',foeLastMoveTurn=-999,foeAbility='',ownItem='',ownSpecies='',lastStatuses={},hazards={},foeEncoreActive=false}){
  const id=canonical(move),foe=canonical(foeSpecies),my=canonical(ownSpecies);
  const saved=Math.max(boost(foeBoosts,'atk'),boost(foeBoosts,'spa'),boost(foeBoosts,'spe'));
  const hp=Number.isFinite(ratio)?ratio:1;
  const passive=PASSIVE.has(foe);
  if(HEAL.has(id)){
    // Avoid healing at full HP or repeatedly wasting turns as opponent heals.
    if(hp>=0.77)return 0;
    return hp<0.34?205:hp<0.50?155:hp<0.65?108:58;
  }
  if(SETUP.has(id)){
    if(canonical(foeAbility)==='unaware')return 0;
    const [stat,gain]=BOOSTS[id];
    const stage=boost(boosts,stat);
    const speed=boost(boosts,'spe');
    if(stage>=4||stage>=2 && (id==='swordsdance'||id==='nastyplot'))return 0;
    if(hp<0.62)return 0;
    if((id==='dragondance'||id==='quiverdance')&&speed>=2)return 0;
    if(stage>0 && !passive)return 8;
    return passive?113:(hp>0.84?86:45);
  }
  if(id==='haze'){
    // Haze removes everyone's changes, including own; avoid unless threat is significant.
    return saved>=2?195:saved===1?97:0;
  }
  if(id==='encore'){
    if(foeEncoreActive)return 0;
    if(turn-foeLastMoveTurn>1)return 0;
    if(!CONTROLS.has(canonical(foeLastMove)))return 0;
    return 180;
  }
  if(id==='trick'){
    if(lastStatuses.trickDone)return 0;
    if(!/^Choice /.test(ownItem))return 0;
    return passive?148:foeHP>0.6?63:12;
  }
  if(id==='willowisp'){
    if(foeStatus || canonical(foeSpecies).includes('fire'))return 0;
    return 46;
  }
  if(id==='thunderwave'||id==='toxic'){
    if(foeStatus)return 0;
    return passive?75:47;
  }
  if(id==='toxicspikes')return hazards.toxicspikes?0:turn<=5?72:10;
  if(id==='spikes')return hazards.spikes>=2?0:turn<=6?55:5;
  if(['reflect','lightscreen','stealthrock'].includes(id))return lastStatuses[id]?0:turn<5?68:7;
  if(id==='protect')return hp<0.4?5:10;
  return 0;
}
function shouldScriptedSetup({scenario,ownSpecies,foeSpecies='',stage={},ratio,turn}){
  if(!['setup','mence'].includes(scenario)||turn>5||ratio<0.55)return null;
  const my=canonical(ownSpecies),foe=canonical(foeSpecies);
  // Never knowingly sacrifice Salamence to a Fairy or a fast ice attacker.
  if(my==='salamence'){
    if(['primarina','starmie','skeledirge','garchomp','dragonite'].includes(foe))return null;
    return boost(stage,'atk')<1?'dragondance':null;
  }
  // Volcarona must not waste a turn against its common Water/Rock counters.
  if(my==='volcarona'){
    if(['primarina','starmie','garchomp','skeledirge','gyarados'].includes(foe))return null;
    return boost(stage,'spa')<1?'quiverdance':null;
  }
  if(my==='gholdengo'){
    if(['skeledirge','garchomp','rillaboom'].includes(foe))return null;
    return boost(stage,'spa')<2?'nastyplot':null;
  }
  return null;
}
function shouldScriptedRegen({scenario,ownSpecies,ratio,turn,switches}){
  return scenario==='stall'&&canonical(ownSpecies)==='toxapex'&&ratio<0.84&&turn>=2&&switches<3;
}
module.exports={policyStatusScore,shouldScriptedSetup,shouldScriptedRegen,canonical};
