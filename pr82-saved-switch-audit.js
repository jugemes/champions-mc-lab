#!/usr/bin/env node
'use strict';
// PR #82 P0-1: re-read of SAVED PR #81 eval logs (reports/data/pr80-eval-*-v2.json),
// NOT a battle rerun. Each requested T1 rival switch ('switch N') is resolved to
// the rival's selected order (slot N of rival3, valid at T1 only) and compared
// with the first RIVAL switch line of T1 that precedes any RIVAL move/faint in
// the saved t1t2 lines. PR #81 checkRequested result shown alongside.
const fs=require('node:fs');
function audit(files){
  const out={requests:0,byPair:{},wrongTarget:[]};
  for(const f of files)for(const c of JSON.parse(fs.readFileSync(f,'utf8')).cases)for(const g of c.branchGames)for(const q of g.requested||[]){
    if(q.move||q.turn!==1)continue;
    out.requests++;
    const target=g.rival.split('/')[Number(q.choice.split(' ')[1])-1];
    let t=null,actual=null,why='none';
    for(const l of g.t1t2){
      if(l==='T1'||l==='T2'){t=l;continue;}
      if(t!=='T1')continue;
      const [kind,actor,det]=l.split('|');
      if(!actor?.startsWith('RIVAL:'))continue;
      if(kind==='move'||kind==='faint'){why=kind==='faint'?'faint-first':'move-first';break;}
      if(kind==='switch'){actual=det.split(',')[0];why='voluntary';break;}
      if(kind==='drag'){why='drag';break;}
    }
    const v2=actual?(actual.replace(/-Mega.*$/,'')===target?'executed':'wrongTarget'):why==='faint-first'?'preempted':why==='drag'?'dragged':'mismatch';
    const k='v1='+q.result+' v2='+v2;out.byPair[k]=(out.byPair[k]||0)+1;
    if(v2==='wrongTarget'&&out.wrongTarget.length<10)out.wrongTarget.push({six:c.six,hyp:c.hyp,rival:g.rival,choice:q.choice,target,actual,seed:g.seed,reverse:g.reverse});
  }
  return out;
}
if(require.main===module){
  const files=(process.env.EVALS||'reports/data/pr80-eval-dev-v2.json,reports/data/pr80-eval-holdout-v2.json,reports/data/pr80-eval-hxsand-v2.json').split(',');
  const r=audit(files);console.log(JSON.stringify(r,null,1));
  if(process.env.OUT)fs.writeFileSync(process.env.OUT,JSON.stringify({source:files,note:'re-read of saved PR #81 logs, NOT a battle rerun',...r},null,1));
}
module.exports={audit};
