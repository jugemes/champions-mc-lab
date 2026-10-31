#!/usr/bin/env node
'use strict';
// PR #84 P0: minimal pinned-Showdown battles with EXPLICIT choices (no AI) that
// produce each switch cause, so the classifier is checked on real engine logs,
// not only on hand-written protocol. Both sides scripted; every team passes
// TeamValidator(gen9championsbssregmc). Each probe states the turn-1 choices,
// then PR #83 (V2) and PR #84 (V3) classifiers are applied to the same log.
//   SHOWDOWN_DIR=... node pr84-forced-switch-probe.js [--json out.json]
const fs=require('node:fs');
const {load,normalize}=require('./lab');
const V2=require('./pr82-switch-utility-t1t2');
const V3=require('./pr84-switch-cause');
const FORMAT='gen9championsbssregmc';
const SHOWDOWN='3a766f2cfb5e51c1e428cfe87d0dba91a8f01640';
const row=(species,item,ability,nature,points,moves)=>({species,item,ability,nature,moves:moves.split('/'),
  evs:Object.fromEntries(points.split(',').map(t=>[({H:'hp',A:'atk',B:'def',C:'spa',D:'spd',S:'spe'})[t[0]],Number(t.slice(1))]))});
// Probe sets (legal, not rank-representative). Items unique per team.
const S={
  golisopod:row('Golisopod','Leftovers','Emergency Exit','Adamant','H32,A32,D2','Liquidation/Iron Head/First Impression/Sucker Punch'),
  corvEject:row('Corviknight','Eject Button','Pressure','Impish','H32,B32,D2','U-turn/Brave Bird/Roost/Body Press'),
  archaludon:row('Archaludon','Sitrus Berry','Stamina','Modest','H32,C32,D2','Flash Cannon/Draco Meteor/Electro Shot/Thunderbolt'),
  skarmRed:row('Skarmory','Red Card','Sturdy','Impish','H32,B32,D2','Brave Bird/Roost/Spikes/Whirlwind'),
  pri:row('Primarina','Fairy Feather','Torrent','Modest','H2,C32,S32','Moonblast/Sparkling Aria/Hydro Pump/Psychic'),
  gyara:row('Gyarados','Lum Berry','Intimidate','Adamant','H32,A32,S2','Waterfall/Earthquake/Dragon Dance/Bounce'),
  garchomp:row('Garchomp','Life Orb','Rough Skin','Adamant','H2,A32,S32','Stone Edge/Earthquake/Dragon Claw/Rock Slide'),
  rotom:row('Rotom-Wash','Choice Scarf','Levitate','Modest','H2,C32,S32','Volt Switch/Thunderbolt/Hydro Pump/Will-O-Wisp'),
  ttar:row('Tyranitar','Focus Sash','Sand Stream','Adamant','H32,A32,D2','Stone Edge/Crunch/Earthquake/Ice Punch'),
  metagross:row('Metagross','Shuca Berry','Clear Body','Adamant','H32,A32,D2','Meteor Mash/Zen Headbutt/Earthquake/Bullet Punch'),
  hydreigon:row('Hydreigon','Expert Belt','Levitate','Modest','H2,C32,S32','Dark Pulse/Draco Meteor/Flamethrower/U-turn'),
  dnite:row('Dragonite','Lum Berry','Multiscale','Adamant','H32,A32,D2','Extreme Speed/Earthquake/Fire Punch/Roost'),
};
const P1=[S.garchomp,S.rotom,S.ttar,S.metagross,S.hydreigon,S.dnite];
const P2=[S.golisopod,S.corvEject,S.archaludon,S.skarmRed,S.pri,S.gyara];
// Each probe: team order (first = lead), per-side queue of move-request choices
// and of forced-switch choices; request = the rival(p2) turn-1 request record
// in the form PR #83 rivalScriptV2 stores it, to compare checkers.
// Team preview picks e.g. '135' = slots 1,3,5 of the six; after preview the
// side's order is the picked order, so 'switch 2' = the second pick.
const PROBES=[
  {id:'emergencyExit_rivalMove',note:'Golisopod (Emergency Exit) chose Liquidation; faster Garchomp Stone Edge drops it below 50% -> forced exit to Archaludon before it moves',
    team:{p1:'123',p2:'135'},p1:['move stoneedge'],p2:['move liquidation'],p2force:['switch 2'],side:'p2',
    request:{turn:1,choice:'move 1',move:'Liquidation',active:'Golisopod'}},
  {id:'emergencyExit_asIfSwitchRequested',same:'emergencyExit_rivalMove',side:'p2',
    note:'same REAL log; request record = the ChatGPT synthetic one (switch 2 -> Archaludon). The engine never produces this pairing (a chosen switch resolves before every move) but a checker must not call a forced exit "executed"',
    request:{turn:1,choice:'switch 2',active:'Golisopod',move:null,target:'Archaludon'}},
  {id:'ejectButton_rivalMove',note:'Corviknight (Eject Button) chose Roost; faster Garchomp Stone Edge -> Eject Button -> Archaludon before Roost',
    team:{p1:'123',p2:'235'},p1:['move stoneedge'],p2:['move roost'],p2force:['switch 2'],side:'p2',
    request:{turn:1,choice:'move 3',move:'Roost',active:'Corviknight'}},
  {id:'ejectButton_asIfSwitchRequested',same:'ejectButton_rivalMove',side:'p2',note:'same REAL log, synthetic switch request to the forced-exit species',
    request:{turn:1,choice:'switch 2',active:'Corviknight',move:null,target:'Archaludon'}},
  {id:'eject_after_own_move',note:'Corviknight (Eject Button, faster than Tyranitar) Roosts first, then Tyranitar Stone Edge ejects it: requested move executed, exit after it',
    team:{p1:'312',p2:'235'},p1:['move stoneedge'],p2:['move roost'],p2force:['switch 2'],side:'p2',
    request:{turn:1,choice:'move 3',move:'Roost',active:'Corviknight'}},
  {id:'voluntary_switch',note:'Golisopod voluntarily switches to Archaludon; Garchomp Stone Edge hits Archaludon',
    team:{p1:'123',p2:'135'},p1:['move stoneedge'],p2:['switch 2'],side:'p2',
    request:{turn:1,choice:'switch 2',active:'Golisopod',move:null,target:'Archaludon'}},
  {id:'voluntary_then_eject',note:'Golisopod voluntarily switches to Corviknight (Eject Button); Stone Edge -> Eject -> Archaludon in the same turn',
    team:{p1:'123',p2:'123'},p1:['move stoneedge'],p2:['switch 2'],p2force:['switch 3'],side:'p2',
    request:{turn:1,choice:'switch 2',active:'Golisopod',move:null,target:'Corviknight'}},
  {id:'both_voluntary',note:'both sides switch on turn 1 (switch order by Speed); each side checked',
    team:{p1:'123',p2:'135'},p1:['switch 2'],p2:['switch 2'],side:'p2',
    request:{turn:1,choice:'switch 2',active:'Golisopod',move:null,target:'Archaludon'},ownRequest:{side:'p1',turn:1,label:'switch:Rotom-Wash'}},
  {id:'pivot_voltSwitch',note:'Scarf Rotom-Wash Volt Switch -> Garchomp (pivot, |switch| carries [from] Volt Switch)',
    team:{p1:'213',p2:'356'},p1:['move voltswitch'],p1force:['switch 2'],p2:['move flashcannon'],
    ownRequest:{side:'p1',turn:1,label:'move:Volt Switch'}},
  {id:'redCard_drag',note:'Skarmory (Red Card) is hit by Garchomp Stone Edge -> Garchomp dragged out (|drag|) after its move',
    team:{p1:'123',p2:'456'},p1:['move stoneedge'],p2:['move spikes'],
    ownRequest:{side:'p1',turn:1,label:'move:Stone Edge'}},
  {id:'postKO_replacement',note:'Garchomp Earthquake KOs Primarina before it moves -> post-KO replacement Golisopod',
    team:{p1:'123',p2:'513'},p1:['move earthquake'],p2:['move moonblast'],p2force:['switch 2'],side:'p2',
    request:{turn:1,choice:'move 1',move:'Moonblast',active:'Primarina'},ownRequest:{side:'p2',turn:1,label:'move:Moonblast'}},
  {id:'own_ejected_before_move',note:'OUR side (p1) holds Eject Button: slower Corviknight is hit first by Garchomp and ejected before its forced Body Press',
    swap:true,team:{p1:'235',p2:'123'},p1:['move bodypress'],p1force:['switch 2'],p2:['move stoneedge'],
    ownRequest:{side:'p1',turn:1,label:'move:Body Press'}},
];
async function run(sim,pr){
  const streams=sim.getPlayerStreams(new sim.BattleStream({noCatch:true}));
  const [t1,t2]=pr.swap?[P2,P1]:[P1,P2];
  const q={p1:[...pr.p1],p2:[...pr.p2],p1f:[...(pr.p1force||[])],p2f:[...(pr.p2force||[])]};
  const log=[],errors=[];
  const drive=async side=>{
    for await(const chunk of streams[side]){
      for(const line of chunk.split('\n')){
        if(line.startsWith('|error|'))errors.push(side+' '+line);
        if(!line.startsWith('|request|'))continue;
        const req=JSON.parse(line.slice(9));
        if(req.wait)continue;
        let c;
        if(req.teamPreview)c='team '+pr.team[side];
        else if(req.forceSwitch)c=q[side+'f'].shift()||'default';
        else c=q[side].shift()||'default';
        streams[side].write(c);
      }
    }
  };
  const w=(async()=>{for await(const m of streams.omniscient)log.push(m);})();
  const d1=drive('p1'),d2=drive('p2');
  await streams.omniscient.write('>start '+JSON.stringify({formatid:FORMAT,seed:[1,2,3,4]})+
    '\n>player p1 '+JSON.stringify({name:'p1',team:normalize(t1)})+'\n>player p2 '+JSON.stringify({name:'p2',team:normalize(t2)}));
  await Promise.all([w,d1,d2]);
  return {log:log.join('\n'),errors};
}
async function main(){
  const sim=load();
  const val=sim.TeamValidator.get(FORMAT);
  for(const [n,t] of [['p1',P1],['p2',P2]]){const p=val.validateTeam(normalize(t));if(p?.length)throw Error(n+': '+p.join('; '));}
  const logs={},rows=[];
  for(const pr of PROBES){
    if(!pr.same){logs[pr.id]=await run(sim,pr);}
    const {log,errors}=logs[pr.same||pr.id];
    const T1=V2.splitTurns(log)[1]||[];
    const lines=T1.filter(l=>/^\|(move|switch|drag|faint|-activate|-enditem|-damage)\|/.test(l));
    const r={id:pr.id,note:pr.note,errors,turn1:lines};
    if(pr.request){
      r.v2=V2.checkRequestedV2(log,'p2',[pr.request])[0];
      r.v3=V3.checkRequestedV3(log,'p2',[pr.request])[0];
      r.rivalEvents=V3.switchEvents(T1,'p2a: ');
    }
    if(pr.ownRequest){
      const s=pr.ownRequest.side;
      r.label=pr.ownRequest.label;r.ownV2=V2.executedOwn(log,s,1);r.ownV3=V3.executedOwnV3(log,s,1);
      r.ownEvents=V3.switchEvents(T1,s+'a: ');
    }
    rows.push(r);
  }
  const out={showdown:SHOWDOWN,format:FORMAT,note:'Explicit-choice pinned-Showdown battles; NOT AI games, NOT a win rate.',rows};
  const i=process.argv.indexOf('--json');if(i>0)fs.writeFileSync(process.argv[i+1],JSON.stringify(out,null,1));
  return out;
}
if(require.main===module)main().then(o=>console.log(JSON.stringify(o,null,1))).catch(e=>{console.error(e.stack||e);process.exitCode=1;});
module.exports={main,PROBES,P1,P2};
