'use strict';
// Turn-AI misplay tags v2 (PR #66 request P0-5), per side, from the public
// battle log only. Superset of legal-search-compare.js misplays() (v1 tags
// kept with identical rules so old numbers stay comparable). A tag is a
// symptom that the heuristic turn AI, not the preview, decided the game; it
// is not proof of a misplay and its absence is not proof of good play.
//   setupSpam      same mon uses the same setup move 3 times in a row
//   encoreRepeat   Encore used twice in a row by the same mon
//   immuneRepeat   same mon repeats the same move into -immune
//   resistRepeat   same mon repeats the same move into -resisted (Scarf/Choice lock symptom)
//   helmetFaint    attacker faints to Rocky Helmet / Rough Skin / Iron Barbs recoil
//   switchLoop     voluntary switch on two consecutive turns
//   chargeNoSun    Solar Beam/Blade -prepare while no sun is up (a real charge turn)
//   weatherRedundant weather move used while that weather is already up
const SETUP=new Set(['Swords Dance','Dragon Dance','Nasty Plot','Calm Mind','Quiver Dance','Bulk Up','Shell Smash']);
const WEATHER_MOVE={'Sunny Day':'SunnyDay','Rain Dance':'RainDance','Sandstorm':'Sandstorm','Snowscape':'Snowscape'};
const CONTACT_RECOIL=/\[from\] (item: Rocky Helmet|ability: Rough Skin|ability: Iron Barbs)/;
const PIVOT=new Set(['U-turn','Volt Switch','Flip Turn','Parting Shot','Teleport','Baton Pass','Chilly Reception','Shed Tail']);
const TAGS=['setupSpam','encoreRepeat','immuneRepeat','resistRepeat','helmetFaint','switchLoop','chargeNoSun','weatherRedundant'];
const V1_TAGS=['setupSpam','encoreRepeat','immuneRepeat'];
function misplaysV2(log){
  const out={p1:{},p2:{}};for(const s of ['p1','p2'])for(const t of TAGS)out[s][t]=0;
  const last={p1:[],p2:[]};let pending=null,turn=0,weather='none';
  const volTurn={p1:-9,p2:-9},fainted={p1:false,p2:false},moved={p1:false,p2:false},pivot={p1:false,p2:false};
  for(const line of log.split('\n')){
    const a=line.split('|');
    if(a[1]==='turn'){turn=Number(a[2]);fainted.p1=fainted.p2=false;moved.p1=moved.p2=false;pivot.p1=pivot.p2=false;pending=null;continue;}
    if(a[1]==='-weather'){weather=a[2];continue;}
    if(a[1]==='move'){
      const side=a[2].slice(0,2),user=a[2].slice(5),move=a[3];
      const h=last[side];h.push({user,move,immune:false,resisted:false});
      const n=h.length;
      if(SETUP.has(move)&&n>=3&&h.slice(-3).every(x=>x.user===user&&x.move===move))out[side].setupSpam++;
      if(move==='Encore'&&n>=2&&h[n-2].user===user&&h[n-2].move==='Encore')out[side].encoreRepeat++;
      if(WEATHER_MOVE[move]&&weather===WEATHER_MOVE[move]&&!line.includes('[still]'))out[side].weatherRedundant++;
      moved[side]=true;if(PIVOT.has(move))pivot[side]=true;
      pending={side,entry:h[n-1]};
    } else if(a[1]==='-immune'&&pending){
      pending.entry.immune=true;
      const h=last[pending.side],n=h.length;
      if(n>=2&&h[n-2].immune&&h[n-2].user===h[n-1].user&&h[n-2].move===h[n-1].move)out[pending.side].immuneRepeat++;
    } else if(a[1]==='-resisted'&&pending&&!pending.entry.resisted){
      pending.entry.resisted=true;
      const h=last[pending.side],n=h.length;
      if(n>=2&&h[n-2].resisted&&h[n-2].user===h[n-1].user&&h[n-2].move===h[n-1].move)out[pending.side].resistRepeat++;
    } else if(a[1]==='-prepare'&&/^Solar (Beam|Blade)$/.test(a[3]||'')&&!/^(SunnyDay|DesolateLand)$/.test(weather)){
      // In sun the engine still logs -prepare, then fires at once (-anim).
      out[a[2].slice(0,2)].chargeNoSun++;
    } else if(a[1]==='-damage'&&/ fnt$/.test(a[3]||'')&&CONTACT_RECOIL.test(line)){
      out[a[2].slice(0,2)].helmetFaint++;
    } else if(a[1]==='faint'){
      fainted[a[2].slice(0,2)]=true;
    } else if(a[1]==='switch'){
      const side=a[2].slice(0,2);
      // Voluntary = chosen at the start of the turn: not a replacement after a
      // faint and not the second half of a pivot move. Lead (turn 0) excluded.
      if(turn>0&&!fainted[side]&&!pivot[side]&&!moved[side]){
        if(volTurn[side]===turn-1)out[side].switchLoop++;
        volTurn[side]=turn;
      }
      pending=null;
    }
  }
  return out;
}
const anyTag=(m,tags=TAGS)=>tags.some(t=>m[t]>0);
module.exports={misplaysV2,anyTag,TAGS,V1_TAGS};
