const {Bot,load}=require('./lab');
const {reportedLive}=require('./reported-live-roster-20261027');
const {makeThreeBattle}=require('./engine-three-branch');
(async()=>{
const sim=load(),own=reportedLive();
const foe=reportedLive(); // mirror: Primarina has Encore
const b=makeThreeBattle(sim,own,foe,{ownThree:['Rotom-Wash','Primarina','Hydreigon'],foeThree:['Primarina','Metagross','Hydreigon'],seed:[2026,10,29,77]});
const idx=(s,id)=>s.active[0].moveSlots.findIndex(x=>x.id===id)+1;
b.makeChoices('move '+idx(b.p1,'willowisp'),'move '+idx(b.p2,'encore'));
const logs=b.log.join('\n');const req=structuredClone(b.p1.activeRequest);
console.log(logs.split('\n').filter(l=>/Encore|move\||burn/.test(l)).join('\n'));
console.log(JSON.stringify(req.active[0].moves.map(m=>[m.id,m.disabled])));
for(const pol of ['v3-public-immunity','v4-public-status']){
 const bot=new Bot((async function*(){yield logs;})(),sim.Dex.mod('champions'),own,'p1',{selections:[],choices:[],errors:[],immuneObservations:[],engineAdvices:[]},null,null,{decisionPolicy:pol});
 await bot.run();
 console.log(pol,'->',bot.decide(req));
}
b.destroy();})();
