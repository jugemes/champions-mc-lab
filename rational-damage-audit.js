#!/usr/bin/env node
'use strict';
// Coarse damage bands used by the rational policies vs the damage the pinned
// Showdown engine actually dealt in the rational-cases battles. Rows with a
// critical hit, a boost on either side, or a foe at <100% HP whose loss was
// clamped by fainting are excluded from the in-band rate (listed, not hidden).
// The foe's real spread is a hypothesis set; bands are over ALL legal spreads.
const {load,hashSeed}=require('./lab');
const {CASES,runCase}=require('./rational-cases');
const {estimateDamage}=require('./damage');
const {hitBand}=require('./decision-rational');
async function main(){
  const sim=load(),dex=sim.Dex.mod('champions'),n=Number(process.argv[2]||4);
  const agg={};
  for(const name of Object.keys(CASES))for(let i=0;i<n;i++){
    const r=await runCase(sim,name,{policy:'rational2',seed:hashSeed(700000+i),reverse:Boolean(i%2)});
    const own=CASES[name].own();
    for(const h of r.hits){
      const base=dex.species.get(h.own).baseSpecies||h.own;
      const set=own.find(p=>p.species===h.own||p.species===base);
      if(!set)continue;
      const me={...set,species:h.own};
      const clean=!h.crit&&!Object.values(h.boosts).some(Boolean)&&!Object.values(h.foeBoosts).some(Boolean)&&h.dealt<h.before-1e-9;
      const key=h.own+' '+h.move+' -> '+h.foe;
      const e=estimateDamage(dex,me,h.foe,h.move,{}),b=hitBand(dex,me,h.foe,h.move,{});
      const a=agg[key]||(agg[key]={obs:[],excluded:0,est:[+e.min.toFixed(3),+e.max.toFixed(3)],band:[+b.min.toFixed(3),+b.max.toFixed(3)]});
      if(clean)a.obs.push(+h.dealt.toFixed(3));else a.excluded++;
    }
  }
  const rows=Object.entries(agg).filter(([,a])=>a.obs.length).map(([k,a])=>{
    const lo=Math.min(...a.obs),hi=Math.max(...a.obs);
    const inE=a.obs.filter(x=>x>=a.est[0]-0.005&&x<=a.est[1]+0.005).length,inB=a.obs.filter(x=>x>=a.band[0]-0.005&&x<=a.band[1]+0.005).length;
    return {hit:k,n:a.obs.length,observed:[lo,hi],estimateDamage:a.est,inEstimate:inE,hitBand:a.band,inHitBand:inB,excluded:a.excluded};
  });
  for(const r of rows)console.log([r.hit,'n='+r.n,'obs '+r.observed.join('-'),'est '+r.estimateDamage.join('-')+' ('+r.inEstimate+'/'+r.n+')','band '+r.hitBand.join('-')+' ('+r.inHitBand+'/'+r.n+')','excl '+r.excluded].join(' | '));
  if(process.argv[3])require('node:fs').writeFileSync(process.argv[3],JSON.stringify(rows,null,1));
}
if(require.main===module)main().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
