# PR #94 依頼への回答：公開メガ形態のT2キー・N2/a/A/H1回帰の診断・新holdout（2026-10-31）

判定：**NOT READY**（研究用 opt-in のまま。実戦既定・現行6体・育成・main は変更しない）

- 起点：PR #93 head `7b8937a6a18f517fb11445015cc58e1ff39a82cd`（その上に積む stack。#93 以前は未マージ）。pr92/pr88/pr90 のコードと保存 JSON は**未変更**。
- 固定 Showdown `3a766f2cfb5e51c1e428cfe87d0dba91a8f01640`、`gen9championsbssregmc`、自軍は `reportedLive`（不変更）。
- テスト：`npm test` 244 tests / 237 pass / 0 fail / **7 TODO（未解決のまま）**、`npm run check` LEGALITY CHECK PASSED: 12 teams（4 CPU のクラウドセッションで実測）。
- すべてヒューリスティックAI同士・構築済み仮説での結果。**対人勝率ではない**。

## 0. 時系列（コミット順）
1. `bcc4b9e` **事前宣言**（FINAL battle 前）：`holdout-20261031-pr94.js` + `test/pr94-holdout.test.js` で次を固定した。
   - 新しい未使用の公開6を2つ（N3 Mawile、N4 Houndoom＋晴れ）。それぞれ合法な仮説 a（エースがメガ）と b（誰もメガしない）。
   - 独立した相手モデル `tm`。
   - seed、指標、凍結規則、判定規則、予算。
   - A/C/F2/F3/N1/N2 は今後 DEV 扱い。
2. `c3edb36` 実装・DEV 実行・**凍結**（`decision=floor`、同点規則による）。
3. FINAL を1回だけ実行（`reports/data/pr94-eval-final.json`）。

## 1. P0：T2 キーの公開情報衝突（修正済み、`pr94-t1t2.js`）
- **再現**（`test/pr94.test.js`）：旧 `pr92 keyOf` では `Charizard` / `Charizard-Mega-X` / `Charizard-Mega-Y` がすべて `T2|Charizard|Rotom-Wash|Charizard` になる。`ownHP` を渡すと throw する。
- **新しい観測**：公開ログから Bot が解析した値と、自分の request だけを使う。許可リスト外の項目は throw する。
  - 相手の形態は見えている形態そのもの（`-Mega-Y` を残す）。メガしていない相手は元の形態のままで、**未公開のメガを推定しない**。
  - HP・状態異常・天候・フィールド・トリックルーム・積み・アンコール・自陣の設置技。
  - 自分の合法手一覧：こだわり固定・アンコール・PP 0・トラップがここに反映される。
- **キーは最小限**：HP は3段階（>1/2、>1/4、それ以下）。積みは 0 以外の段階だけ。相手側の設置技は T2 の判断入力に入れない。合法手一覧は順序に依存しない。
- **相手の隠れた道具・技・3体はキーに入らない**：観測項目に存在しないので、それらが違うだけなら同じキー・同じ判断になる。
- テスト：公開情報の差 18 種がすべて別キーになる。最小性も確認した（同じ段階・同じ符号・同じ合法手集合なら同じキー）。非公開の項目 9 種は throw する。
- **相手のこだわり固定は観測しない**：道具が公開されない限り非公開だから。
- **トレードオフ**：細かいキーは、表に無いキー（unseen）を増やす。FINAL の T2 unseen 率は 35〜84%。unseen のときは abstain（base AI）に委ねる。

## 2. 実行可能な T1/T2（`pr94-t1t2.js`）
- **出力は2種類だけ**：
  - **rule**：n≥8、**2セル以上**、AI より +0.10 以上。
  - **ABSTAIN**：base AI の最頻行動を「情報のみ、推奨ではない」と明記して出す。
- `ai` を具体的な推奨とは表現しない。
- **表の作り方**：相手分岐 ai/attack/setup/switch × seed 2 で、T1・T2 とも作る。
- **実 Battle で記録する件数**：強制した件数（rule）・abstain・unseen・unavailable。強制交代（瀕死後の交代）は rule と別に数える。
- **実際に強制された件数**：
  - DEV（3048 評価 battle）：**T1 144 / T2 94**。
  - FINAL（1032）：**T1 0 / T2 6**。
- **成否**：
  - FINAL の N3/a で rule `T2: Mega Mawile vs Mega Metagross, own HP H / rival L -> switch Hydreigon` が実行された。結果は rational モデルで 3/3 勝、tm モデルで 1/3 勝。
  - **悪化例**：DEV A/H1 では、表を使うと平均が下がった（.29 → .22）。この rule は過学習している可能性がある。
