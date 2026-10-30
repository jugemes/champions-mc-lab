# Claude 実装＋検証：opt-in `decisionPolicy:'rational'`（発注 PR #50 / Issue #20）

- 発注：`docs/claude-requests/showdown-first-decision-quality-20261030.md`
- エンジン：Pokémon Showdown 固定 SHA `3a766f2cfb5e51c1e428cfe87d0dba91a8f01640`（ローカルで clone→`node build`）、format `gen9championsbssregmc`、`Dex.mod('champions')`
- 外部 `poke-engine` / Foul Play / battle-engine のコードは**一切使用していない**。battle-engine (MIT, SHA `0b4661c`) から借りたのは考え方のみ：①2択の同時評価表、②交代の切迫度、③公開情報を prior で上書きしない、④「先に基準を決めてから勝数を見る」段階的 gate。
- **旧AI（baseline/v2/v3）の挙動は不変**。同一seedで `node lab.js --count 6`（192戦）の `results.csv` が main とバイト一致（`cmp` 一致）を確認済み。

## 1. 観測した失敗 → 原因仮説
| 報告された失敗 | 固定Showdownで再現したか | baseline の原因（コードで確認） |
|---|---|---|
| A. メガグソクが+6後もつるぎのまい→アンコール | **再現**（10/10戦で +6 到達後のSD 計70回、SD最大10連続） | Encore中は request が SD だけを返す。baseline の交代判定は `score(bench)>best+18` 等の汎用条件のみで「縛られた技が無価値」を見ない。 |
| B. こだわりガブのどくづき固定でアーキテクトに居座り | **再現**（10戦で無効被弾21回、どくづき最大6連続） | choice ロックを検出しない。`moveUtility` は無効技を 0 点にするだけで、0点の技しか選べない状態を「交代理由」にしない。 |
| B. メタグロスがゴツメ＋はねやすめガアに接触連打 | **部分再現**（ゴツメ反動31回/10戦。ただし baseline は HP<25% で交代するため**ゴツメ自滅は0回**で、報告の5連打自滅そのものは出ない） | 接触ペナルティは固定 -32 のみ。相手の回復で前進していないことを見ない。 |
| C. こだわりガブが岩なだれ4連打でガア | **未再現**（10/10戦で baseline もT2で交代） | この台本では baseline の汎用交代条件が先に働く。報告局面の相手行動/HPが不明なため再現できていない。**直したと主張しない。** |

## 2. 実装（`decision-rational.js` ＋ `lab.js` のフック）
`decisionPolicy:'rational'` のときだけ有効。baseline の技評価を土台に、以下を加算/上書き：

1. **(iii) 上限積み技**：`move.boosts` の上昇能力がすべて+6なら -1e5（技名リストではなく dex のデータで判定）。0点の補助技は -1 に落とし、「全部0点なら先頭技」という同点の罠を消す。
2. **(i) ゴツメ/さめはだ/てつのトゲ**：**公開済み**の持ち物/特性のみ（`[from] item: Rocky Helmet|[of] p2a` を種族ごとに記憶。未公開なら0扱い）。反動≥残HPかつ確定数に届かない接触技は -1e4。回復技を見せた相手に「中央値ダメージ < 50%+反動」なら `contact-into-recovery`。
3. **(ii) こだわり/アンコール固定**：`available.length===1` を固定とみなし、その技が「無効（計算 or `-immune` 観測）/ 回復を見せた相手に前進≤5% / 半減以下で中央値<30% / 反動で自滅 / 価値のない補助技」なら、合法交代（`canSwitchAgainst` で拘束確認）を選ぶ。
4. **(iv) アンコール状態の更新**：`-start/-end ... Encore` を双方で追跡。自分側は 3 の判定に、相手が**補助技でアンコール中**なら次の行動が既知なので baseline の任意交代をしない。
5. **無進展ループ検出（公開履歴のみ）**：前ターンに同じ相手へ技を撃ったのに相手HPが減っておらず（回復）、自分のHPだけ減った → 交代。
6. **同時手 matrix（簡易投影）**：自分の各技・各交代 × 相手の公開行動（公開タイプの物理/特殊90 STAB 帯、**見えた技**、補助/積み、不明先への交代）。素早さは公開帯（無振り-補正〜32振り+補正、持ち物未公開ならスカーフ×1.5も）で、順序不明なら worst は悲観側、mean は平均。**見えていない相手でも被ダメ0にしない**（battle-engine Phase1 の穴を模倣しない）。現状は交代先選択と `trace.matrix` ログ用途で、主たる技選択には使っていない。数値は投影であり Battle の正確な結果ではない。

