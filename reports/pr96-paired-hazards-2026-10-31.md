# PR #96 依頼への回答：合理的な相手の paired 比較・T2 キーの公開設置技・A/H1 と N2/a の回帰・新 holdout N5/N6（2026-10-31）

判定：**NOT READY**。事前宣言した規則（`holdout-20261031-pr96.js` 第7項）で、DEV と FINAL の両方とも不合格だった。研究用 opt-in のまま。実戦既定・現行6体・育成・main は変更しない。

- 起点：PR #95 head `4f27166`（この上に積む stack）。pr94/pr92 以前のコードと保存 JSON は**未変更**。
- 固定 Showdown `3a766f2cfb5e51c1e428cfe87d0dba91a8f01640`、`gen9championsbssregmc`、自軍は `reportedLive`。
- テスト：`npm test` 255 tests / 248 pass / 0 fail / **7 TODO（未解決のまま）**、`npm run check` LEGALITY CHECK PASSED: 12 teams。
- すべてヒューリスティック AI 同士・構築済み仮説での結果。**対人勝率ではない**。

## 0. 時系列（コミット順）
1. `df1a3ce` **事前宣言**（FINAL battle の前に push 済み）：`holdout-20261031-pr96.js` と `test/pr96-holdout.test.js` で次を固定した。
   - 新しい公開6を2つ（N5 Kangaskhan、N6 Altaria）。それぞれ合法な仮説 a（エースがメガ）と b（別の1体がメガ）。
   - 相手モデル2系統、seed、指標、判定規則、停止条件、予算。
   - 新しい選択変種は作らない。pr96 の decision は PR #95 で凍結した `floor` を使う。
2. `6b615ce` 実装・テスト・評価スクリプト。
3. DEV を実行（`reports/data/pr96-eval-dev.json`）。
4. FINAL を1回だけ実行（`reports/data/pr96-eval-final.json`）。DEV のあとで調整したものはない。

## 1. P0-2：候補ごとの事後除外 → 免疫を理解する相手 AI と paired 比較（`pr96-paired.js`）
- **再現**（`test/pr96.test.js`）：ChatGPT の合成反例をそのまま使った。
  - 同じ10件の job で、A は 1勝9敗（9敗に免疫タグ）、B は 6勝4敗。
  - pr94 の候補ごとフィルタでは **A=1.0 / B=.6**（A が上）。
  - pr96 の paired 全試合では **A=.1 / B=.6**。
  - セルごとに候補の試合数が揃わない入力は throw する（fallback で黙って通さない）。
- **修正**：事後に除外するのをやめ、**相手に不合理な技を撃たせない**ようにした。
  - 相手の毎回の決定（全ターン、base AI も分岐スクリプトも）を、まず従来どおり計算する。
  - その決定が、こちらの**見えている形態**に対する公開免疫への攻撃だった場合、`masked` として記録する。公開免疫とは次の4つ：
    - 型相性。
    - その形態の唯一の特性。
    - 公開済みの特性。
    - 公開済みの風船。
  - そのうえで、**同じ相手ロジックに、その技を無効にした request で選び直させる**。別の技を選ぶことも交代することもあり、特定の技名を強制はしない。
  - 相手自身の特性は相手の知識として扱う（Mold Breaker / Scrappy / -ate / Thousand Arrows）。
  - 特性候補が2つ以上ある未公開の特性や、隠れた道具は仮定しない。
- **評価**：
  - すべての候補を**同じ job**（相手3体・先発・分岐・seed・左右）の**全試合**で評価する。
  - セルごとに次を報告する：試合数、masked の数、残った公開免疫ヒット、pr86 の不合理な試合。
  - 感度分析 `pairedIntersection`：どれか1候補で不合理だった job は、全候補から同時に除く。
  - 強制的に不合理な行動をとる `utility` 分岐は、事前宣言で全方策から同時に除いた。
- **検出器も修正した**（`publicImmune96`）：pr94 の `publicImmune` は「そのターンにこちらが交代で出した相手への攻撃」も不合理と数えていた。そのターン開始時の場の形態で判定するように直した（テストあり）。
- **固定 Showdown での確認**（N2/a の view2 セル、Rotom-Wash 先発、selector のテンプレ型）：
  - 素朴な相手は T1 で毎回 Earthquake を浮遊に撃つ。
  - 免疫を理解する相手は 0 回で、代わりに Close Combat や交代を選ぶ。
  - こちらの内部勝率は 16/16 から **2/16** に下がった（scratch smoke と `test/pr96.test.js`）。
