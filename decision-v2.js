'use strict';
// Candidate-only auditable v2. Same observed information as the baseline bot.
// Scores a move relative to imminent damage and the remaining rival HP.
// This policy never reads opponent private moves, stat points or team choices.
const {estimateDamage,moveUtility,incomingRisk}=require('./damage');
const {policyStatusScore,canonical}=require('./tactics');
function evaluateMove(dex,own,foeName,moveName,context={}){
  const move=dex.moves.get(moveName);
  if(!move.exists)return -1e6;
  const selfHp=Math.max(0,Number(context.ratio??1));
  const foeHp=Math.max(.001,Number(context.foeHP??1));
  const info={
    boosts:context.boosts||{},foeBoosts:context.foeBoosts||{},
    foeHP:foeHp,foeItem:context.foeItem||'',foeAbility:context.foeAbility||''
  };
  const risk=incomingRisk(dex,own,foeName,{
    foeBoosts:info.foeBoosts,seenMoves:context.seenMoves||[]
  });
  const potential=context.available||own.moves||[];
  const bestDamage=potential.map(m=>{
    const data=estimateDamage(dex,own,foeName,m,info);
    return data.immune?0:data.mid*data.accuracy;
  }).reduce((a,b)=>Math.max(a,b),0);
  if(move.category!=='Status'){
    const hit=estimateDamage(dex,own,foeName,moveName,info);
    if(hit.immune)return -1e5;
    let score=moveUtility(dex,own,foeName,moveName,info);
    // When fainting is plausible and an immediate KO is possible, favor
    // damage over speculative recovery/Trick/setup. The KO calc is a range.
    if(hit.min>=foeHp)score+=35*hit.accuracy;
    else if(hit.max>=foeHp)score+=13*hit.accuracy;
    if(move.priority>0&&foeHp<=.5)score+=20;
    if(context.foeItem==='Rocky Helmet'&&move.flags?.contact)score-=28;
    // Already-burned physical attacker, if verified by public status.
    if(context.ownStatus==='brn'&&move.category==='Physical'&&canonical(own.ability)!=='guts')
      score*=0.6;
    return score;
  }
  let score=policyStatusScore(move.id,{
    ratio:selfHp,turn:context.turn,boosts:info.boosts,foeBoosts:info.foeBoosts,
    foeSpecies:foeName,foeHP:foeHp,foeStatus:context.foeStatus,
    foeLastMove:context.foeLastMove,foeLastMoveTurn:context.foeLastMoveTurn,
    foeAbility:context.foeAbility,ownItem:own.item,ownSpecies:own.species,
    lastStatuses:context.lastStatuses,hazards:context.hazards
  });
  const kind=canonical(move.id);
  const lethal=risk>=selfHp;
  const enemyBoost=Math.max(0,Number(info.foeBoosts.atk||0),Number(info.foeBoosts.spa||0));
  const easyKO=bestDamage>=foeHp;
  // This replaces, rather than adds to, blindly repeating recovery at
  // <= 34% HP, especially when the rival can KO through the recovery.
  if(['recover','roost','slackoff','moonlight','softboiled'].includes(kind)){
    if(lethal||risk>=selfHp+0.30||easyKO)return 0;
    if(risk>.65)return Math.min(score,25);
    if(risk>.35)return Math.min(score,90);
    return score;
  }
  if(kind==='trick'){
    // Avoid giving away Scarf instead of finishing a boosted/near-KO foe.
    if(foeHp<.65||enemyBoost||risk>=selfHp*.7||easyKO)return 0;
    if(!['toxapex','umbreon','slowbro','corviknight','skarmory','blissey'].includes(canonical(foeName)))return Math.min(score,12);
    return score;
  }
  if(['swordsdance','nastyplot','dragondance','quiverdance'].includes(kind)){
    if(lethal||risk>.52||foeHp<.50||enemyBoost>=2||easyKO)return 0;
    return score;
  }
  if(kind==='encore'){
    if(lethal&&enemyBoost<2)return 0;
    if(easyKO)return Math.min(score,35);
  }
  if(kind==='haze'){
    if(enemyBoost>=2&&risk<selfHp)return Math.max(score,130);
  }
  if(['willowisp','thunderwave','toxic','toxicspikes','spikes','stealthrock','reflect','lightscreen'].includes(kind)){
    if(lethal||easyKO||foeHp<.28)return 0;
    if(enemyBoost>=2&&kind!=='willowisp')score=Math.min(score,20);
  }
  if(kind==='protect'&&easyKO)return 0;
  return score;
}
module.exports={evaluateMove};