公開情報の境界：Bot は自分のチームと自分側 stream しか受け取らない（`game()` 構造上、相手 team は渡らない）。テスト `hidden-info boundary` で、**T1前に未公開の相手の4技目・持ち物だけを変えても T1 選択が同一**であることを固定Showdownで確認。

## 3. テスト（`test/decision-rational.test.js`、10件すべて pass）
- 単体：(iii) 上限積み、(i) ゴツメ自滅/回復相手、(ii) どくづき→アーキテクト・じしん→リザ・岩なだれ→回復ガアは bad／じしん→カバ・岩なだれ→リザは keep、(iv) アンコール補助技、公開リスク帯>0、matrix の worst≤mean と交代行。
- 固定Showdown実戦：A（旧SD上限>0→新0）、B どくづき（旧無効≥2→新=1）、B ゴツメ（新のゴツメ反動<旧）、隠し情報 swap。
- 全体：`npm test` 107件中 100 pass / 0 fail / 7 todo（todo は既存）。`npm run check` LEGALITY PASSED 12 teams。ケース用の仮説セットも全て `TeamValidator` 通過を `rational-cases.js` 起動時に検査（`Choice Band` は M-C で存在しないため不採用→Yache Berry に変更した経緯あり）。

## 4. 反例ケース：同seed・左右入替（`node rational-cases.js 10`）
seed = `hashSeed(700000+i)`、i 奇数で候補が p2。生データ `reports/data/rational-cases-20261030.json`。

| ケース | 方針 | 勝/10 | 主要指標（10戦合計） |
|---|---|---|---|
| A グソクSD＋アンコール | baseline | 5 | +6でのSD **70**、アンコール中の行動 90、平均19.9T |
| | rational | 9 | +6でのSD **0**、アンコール中の行動 10（各戦T3で交代） |
| B どくづき固定→アーキテクト | baseline | 1 | 無効被弾 **21** |
| | rational | 5 | 無効被弾 **10**（初回1回は不可避、T2で交代） |
| B ゴツメ＋はねやすめガア | baseline | 6 | ゴツメ反動 **31**、ゴツメ自滅 0 |
| | rational | 7 | ゴツメ反動 **22**（7/10戦でT3に `no-progress-loop` 交代。残り3戦はガアが羽休め前に倒れた等で発火条件なし） |
| C 岩なだれ固定→ガア | 両方 | 10 | 差なし（未再現） |

**勝数は台本付き単一局面の動作確認であって勝率ではない。** 選出は仮説で強制。

### 相手行動・選出の分類
| ケース | 相手の選出（公開6から） | 相手行動 | 分類 |
|---|---|---|---|
| A | プリマ/ブラッキー/ドドゲ（仮説） | SD直後にアンコール | **合理的**（SDを見てからの定番）。台本はアンコール切れ直後に再アンコールするため baseline の被害は誇張気味 |
| B ゴツメ | ガア/アーキテクト/ルカZ | ガアは HP<60%で羽休め、他はボディプレス | **合理的**（こちらのメタグロス・ガブにガアは自然な選出） |
| B どくづき | プリマ→T1にアーキテクトへ交代 | 読み交代 | **合理的だが読み依存**：ガブがじしんなら抜群。相手の最善とは断定しない |
| C | リザY→T1にガア交代 | 岩なだれ読み | 合理的。ただし baseline が既に交代するため検証として弱い |