- **保存済み選出への影響**：免疫を理解する相手では、pr93 の Rotom-Wash 先発選出が大きく下がる。
  - DEV A/H0 rational の meanAce：素朴な相手 .70 → **.35**。
  - DEV A/H2 rational の meanAce：.70 → **.30**。
  - 逆に C/X rational では .325 → .65 と上がる（相手が選び直した結果、交代を選んだ）。
  - **方向は一定しない**。

## 2. P0-1：T2 キーの公開設置技（`keyOf96`）
- **再現**：pr94 の `keyOf` では、相手側の設置技が「なし / ステロ / ステロ＋まきびし1 / ステロ＋まきびし2 / どくびし / ねばねばネット」のどれでも**同じキー**になる。`keyOf96` では6種類のキーに分かれる。
  - 自陣側の層数も区別する。左右の取り違えもない。
  - pr94 の性質は維持した：メガ形態は見えている形態のまま、HP 段階の最小性、合法手一覧は順序に依存しない、非公開の項目は throw する。
- **固定 Showdown の実 Battle**（N2/b、こちら Tyranitar 先発で T1 にステロを強制）：
  - `-sidestart` が出て、T2 の観測が `rivalHazards.stealthrock=1` になり、キーに `|riv:stealthrock|` が入る。
  - Knock Off を強制した場合は `|riv:-|`。
  - 同じ観測の pr94 キーは、設置技なしと同一だった。
- **実用上の影響はほぼゼロ**：DEV 8・FINAL 2 の T1/T2 表のどれにも、**相手側に設置技がある T2 キーは0件**あった（ルールも0件）。
  - 理由：表を作るときの T2 job は T1 で base AI か T1 rule に従う。自軍の Tyranitar がステロを撒く状況は表に現れない。
  - 現時点では「正しさの修正」であって、勝率への効果は示せていない。
- **キーの爆発と unseen**：
  - キー数（pr96 対 pr95 の表）：A 39/35、C 46/45、N3 50/59、N5 49/—、N6 42/—。
  - FINAL の T2 unseen：N5 56〜69%、N6 57〜87%。**unseen のときは ABSTAIN**（base AI に委ねる）。

## 3. A/H1・N2/a の機構回帰（DEV、免疫を理解する相手、meanAce / 最悪エースセル）
| | v2 | quick | pr93 | pr95 | pr95+T | **pr96** | pr96+T |
|---|---|---|---|---|---|---|---|
| A/H0 rational | 0/0 | .20 | .35 | .20 | .20 | .075 | .075 |
| **A/H1 rational** | **1.0/1.0** | .55 | .15 | .55 | .55 | .25 | .325 |
| A/H2 rational | 0/0 | .225 | .30 | .225 | .225 | .15 | .15 |
| A/H0 tm | .01 | .325 | .275 | .325 | .325 | **.51** | .51 |
| A/H1 tm | **.79** | .675 | .44 | .675 | .675 | .71 | .71 |
| A/H2 tm | .05 | .40 | .49 | .40 | .40 | **.74** | .74 |
| **N2/a rational** | **.99/.95** | .96 | .64 | .70 | .73 | .84/.60 | .84 |
| **N2/a tm** | **.99/.95** | .94 | .87 | .58 | .59 | .87/.70 | .87 |
| N2/b rational | .89/.45 | .55 | .94 | .90 | .92 | .79/.30 | .82 |

- **A/H1 の負け筋の診断**：相手 Primarina の型は自軍と同一（控えめ、HP32・特攻32・S2、オボン）。
  - **素早さが同速なので、同族対面は乱数勝負になる**。保存した負けログでは、相手が毎ターン先に動き、Moonblast 3発で負けている。
  - そのあとの相手の Gholdengo は風船を持っているので、Garchomp の Earthquake が無効になる（隠れた道具）。
  - 構築側の論点：自軍 Primarina の S2 で、同じ型との同速を許すか。**選出器では乱数を避けられない**。
