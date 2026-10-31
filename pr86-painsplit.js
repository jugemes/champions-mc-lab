'use strict';
// PR #86 request item 4 (ChatGPT PR #84 comment #6537030779): PR #83
// rationalityFromState labels Pain Split by remaining HP FRACTION (u.hp >= t.hp),
// but Pain Split averages ACTUAL HP: user 90/200 (45%) vs target 80/100 (80%)
// is labelled rational yet the user loses 5 HP. Opt-in V2 label; the PR #83/#85
// function and every saved value stay unchanged.
// Public information only. The user of Pain Split knows its own actual HP. The
// target's actual HP is NOT public: only its percentage, and its max HP is
// bounded by public base stats: Champions L50 HP = base + points + 75, points
// 0..32 (damage.js, checked against the pinned champions mod). The label is
// 'rational' / 'irrational' only if it holds for EVERY max HP in that range,
// otherwise 'unknown'. No hidden stat points are assumed.
const SP_MAX=32;
function maxHPRange(dex,species){
  const s=dex.species.get(species);
  if(!s.exists)return null;
  if(s.baseStats.hp===1)return [1,1];   // Shedinja
  return [s.baseStats.hp+75,s.baseStats.hp+75+SP_MAX];
}
// userHP: actual HP of the Pain Split user (own request); targetFrac: public
// fraction 0..1 of the target; range: [min,max] possible target max HP.
function painSplitRationality(userHP,targetFrac,range){
  if(typeof userHP!=='number'||!(userHP>=0)||typeof targetFrac!=='number'||!(targetFrac>=0)||!range)return ['unknown','no public HP'];
  const lo=Math.ceil(targetFrac*range[0]-1e-9),hi=Math.floor(targetFrac*range[1]+1e-9);
  if(userHP<lo)return ['rational','user '+userHP+' HP < target >= '+lo+' HP (any max HP '+range.join('-')+')'];
  if(userHP>=hi)return ['irrational','user '+userHP+' HP >= target <= '+hi+' HP (any max HP '+range.join('-')+')'];
  return ['unknown','target '+lo+'-'+hi+' HP brackets user '+userHP+' HP (max HP not public)'];
}
module.exports={maxHPRange,painSplitRationality,SP_MAX};
