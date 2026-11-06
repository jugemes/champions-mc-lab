# PR #84 依頼：PR #83 独立反証への対応（強制交代の誤判定・公開条件キー・未学習 holdout）

日付：2026-10-31 JST｜Claude Code｜依頼書 `docs/claude-requests/pr83-forced-switch-and-true-holdout-20261031.md`（PR #84）
Showdown `3a766f2cfb5e51c1e428cfe87d0dba91a8f01640`（ローカル checkout → `git rev-parse` で確認）、`gen9championsbssregmc`。こちらは `reportedLive()` の6体（変更なし）。
**判定：NOT READY（完了ゲート未達）。** P0 の判定器は直り、実 Battle で確認した。ただし T1/T2 エントリーは、未学習の相手選出（holdout cell）で素の AI より**悪化**した。人間向けの推奨として出せる T1/T2 ルールはない。
AI 同士の対戦で、仮説セットは手書き。**ランク戦の勝率ではない。**

ブランチ `claude/focused-sagan-fkhcty` は PR #83 head `b168cee` の上に積んでいる（#81/#79/#77 の上に積み上がった状態）。**今回の差分は `b168cee..HEAD` だけ**。PR #83 のファイルは1バイトも変更していない（変更すると保存結果の再現性が壊れるため）。新しいコードはすべて新規ファイル。

## 1. 観測した失敗 → 原因
| # | 指摘 | 再現 | 原因 |
|---|---|---|---|
| P0 | 強制交代が、要求した自発的交代と同じ種族なら `executed` | **固定 Showdown の実 Battle で再現**（`pr84-forced-switch-probe.js`。両者とも手動指定の選択で、AI は使わない）。Golisopod のききかいひ（Emergency Exit）、Corviknight のだっしゅつボタン（Eject Button）のどちらも、実ログで PR #83 `checkRequestedV2` が `executed` を返す。**こちら側でも再現**：だっしゅつボタンで技より先に退場すると、PR #83 `executedOwn` は `switch:Archaludon`（自発的な交代）と判定する | `voluntarySwitch` は「同じ側の move/faint/drag より前の switch」を見るだけで、相手の技の後に出る強制退場を区別しない |
| 28件 | 自軍の強制行動ラベルと実際の行動が不一致 | 28件すべてを実ログで確認。**全件、同じターンにこちらより先に相手のアンコールが入っていた**（例：`|move|p2a: Primarina|Encore` → `|-start|p1a: Primarina|Encore` → こちらは Sparkling Aria を指定したが Moonblast が出る） | 判定器の誤りではなく、ターン途中のアンコールによる正当な上書き。強制ラベルの方が実行不能だった |
| 18件 | utilityRational なのに irrational | 18件すべての行を確認。**16件**：Dragapult が Garchomp に Thunder Wave（地面タイプには無効）。utilityRational は、自身の判定で irrational となる技を選ばない。つまりこれは分岐が null を返し、**素の AI にフォールバックした手**で、選択時点で既に非合理。**2件**：Umbreon の Yawn。同じターンに先にシンクロ（Synchronize）でこちらがやけどしたため、結果として失敗（選択時点では合理的、結果は非合理） | 分岐のフォールバック手が「合理的な相手の行動」として混入していた |
| T2 キー | 公開条件の異なる局面に同じルールが当たる | PR #83 の train 試合では、PR #83 キー148種類のうち**39種類**、rule 40件のうち**10件**が、公開 HP・状態異常・能力変化・設置技・天候・合法手の異なる局面をまとめていた（例：Golisopod の Iron Head 後に Moonblast を撃つルールが、相手の特攻 -1 あり/なしの両方に適用される） | キーに HP/状態/場の状態が入っていない |

## 2. 実装（新規ファイル）
- `pr84-switch-cause.js`
  - `switchEvents(L, side)`：交代1回ごとに原因を付ける。`voluntary / forcedExit（Emergency Exit・Wimp Out・Eject Button・Eject Pack）/ pivot（U-turn・Volt Switch・Flip Turn など。Showdown が付ける `[from] Volt Switch` も読む）/ replacement（KO 後）/ drag（Red Card・ほえる）/ unattributed`。
  - Showdown は選択された交代（order 103）を、メガシンカ（104）と技（200）より先に処理する（`sim/battle-queue.ts`）。したがって、**どちらかの側の最初の `|move|` より後に出た交代は、原因が特定できない限り voluntary と見なさない**。
  - `checkRequestedV3`：強制退場を `forcedExit` として返す。交代先が要求と同じ種族でも `executed` にはしない。`executedOwnV3`：技より先に強制退場した場合は `forcedOut:<cause>`。KO で行動できなかった場合は PR #83 と同じく `none`。
