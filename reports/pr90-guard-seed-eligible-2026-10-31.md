# PR #90 依頼への回答：guard 同seed左右・適格候補・公開済み道具/特性・A/C/F2/F3 負け筋（2026-10-31）

判定：**NOT READY**（研究用 opt-in のまま。実戦既定・現行6体・育成は変更しない）

- 起点：PR #89 head `69311d75f283ad1b93a5eaa0a138b36b66a3e3d5`。`pr88-guarded-preview.js`・`pr84-public-cond-entry.js`・保存 pr88 JSON は**未変更**（旧結果は再現可能）。
- Showdown `3a766f2cfb5e51c1e428cfe87d0dba91a8f01640`、`gen9championsbssregmc`、`npm test` 219 tests / 212 pass / 0 fail / 7 TODO、`npm run check` LEGALITY CHECK PASSED: 12 teams（ローカル実測、CPU 4並列）。
- すべてヒューリスティックAI同士・構築済み仮説の結果で、**対人勝率ではない**。

## 1. P0-1 guard左右同seed

**再現**：pr88 の guard ジョブ `seed:hashSeed(base+300000+ci*16+rep), reverse:(ci+rep)%2===1` は、ci=0 の左が `[6654,38881,52623,7123]`、右が `[44798,55675,22272,29975]`（`test/pr90.test.js` で固定）。

**修正**：`pr90-guarded-preview-v2.js`（新規・opt-in）。`(候補, cell, 分岐, rep)` ごとに同じ seed を reverse=false/true の両方で実行する。`pairSides()` は、左右で seed・相手3+先発・自3+先発・分岐・シナリオが同じことを assert し、改ざんした場合は throw する。

**実測（新発見）**：同じ seed なら、左右で勝敗は**ほぼ完全に一致する**。
| 対象 | 左右で勝敗が割れたpair |
|---|---|
| DEV 6 six（reps:2） | 0 / 11,520 |
| F3 | 0 / 1,920 |
| F2 | 7 / 2,304 |
| F1 | 114 / 1,920 |
- 保存済み pr88 外部評価ログ（同seed左右）：64/64 pair が同じ勝敗。
- 小規模な実Battle（新 six 3×2仮説×6 seed、36 pair）でも 36/36 が同じ勝敗。ログ差分は性別の乱数（例 `F` / `M`）だけだった。
- 割れが出たのは F1/F2 だけ。性別依存の効果が原因という仮説を立てたが、未確認。

**含意**
1. pr88 guard の「左右」は、実質的には **2 seed のサンプル**だった。ChatGPT 指摘の「左右差と seed 差の交絡」は実在するが、左右差そのものはほぼ 0。
2. `reps:1×左右`（pr88 と同じゲーム数。`reports/data/pr90-selection-*-reps1.json`）では、seed を 1 本失ったため **9 six 中 3 six（A, U1, F2）で選出が変わった**。原因は左右ではなく seed の分散。これにより、guard の候補順位が僅差の候補間では seed に敏感であることが示された。
3. 既定を `reps:2×左右`（pr88 の 2 seed をそれぞれ左右で実行、ゲーム数は2倍）にした。結果：
   - DEV 6 six：guard score（worst/mean）は保存 pr88 と**完全一致**し、選出も 6/6 同一。
   - FINAL：F2・F3 は同一。**F1 だけ変化した**（Primarina>Metagross/Tyranitar から Tyranitar>Metagross/Garchomp。worst .833 vs .839 の僅差が左右割れで逆転）。
   - F1 は FINAL なので、この新しい選出の勝率は評価していない。主張するには新しい未見 six を事前コミットする必要がある（今回は未実施）。
4. **既存の外部評価（pr88-selection-eval の同seed左右）も、実効サンプル数はゲーム数の約半分**として扱うべき（その結果自体は否定しない）。今後の評価では、左右に別 seed を割り当てるか、pair 単位で n を数えることを推奨する。

## 2. P1-1 適格候補の見逃し

- `decideV2`：先に「worst ≥ legacy worst + margin」かつ「mean ≥ legacy mean − slack」を満たす候補を filter し、その中で (worst, mean) が最大の候補を選ぶ。
- ChatGPT 反例（L .40/.70、A .70/.60、B .60/.75）の結果：pr88 `decide` は legacy、`decideV2` は B（テストで固定）。
- **保存済み pr88 DEV/FINAL の 9 six の score では、`decide` と `decideV2` の選出は 9/9 同一**。つまり既報成績への実害はない。
- F3 で legacy が維持されるのは、この bug ではなく margin 0.10 による（legacy .854、最良候補 .927 < .954）。

## 3. P1-2 公開済み道具/特性をT2キーへ

- `pr90-public-cond-v4.js`：`condFromBotV4` は lab.js Bot の `foeItem`/`foeAbility` を使う。これらは公開ログ（`-item`/`-enditem`/`-ability`/ゴツメの `[of]`/公開Mega特性）からのみ更新され、未公開の間は `''`。`condSigV4` は `|r:item/ability` を追加し、dex に実在しない値は throw する。pr84 の関数とキーは不変。
- 実Battleテストで、隠し道具だけが違う 2 チーム（Leftovers / Shuca Berry）の T1 キーが同一で、末尾が `|r:/` になることを確認した。
- **実Battleでの判断差：なし**。凍結済みの T2 表（loco_t2）は FINAL2 で発動 0 回で、V4 キーはどの既存表にも未接続。表現力の追加だけで、既報結果への影響はない。

## 4. 処理時間とハードタイムアウト

