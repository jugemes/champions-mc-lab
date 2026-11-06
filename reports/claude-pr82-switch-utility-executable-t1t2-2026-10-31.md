# PR #82 依頼：PR #81 独立反証への対応（交代先・無効 utility・公開情報のみ T1/T2）

日付：2026-10-31 JST｜Claude Code｜依頼書 `docs/claude-requests/pr81-rational-switch-utility-executable-t1t2-20261031.md`（PR #82）
Showdown `3a766f2cfb5e51c1e428cfe87d0dba91a8f01640`（ローカルで checkout して `git rev-parse` で確認）、`gen9championsbssregmc`、こちらは `reportedLive()` の6体（変更なし）。
**判定：NOT READY。** P0-1/P0-2 のチェッカーは直した。P0-3 のエントリーは実行可能で漏洩なしだが、未見の HX_fairy では human1 素の AI より**悪化**した。実戦用の T1/T2 ルールとしては使えない。
AI 同士の対戦で、仮説セットは手書き。**ランク戦の勝率ではない。**

ブランチ `claude/focused-sagan-t2bd2h` は PR #81 head `bde7fd7`（#79/#77 に積み上がった状態）を土台にしている。`public-six-general.js` と、それが読み込むファイルは**一切変更していない**。変更すると PR #81 の policy identity が変わり、保存済み general-v2 search がすべて live で棄却されるため。新しいコードはすべて新規ファイル。

## 1. 観測した失敗 → 原因
| # | ChatGPT 指摘 | 再現（変更前） | 原因 |
|---|---|---|---|
| P0-1 | 指定と違う交代先でも executed になる | PR #81 `checkRequested` に `switch 2`（Archaludon 指定）/ 実際は `|switch|p2a: Gholdengo` を与えると `executed`。**追加の反例**：KO 後の交代（`|faint|` の後の `|switch|`）も `executed` になる | 「先頭が別種族に替わったか」しか見ていない |
| P0-2 | `-fail` でも executed | `Stealth Rock`→`|-fail|`、状態異常持ちへの `Will-O-Wisp`→`|-fail|` がどちらも `executed`。**実戦ログでも再現**：HX_sand a の Hippowdon が T1・T2 と続けてステロを撃ち、2回目は `-fail`（テスト4） | PR #81 の `utility` は、使える utility 技のうち最初のものを有効性を見ずに選ぶ |
| P0-3 | T1/T2 表は事後集計 | `pr80-decision-trees.js` は `rsrc|rival|branch`（相手の隠れた3体と実験分岐）でグループ化している | 意思決定時点で見えない情報でグループ化していた |

## 2. 実装（新規ファイル）
- `pr82-switch-utility-t1t2.js`
  - `checkRequestedV2`：交代 slot を選出3体の種族に解決して実際の交代先と比べる（`executed / wrongTarget / preempted / dragged / mismatch / unverifiable`）。自発的な交代（そのターン、自分の move・faint より前の switch）と、KO 後の交代・U-turn 系の退場・drag を区別する。実行された技については `effect` に `effective / fail / immune / miss / protected / noTarget` を別欄で返す。
  - `utilityAudit` / `rationalityFromState`：技を出す直前の**公開状態**から `rational / irrational / unknown` を判定。判定材料は、既に撒かれた設置技、相手の既存状態異常、タイプ免疫、相手が場に出てからまだ動いていない時のアンコール、HP90%以上での回復、など。公開状態では rational だったのにエンジン上は失敗した場合（隠れ特性・みがわり等）は `unknown` とする。
  - `utilityRational`（相手側の分岐）：bot の公開状態で rational と判定された最初の utility 技を使う。`rivalScriptV2` は交代先の種族も記録する。
  - `decideEarly`：こちら側の T1/T2 エントリー。入力キーは `publicSix, ownThree, turn, rivalActive, rivalT1, ownActive, forced, legal` だけで、それ以外は throw する。返り値は `rule`（素の AI から外れる）/ `base`（素の AI の選択を維持）/ `uncovered`（安全なルールなし）/ `forced`（KO 後の交代は事前の選択ではない）。
  - `buildTable`：オフラインで表を作る。隠れ条件（相手3体 × 仮説 × 分岐）ごとの最悪勝率を使うのは採点の時だけで、出来上がった表のキーは公開観測のみ。base-first 方式：素の AI に対して最悪条件勝率で +0.25 以上、かつ平均が下回らない、の両方を満たした時だけ外れる。最初の試走で、6択から単純に argmax を取る方式は過学習した（HX_fairy/a の試走で 0.917→0.729）。
  - `livePreview`（P0-5）：保存済み search が有効ならその mixture。無効で時間予算が20秒以上あれば bounded quick search。それも無ければ legacy にフォールバックし、不確実性を明示する。