- **「A/H1 で v2 が良い」は仮説 H1 だけの現象**だった。
  - 同じ A の H0/H2 では、v2 は rational で 0/0、tm で .01/.05 と最悪。
  - A を3仮説で平均すると、rational では v2 .33、pr95 .33、pr96 .16。tm では v2 .28、pr95 .47、**pr96 .65**。
  - **A は全方策が弱い公開6**であり、仮説への頑健さの問題として扱うべき。
- **N2/a**：pr96 は Garchomp>Metagross>Hydreigon（seed A と B で一致）。
  - pr95（.70/.58）から改善したが、v2（.99）より .12〜.15 低い。
  - **v2 より重大な悪化が残る**ので、採用しない。
  - 実際の型（スキルリンクの Pin Missile / Rock Blast と CC）とテンプレの差は、#95 の D2 のまま。今回は selector の仮説を変えていない。
- **DEV 全体**（16仮説、免疫を理解する相手）：
  - rational モデル：meanAce は pr96 .800 対 v2 .787 / pr95 .808。最悪エースセル平均は pr96 **.731** 対 v2 .678 / pr95 .703。最悪セル 0 は pr96 0件 対 v2 2件。
  - tm モデル：meanAce は pr96 **.882** 対 v2 .774 / pr95 .811。
  - **ただし事前宣言の (c) で不合格**：A/H1 rational（.25 < 1.0−.10）、N2/a rational（.84 < .99−.10）、N2/a tm（.87 < .99−.10）。

## 4. 新 holdout N5/N6（FINAL、1回だけ実行）
- **N5 Kangaskhan**：メガカンガスカン（おやこあい）。氷/フェアリー/格闘/地面/炎ゴーストの範囲。女王の威厳で先制技（Aqua Jet / Bullet Punch）を封じる。b では Golurk がメガ。
- **N6 Altaria**：メガチルタリス（フェアリースキン＋竜の舞）。Samurott-Hisui / Chesnaught がまきびしを撒く。b では Delphox がメガ。
- エースセルの数は、どの仮説 × モデルでも 2 以上（テスト済み）。

| 相手モデル（meanAce / 最悪エースセル平均） | legacy | quick | v2 | pr93 | pr95 | pr95+T | **pr96** | pr96+T |
|---|---|---|---|---|---|---|---|---|
| rational | .781/.65 | .856/.75 | .869/.788 | .786/.625 | .856/.75 | .875/.788 | **.881/.80** | .881/.80 |
| tm | .925/.825 | .893/.70 | .921/.775 | .861/.713 | .893/.70 | .893/.70 | **.933/.825** | .921/.787 |

- **識別力**：
  - N6/b rational では legacy .37、pr93 .45、v2/pr95/pr96 .70。N6/a rational も .83〜.92 で、方策間に差が出た。
  - **停止条件（全部 .90 以上）は不発**。N5/b rational だけは全方策 1.0 で、識別力がない。
- **事前宣言の判定：不合格**。
  - (b) N6/a tm で、pr96 .917 < max(legacy 1.0, v2, pr95) − .05。
  - pr96 は N6 で pr95/v2 と同じ選出（Rotom-Wash>Metagross>Garchomp）。legacy（Primarina>Hydreigon>Garchomp）はこのセルで 1.0。
- **選出の seed 依存**：pr96 は selector seed A と B で選出が分かれた。
  - DEV：A（Primarina>Hydreigon>Garchomp 対 Primarina>Garchomp>Rotom-Wash）と F2。
  - FINAL：N5（3体目が Hydreigon / Rotom-Wash）と N6（Rotom-Wash 先発 / Metagross 先発）。
  - 10個の公開6のうち4個で分かれた。guard 値の上位差がノイズと同程度、という #95 の指摘は解消していない。

## 5. T1/T2 の実用性
- FINAL（免疫を理解する相手）で pr96 の表が実際に強制された件数：**T1 120 / T2 21**。すべて N5 で、N6 は表の rule が0件。
  - rule を強制した試合の勝率：T1 .875〜1.0、T2 1.0。
  - ただし表なしと比べると、FINAL では改善していない：tm で pr96 .933 → pr96+T .921、rational では同じ。
  - DEV では rational で +.009、tm で −.013。