- `guardedPreviewHard`：選出器を detached な子プロセスグループで実行し、`budgetSeconds` に達したら worker ごと SIGKILL して、事前計算済みの legacy 選出を `abstain` で返す（安全とは主張しない）。
- テストで確認：budget 3s のとき 6s 未満で返り、残存プロセスは 0。
- 実測（4 worker、reps:2×左右）：
  - DEV：38〜58s（A 45.1、B 52.0、C 42.1、U1 58.1、U2 49.8、U3 38.2）
  - FINAL：F1 42.4、F2 47.8、F3 43.6
  - reps:1 では 33〜45s
- **実ゲームの選出時間制限は未確認**（公式値を確認していない）。対人の選出画面で使うには、現状では遅すぎる可能性が高い。事前計算（既知の公開 six 表）か、seed 数/候補数の削減が必要。

## 5. P0-2 A/H0・A/H2・C/X・C/Y・F2/a・F3/a：選出器の失敗か構築の限界か

`pr90-ceiling.js`：自分側の全 60 通りの 3+先発を、pr88 と**同じ**相手合理 cell・分岐・seed・左右で実行した。
- 保存済みの legacy/quick/guarded/human1 の meanRat は、22 項目中 21 項目で完全再現した。
- 例外は A/H2 legacy（.175 → .163）。仮説として、後列の並び順（Primarina/Metagross）の違いが AI の交代に影響した。
- **事後の上限であり、相手の真の型を使っている**。選出器にも調整にも使わない。
- 最大値の楽観バイアス（60 候補から最大を取ることによる上振れ）を確かめるため、上位5候補＋guarded を**新しい seed**（9200000 / 9250000）で再実行した（`pr90-ceiling-fresh.json`）。

| 仮説 | guarded（pr88 seed → 新seed） | 事後最良（pr88 seed → 新seed） | 判断 |
|---|---|---|---|
| A/H0 | .35 → .45 | Primarina>Hydreigon/Rotom-Wash .90 → **.925**（worst cell .8） | **選出器の失敗**。現6体に勝ち筋あり |
| A/H2 | .45 → .40 | Rotom-Wash>Primarina/Garchomp .887 → **.875** | 選出器の失敗 |
| C/X | .75 → .80（60通り中3位） | 上位候補は新seedで .5〜.825 にばらつく | guarded は上限付近。worst cell が弱い |
| C/Y | .75 → .80（7位） | Tyranitar>Metagross/Rotom-Wash .85 → .825 | 上限付近 |
| F2/a | .55 → **.475** | Metagross>Hydreigon/Garchomp 1.0 → **1.0**（Metagross 先発の複数案が 1.0） | **選出器の失敗** |
| F3/a | .775 → .95 | Metagross>Hydreigon/Garchomp 1.0 → 1.0 | F3 の guarded .775 は seed 依存が大きい |

**負け筋（保存ログ T1–T3、公開情報で説明できる範囲）**
- **A/H0**：guarded（Metagross>Garchomp/Rotom-Wash）は、相手 view1 = Primarina 先発＋Garchomp/Golisopod に負けた。
  - T1：メガメタグロスのかみなりパンチで Primarina を落としきれず、オボンで回復される。Sparkling Aria で Metagross は 28/157 まで削られる。
  - T2：Primarina を倒す。
  - T3：後続のスカーフ Garchomp の Earthquake で Metagross が落ちる。
  - view1/aceLead の全分岐で 0。
  - 事後最良の Primarina 先発＋Hydreigon/Rotom-Wash は、地面の一貫を切りつつ水/妖への打点を確保する。ただしこの解釈は事後のもので、公開6体から選べるかは未検証。
- **F2/a**：guarded（Primarina>Metagross/Hydreigon）は、Hatterene 先発＋Infernape/Feraligatr に負けた。
  - T1：Primarina が AI 判断で Metagross に交代し、Psychic を受ける。
  - T2：メガ Metagross が Hatterene を倒す。
  - T3：メガ Feraligatr が Dragon Dance を積み、そのまま全抜きされる。
  - 一方、Metagross 先発は事後に全 cell・全分岐 1.0。guard のシナリオ（役割テンプレート）は公開6体から作るが、F2 ではメガ Feraligatr の竜舞を十分に重く評価できていない（仮説）。

## 6. ChatGPTが反証すべき点
1. **同seed左右がほぼ同一結果になる**主張の一般性：性別以外の乱数が左右で同じ順に消費される前提を、Showdown の PRNG 消費順で確認してほしい。F1/F2 の割れの原因（性別依存の効果か）も確認してほしい。
2. 既存の pr86/pr88 評価の n を pair 単位に読み替えた場合の信頼区間。
3. F1 の新しい選出（Tyranitar>Metagross/Garchomp）は未評価。新しい未見 six の事前コミットが必要かどうかの判断。
4. 事後上限（`pr90-ceiling`）は相手の真の型を使っている。「現6体で勝ち筋がある」は、**公開6体だけから選べるという主張ではない**。A/H0・F2/a で公開情報だけから Metagross/Primarina 先発を選ぶ規則が作れるかは未解決。
5. 7 TODO（Fairy の打点の事前予測、Scarf 速度帯、Mega-Y 選出、Mega ターンの評価、Levitate 推定、Tough Claws、砂嵐による岩タイプの特防補正）は未解決。

## 再現
```
SHOWDOWN_DIR=... npm test && npm run check
PHASE=DEV node pr90-eval.js ; PHASE=FINAL node pr90-eval.js     # reports/data/pr90-selection-{dev,final}.json
node pr90-ceiling.js ; FRESH=1 node pr90-ceiling.js              # reports/data/pr90-ceiling{,-fresh}.json
```
