#!/usr/bin/env node
'use strict';
// PR #94 item 3: N2/a worst cell (Mega ace lead vs our Rotom-Wash lead) on
// pinned Showdown. Isolates the two causes of the PR #93 internal/external gap
// by varying ONLY the ace's nature / moves in the N2/a team:
//   real                 N2/a set (Adamant, Close Combat/Pin Missile/Rock Blast/SD)
//   jollySkillLink       same moves, Jolly (the role template's nature)
//   adamantTemplateMoves Adamant, template moves (CC/Megahorn/EQ/Stone Edge)
//   template             the selector's internal set (Jolly, template moves)
// plus the same cell / seeds for v2's pick (Metagross lead). 16 seeds per row,
// one side each (s%2), rival branch ai and attack. Writes
// reports/data/pr94-n2a-diagnosis.json. AI vs AI, NOT a ladder win rate.
const fs=require('node:fs');
const {hashSeed,load}=require('./lab');
const T=require('./pr94-t1t2');
const H92=require('./holdout-20261031-pr92');
async function main(){
  const dex=load().Dex.mod('champions');
  const own=require('./reported-live-roster-20261027').reportedLive();
  const N2=H92.unseenSixesPR92().N2_heracross,ace=N2.ace,base=N2.hypotheses.a,real=base.find(p=>p.species===ace);
  const tmpl=['Close Combat','Megahorn','Earthquake','Stone Edge'];
  const mk=(nature,moves)=>base.map(p=>p.species===ace?{...p,nature,moves}:p);
  const V={real:mk(real.nature,real.moves),jollySkillLink:mk('Jolly',real.moves),adamantTemplateMoves:mk('Adamant',tmpl),template:mk('Jolly',tmpl)};
  const foe=[ace,...base.map(p=>p.species).filter(s=>s!==ace)].filter(s=>['Rotom-Mow','Lycanroc-Dusk',ace].includes(s));
  const picks={pr93:['Rotom-Wash','Hydreigon','Primarina'],v2:['Metagross','Hydreigon','Garchomp']};
  const jobs=[],names=Object.keys(V),teams=Object.values(V);
  teams.forEach((t,ti)=>{for(const [pol,p] of Object.entries(picks))for(const br of ['ai','attack'])for(let s=0;s<16;s++)
    jobs.push({team:ti,pol,own:p,foe,branch:br,seed:hashSeed(9550000+ti*1000+(br==='ai'?0:100)+s),reverse:s%2===1,keepLines:true,plan:{}});});
  const R=await T.runGames94(own,teams,jobs,{workers:Number(process.env.WORKERS||4)});
  const rows=[];
  names.forEach((n,ti)=>{for(const pol of Object.keys(picks))for(const br of ['ai','attack']){
    const X=R.filter((r,i)=>jobs[i].team===ti&&jobs[i].pol===pol&&jobs[i].branch===br);
    const t1=X.map(r=>(r.lines.find(l=>l.startsWith('T1 |move|')&&!l.split('|')[2].startsWith(r.side+'a:'))||'').split('|')[3]||'-');
    rows.push({variant:n,pick:pol,branch:br,n:X.length,won:X.filter(r=>r.won).length,
      ourLeadKOdT1:X.filter(r=>r.lines.some(l=>l.startsWith('T1 |faint|'+r.side+'a:'))).length,
      publicImmuneGames:X.filter(r=>r.immune.length).length,rivalT1Moves:[...new Set(t1)]});}});
  const out={showdown:'3a766f2cfb5e51c1e428cfe87d0dba91a8f01640',format:'gen9championsbssregmc',foe,picks,seeds:'hashSeed(9550000+variant*1000+(attack?100:0)+s), s=0..15, side s%2',rows};
  fs.writeFileSync(process.env.OUT||'reports/data/pr94-n2a-diagnosis.json',JSON.stringify(out,null,1));
  for(const r of rows)console.log(r.variant.padEnd(22),r.pick.padEnd(5),r.branch.padEnd(6),'won',r.won+'/'+r.n,'T1 KO of our lead',r.ourLeadKOdT1,'immune',r.publicImmuneGames,r.rivalT1Moves.join(','));
}
if(require.main===module)main().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
