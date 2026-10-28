#!/usr/bin/env node
'use strict';
// Claude independent audit B (Issue #13 / launch PR #18): replay environment-m7-audit
// cells with captured Showdown logs. Usage: node claude-audit-b-turn-logs.js <teamIdx 1-based> <mode> <n> [ownForced a/b/c]
// mode: rational-opponent|forced-pressure|forced-alternative. Opponent six only is public to our preview.
const fs=require('node:fs'),path=require('node:path');
const {load,game,hashSeed}=require('./lab');
const {reportedLive}=require('./reported-live-roster-20261027');
const {groups}=require('./environment-m7-teams');
const sim=load();
const own=reportedLive();
const modes=['rational-opponent','forced-pressure','forced-alternative'];
function compact(log){
  const keep=[];
  for(const line of log.split('\n')){
    const a=line.split('|');
    if(['turn','switch','drag','move','faint','-mega','detailschange','-weather','-damage','-heal','-sideend','-sidestart','-activate','-boost','-status','win','-terastallize','-item','-enditem','cant'].includes(a[1]))
      keep.push(line);
  }
  return keep.join('\n');
}
async function main(){
  const gi=Number(process.argv[2])-1,mode=process.argv[3],n=Number(process.argv[4]||12);
  const ownForced=process.argv[5]?process.argv[5].split('/'):null;
  const grp=groups[gi],mi=modes.indexOf(mode);
  const rows=[];
  for(let k=0;k<n;k++){
    const seed=hashSeed(730000+gi*10000+mi*1000+k),reverse=Boolean(k%2);
    const options={megaAware:true,candidatePreviewPolicy:'rational',opponentPreviewPolicy:'rational',
      candidateDecisionPolicy:'v3',opponentDecisionPolicy:'v3'};
    if(mode!=='rational-opponent')options.opponentForced=mode==='forced-pressure'?grp.forcedA:grp.forcedB;
    if(ownForced)options.candidateForced=ownForced;
    const g=await game(sim,reverse?grp.team:own,reverse?own:grp.team,seed,true,null,reverse,options);
    const mine=g.trace.selections.find(x=>x.side===(reverse?'p2':'p1')),theirs=g.trace.selections.find(x=>x.side===(reverse?'p1':'p2'));
    const win=g.winner===(reverse?'opponent':'candidate');
    const mySide=reverse?'p2':'p1';
    const rem=(g.log.match(new RegExp('\\|faint\\|'+(reverse?'p1':'p2')+'a','g'))||[]).length;
    const myLoss=(g.log.match(new RegExp('\\|faint\\|'+mySide+'a','g'))||[]).length;
    rows.push({k,seed:String(seed),reverse,win,turns:g.turns,mine:mine.chosen,myLead:mine.lead,theirs:theirs.chosen,theirLead:theirs.lead,foeFaints:rem,myFaints:myLoss,errors:g.trace.errors.length,log:compact(g.log)});
  }
  const tag=`${grp.name}__${mode}${ownForced?'__own-'+ownForced.join('-'):''}`;
  const dir=path.join(__dirname,'output','claude-audit-b');fs.mkdirSync(dir,{recursive:true});
  fs.writeFileSync(path.join(dir,tag+'.json'),JSON.stringify(rows,null,1));
  console.log(tag,'wins',rows.filter(r=>r.win).length+'/'+n,'avgTurns',(rows.reduce((s,r)=>s+r.turns,0)/n).toFixed(1));
  const pick=new Map();rows.forEach(r=>{const key=r.mine.join('/')+' lead='+r.myLead;pick.set(key,(pick.get(key)||0)+1)});
  console.log(' own picks',[...pick].map(([k,v])=>k+' x'+v).join(' ; '));
  console.log(' opp three',[...new Set(rows.map(r=>r.theirs.join('/')+' lead='+r.theirLead))].join(' ; '));
  console.log(' per-seed',rows.map(r=>(r.win?'W':'L')+r.turns+'('+r.myFaints+'/'+r.foeFaints+')').join(' '));
}
main().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