- `pr84-public-cond-entry.js`：`decideEarlyV3` / `obsKeyV3`。キーに次の公開条件を追加した。自分の HP 帯・状態異常・能力変化・アンコール状態・自陣の設置技、相手の公開 HP 帯・状態異常・能力変化・アンコール状態・相手陣の設置技、天候、フィールド、合法手の集合（こだわり固定・アンコール・かなしばり・PP 切れ・トラップは合法手の集合に表れる）。cond に許可されていないフィールドがあれば throw する（隠れ道具など）。未見の条件に対しては `uncovered`。
- `pr84-forced-switch-probe.js`：上記の実 Battle 12件（TeamValidator 合法、手動指定の選択）。
- `pr84-reaudit.js`：PR #83 の stage1/stage2/test を**同じ seed で再実行**して PR #83 の数値を再現し、そのうえで V3 の判定・V3 の表・holdout を追加する。
- `holdout-20261031-pr84.js`：holdout cell と HOLD seed を、**実行前に別コミット `b05c51f` で宣言**した。
  - `reLead`：相手の legacy 3体のまま、2番目を先発にしたもの。
  - `aceAlt`：エースを後ろに置く選出（固定ハッシュで1つ選ぶ）。
  - seed `hashSeed(8450000+ci*100+{0,1})`、左右両方。

## 3. 検証（Claude がこのセッションで実行したもの）
- `npm test` 199件：**pass 192 / fail 0 / todo 7**（既存の TODO 7件はそのまま。新規テスト4件のうち1件は実 Battle）。`npm run check`：LEGALITY CHECK PASSED（12 teams）。
- 実 Battle：合計 **77,136 試合**（stage1 14,280 / stage2 14,280 / stage2-V3 14,280 / test 23,136 / holdout 11,160）。4 workers で394秒。stage0 は再実行していない（cell は保存済み JSON から読み込み）。
- **PR #83 の再現は完全一致**：表（148キーの status と action）、強制行動の不一致28件、requestedCompare の全区分、22仮説 × 全方策の平均値が、保存値と一致した。したがって、以下の V2 と V3 の比較は、PR #83 と同じ試合の上で行ったもの。
- 保存 JSON の読み直しだけに頼った数値はない。依頼書にある ChatGPT の再集計値（0.556/0.682/0.636/0.690/0.685/0.605）は、今回の再実行でも同じ値になった。

### P0 の実際の頻度
| 区分 | 件数 |
|---|---|
| 相手の要求行動 36,312件の判定（R 段階） V2 = V3 | **全件一致**（交代の executed 8,276 / 技の executed 25,416 / forcedOut 210 / preempted 2,406 / mismatch 4） |
| 要求した交代が実際には強制退場だったもの（`forcedExit`） | **0 / 8,276** |
| 全試合・全ターン・両側で、`voluntarySwitch` V2 が交代、V3 が null になった件数 | **1,088**（全件、Golisopod が行動前にききかいひで退場したケース。Emergency Exit の発動は全体で1,244件） |
| こちら側の6体への影響 | **0**。実戦6体にききかいひ・だっしゅつボタンはない。PR #83 の `executedOwn` はこちら側だけに使うので、PR #83 の数値は汚れていない |

**結論**：P0 の穴は実在する。実エンジンのログで V2 が誤判定することを、相手側・こちら側の両方で確認した。ただし、要求した交代の判定には事実上出現しない。エンジンでは、選択された交代は必ず技より先に処理されるため。過去の結果を訂正する必要はない。一方、汎用のターン分類としては、V2 だと1,088件を自発的な交代と誤って数える。

### 公開条件キー（V3）
- V3 表（同じ train 試合から作成）：200キー。rule 38 / base 58 / uncovered 104（PR #83 は148キー、rule 40）。キーが細かくなった分、uncovered が増えた。
- test（PR #83 と同じ cell。seed だけ新規）：human1 0.556（勝ちゼロの cell×分岐 158/510）、+entry PR83 0.682（102/510）、**+entry V3 0.681（98/510）**、general 0.636（7/510）。**V3 は勝ちゼロを4減らしたが、平均は同等。**
- HX_fairy/a の test では、V3 が PR83 より悪い（0.854 → 0.688）。

### 未学習の holdout cell（宣言済み、新規 seed、表は凍結）
| 方策 | 平均 | 勝ちゼロの cell×分岐 |
|---|---|---|
| human1（素の AI） | **0.793** | 31/252 |
| human1 + entry PR83 | 0.753 | 44/252 |
| human1 + entry V3 | 0.753 | 44/252 |
| general mixture | 0.674 | **0/252** |
| legacy | 0.688 | 67/252 |

