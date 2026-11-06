# Claude独立監査：PR #102 opt-in `publicMoveMemory`（2026-11-01）

依頼: PR #103 / `docs/claude-requests/pr102-mega-public-move-memory-decision-20261101.md`
対象: PR #102 head `2a45cf447519736daff5bba4c693513796589e27`（#101上のstack、未採用）
環境: Showdown `3a766f2cfb5e51c1e428cfe87d0dba91a8f01640`、`gen9championsbssregmc`、Node 22.23.4
こちら6体: `reportedLive()`（M-7報告6体）。**AI同士の結果であり、ランク勝率ではない。**

## 結論（先に）
1. **欠陥1件を発見して修正（opt-inのみ）**: Illusion（ゾロアーク、M-Cで合法）が化けている間に使った技は、従来コードでも化け先の種族名で記録される（既存の汚染）。#102のopt-inでは、本物のその種族が後でメガシンカすると、**ゾロアークの技（Flamethrower/Night Daze）がメガ形態の記憶に移る**。固定Showdownの実Battle（seed `hashSeed(10300101)`）で再現した。公開の`|replace|`（イリュージョン解除）を受けたとき、その場に出ていた間に初めて記録した技をゾロアークへ移す処理を追加した。既定OFFの動作は変えていない。
2. **行動差は0件**: 552組の実Battleペア（1104試合）で旧`false`と新`true`を比べた。Botの記憶自体は80組で異なったが、**技選択・交代・勝敗の差は0件**、エンジンエラーも0件だった。「勝率が改善した」とは言えない。
3. 採否の意見: opt-inの研究用として残してよい。ただし、判断改善の根拠にはならない。既定ONにする優先度は低い。育成や構築への影響はない。

## 1. コード監査（#102の`lab.js`差分）
| 観点 | 結果 |
|---|---|
| 公開技だけを使うか | ○ 入力は`|move|p2a:`行と`detailschange`の公開種族名だけ。非公開の型、選出3体、持ち物は読まない |
| 転送する条件 | ○ `baseSpecies`が同じで、前後のどちらかが`isMega`のときだけ。別種族へのdetailschangeでは転送しない（#102テストあり） |
| メガX/Y/Z | ○ Charizard-Mega-Yへ転送してもMega-Xのキーは作られない。Garchomp-Mega-Z、Lucario-Mega-Zは`isMega=true`、`baseSpecies`は基本種と確認 |
| 配列の共有（alias）による副作用 | ○ `known.slice()`でキーごとに別の配列になる。後から一方へpushしても他方は変わらない（本PRでテスト追加） |
| メガ後に引っ込んで再登場 | ○ 再登場は`Golisopod-Mega`名のswitchで、そのキーは引き継ぎ済み。メガ中の新しい技はbaseのキーにも記録される |
| **Illusion** | ✗→修正。上記の結論1を参照。本PRでは、交代で出てから引っ込むまで（stint）の間に初めて記録した技だけを、`replace`のときにゾロアークへ移す |
| `-enditem`など | 本変更とは関係しない（技の記憶にだけ作用する） |
| 残る既知の穴（未修正、範囲外） | (a) Mimikyuの化けの皮が剥がれる`Mimikyu-Busted`は非メガのdetailschangeなので、旧・新どちらでも技の記憶が切れる。STABはBP90の仮定に含まれるので影響は小さいと推定。(b) `[from]`付きで呼ばれた技も「公開技」として記録する（以前からの挙動）。(c) 本物が先に公開した技をゾロアークも使った場合、その技はゾロアークに付かない（保守的な挙動） |

## 2. 固定Showdown実BattleでのA/B
`claude-public-move-memory-ab.js` → `reports/data/claude-pr102-memory-ab-20261101.json`
- 各ペアで違うのは**こちらBotの`publicMoveMemory`だけ**。seed、左右、双方の3体と先発、相手のscript、相手Botの設定は同一にした。seedは`hashSeed(10300001/11/21)`の3つ、左右反転あり。
- 設定は2種類: `baseline`（既定）と`v3pub`（`decisionPolicy:'v3',publicMegaAbility,publicCondition`）。
- 比較指標: 公開ログに出たこちらの行動（技/メガ/交代、強制交代を含む）の最初の差、勝敗、こちらの各判断時点の`seenMoves[foeActive]`の差（読み取り専用probe）。
- 相手のscriptは**テスト用のfixture**で、人間の合理的な行動の証明ではない（メガを遅らせる手は実戦では稀）。

