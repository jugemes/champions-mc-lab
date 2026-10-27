'use strict';
// The six the user REPORTED using on ladder since 2026-10-18, transcribed
// field by field from docs/REAL-BATTLE-CASES-2026-10-27.md. It is a record of
// the user's report, NOT a new proposal and NOT a re-photographed in-game check.
// Defined independently of provisional-rank-roster-20261018.js (which stays
// unchanged for reproducibility), so a comparison between the two is a real
// cross-check rather than a property of copying.
const row=(species,item,ability,nature,points,moves)=>({
 species,item,ability,nature,moves:moves.split('/'),
 evs:Object.fromEntries(points.split(',').map(t=>[({H:'hp',A:'atk',B:'def',C:'spa',D:'spd',S:'spe'})[t[0]],Number(t.slice(1))]))
});
function reportedLive(){
 return [
  // メガメタグロス ようきH2/A32/S32 メタグロスナイト コメットパンチ/サイコファング/バレットパンチ/かみなりパンチ
  row('Metagross','Metagrossite','Clear Body','Jolly','H2,A32,S32',
   'Meteor Mash/Psychic Fangs/Bullet Punch/Thunder Punch'),
  // サザンドラ おくびょうH2/C32/S32 いのちのたま りゅうせいぐん/あくのはどう/かえんほうしゃ/ラスターカノン
  row('Hydreigon','Life Orb','Levitate','Timid','H2,C32,S32',
   'Draco Meteor/Dark Pulse/Flamethrower/Flash Cannon'),
  // アシレーヌ ひかえめH32/C32/S2 オボンのみ ムーンフォース/うたかたのアリア/アクアジェット/アンコール
  row('Primarina','Sitrus Berry','Torrent','Modest','H32,C32,S2',
   'Moonblast/Sparkling Aria/Aqua Jet/Encore'),
  // ガブリアス ようきH2/A32/S32 こだわりスカーフ じしん/ドラゴンクロー/いわなだれ/どくづき
  row('Garchomp','Choice Scarf','Rough Skin','Jolly','H2,A32,S32',
   'Earthquake/Dragon Claw/Rock Slide/Poison Jab'),
  // バンギラス いじっぱりH32/A32/D2 ヨプのみ ストーンエッジ/はたきおとす/れいとうパンチ/ステルスロック
  row('Tyranitar','Chople Berry','Sand Stream','Adamant','H32,A32,D2',
   'Stone Edge/Knock Off/Ice Punch/Stealth Rock'),
  // ウォッシュロトム ずぶといH32/B32/C2 たべのこし ハイドロポンプ/ボルトチェンジ/10まんボルト/おにび
  row('Rotom-Wash','Leftovers','Levitate','Bold','H32,B32,C2',
   'Hydro Pump/Volt Switch/Thunderbolt/Will-O-Wisp')
 ];
}
// Expected result of comparing reportedLive() with provisional(); a test
// computes the actual difference and must find exactly this.
const DIFF_FROM_PROVISIONAL=[
 {species:'Metagross',field:'moves',provisional:'Zen Headbutt',reported:'Psychic Fangs',
  source:'user screenshot reported to ChatGPT (docs/REAL-BATTLE-CASES-2026-10-27.md)'}
];
// Fields that the report does NOT state. The values above are placeholders,
// not observations. Single-ability species (Hydreigon, Rotom-Wash Levitate;
// Primarina's Torrent is one of two) are listed only when there is a choice.
const UNVERIFIED=[
 {species:'Metagross',field:'ability',value:'Clear Body',
  note:'pre-Mega ability only; Clear Body and Light Metal are both legal. After Mega it is Tough Claws regardless.'},
 {species:'Primarina',field:'ability',value:'Torrent',note:'Torrent and Liquid Voice are both legal; not stated in the report.'},
 {species:'Garchomp',field:'ability',value:'Rough Skin',note:'Sand Veil and Rough Skin are both legal; not stated in the report.'},
 {species:'Tyranitar',field:'ability',value:'Sand Stream',note:'Sand Stream and Unnerve are legal; sand use is implied by the plan but not stated.'},
 {species:'Hydreigon',field:'item',value:'Life Orb',
  note:'set the user asked to train; holding it in battle not yet directly evidenced.'},
 {species:'*',field:'ivs',value:'31 all',note:'not reported; lab.normalize() always assumes 31.'}
];
module.exports={reportedLive,DIFF_FROM_PROVISIONAL,UNVERIFIED};