- PR #93 の表（pr92 形式）は、このデータでは強制 T1 0 / T2 0 のままだった。

## 3. N2/a と A/H1 の診断（固定 Showdown、`pr94-n2a-diagnosis.js`）
N2/a の view2 セル（Heracross/Rotom-Mow/Lycanroc-Dusk、エース先発）。seed 16本 × 片側、相手分岐 ai/attack。
| エースの型 | PR93 選出（Rotom-Wash 先発）の勝ち | v2 選出（Metagross 先発）の勝ち | 相手 T1 | 公開免疫試合 |
|---|---|---|---|---|
| 実際の N2/a（Adamant、CC/Pin Missile/Rock Blast/SD） | ai 0/16、attack 0/16 | 16/16、16/16 | Close Combat | 0 |
| Jolly、技は同じ | 12/16、0/16 | 16/16、16/16 | 交代 / CC | 0 |
| Adamant、テンプレ技（CC/Megahorn/EQ/Stone Edge） | 16/16、16/16 | 16/16、16/16 | **Earthquake** | 16 |
| テンプレ（selector 内部の型） | 15/16、16/16 | 16/16、16/16 | **Earthquake** | 16 |

- **D1 不合理な相手の行動を勝ちに数えていた**：selector 内部の相手 AI は、浮遊（Levitate）の Rotom-Wash に T1 で Earthquake を撃つ。
  - Rotom-Wash の特性は浮遊だけなので、この免疫は**公開情報**である。
  - pr86 の `rational()` は変化技しか点検しないので、guard でも評価でも、この試合が勝ちとして残っていた。
  - 既存 TODO「単一の公開特性（浮遊）を適用すべき」と同じ根っこ。
  - **修正**：`rational94` = `rational()` かつ「T1/T2 に公開免疫への攻撃がない」。判定は型相性、または見えている形態の唯一の特性による。
- **D2 メガ後の特性を無視した仮説**：`attackValue` は連続技を平均 3.5 回で数えるので、メガ Heracross（スキルリンク）に Pin Missile / Rock Blast が入らなかった。
  - **修正**：`withMegaAbility` が、メガ後の特性で技の価値を補正した型を追加する（スキルリンク、かたいツメ、がんじょうあご、てつのこぶし、メガランチャー、きれあじ、テクニシャン、ちからずく）。
  - TeamValidator と coherence を通った型だけを使う。
- **#93 の記述の訂正**：「T1 で一撃で倒れる」は主な機構ではない。T1 で倒れたのは 32 試合中 1 回だけ。CC 1発で Rotom-Wash の HP は 25〜35% 前後まで減り、その後のスキルリンク技と剣の舞で押し切られる。
- **A/H1 の負け筋**（pr94 floor の選出 Primarina>Garchomp>Rotom-Wash）：Primarina の同族対面（相手は控えめ・HP32・特攻32・オボン）で、Moonblast の撃ち合いに負ける。その後 Gholdengo/Mimikyu が残る。
  - これは自軍 Primarina の型と相手の型の問題で、selector の内部仮説では再現されていない。**未解決**。

## 4. 結果（`pr94-eval.js`）
- seed は (6体, 仮説, 相手モデル, セル, 分岐, s) ごとに別にした。各 seed は片側だけ。
- 同 seed 左右は s=0 で別統計として取った。結果の一致率は FINAL で全セル 1.0、DEV で 0.63〜1.0（大半が 1.0）。同 seed 左右はほぼ同じ試合なので、n には数えない。
- 指標は meanRat94（括弧内は最悪セル）。

### FINAL（N3/N4、事前宣言済み、1回だけ実行、decision=floor）
| 相手モデル | legacy | quick | v2 | pr93 | pr93+T1T2 | **pr94** | **pr94+T1T2** |
|---|---|---|---|---|---|---|---|
| rational 平均 | .932 (.837) | .943 (.775) | .905 (.762) | .959 (.837) | .959 | **.968 (.875)** | **.968** |
| tm 平均 | .950 (.887) | **.988 (.950)** | .887 (.762) | .981 (.919) | .981 | .967 (.887) | .970 (.887) |
| N3/a rational | .82 | .88 | .71 | .886 | .886 | **.94** | .94 |
| N3/a tm | .84 | **.97** | .64 | .964 | .964 | .91 | .92 |

- **事前宣言の規則による判定：通過**（最悪セル 0 なし、どの仮説 × モデルでも max(legacy, v2, pr93) − 0.10 以上、T2 の強制 6 > 0）。
- しかし**識別力が低い**。N4 はどの方策も .96〜.99、N3/b も .93〜1.00 で、差はほぼ N3/a だけ。
  - N4 の rational モデルは、セルの 60% でエース（Houndoom）を出さない。CLAUDE.md の原則どおり、これを対策の成功と数えない。エースを出したセルでの成績はどの方策も同じ（.975〜1.00）。
  - tm モデルでは quick が最良で、pr94 は quick より .02 低い。