- `pr82-eval.js`：新しい実 Battle（下記）。`pr82-saved-switch-audit.js`：保存済み PR #81 ログを読み直す（**battle の再実行ではない**）。
- `holdout-20261031-pr82.js`：HX_fairy（Scizor/Azumarill/Tinkaton/Clefable/Annihilape/Ceruledge）の2仮説。どちらも TeamValidator 合法。**実行前にコミット済み**（3f8f609）。general search は PR #81 のコードを変更せずに実行（107秒、`reports/data/pr82-search-hxfairy.json`）。

## 3. 検証
- `npm test` 195件：pass 188 / fail 0 / todo 7（既存の TODO 7件。うち新規テストは9件で、実 Battle を使うものを含む）。`npm run check` LEGALITY PASSED。全ケースの仮説チームは eval 内で TeamValidator を通している。
- 実 Battle は合計 **54,936 試合**（stage0 5,280 / stage1 14,280 / stage2 14,280 / test 21,096）。4 workers で390秒。
  - seed：train `hashSeed(8200000+ci*100+{0,1})`、test `hashSeed(8250000+ci*100+{0,1})`、左右両方。
  - 相手の分岐：ai/attack/setup/switch/utility(PR #81)/utilityRational。
  - 相手 cell：legacy・aceLead（PR #77 の `rivalPicks`）と、stage0（全60通りの相手選出 vs human1、train seed）で human1 の勝率が最も低かった代替選出2つ。
  - 全方策で cell・分岐・seed・左右は同一条件。
- `reports/data/pr82-eval.json` と `-table.json`。1回目（建表の mean 条件が厳しすぎ、最悪勝率 1.00 vs 0.00 の改善も uncovered になっていた）は破棄し、修正後に全体を再実行した。数値は2回目のもの。

### P0-1 交代先・結果の判定（同じ実ログに v1 と v2 を適用）
| 区分 | 件数 |
|---|---|
| 交代 v1=executed / v2=executed（交代先一致） | 8,276 |
| **wrongTarget** | **0** |
| 技 v1=executed / v2=effective | 20,572 |
| 技 v1=executed / v2=**fail** | 2,779 |
| 技 v1=executed / v2=**immune** | 1,931 |
| 技 v1=executed / v2=miss / noTarget | 126 / 8 |
| preempted / forcedOut / mismatch（v1 と v2 で一致） | 2,406 / 210 / 4 |

保存済み PR #81 ログの読み直し：T1 の交代指定2,298件中、交代先の不一致は **0件**。**交代先の取り違えという誤りは、既存データでも今回の実 Battle でも起きていない。** 判定器の穴は実在するが、PR #81 の数値を汚してはいなかった。一方で、「実行された」と数えた技の約 **20%（4,844/25,416）は効果なし**（fail/immune/miss/noTarget）だった。
自軍の強制行動（forced label）と実際の行動の不一致は 28/23,742。T2 で技名だけが別の技になっている。相手のアンコールがターン途中で入ったためという仮説だが、個別には未確認。

### P0-2 相手 utility 技の合理性（test 段階、T1/T2）
| 分岐 | rational | irrational | unknown |
|---|---|---|---|
| utility（PR #81：最初の utility 技） | 846 | **777** | 1,106 |
| utilityRational（今回） | 650 | 18 | 74 |
| ai（素の AI） | 420 | 32 | 48 |

- PR #81 の `utility` で出た技の約3割は非合理だった。例：A の Primarina が、まだ動いていない Primarina にアンコール → fail。
- human1 の勝率：utility 201/340（0.59）、utilityRational 177/340（0.52）。**PR #81 の utility 分岐は、こちらの頑健性を約7pt 甘く見積もっていた。**
- utilityRational 側の irrational 18件は、選択時点と実行時点の間に状態が変わったケース（こちらの交代で対象が入れ替わる等）と推定しているが、未検証。

### P0-3 実行可能なエントリーと漏洩検査
- 漏洩検査：test で記録した決定のうち、公開観測が同一のものは147種類。そのうち116種類は隠れ条件が異なる複数の試合にまたがる。**決定が不一致だったものは 0**。
- ユニットテスト：非公開キー（rivalThree/rivalSets/branch/hypothesis/items/futureEvents/rsrc）を渡すと throw する。KO 後の交代は `forced`。未見の観測・合法でない行動・T3 以降はすべて `uncovered`。
- 表：148キー（rule 40 / base 54 / uncovered 54）。

### 方策比較（test seed、22仮説、mean / 勝ちゼロの cell×分岐 / 最悪が0より大きい仮説数）
| 方策 | 平均 | legacy+aceLead cell | 代替 cell | 勝ちゼロの cell×分岐 | 最悪>0 |
|---|---|---|---|---|---|
| human1（素の AI） | 0.556 | 0.749 | 0.385 | 158/510 | 2/22 |
| human1+entry | 0.682 | 0.779 | 0.601 | 102/510 | 5/22 |
| general mixture | 0.636 | 0.667 | 0.613 | **7/510** | **20/22** |
| top2 | 0.690 | 0.697 | 0.691 | 34/510 | 14/22 |
| legacy | 0.685 | 0.667 | 0.722 | 119/510 | 3/22 |
| quick（bounded） | 0.605 | 0.704 | 0.533 | 137/510 | 5/22 |

**読み方の注意**
1. 代替 cell は human1 にとって最悪の相手選出を train seed で選んだもので、human1 に不利な偏りがある。
2. entry の表は**同じ cell を train seed で**学習したもの。test で変わっているのは seed だけで、相手選出の汎化は検証していない。
3. 未見の HX_fairy では entry が悪化：a 0.979→0.854、b 0.750→0.667（`Ceruledge → Psychic Fangs` ルールで b の rivalLegacy が 0.917→0.167）。
4. 決定的に1つ選ぶ human1 は、22仮説中20で最悪 0（PR #81 の指摘どおり）。mixture は cell×分岐の勝ちゼロが7/510と最も少ないが、人間が1回だけ選ぶ場合の保証にはならない。

### ケース別：実用の 3+先発、条件付き T1（表 rule のみ、test seed）
| 6体 | human1 3+先発 | 公開条件 → T1 | 既知の反例 |
|---|---|---|---|
| A | Primarina>Garchomp/Rotom-Wash | 相手 Primarina 先発 → Encore（rule）。Golisopod/Garchomp 先発は uncovered | H0 alt1（Garchomp/Golisopod/Gholdengo）0/24 のまま |
| B | Rotom-Wash>Metagross/Garchomp | 全先発 uncovered または base | case alt1（Archaludon/Garchomp/Corviknight）0.04→0 |
| C | Rotom-Wash>Metagross/Garchomp | Charizard 先発 → Volt Switch（rule） | alt1（Baxcalibur/Charizard/Gholdengo）0 のまま |
| Indeedee | Rotom-Wash>Primarina/Garchomp | Gengar → Primarina に交代、Garchomp → Hydro Pump | test では 3仮説とも 1.00（cell は train と同じ） |
| E | Rotom-Wash>Metagross/Garchomp | **Charizard 先発 = uncovered（安全なルールなし）**、Basculegion → Volt Switch | **E vs メガリザY 先発：0.167（素）/ 0.292（entry）。未解決** |
| HX_rain | Garchomp>Metagross/Hydreigon | Swampert → Rock Slide（rule）、Archaludon は uncovered | **a の aceLead（Swampert）：素 0.167 → entry 0。rule が悪化させた** |
| HX_gyarados | Primarina>Metagross/Hydreigon | Garchomp/Corviknight → Metagross に交代 | 改善は in-sample |
| HX_sand | Hydreigon>Garchomp/Rotom-Wash | Excadrill 先発 = base、Dragapult = uncovered | **b の alt（Dragapult/Excadrill/…）0.167 / 0。未解決** |
| HX_fairy（未見） | Metagross>Primarina/Rotom-Wash | Ceruledge → Psychic Fangs（rule）、Scizor = uncovered | **entry で悪化** |

### P0-5 live
quick search は1回 10〜15秒（4 workers、1,536〜1,728試合）。PR #81 の search は102〜167秒。ただし quick の pick は legacy より安全ではなかった（勝ちゼロの cell×分岐 137 vs 119）。**一般的な live 対応はできていない。** `livePreview` は不確実性を明示して返すだけ。

## 4. 未解決（ChatGPT が反証すべき点）
1. entry の改善は in-sample（同じ cell、seed だけ新規）。未見の HX_fairy では悪化した。rule 40件は **2 seed × 左右** の小標本に基づく。margin 0.25 は事前に決めた値だが、実質的には1回の修正を経ている（1回目の run は破棄）。
2. T2 キー（相手の T1 行動クラス × 双方の場）は細分化されすぎて、uncovered が多い。T2 の counterfactual は「T1=表の行動」に固定した条件でしか取っていない。
3. 合理性ルールは公開状態だけで判定している。Taunt・Trick・Haze・Destiny Bond・攻撃技へのアンコールは `unknown`。PP、こだわり固定の判定、素早さの順番による失敗は個別には扱っていない。
4. 相手の分岐は T1/T2 のみ。T3 以降は素の AI。自軍の turn AI は PR #77 の pr76 のまま。既存の TODO 7件（`npm test` の todo）はそのまま残っている。
5. 仮説セットは手書きで、使用率による重み付けはしていない。HX_fairy の仮説は Claude が作ったもの。
6. 代替 cell の選び方（human1 にとって最悪の2つ）は human1 に不利に偏っている。

## 5. 実戦用の6体・育成・費用への影響
実戦用の6体・育成・課金・main には一切変更なし。新たな育成の推奨もしない。