- N5 の rule の例：
  - `T1|Kangaskhan|…` → Dragon Claw（gain .125、n 32、4セル）。
  - `T2|Tsareena|Garchomp|Ninetales-Alola|snowscape|…` → Poison Jab（gain .222、n 9、6セル）。
- **人間用の推奨が完成したとは書けない**：
  - 表の rule の多くは ABSTAIN（AI の行動は情報のみで、推奨ではない）。
  - 表がない公開6（N6）もある。
  - 表を使っても成績の改善は示せていない。
- **処理時間**（4 worker、クラウドセッション）：
  - pr96 selector：17〜33s。
  - pr96 の T1/T2 表作成：23〜45s。
  - v2：35〜40s。
  - 評価は 1 battle 平均 15ms。
  - DEV は全体で 19分、FINAL は約9分。
  - **実戦の選出時間制限に間に合うかは未確認**（オフラインでの事前計算が前提）。

## 6. 判定と残る問題
- **NOT READY**（DEV (c) 3件、FINAL (b) 1件）。pr96 は採用しない。
- 改善できた点：
  - 候補ごとのフィルタによる不公平な比較を除去し、paired・全試合評価にした。
  - 公開免疫への不合理な攻撃を、相手の選び直しに置き換えた。
  - DEV と FINAL の最悪セルの底上げ（tm で顕著）。
- 改善できなかった点：
  - N2/a は v2 に .12〜.15 及ばない（仮説の型ずれ D2）。
  - A/H1 は同族対面の同速の乱数に依存する。
  - N6/a tm で legacy に負ける。
  - 選出の seed 依存。
  - 設置技キーは実用上ほぼ効いていない。
- 7 TODO は未解決のまま（Fairy 範囲技の事前分布、Scarf を考えた素早さ、メガY/ひでり、メガ前の評価、浮遊の公開特性を damage/preview 側で扱うこと、かたいツメ、砂嵐の特防補正）。
  - 今回の免疫を理解する相手は、**シミュレーション内の相手の行動**だけを直した。自軍の decide / threat 側の TODO は残る。

## 7. 再現コマンド
```
export SHOWDOWN_DIR=<Showdown 3a766f2c... を build したディレクトリ>
npm test && npm run check
PHASE=DEV node pr96-eval.js     # reports/data/pr96-eval-dev.json（55170 battle）
PHASE=FINAL node pr96-eval.js   # reports/data/pr96-eval-final.json（12870 battle、1回だけ実行済み）
```
- seed：FINAL の eval は hashSeed(9600000+…)、DEV の eval は 9620000。selector は seed A が 9610000 / 9630000、seed B が 9660000 / 9680000。
- 同 seed 左右は s=0 で別統計として取った（`sameSeedSidesAgree`）。

## 8. ChatGPT に反証してほしい点
1. `publicImmuneMoves` の範囲。
   - 現在は型相性・唯一の特性・公開済みの特性・公開済みの風船。相手自身の Mold Breaker / Scrappy / -ate は相手の知識として扱っている。
   - 状態で型が変わる技（Weather Ball など）は masked しない。
   - 「選び直し」が相手の合理的な行動として妥当か。特に、選び直しが交代になる場合の評価への影響。
2. paired 全試合評価で `utility` 分岐を事前に除いた点。pr86 の不合理（変化技）は除外せず、数だけ報告している。intersection の感度分析は selector の scores に保存した。
3. A は全方策が弱く、H1 だけで v2 が 1.0 になる。これを v2 の回帰基準（(c)）にし続けるべきか。仮説の平均・最悪で見るべきではないか。
4. 設置技キーの効果がゼロなのは、表の作り方（T1 でステロを撒く分岐がない）が原因。T1 分岐に「自軍の設置技」を加えるべきか、それとも unseen が増えるだけか。
5. N5/N6 の型の妥当性。特に N6/a tm で legacy が 1.0 になる理由（Primarina 先発がチルタリスとサモンの組み合わせに強い？）。
6. Primarina の S2 による同族対面の同速問題は、構築（育成）の論点として扱うべきか。新規育成は推奨しない（利益が未実証のため）。
