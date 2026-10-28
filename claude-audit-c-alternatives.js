#!/usr/bin/env node
'use strict';
// Claude independent audit C (Issue #13 / launch PR #18): paired test of two candidate fixes
// against the unchanged baseline 'rational' on the SAME seeds/sides/opponent trios as
// environment-m7-audit.js. Usage: node claude-audit-c-alternatives.js [perCell] [teamIdx1..14|all]
//  base     : rational preview, v3 decisions (unchanged)
//  foePrev  : rational-foe-mega preview (minimax over rival Mega forms), v3 decisions
//  hedge    : rational preview, v3 decisions + foeMegaHedge (turn-1 worst-case over rival forms)
//  both     : both changes
// Constructed opponents / synthetic sets / heuristic bots: NOT a ladder win rate.
const fs=require('node:fs'),path=require('node:path');
const {load,game,hashSeed}=require('./lab');
const {reportedLive}=require('./reported-live-roster-20261027');
const {groups}=require('./environment-m7-teams');
const sim=load(),own=reportedLive();
const n=Number(process.argv[2]||12),sel=process.argv[3]||'all';
const modes=['rational-opponent','forced-pressure','forced-alternative'];
const variants={base:{candidatePreviewPolicy:'rational'},foePrev:{candidatePreviewPolicy:'rational-foe-mega'},
  hedge:{candidatePreviewPolicy:'rational',foeMegaHedge:true},both:{candidatePreviewPolicy:'rational-foe-mega',foeMegaHedge:true}};
async function main(){
  const rows=[];
  for(let gi=0;gi<groups.length;gi++){
    if(sel!=='all'&&Number(sel)-1!==gi)continue;
    const grp=groups[gi];
    for(let mi=0;mi<3;mi++)for(const [vn,vo] of Object.entries(variants)){
      let wins=0,errors=0;const per=[];
      for(let k=0;k<n;k++){
        const seed=hashSeed(730000+gi*10000+mi*1000+k),reverse=Boolean(k%2);
        const options={megaAware:true,opponentPreviewPolicy:'rational',candidateDecisionPolicy:'v3',opponentDecisionPolicy:'v3',...vo};
        if(mi>0)options.opponentForced=mi===1?grp.forcedA:grp.forcedB;
        const g=await game(sim,reverse?grp.team:own,reverse?own:grp.team,seed,false,null,reverse,options);
        errors+=g.trace.errors.length;
        const w=g.winner===(reverse?'opponent':'candidate');wins+=Number(w);per.push(Number(w));
      }
      rows.push({team:grp.name,mode:modes[mi],variant:vn,n,wins,errors,per});
      console.log('C_CELL '+JSON.stringify({team:grp.name,mode:modes[mi],variant:vn,wins,n,errors}));
    }
  }
  const dir=path.join(__dirname,'output','claude-audit-c');fs.mkdirSync(dir,{recursive:true});
  fs.writeFileSync(path.join(dir,'cells-'+sel+'.json'),JSON.stringify(rows));
  for(const mode of modes)for(const vn of Object.keys(variants)){
    const p=rows.filter(r=>r.mode===mode&&r.variant===vn);
    const w=p.reduce((s,r)=>s+r.wins,0),g=p.reduce((s,r)=>s+r.n,0);
    console.log('C_SUMMARY '+JSON.stringify({mode,variant:vn,wins:w,games:g,rate:+(w/g).toFixed(4)}));
  }
}
main().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