**T1/T2 エントリーは、未学習の相手選出では素の AI より悪い**（平均 -0.04、勝ちゼロ +13）。悪化した例：
- A/H0：0.417 → 0.208
- A/H1：0.583 → 0.417
- Indeedee/scarf：1.00 → 0.667

PR #83 の test での改善（0.556 → 0.682）は、同じ cell で学習した **in-sample の効果**と判断する。
general mixture は holdout で勝ちゼロ 0/252 だが、平均は最も低い。人間が1回だけ選ぶ場合の保証にはならない。

### 依頼で名指しされた失敗例
| 例 | 今回の結果 |
|---|---|
| E：メガリザY（Charizard 先発） | 表では uncovered のまま。holdout の aceAlt（Basculegion/Charizard/Garchomp）で human1 0.542 → entry 0.521。未解決 |
| C：Garchomp への交代 | C_charizard の表は全件 uncovered（96/96）。test Y 0.417、X 0.479。holdout Y 0.458、X 0.375。未解決 |
| HX_rain：Swampert | test a で entry 0.208（human1 0.25）。holdout では entry の判定が全件 uncovered で、human1 と同じ0.75 |
| HX_sand：代替選出 | b の test は0.389で変化なし（表は全件 uncovered）。holdout では human1 0.958 |
| HX_fairy | test a で entry V3 0.688 < PR83 0.854 < human1 0.979。holdout では entry 1.00（human1 0.958）。一貫しない |

### 人間向けの要約（公開6体 → 3体＋先発 → 条件付き T1/T2）
| 公開6体 | 3+先発（human1） | T1/T2 | 既知の負け筋・未知 | 確度 |
|---|---|---|---|---|
| A（Golisopod） | Primarina>Garchomp/Rotom-Wash | **推奨なし**（rule は holdout で悪化） | H0 は test 0.25 / holdout 0.42 | 低 |
| B（Lucario） | Rotom-Wash>Metagross/Garchomp | 素の AI（表は全件 uncovered） | case の test で勝ちゼロ 8/24 | 低〜中 |
| C（Charizard） | Rotom-Wash>Metagross/Garchomp | 素の AI（uncovered） | Y/X とも 0.38〜0.48 | 低 |
| Indeedee | Rotom-Wash>Primarina/Garchomp | **推奨なし**（scarf の holdout で 1.00 → 0.67） | ― | 中 |
| E（sun） | Rotom-Wash>Metagross/Garchomp | 素の AI。メガリザY 先発は uncovered | E2 の test で human1 0.167 | 低 |
| HX_rain / gyarados / sand / psychic / sun_balance / fairy | §ケース別 JSON 参照 | 素の AI。rule は推奨しない | HX_rain/a は0.21〜0.25 | 低〜中 |

- 遅延：`decideEarlyV3` は表を引くだけ（1ms 未満）。選出は PR #83 と同じ（保存済み search、またはフォールバック）。
- 新しい公開6体：エントリーのキーは6体を含むため、**構造上すべて uncovered**（素の AI と同じ）。新しい6体での選出評価は今回は**実施していない**。

## 4. 未解決（ChatGPT が反証すべき点）
1. holdout cell は2種類（reLead/aceAlt）× 2 seed × 左右で、標本は小さい。cell の選び方は Claude が決めたもの（実行前にコミット済み）。新しい公開6体では評価していない。
2. V3 の stage2 の T1 は V3 の T1 表で指している。PR #83 の stage2 とは T1 の行動が違う試合がある。
3. utilityRational の16件は、素の AI へのフォールバックによる非合理手。この分岐での勝ちのうち、相手の非合理手に依存しているものは除外していない（件数は少ない）。oracle（全条件の最悪値）と、観測可能な相手方策の区別は、依然として表の建て方（隠れ条件ごとの最悪勝率）に依存している。
4. HP 帯の区切り（満タン / ≥50% / ≥25% / それ未満）は事前に決めた値で、感度分析はしていない。素早さの関係や、相手の公開済み道具はキーに入れていない。
5. 既存の TODO 7件はそのまま。相手の分岐は T1/T2 のみ。仮説セットは手書きで、使用率による重み付けはない。
6. `pr84-reaudit.js` の utility 原因ラベルは、初回の実行時ロジックが誤っていた（16件を「相手が先に動いた」と分類）。ログの行を読んで再分類し、その旨を JSON の `reclassified` に記録した。スクリプトも修正済みだが、修正版での再実行はしていない。

## 5. 実戦用の6体・育成・費用への影響
実戦用の6体・育成・課金・main・ランナーには一切変更なし。新たな育成の推奨もしない。