## 5. 対照ベンチ（段階 gate、`node rational-benchmark.js 40`）
基準は事前に固定：**gate1** 候補側のプレミ指標が増えないこと、対象指標が減ること → 通過時のみ **gate2** 勝数＋Wilson95%。
候補 = `reportedLive()`（実戦報告6体、コード側未確認項目は `UNVERIFIED` 参照）。相手 = holdout 8構築＋rain/setup/stall の計11構築、各40 seed（左右交互）、選出は双方 legacy `chooseThree`（公開6のみ）。生データ `reports/data/rational-benchmark-20261030.json`。

| 条件（候補 vs 相手） | 勝/440 | Wilson95% | 候補の無効被弾 | 相手の無効被弾 | エラー |
|---|---|---|---|---|---|
| baseline vs baseline | 208 | 0.427–0.519 | 355 | 476 | 0 |
| rational vs baseline | 218 | 0.449–0.542 | **176** | 476 | 0 |
| baseline vs rational | 190 | 0.386–0.478 | 344 | **158** | 0 |
| rational vs rational | 200 | 0.409–0.501 | 165 | 158 | 0 |

- gate1：**通過**（無効被弾は約半減、ゴツメ自滅/上限SD はこの11構築では両方0で増加なし）。
- gate2：rational 化で +10勝（主に mixed_electric 5→14/40）。**ただし選出が決定的なため相手構築ごとに 0/40 か 40/40 に張り付き、実効的な独立標本は約11。** Wilson CI は過小評価で、+10 は有意差と主張しない。
- 相手を rational にすると候補は 208→190（rain_pivot 24→6）。相手が賢くなって勝数が下がるのは想定どおりで、「旧AI相手の勝数」を構築評価に使うべきでない証拠の一つ。

## 6. 未解決・既知の弱点（ChatGPT に反証してほしい点）
1. **メガ後の特性/種族値を `estimateDamage` が反映しない**（メガメタグロスのかたいツメ等）。`contact-into-recovery` 閾値（中央値<50%+反動）は過小評価側にずれ、早すぎる交代を起こしうる。実測ではかみなりパンチ 43% 程度。
2. 固定判定は `available.length===1`。ちょうはつで攻撃技が1つだけ残る場合、PP切れ、Disable 等も「固定」に含まれる。誤判定時も「その技が悪い」場合しか交代しない設計だが未試験。
3. 交代先は matrix の worst+0.5×offense で選ぶ簡易式。交代連打の上限 8（`rationalSwitches`）。ピンポン交代・ステロ下の消耗は未評価。
4. matrix は主たる技選択に未使用（ログのみ）。同時手の最大損失を技選択に使うと baseline から大きく変わるため、別 gate で試すべき。
5. Case C（岩なだれ固定）は未再現。ユーザーの実戦ログ（ターン・HP・相手の行動）があれば台本を合わせられる。
6. ベンチの選出は legacy のまま。選出AIの合理性（P0-5/#27 等）とは独立で、ここでは**ターンAIの差分だけ**を見ている。
7. 実戦6体の変更・新規育成の推奨は**していない**。ユーザー判断待ち。

## 7. 再現手順
```bash
git clone https://github.com/smogon/pokemon-showdown showdown && cd showdown \
  && git checkout 3a766f2cfb5e51c1e428cfe87d0dba91a8f01640 && npm install && node build && cd ..
export SHOWDOWN_DIR=$PWD/showdown
npm run check && npm test
node rational-cases.js 10 out-cases.json      # 反例4ケース×10seed×{baseline,rational}
node rational-benchmark.js 40 out-bench.json  # 11構築×40seed×4条件
```
コスト：既存 Claude Team 枠のクラウドセッションのみ。新規 workflow・有料 runner・API 従量課金なし。
