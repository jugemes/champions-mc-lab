#!/usr/bin/env node
'use strict';
// Fixed counterexample battles on the pinned Showdown engine, baseline vs the
// opt-in 'rational' turn policy. Same seed, same teams, both sides (p1/p2).
// Opposing sets are LEGAL HYPOTHESES, not observed sets. Where an opponent is
// scripted, the script is the line that punishes the reported blunder and is
// labelled; it is NOT a claim that a ladder opponent always plays it.
// Counts here are behaviour checks on single battles, NOT ladder win rates.
const {Bot,normalize,load,hashSeed}=require('./lab');
const {reportedLive}=require('./reported-live-roster-20261027');
const {canonical}=require('./tactics');
const FORMAT='gen9championsbssregmc';
const row=(species,item,ability,nature,points,moves)=>({species,item,ability,nature,moves:moves.split('/'),
  evs:Object.fromEntries(points.split(',').map(t=>[({H:'hp',A:'atk',B:'def',C:'spa',D:'spd',S:'spe'})[t[0]],Number(t.slice(1))]))});
const H={
  corviknight:row('Corviknight','Rocky Helmet','Mirror Armor','Impish','H32,B32,D2','Roost/U-turn/Body Press/Iron Head'),
  archaludon:row('Archaludon','Sitrus Berry','Stamina','Modest','H32,C32,D2','Electro Shot/Draco Meteor/Flash Cannon/Thunderbolt'),
  lucarioZ:row('Lucario','Lucarionite Z','Inner Focus','Timid','H2,C32,S32','Aura Sphere/Flash Cannon/Vacuum Wave/Nasty Plot'),
  primarina:row('Primarina','Leftovers','Torrent','Modest','H32,C32,S2','Moonblast/Sparkling Aria/Aqua Jet/Encore'),
  charizardY:row('Charizard','Charizardite Y','Blaze','Timid','H2,C32,S32','Flamethrower/Solar Beam/Air Slash/Roost'),
  garchomp:row('Garchomp','Yache Berry','Rough Skin','Jolly','H2,A32,S32','Earthquake/Dragon Claw/Stone Edge/Fire Fang'),
  mimikyu:row('Mimikyu','Life Orb','Disguise','Jolly','H2,A32,S32','Play Rough/Shadow Claw/Shadow Sneak/Swords Dance'),
  golisopodSD:row('Golisopod','Golisopite','Emergency Exit','Adamant','H32,A32,D2','First Impression/Swords Dance/Iron Head/Aqua Jet'),
  hippowdon:row('Hippowdon','Smooth Rock','Sand Stream','Impish','H32,B32,D2','Earthquake/Slack Off/Stealth Rock/Whirlwind'),
  gengar:row('Gengar','Focus Sash','Cursed Body','Timid','H2,C32,S32','Shadow Ball/Sludge Bomb/Thunderbolt/Destiny Bond'),
  kingambit:row('Kingambit','Black Glasses','Supreme Overlord','Adamant','H32,A32,D2','Kowtow Cleave/Iron Head/Sucker Punch/Swords Dance'),
  umbreon:row('Umbreon','Sitrus Berry','Synchronize','Calm','H32,B2,D32','Foul Play/Moonlight/Yawn/Protect'),
};
// Scripts: (bot, req, avail) -> choice|null. Return null to use the bot's own policy.
const findMove=(req,name)=>{const i=req.active[0].moves.findIndex(m=>canonical(m.id||m.move)===canonical(name)&&!m.disabled);return i<0?null:'move '+(i+1);};
const findSlot=(req,species)=>{const i=req.side.pokemon.findIndex(p=>!p.active&&p.details.startsWith(species)&&!p.condition.endsWith(' fnt'));return i<0?null:'switch '+(i+1);};
const hpOf=req=>{const [h,m]=String(req.side.pokemon.find(p=>p.active).condition).split('/').map(Number);return m>0?h/m:0;};
const SCRIPTS={
  // Rocky Helmet Corviknight Roosts below 60%, otherwise Body Press. Punishing, plausible line.
  helmetRoost:(bot,req)=>{const me=bot.getSet(req.side.pokemon.find(p=>p.active));
    if(me.species!=='Corviknight')return null;return hpOf(req)<0.6?findMove(req,'Roost'):findMove(req,'Body Press');},
  // T1 the lead hard-switches to Archaludon (the public answer to a Poison Jab lock).
  swapToArchaludon:(bot,req)=>bot.turn===1?findSlot(req,'Archaludon'):null,
  // T1 Charizard goes to Corviknight (the public answer to Rock Slide); Corviknight then Roost/Body Press.
  swapToCorviknight:(bot,req)=>bot.turn===1?findSlot(req,'Corviknight'):SCRIPTS.helmetRoost(bot,req),
  // Encore the foe right after it used a status move; otherwise own policy.
  encoreStatus:(bot,req)=>{const last=bot.dex.moves.get(bot.lastMove);
    if(last.exists&&last.category==='Status'&&bot.foeLastMoveTurn===bot.turn-1&&!bot.foeEncored)return findMove(req,'Encore');
    return null;},
};
class ScriptedBot extends Bot{
  constructor(...a){super(...a);this.script=null;}
  decide(req){
    if(this.script&&!req.teamPreview&&!req.forceSwitch&&req.active&&this.errors===0){const c=this.script(this,req);if(c)return c;}
    return super.decide(req);
  }
}
const CASES={
  B_helmet_roost:{
    note:'Report: Metagross used Thunder Punch 5x into Rocky Helmet + Roost Corviknight and fainted.',
    own:()=>reportedLive(),ownPick:['Metagross','Garchomp','Rotom-Wash'],
    opp:[H.corviknight,H.archaludon,H.lucarioZ,H.primarina,H.hippowdon,H.gengar],oppPick:['Corviknight','Archaludon','Lucario'],
    script:'helmetRoost',
  },
  B_scarf_poisonjab_archaludon:{
    note:'Report: Choice-locked Poison Jab Garchomp stayed in on Archaludon (Poison immune).',
    own:()=>reportedLive(),ownPick:['Garchomp','Metagross','Rotom-Wash'],
    opp:[H.primarina,H.archaludon,H.corviknight,H.lucarioZ,H.hippowdon,H.gengar],oppPick:['Primarina','Archaludon','Corviknight'],
    script:'swapToArchaludon',
  },
  C_scarf_rockslide_corviknight:{
    note:'Report: Choice-locked Garchomp used Rock Slide 4x into Corviknight.',
    own:()=>reportedLive(),ownPick:['Garchomp','Metagross','Rotom-Wash'],
    opp:[H.charizardY,H.corviknight,H.garchomp,H.primarina,H.hippowdon,H.gengar],oppPick:['Charizard','Corviknight','Garchomp'],
    script:'swapToCorviknight',
  },
  A_golisopod_setup_encore:{
    note:'Report: Mega Golisopod kept using Swords Dance after +6 and was Encored.',
    own:()=>[H.golisopodSD,H.mimikyu,H.corviknight,H.archaludon,H.hippowdon,H.gengar],ownPick:['Golisopod','Mimikyu','Archaludon'],
    opp:[H.umbreon,H.primarina,H.kingambit,H.charizardY,H.garchomp,H.lucarioZ],oppPick:['Primarina','Umbreon','Kingambit'],
    script:'encoreStatus',
  },
};
// Behaviour metrics of the candidate side from the omniscient log.
function metrics(log,side,dex,ownTeam){
  const foe=side==='p1'?'p2':'p1';
  const m={helmetChip:0,helmetFaints:0,immuneHits:0,maxRepeatSameMove:0,setupAtCap:0,movesWhileEncored:0,contactIntoHelmetHolder:0,switches:0};
  let last='',rep=0,stage={},encored=false,lastMoveLine='';
  const lines=log.split('\n');
  for(let k=0;k<lines.length;k++){
    const a=lines[k].split('|');
    if(a[1]==='switch'&&a[2]?.startsWith(side+'a:')){stage={};encored=false;last='';rep=0;m.switches++;}
    if(['-boost','-unboost'].includes(a[1])&&a[2]?.startsWith(side+'a:'))stage[a[3]]=Math.max(-6,Math.min(6,(stage[a[3]]||0)+(a[1]==='-boost'?1:-1)*Number(a[4])));
    if(a[1]==='-start'&&a[2]?.startsWith(side+'a:')&&a[3]==='Encore')encored=true;
    if(a[1]==='-end'&&a[2]?.startsWith(side+'a:')&&a[3]==='Encore')encored=false;
    if(a[1]==='move'&&a[2]?.startsWith(side+'a:')){
      const mv=dex.moves.get(a[3]);lastMoveLine=a[3];
      if(encored)m.movesWhileEncored++;
      rep=a[3]===last?rep+1:1;last=a[3];m.maxRepeatSameMove=Math.max(m.maxRepeatSameMove,rep);
      const b=mv.target==='self'?mv.boosts:null;
      if(b&&Object.entries(b).filter(([,v])=>v>0).every(([k])=>(stage[k]||0)>=6))m.setupAtCap++;
    }
    if(a[1]==='-immune'&&a[2]?.startsWith(foe+'a:')&&lastMoveLine)m.immuneHits++;
    if(a[1]==='-damage'&&a[2]?.startsWith(side+'a:')&&lines[k].includes('[from] item: Rocky Helmet')){
      m.helmetChip++;if(/\|0 fnt\|/.test(lines[k]))m.helmetFaints++;}
  }
  return m;
}
// script: undefined = the case's labelled script, null = opponent plays its own
// policy (unscripted follow-up of a scripted success condition).
async function runCase(sim,name,{policy='baseline',seed=[1,2,3,4],reverse=false,logMatrix=false,oppPolicy='baseline',script}={}){
  const c=CASES[name];if(!c)throw Error('Unknown case '+name);
  const dex=sim.Dex.mod('champions');
  const own=c.own(),opp=c.opp;
  const streams=sim.getPlayerStreams(new sim.BattleStream({noCatch:true}));
  const trace={choices:[],selections:[],errors:[]};
  const cs=reverse?'p2':'p1',os=reverse?'p1':'p2';
  const cand=new ScriptedBot(streams[cs],dex,own,cs,trace,c.ownPick,null,{decisionPolicy:policy,seed,logMatrix});
  const foe=new ScriptedBot(streams[os],dex,opp,os,trace,c.oppPick,null,{decisionPolicy:oppPolicy,seed});
  foe.script=script===null?null:SCRIPTS[script||c.script]||null;
  const logs=[];let winner='',turns=0;
  const obs=(async()=>{for await(const msg of streams.omniscient){logs.push(msg);for(const l of msg.split('\n')){
    if(l.startsWith('|win|'))winner=l.slice(5);if(l.startsWith('|turn|'))turns=Number(l.slice(6));}}})();
  const r1=cand.run(),r2=foe.run();
  const teams={[cs]:own,[os]:opp},names={[cs]:'candidate',[os]:'opponent'};
  await streams.omniscient.write('>start '+JSON.stringify({formatid:FORMAT,seed})+'\n>player p1 '+JSON.stringify({name:names.p1,team:normalize(teams.p1)})+'\n>player p2 '+JSON.stringify({name:names.p2,team:normalize(teams.p2)}));
  await Promise.all([obs,r1,r2]);
  const log=logs.join('\n');
  return {case:name,policy,seed:seed.join('-'),side:cs,win:winner==='candidate',turns,errors:trace.errors.length,
    selections:trace.selections,metrics:metrics(log,cs,dex,own),rational:trace.rational||[],matrix:trace.matrix||[],hits:(trace.hits||[]).filter(h=>h.side===cs),log,
    candidateChoices:trace.choices.filter(x=>x.side===cs).map(x=>x.turn+':'+x.choice)};
}
async function main(){
  const sim=load(),n=Number(process.argv[2]||4),out=[];
  const v=sim.TeamValidator.get(FORMAT);
  for(const [name,c] of Object.entries(CASES))for(const t of [c.own(),c.opp]){const p=v.validateTeam(normalize(t));if(p?.length)throw Error(name+': '+p.join('; '));}
  const policies=(process.env.POLICIES||'baseline,rational').split(',');
  for(const name of Object.keys(CASES))for(let i=0;i<n;i++)for(const policy of policies){
    const r=await runCase(sim,name,{policy,seed:hashSeed(700000+i),reverse:Boolean(i%2)});
    delete r.log;delete r.matrix;out.push(r);
    console.log([name,policy,r.seed,r.side,r.win?'W':'L','T'+r.turns,JSON.stringify(r.metrics),r.rational.map(x=>'T'+x.turn+':'+x.reason).join(' ')].join(' | '));
  }
  if(process.argv[3])require('node:fs').writeFileSync(process.argv[3],JSON.stringify(out,null,1));
}
if(require.main===module)main().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
module.exports={CASES,SCRIPTS,H,runCase,metrics,ScriptedBot};
