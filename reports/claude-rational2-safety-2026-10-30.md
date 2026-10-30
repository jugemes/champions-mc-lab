# Claude｜PR #51 rational の安全性修正 `rational2` と逆効果seedの同一状態分岐検証（2026-10-30）

発注：[PR #54](https://github.com/jugemes/champions-mc-lab/pull/54)（`docs/claude-requests/rational-safety-and-preview-20261030.md`）。
ベース：PR #51 commit `679c5e14f85cf96878d3ce5030f0e49bb1b5d45d`。PR #51 は上書きしていない。

## 再現条件
- Showdown `3a766f2cfb5e51c1e428cfe87d0dba91a8f01640`（ローカルでclone・build、`git rev-parse HEAD` で確認）、`gen9championsbssregmc`。
- `npm run check` → `LEGALITY CHECK PASSED: 12 teams`。`rational-compare.js` も全ケース両チームを `TeamValidator` に通す。
- 自分側：`reported-live-roster-20261027.js`（L6）。相手側：`rational-cases.js` の **仮説セット**（観測された型ではない）。選出はケースごとに固定（`ownPick`/`oppPick`）＝事前選出の合理性は本レポートの対象外（P1参照）。
- 既定の `decisionPolicy` は baseline のまま。`rational`（PR #51）は**1バイトも変えていない**。修正は opt-in の `rational2` として追加。
- 現行L6・main・固定Showdown は不変更。

## 1. 観測した失敗 → 原因仮説（ChatGPTレビュー #5709382419 と PR52 コメント）
| # | 指摘 | 確認結果 |
|---|---|---|
| P0-1 | `rationalSwitches<8` と `this.switches<3` が独立 | **確認**。rational経路の交代は `this.switches` を増やさず、従来ヒューリスティック交代がさらに3回可能だった。 |
| P0-2 | `available.length===1` を Choice/Encore と決めつけ | **確認**。PP切れ・ちょうはつ・かなしばりも同条件。Showdownのrequestは `disabled` だけで原因を返さない（`sim/pokemon.ts` getMoves）。 |
| P0-3 | seed `52522-48513-31438-37827` p2 で baseline勝ち／rational負け | **再現した**（両者11ターン、rational T3 `no-progress-loop`→`switch 3`）。原因が T3交代かは下の分岐検証で判定。 |
| P0-4 | hidden-info テストの `void r1; void r2` | **確認**。T1観測後に未完了ストリームを放置していた。 |
| P0-5 | A/B/ゴツメが退行しないこと | 下表で検証。 |

## 2. 実装（`rational2` のみ。baseline / v2 / v3 / rational は無変更）
- **交代カウンタ統一**：rational2 の交代も `this.switches` を加算。従来ヒューリスティック交代は合計 `<3`、rational2 理由の交代は合計 `<6`。ただし「居座っても文字通り何もしない」場合（無効技・+6積み技へのロック）は上限免除（無駄行動の固定化を避ける）。
- **ピンポン防止**：同じ相手が場に残る間、**直前に引っ込めた個体へ即戻す（A→B→A）**交代を禁止、同一相手への4回目の自発交代も禁止。3体目への二重交代は許可（初版で一律禁止したところ Garchomp→Rotom の正しい二重交代を潰し、分岐検証で 79→46/100 に悪化したため修正）。相手の交代でリセット。従来ヒューリスティック交代も同じガードを通す。
- **制約の分類** `classifyRestriction`：request の `pp`/`disabled`、自分の**現在の**持ち物（`req.side.pokemon[].item`、はたきおとし／トリック後は Choice と判定しない）、公開ログの `-start Encore/Taunt/Disable` から `choice|encore|taunt|disable|pp|unknown`。理由ラベルも `pp-locked-bad` 等に。
- **ループ判定** `noProgressLoopV2`：PR #51 の判定に3つの出口。(a) **この試合で実際に与えたダメージ**（なければ補正帯）が回復量0.5+0.05以上なら停滞ではない、(b) 相手の回復技残PP≤1（Champions PP は `(pp/5+1)*4` で固定、はねやすめ=8）、(c) `samples=2` オプション（既定1、下記）。
- **補正ダメージ帯** `hitBand`：`estimateDamage` が無視する公開・固定の事実のみ補正。メガ後の固定特性（メガメタグロス=かたいツメ×1.3）、ボディプレスは防御で計算。`damage.js` は不変更（既存TODO #74 は残る）。
- **交代先と居座りの比較** `chooseSwitchV2`：自陣ステロ/まきびしの入場ダメージ（Rock相性、浮遊、あつぞこ）、交代先の公開最悪帯での即死、**居座り行動の最悪値**との比較（差0.15以上悪い交代はしない）。ロック中の居座りは2ターン分、居座って倒れる場合は即死と同じ0.5のペナルティ。
- **相手Encore中の固定則**：Encore開始から2ターン以内かつ最善技の評価>0の時だけ「攻撃を優先」に限定（PR #51 は残りターン無視）。
- `lab.js` に公開情報の追跡を追加：自陣hazard、自分の Encore/Taunt/Disable、自分の技が与えた実ダメージ（急所は除外）、相手の回復技使用回数。**baselineの選択には使われない**（PR #51 の保存80行が完全一致で再現＝下記）。

## 3. 本当に再実行したテスト
| 項目 | 結果 |
|---|---|
| `npm test` | **121 tests / 114 pass / 0 fail / 7 todo**（todoは既存） |
| `npm run check` | `LEGALITY CHECK PASSED: 12 teams` |
| `node speed-probe.js` / `node lab.js --count 1 --logs 1` | PASS / 完走 |
| PR #51 保存データ `rational-cases-20261030.json` の再現 | **80/80 行が選択・勝敗・指標とも完全一致**（baseline・rational 不変の証拠） |
| 新規 unit（`test/decision-rational2.test.js` 14件） | 制約分類6種、PP/hazard/かたいツメ/ボディプレス、ループ出口、KO入場・居座り比較、統一カウンタ、PP固定ラベル、免除、ピンポン（戻り禁止・3体目許可・4回目禁止・相手交代でリセット）、残PP1で押し切り、`choiceAt` 例外、hidden-info、実Battleゲート3件 |
| hidden-info（完全Battleをawait、20秒タイムアウトで stream を writeEnd） | 3 seed × 4変種（相手の未公開技・持ち物、**相手の控え2体の入替**、先発は同じ）で、**自分の選出とT1行動が全一致** |

## 4. 旧／新比較（固定Showdown、seed `hashSeed(700000+i)`、i=0..9、偶数p1/奇数p2、選出固定）
`node rational-compare.js 10` → `reports/data/rational2-compare-20261030.json`
| ケース | 相手 | baseline | rational(#51) | rational2 |
|---|---|---|---|---|
| A グソク+6剣舞/Encore | script | W5/10, setupAtCap **70**, Encore中行動90 | W9, cap **0**, 10 | W9, cap **0**, 10 |
| A | **unscripted**（相手は自身のbaseline方策） | W5, cap 70 | W9, cap 0 | W9, cap 0 |
| B スカーフ毒突き→アーキ | script | W1, immuneHits **21** | W5, **10** | W5, **10** |
| B | unscripted | W0, 0 | W0, 0 | W0, 0 |
| B ゴツメ+はねやすめ | script | W6, helmetChip **31** | W7, **22** | W7, **22** |
| B ゴツメ | **unscripted** | **W2**, chip 41, ゴツメで瀕死6 | **W0**, chip 29, 瀕死1 | **W0**, chip 29, 瀕死0 |
| C スカーフ岩なだれ→アーマーガア | script/unscripted | W10, 0 | W10 | W10 |
- **A/B の修正は退行なし**（70→0、21→10、31→22 を維持）。A は unscripted でも同じ＝「固定相手が非合理にEncoreを繰り返すから成功した」のではなく、baseline方策の相手も同様にEncoreする。
- **C の岩なだれ連打プレミは今回も未再現**（旧AIもT2で交代）。未再現として保持。
- **rational と rational2 の行動差は 80試合中 0**。つまり rational2 の修正（統一カウンタ・分類・ピンポン・PP・hazard・居座り比較）は**これらのケースでは発動しない安全網**で、勝敗を変えていない。改善の証明ではなく「退行していない」までの証拠。
- **新たな懸念**：ゴツメケースを unscripted にすると rational/rational2 が baseline より悪い（2→0/10）。相手ガアが baseline方策では Rotom に対してアーキへ引く。後述の分岐検証と一致。

## 5. 逆効果 seed `52522-48513-31438-37827` p2 の判定（同一状態分岐）
`node rational-branch.js 200` → `reports/data/rational2-branch-20261030.json`
- 方法：同じseed・同じ選出でT3開始まで再生（**T1–T2のログが全分岐で一致することをコードで検査**）、T3の候補行動だけを変え、Showdown の `>reseed` で**200通りの同じ乱数列**を全分岐に与え、以降は同じ方策で続行。単一試合の勝敗ではなく、その1手の価値を比較。
- T3局面：メガメタグロス 71/157（45%）、ガア 136/205（66%、T2にはねやすめ）、ゴツメ公開。実ダメ：かたいツメ雷パンチ→ガア **42–47%**（はねやすめ50%未満）、ゴツメ1/6、ボディプレス22%。

| 相手の続行 | 居座り雷パンチ | Rotom交代（rational） | Garchomp交代 | 対の不一致（雷P勝ちのみ : Rotom勝ちのみ） |
|---|---|---|---|---|
| script（HP<60%ではねやすめ、他はボディプレス） | 174/200 | **182/200** | 158/200 | 17 : 25（有意差なし） |
| unscripted（相手baseline方策） | **13/200** | 2/200 | 1/200 | 12 : 1 |
（続行方策を baseline / rational / rational2 に変えても各分岐±4勝以内。数値は baseline続行。）

**結論**：
1. ChatGPT指摘の「T3交代が勝ち筋を細くした」は、**scriptedの相手では支持されない**（交代の方が182対174で僅かに上、有意差なし）。元の1試合の差は主にT9のりゅうせいぐん外し（90%命中）等の乱数。
2. **相手がRotomに対してアーキへ引く（人間的な）続行では、居座りの方が良い**（13対2、不一致12:1）。ただしこの3対3自体が両分岐とも勝率1–7%の負け局面で、差は小さい。T3交代は相手にはねやすめ1回分を無料で与える（Rotom分岐でガアが205/205に回復）。
3. `samples=2`（停滞を2サイクル観測してから交代）を試したが、PR #51 の別経路 `contact-into-recovery` が同じT3交代を選ぶため結果は変わらず。**1ケースへの過適合を避けるため既定は1のまま**（`loopSamples` / `RATIONAL2_LOOP_SAMPLES` で切替可能）。

## 6. 粗い `estimateDamage` と固定Showdown実ダメージ
`node rational-damage-audit.js 10`（急所・能力変化・瀕死でクランプされた行は除外し件数を表示）
| 攻撃 | n | 実測 | estimateDamage帯 | hitBand（補正） |
|---|---|---|---|---|
| メガメタグロス 雷パンチ→ガア | 17 | 0.42–0.50 | 0.32–0.69（mid 0.51） | 0.42–0.90（mid 0.66） |
| ウォッシュロトム 10万→ガア | 16 | 0.60–0.71 | 0.42–0.95 | 同 |
| メガメタグロス サイコファング→アーキ | 3 | 0.23–0.25 | 0.12–0.26 | 0.16–0.33 |
| ガブ 岩なだれ→ガア | 8 | 0.15–0.17 | 0.15–0.32 | 同 |
| ロトム 10万→メガリザY | 2 | 0.37–0.75 | 0.39–0.84（**1/2が帯外**） | 同 |
- 帯は相手の全合法配分にわたるため広い。**帯のmidで回復との比較をすると、かたいツメ補正後のmid 0.66 は「はねやすめに勝つ」と誤判定**する（実際は0.42–0.50でH32B32ガアに負ける）。このため rational2 は試合中の**実測ダメージを優先**する。
- ロトム→メガリザY 0.37 が帯外の1行は未解明（観測HP取得タイミングか計算の欠落）。ChatGPTの検証対象。

## 7. ペア比較ベンチ（参考。対人勝率ではない）
`RATIONAL_POLICY=rational2 node rational-benchmark.js 10`（11相手×10、計110/条件、両者legacy選出）
| 条件 | 勝 | Wilson95% | 自分の無効技被弾 |
|---|---|---|---|
| baseline-vs-baseline | 51/110 | 0.37–0.56 | 82 |
| rational2-vs-baseline | 52/110 | 0.38–0.57 | **44** |
| baseline-vs-rational2 | 49/110 | 0.36–0.54 | 79（相手側 39） |
| rational2-vs-rational2 | 50/110 | 0.37–0.55 | 41 |
勝数差は誤差内。言えるのは「無効技連打が約半減、勝数は変わらない」まで。PR #51 の 11×40×4 は今回再実行していない。

## 8. 解消した欠陥／残った欠陥
**解消（コード＋テストで確認）**：二重カウンタ、制約原因の誤ラベル、即時ピンポン、相手Encore固定則の残ターン無視、hidden-infoテストのストリーム放置、居座り/交代先比較でのhazard・即死・ロック継続の無視、回復残PPの無視、メガ固定特性/ボディプレスの帯欠落（rational2内のみ）。
**残った欠陥・未検証**：
- ゴツメ＋回復の相手に対する交代タイミングは、**相手の続行方策しだいで正解が逆転**（§5）。相手の控え（公開6からの合理的3体）を考慮した交代予測がない。
- 上記の安全網はケースA/B/Cでは発動せず、**実戦相当の局面でのゲートは unit の合成requestのみ**。ステロ+回復連打の実Battle反例は未作成。
- `damage.js` 本体（baseline）にはかたいツメ等が未反映（既存TODO）。
- Champions の Encore 継続ターンは gen9 の3ターンと仮定（固定Showdown `data/moves.ts` duration:3 を確認、実機未確認）。

## 9. P1（公開6→3選出）
**本PRでは未実装**（P0優先の発注どおり）。PR #53 の診断（B/C で回答役の Rotom-Wash／スカーフガブが選ばれない）は、本PRのケースが選出を固定しているため影響を受けない。選出改善は別PRとし、その旨 Issue #20 に記録する。

## 10. ChatGPTが反証すべき点
1. §5の分岐法：`>reseed` 後の乱数は分岐ごとに同じ列だが、消費順が異なるため「同じ乱数」ではない。対の不一致数を独立サンプルとして扱ってよいか。
2. 居座り/交代比較の margin 0.15、ロック2倍、即死0.5、上限6、4回目禁止の値は根拠の弱い設定値。別ケースで過剰に交代を止めていないか。
3. unscripted ゴツメで rational 系が baseline に負ける（2→0/10）のは T3以外の理由もあるか（seed一覧は `rational2-compare` JSON）。
4. hidden-info テストは先発を固定した変種のみ。先発が変われば行動が変わるのは正常だが、選出段階では相手の実際の3体を一切読んでいないことを `chooseThree` のコードで確認してほしい。