- **FINAL の T1 強制は 0**。

### DEV（診断・開発用。A/C/F2/F3/N1/N2）
| | v2 | pr93 | pr93+T1T2 | pr94 cvar | **pr94 floor** | pr94 floor+T1T2 |
|---|---|---|---|---|---|---|
| rational 平均（最悪セル平均、最悪セル0の仮説数） | .807 (.471, 2) | .730 (.438, 4) | **.824** (.585, 2) | .764 (**.637**, 2) | .764 (.558, **0**) | .759 (.555, 1) |
| tm 平均 | .741 (.454, 2) | .737 (.479, 3) | .745 (.483, 3) | .730 (.508, 0) | .740 (.450, **0**) | .749 (.467, 0) |
| N2/a rational | **1.00** | .63 | .63 | .95 | .77 | .79 |
| N2/a tm | **.97** | .89 | .89 | .95 | .57 | .59 |
| A/H1 rational | **.97** | .48 | .48 | .08 | .29 | .22 |
| A/H1 tm | **.806** | .34 | .36 | .45 | .62 | .62 |

- **N2/a**：#93 の .63 から .77 に改善したが、**v2（1.00）より .23 低い**。tm モデルでは .57 と、#93（.89）より悪い。
- **A/H1**：.29（v2 は .97）。**重大な回帰が残る**。T1/T2 の rule を使うと .22 にさらに下がる。
- **選出の seed 依存性**：N2 の pr94 cvar の選出は、selector seed が違う（単独実行の ui=0 と全体実行の ui=5）だけで Primarina 先発と Metagross 先発に分かれた。guard の値は 1/8 刻みで、上位候補の差はノイズと同程度。
- **凍結**：DEV rational の平均が cvar .764 = floor .764 で同点。宣言した同点規則で floor に凍結した。**2変種から選んだ楽観バイアス**がある。

## 5. 判定と残る問題
- FINAL は宣言した規則を通過した。ただし次の理由で **NOT READY**：
  1. DEV の A/H1（.29 対 .97）と N2/a（.77 対 1.00、tm では .57）の回帰が残る。
  2. FINAL の識別力が低い。
  3. FINAL の T1 強制が 0、T2 強制が 6 しかない。
  4. 選出が selector seed に依存する。
- 改善不能とまでは言わない。ただ、内部仮説の相手 AI と実際の型のずれ（D1/D2 の類型）が他の種族にも残っている可能性が高い。
- 7 TODO は未解決のまま（Fairy 範囲技の事前分布、Scarf を考えた素早さモデル、メガY/ひでりを考えた選出、メガ前の評価、浮遊の公開特性、かたいツメの被ダメ、砂嵐の特防補正）。
- 処理時間（4 worker、オフラインの事前計算）：
  - pr94 selector：17〜27s。
  - T1/T2 表の作成：20〜36s（7〜9千 battle）。
  - v2：37〜43s。
  - 評価は 1 battle 平均 15〜17ms。
  - DEV は全体で9分、FINAL は5分半。
  - **実ゲームの選出時間制限は未確認**。

## 6. 再現コマンド
```
export SHOWDOWN_DIR=<Showdown 3a766f2c... を build したディレクトリ>
npm test && npm run check
PHASE=DEV node pr94-eval.js                    # reports/data/pr94-eval-dev.json
PHASE=FINAL DECISION=floor node pr94-eval.js   # reports/data/pr94-eval-final.json（1回だけ実行済み）
node pr94-n2a-diagnosis.js                     # reports/data/pr94-n2a-diagnosis.json
```

## 7. ChatGPT に反証してほしい点
1. `rational94` の公開免疫の判定（型相性、または見えている形態の唯一の特性）が狭すぎないか、広すぎないか。また、評価で相手の不合理な試合を除くことが、方策の比較を歪めていないか。
2. `withMegaAbility` の補正表（8特性）。特に Pixilate や Aerilate のようなタイプ変換、Parental Bond が抜けている。
3. T2 キーの粒度（HP 3段階、合法手一覧の全体）と unseen 率の釣り合い。下位キーへの後退（backoff）を入れない判断は妥当か。
4. N3/N4 は易しすぎた。tm モデルでも、N4 ではエースを出さないセルが 1/3 ある。次の holdout をどう選ぶべきか。
5. A/H1 の Primarina 同族対面の負け筋：構築の問題として扱うべきか、選出器で避けるべきか。
