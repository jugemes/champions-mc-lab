'use strict';
// PR #90 request P1-2 (ChatGPT review #5721083231 of PR #89): pr84
// condFromBot/condSig drop the rival's item / ability even after the public log
// revealed them (Choice Scarf/Levitate and Leftovers/Pressure gave the same
// key), and condSig throws on foeItem. Not a leak; a missing public field.
// V4 adds foeItem / foeAbility taken ONLY from lab.js Bot fields that are fed
// by public log lines (|-item|, |-enditem|, |-ability|, Rocky Helmet damage
// "[of]", public Mega ability). Unrevealed = ''. Values must be real champions
// dex item / ability names; anything else throws. pr84 functions are unchanged
// (V3 keys stay byte-identical). Opt-in research module, NOT adopted.
const C=require('./pr84-public-cond-entry');
const {load}=require('./lab');
let dex=null;const D=()=>dex||(dex=load().Dex.mod('champions'));
function checkCondV4(c){
  const {foeItem,foeAbility,...rest}=c||{};
  C.checkCond(rest);
  if(foeItem!=null&&foeItem!==''&&!(typeof foeItem==='string'&&D().items.get(foeItem).exists))throw Error('condV4: bad foeItem '+JSON.stringify(foeItem));
  if(foeAbility!=null&&foeAbility!==''&&!(typeof foeAbility==='string'&&D().abilities.get(foeAbility).exists))throw Error('condV4: bad foeAbility '+JSON.stringify(foeAbility));
  return rest;
}
function condSigV4(c){
  if(!c)return 'nocond';
  const rest=checkCondV4(c);
  return C.condSig(rest)+'|r:'+(c.foeItem?D().items.get(c.foeItem).id:'')+'/'+(c.foeAbility?D().abilities.get(c.foeAbility).id:'');
}
function condFromBotV4(req,bot){
  return {...C.condFromBot(req,bot),foeItem:bot.foeItem||'',foeAbility:bot.foeAbility||''};
}
module.exports={checkCondV4,condSigV4,condFromBotV4};