| ケース / 相手の3体（先発が先頭） | 相手script | ペア数 | メガ前の公開技 | 記憶が異なる | 行動差 | 勝敗差 |
|---|---|---|---|---|---|---|
| A メガグソク / Golisopod・Garchomp・Mimikyu、Garchomp先発版も | ai, megaSD_T1（T1にメガ＋剣舞） | 144 | 0 | 0 | 0 | 0 |
| 同上 | T1にメガせずSucker Punch（delaySuckerPunch） | 72 | 28 | 18 | 0 | 0 |
| 同上 | T1にメガせずIron Head（delayIronHead） | 72 | 0 | 0 | 0 | 0 |
| 同上 | T1にSucker Punch→T2交代→再登場でメガ（scoutSuckerPunchSwitch） | 72 | 28 | 18 | 0 | 0 |
| A改 Zoroark入り / Zoroark・Garchomp・Golisopod | ai, Zoroark T1 Flamethrower→T2 Night Daze | 48 | (化けた状態の技) | 24 | 0 | 0 |
| C リザY / Charizard・Garchomp・Mimikyu | ai, T1にメガせずAir Slash / Flamethrower | 72 | 44 | 20 | 0 | 0 |
| Indeedee実戦例 メガガブZ / Garchomp・Indeedee・Gengar | ai, T1にメガせずFlamethrower、偵察→交代 | 72 | 12 | 0 | 0 | 0 |
| **計** | | **552** | | **80** | **0** | **0** |

こちらの3体: A=`Tyranitar/Metagross/Primarina`・`Primarina/Metagross/Garchomp`・`Metagross/Rotom-Wash/Garchomp`、C=`Tyranitar/Rotom-Wash/Metagross`・`Rotom-Wash/Garchomp/Primarina`、メガガブZ=`Metagross/Primarina/Rotom-Wash`・`Primarina/Metagross/Tyranitar`。
相手の3体と先発は、公開6体の目線で「メガのエースを先発にする」線と「別の先発から裏でメガ」の線の両方を置いた。

### 行動差が0になる構造上の理由（推定）
- `seenMoves`が判断に効くのは`incomingRisk`だけ（交代するかどうかの閾値と、強制交代先の順位付け）。ここでは公開STABを**BP90と仮定**しているので、STABの公開技（リザのAir Slash/Flamethrower、メガグソクのIron Head/Leech Life）を記録しても最大値は上がらない。効くのはSucker Punchのような**タイプ外の技**だけ。
- メガ前に技が公開されるには相手がメガを遅らせる必要がある。Botは最初の技で必ずメガする。fixtureで遅らせても、Golisopodが**ききかいひ（Emergency Exit）**で先に引っ込む、またはメガガブZが**メガ後のこちらの判断より前に倒れる**ため、差が判断に届かない例が多かった（Iron Headの72組は公開0件）。
- Sucker Punchを覚えた18組では、こちらはPrimarina（悪半減）やGarchompを出していた。Metagrossが対面でも、旧版がすでに同じ交代をしていた（例: A/Metagross先発/反転）。

## 3. 回帰
- `npm test`: **273 total / 266 pass / 0 fail / 7 TODO**（#102の269/262/0/7に本PRの4件を追加）。`npm run check`: 12チーム合法。
- 追加テスト`test/claude-pr102-public-memory-audit.test.js`は4件。#102のlab.jsに戻すと、Illusionに関する3件（合成2件と実Battle1件）が**失敗**することを確認した。
  - 実Battle: `Zoroark@Focus Sash`（TeamValidator合法）が化けた状態でT1 Flamethrower、T2 Night Daze。こちらのTyranitarがStone Edgeで解除し、後で本物のGolisopodがメガする。修正前のopt-inでは`seenMoves['Golisopod-Mega']=["Flamethrower","Night Daze","Swords Dance"]`、修正後はZoroarkの技を含まない。
- 既定OFFの記録内容は変えていない（合成テストで、旧来の汚染がbaseのキーに残ることをそのまま固定している）。

## 4. ChatGPTが反証すべき点
1. `replace`をIllusion解除とみなしてよいか。M-Cシングルで他に`replace`を出す処理がないか。
2. stintの境界を`switch`/`drag`でリセットしている。`replace`後にさらに`detailschange`が来る、など異常な順序を見落としていないか。
3. 「行動差0」は今回のfixtureとseedに限った結果。タイプ外の公開技（Sucker Punch等）が**Metagross対面で交代の閾値をまたぐ**局面を、意図的に作れるか（今回は自然には発生しなかった）。
4. 公開STABをBP90と仮定している限り、技の記憶が判断に効きにくい。記憶の改善より、Issue #20 P0-2（エンジンによる評価）の方が効果が大きいのではないか。
5. Mimikyu-Bustedで記憶が切れる問題は範囲外として残した。直す価値があるか。

## 未達（変更なし）
A/N2/N6の合理的な相手、未知の公開6体、T1/T2の汎用選出ゲートは引き続き未達。本PRはそれらを解決しない。main、実戦の6体、育成、Showdownのpinは変更していない。
