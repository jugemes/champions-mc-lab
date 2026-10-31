# PR #92 依頼への回答：guard仮説と合理敵セルの乖離・新未知公開6・T1/T2（2026-10-31）

判定：**NOT READY**（事前宣言した判定規則で不合格。研究用 opt-in のまま。実戦既定・現行6体・育成は変更しない）

- 起点：PR #91 head `459a1b058a2d08de7ed9bb0eaff12b65b9845165`。pr88/pr90 のコードと保存 JSON は**未変更**（旧結果は再現可能）。
- 対象：Showdown `3a766f2cfb5e51c1e428cfe87d0dba91a8f01640`、`gen9championsbssregmc`、自軍は `reportedLive`（不変更）。
- テスト：`npm test` 228 tests / 221 pass / 0 fail / 7 TODO。`npm run check` は LEGALITY CHECK PASSED: 12 teams（4 CPU のクラウドセッションでの実測）。
- すべてヒューリスティックAI同士、構築済み仮説での結果。**対人勝率ではない**。

## 0. 手順と時系列（コミット順）
1. `1910153` **事前宣言**（battle を1回も実行する前）：`holdout-20261031-pr92.js` と `test/pr92.test.js` で次を固定した。
   - 未使用の新しい公開6を2つ（N1 Blaziken、N2 Heracross）。それぞれ合法な仮説 a/b を持つ。
   - セル規則（pr88 rationalCells + view3）、seed、評価指標、NOT READY 判定規則、予算。
   - 既知の A/C/F2/F3 は**診断・開発用**と明記した。
2. `b553a54` 提案版 selector・T1/T2 表・評価器を実装し、DEV で2変種を比較した。凍結規則に従って `cellRule:'rational'` を **FINAL 前に凍結**した。
3. FINAL（N1/N2）を**1回だけ**実行した（`reports/data/pr92-eval-final.json`）。凍結後の調整はしていない。

## 1. 乖離の原因（公開6だけで確認。battle 不要）
| ID | 原因 | 証拠 |
|---|---|---|
| G1 | pr88 は `coverageScenarios max 4` で、役割の組み合わせが欠ける | A では `Garchomp:scarf` と `Gholdengo:scarf` が未カバー。F2 では `Feraligatr:scarf` と `Noivern:scarf` が未カバー。A/H0 の実際の負け筋は Primarina 先発の後ろのスカーフ Garchomp |
| G2 | 積み技は SETUP リストの先頭を採るため、Swords Dance が Dragon Dance より先に選ばれる | Mega Feraligatr が竜舞で全抜きする仮説が一度も作られない（F2/a の負け筋） |
| G3 | 相手3体の候補 `rivalCandidates` が「中心の組 + 1体」の形に偏る | F2 の guard の相手3体は**すべて Mudsdale を含む**。F2/a で負けたセル Hatterene/Infernape/Feraligatr は一度も現れない。この3体は各シナリオで「Feraligatr を含む3体」の2位 |
| G4 | 集計が「シナリオ平均の最小」 | 勝率0のセルが 12 以上のセルの平均に埋もれる（A：guard 内部 .729 に対し、外部評価では 0 のセルあり） |
| G5 | 候補が legacy + 探索上位3 だけ | その外にある選出は選ばれる可能性がない |

## 2. 提案版 `pr92-rational-cover-preview.js`（入力は公開6種名のみ）
- **シナリオ**：v2 の役割仮説に「素早さも上がる積み技」の変種を加える。追加するのは、合法で TeamValidator と coherence を通る場合だけ。`coverageScenarios max 8` で (種族, タグ) を全カバーし、pr88 の alt-category を加える。
- **相手セル**（凍結した `cellRule:'rational'`）：相手が自分の選出に使う規則 `rationalCells`（legacy/view1/view2/aceLead/aceBack）を、**公開6から作った仮説チーム**に適用する。
  - ace は各シナリオでメガストーンを持つ種族。持つ種族がいなければ相手 legacy 3体の先頭。
  - 加えて「メガ持ちを含む rankTrios 上位2の3体」も入れる。
  - 実際に評価される相手の型は一切使わない。
- **選出**：自軍の 60 通りの 3+先発を、全セル（相手 AI 分岐、1 seed）でふるいにかける。上位6と legacy を guard にかける：全セル × 相手分岐 ai/attack/setup/switch × 独立 seed 2本（左右は seed ごとに片側だけ）。
  - セル値 = 分岐 × seed の平均。
  - 採点 = **CVaR25（セル値の下位 25% の平均）**。同点は平均で決める。
  - legacy を置き換えるのは、CVaR ≥ legacy + 0.05 かつ mean ≥ legacy − 0.02 の候補があるときだけ。
- **ハードな期限**：子プロセスグループを SIGKILL する。期限超過は legacy を `abstain` として返す（安全とは主張しない）。
- 先に試した `cellRule:'all'`（rivalCandidates + core-break 3体）は捨てた。core-break 3体はどのシナリオでも F2 の HIF セル（Hatterene/Infernape/Feraligatr）を生まなかった。また DEV の A/H0 で 0.22 と悪かった。

## 3. T1/T2 の人間用方策 `pr92-t1t2.js`
- **キーは公開情報だけ**：T1 は相手先発の種族名。T2 は「相手先発 | 自分の場 | 相手の場」。
- `checkObs` は、これ以外の項目（道具・技・3体など）が入ると throw する（テストで確認）。
- **表の作り方**：selector の公開由来シナリオとセルで、各合法行動を1つずつ強制し、同じジョブの base AI と対にして比べる。n ≥ 8 かつ AI より 0.10 以上良いときだけ「強制ルール」にする。それ以外は「AI既定」で、その状態で AI が実際に取った最頻の行動と割合を出す。こうして人間が読める具体的な行動にする。
- **実行**：評価時に実際の相手の型に対して実 Battle で表を実行した（`proposedT1T2`）。
- 結果：
  - DEV では C で **Rotom-Wash 先発のまま Baxcalibur/Charizard 先発に T1 Volt Switch** するルールが効いた。C/Y は .26 → .83、C/X は .24 → .87。
  - FINAL では強制ルールが **0 本**だった（N1/N2 の全キーで AI 既定）。つまり FINAL では T1/T2 表は AI と同じ行動を記述しただけで、**付加価値は実証できていない**。

## 4. 結果（評価器 `pr92-eval.js`：相手は自分の実際の型から合理セルを選ぶ。相手 T1/T2 は pr82 BRANCHES の6分岐。seed 4本で各片側。合理試合 nRat=100 / 仮説・方策）

### FINAL（N1/N2、事前宣言済み、1回だけ実行）
| 方策 | 平均 meanRat | 最悪セルの平均 | 最悪セル0の仮説 | N1/a | N1/b | N2/a | N2/b |
|---|---|---|---|---|---|---|---|
| legacy | .660 | .287 | 1 | .88 | .75 | .66 | .35 (0) |
| quick | .855 | .663 | 0 | .96 | .96 | .94 | .56 |
| #89 guarded | .867 | .487 | 0 | .88 | .75 | **1.00** | .84 |
| #91 v2 | .867 | .487 | 0 | .88 | .75 | **1.00** | .84 |
| **提案版** | **.910** | **.750** | 0 | .99 | 1.00 | **.68**（最悪 .20） | .97 |
| 提案版 + T1/T2 | .910 | .750 | 0 | 同上（強制ルール 0 本） | | | |

- **事前宣言規則による判定：NOT READY**。N2/a の meanRat .68 が max(legacy, v2) 1.00 − 0.15 を下回った。
- N2/a のセル比較（提案版と v2）：3セルで悪化、改善は0。
- N2/a の負け筋（view2 Heracross/Rotom-Mow/Lycanroc-Dusk、ai 分岐、seed 0）：
  - T1：メガ Heracross が先手で Close Combat を撃ち、Rotom-Wash 先発が一撃で倒れる。
  - T2：Primarina が出て Moonblast で Heracross を倒すが、Rotom-Mow が Leaf Storm を撃つ…という展開。
  - 内部シナリオでは「Heracross 先発に対して Rotom-Wash を残す」が問題にならなかった。メガ Heracross の先制一撃（Rotom-Wash の素早さ帯と被ダメ）を仮説が過小評価している可能性がある（未確認）。
- 相手エース：N2 は全セルにエースがいる。N1 は 5 セル中 4 セル。「相手がエースを出さなかったから勝てた」には当たらない（N1/a で提案版がエースなしセルで取った成績は .975）。

### DEV（診断・開発用。既知の6体で、未知 holdout ではない）
| 方策 | 平均 | 最悪セル0の仮説 | A/H0 | A/H1 | A/H2 | C/Y | C/X | F2/a | F2/b | F3/a |
|---|---|---|---|---|---|---|---|---|---|---|
| #89/#91 | .735 | 2 | .52 (0) | .93 | .56 (0) | .71 | .73 | .66 | .98 | .79 |
| 提案版（rational） | .647 | 3 | .62 (0) | **.43** | .79 | **.26 (0)** | **.24 (0)** | **1.00** | .84 | 1.00 |
| 提案版 + T1/T2 | **.799** | 2 | .63 (0) | **.42 (0)** | .80 | .83 | .87 | **1.00** | .84 | 1.00 |

- F2/a は事後 oracle を使わずに **Metagross 先発**（Metagross>Primarina/Rotom-Wash）を選び、1.00 になった（v2 は .66）。
- 一方、**A は閉じていない**。
  - A/H0 は「legacy」セル（Primarina 先発 + Garchomp/Gholdengo）で 0。
  - A/H1 は v2 の .93 から .43 に**悪化した**。
- C は選出（Rotom-Wash 先発）だけだと大きく悪化し、T1 Volt Switch のルールで初めて回復した。**選出と T1 の組でしか成立しない**。

## 5. 処理時間（4 worker、実測）
| 処理 | 時間 |
|---|---|
| 提案版 selector | 17〜33s（FINAL N1 26.3、N2 17.4。DEV 23〜33） |
| T1/T2 表の作成 | 9〜16s |
| #89 guarded | 28s |
| #91 v2 | 35s |
| quick | 約10s |

- **実ゲームの選出制限時間は未確認**。対人の選出画面で即時に計算できるとは主張しない。
- 区別して扱う：
  - **オフライン事前探索**：既知の公開6に対して selector と表を事前計算する。
  - **実戦時の即時選択**：表を引くだけ。
- 期限超過（300s）は `abstain`（legacy）として記録する。

## 6. 独立 n と seed
- 評価は (セル, 分岐) ごとに独立 seed 4本で、seed ごとに片側だけ実行した。PR #91 の「同 seed の左右はほぼ複製」を受けて、n を水増ししていない。
- 4本の seed は方策間で共通（対の比較）。仮説あたりの合理試合は 100（5セル × 合理分岐5 × 4 seed）。
- セル単位の差は少数セルの比較なので、方策間の .1〜.2 程度の差は確定的ではない。

## 7. 合法性・公開情報の境界
- N1/N2 の4チームは TeamValidator と coherence（66P、各32以下、4技、Choice に変化技なし、メガストーン整合）を `test/pr92.test.js` で確認した。
- 置き換えた項目：Weakness Policy / Choice Specs（M-C に存在しない）→ Rindo Berry / Wise Glasses。Pawmot の U-turn、Mabosstiff の Yawn（覚えない）→ Mach Punch / Protect。
- selector の入力は6つの文字列だけ（それ以外は throw）。T1/T2 の観測項目は許可リスト方式。事後 oracle（`pr90-ceiling`）は selector・調整のどちらにも使っていない。

## 8. ChatGPT が反証すべき点
1. **DEV で変種を選んだことの影響**：`cellRule:'rational'` は、評価器と同じ「相手の選出規則」を**仮説チームに**適用する。隠れた型は使っていないが、評価器の相手モデルに合わせた設計ではある。FINAL のセル規則は view3 を足しただけで、ほぼ同じ規則。規則の異なる相手モデル（例：人間の使用率ベース）で評価し直す必要がある。
2. **N2/a の悪化**：メガ Heracross の先手 Close Combat で Rotom-Wash 先発が一撃で倒れる、を内部シナリオが拾えなかった理由（メガ後の素早さ帯・火力の仮説、Heracross の役割テンプレート）。
3. **A/H1 の悪化（.93→.43）と A/H0 の0セル**：Primarina 先発（Sitrus 耐久型・Encore）の型が仮説に含まれていないのか、集計の問題か。
4. **T1/T2 表**：FINAL での強制ルールは 0 本で、DEV の C で効いたルールは1種類だけ。表の作成（ai+attack 分岐、2 seed）が過学習や過小検出になっていないか。
5. 既存の **7 TODO**（Fairy の打点の事前予測、Scarf 速度帯、Mega-Y 選出、Mega ターンの評価、Levitate 推定、Tough Claws、砂嵐による岩タイプの特防補正）は未解決。F1 の #91 新選出（Tyranitar>Metagross/Garchomp）も未評価のまま。

## 再現
```
SHOWDOWN_DIR=... npm test && npm run check
COVER=rational PHASE=DEV OUT=reports/data/pr92-eval-dev-rational.json node pr92-eval.js
PHASE=DEV OUT=reports/data/pr92-eval-dev-all.json node pr92-eval.js
PHASE=FINAL node pr92-eval.js            # reports/data/pr92-eval-final.json（凍結済み、1回だけ実行）
```
- 保存 JSON には、選出・選出時間・提案版のスコア・T1/T2 表と統計・セル別成績・負け筋ログ（T1–T3）が含まれる。
- DEV JSON の T1/T2 統計には `aiAction` がない。DEV 実行中に追加したため（表の判定自体は同じ）。
