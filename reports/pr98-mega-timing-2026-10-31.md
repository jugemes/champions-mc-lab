# PR #98 依頼への回答：メガ公開時点・風船免疫・合理敵 paired 回帰（2026-10-31）

判定：**NOT READY（変わらず）**。今回直したのは**監査（事後の不合理タグ）とマスク器の誤り**で、**PR #97 の選出・勝率・判定は1件も変わらない**ことを、固定 Showdown での全 Battle 再実行で確認した。A/H0–H2・N2/a・N6/a tm の回帰は残っている。新しい選出変種・新 holdout の FINAL は**実行していない**（理由は §5）。

- 起点：PR #97 head `36725dc`（この上に積む stack）。`pr96-paired.js`・pr94 以前のコード・保存 JSON は**未変更**。追加は新規ファイルのみ（`pr98-timing.js`、`pr98-shadow-hook.js`、`pr98-replay-compare.js`、`test/pr98.test.js`、本報告、`reports/data/pr98-replay-*.json`）。
- 固定 Showdown `3a766f2cfb5e51c1e428cfe87d0dba91a8f01640`（ローカルで同 SHA を build）、`gen9championsbssregmc`、自軍 `reportedLive`。
- テスト：`npm test` 261 tests / 254 pass / 0 fail / **7 TODO（未解決のまま）**、`npm run check` LEGALITY CHECK PASSED: 12 teams。
- AI 同士・構築済み仮説の結果であり、**対人勝率ではない**。

## 1. P0：同ターンのメガを、相手の選択時点の公開情報に遡及していた
**観測した失敗**（ChatGPT review #5722096718）：`publicImmune96` は `|turn|` で `start=active` とした後、同じターンの `|detailschange|` で `start` をメガ形態に**上書き**していた。相手が技を選んだ時点では、メガはまだ公開されていない。

**再現（元の関数をそのまま実行）**
- 合成ログ（ChatGPT の V8 反例と同じ形）：通常 Altaria → 同ターン Altaria-Mega → 相手 Hydreigon の Dragon Pulse → `-immune`。`publicImmune96` は `{turn:1, move:'Dragon Pulse', target:'Altaria-Mega', why:'type'}` を返した。pr94 の `publicImmune` も同じ誤り。
- **固定 Showdown の実 Battle**：自軍側に N6/a（TeamValidator 合法、66P・各32以下・4技）を置き、Altaria 先発。T1 にメガ＋竜舞。相手は reportedLive の Hydreigon 先発で、T1/T2 に Draco Meteor を撃つ。両サイド（p1/p2）で実行。
  - エンジンの実プロトコル：`|turn|1` → `|detailschange|…|Altaria-Mega` → `|move|…Hydreigon|Draco Meteor` → `|-immune|`。T2 も同じ順。
  - `publicImmune96`：T1 も T2 も「不合理」。
  - **免疫を理解する相手でも**、T1（通常形態の Altaria を見て選んだ、合理的な選択）が不合理と判定されていた。

**修正**（`pr98-timing.js` の `publicImmune98`）
- 判定は、**ターン開始時に公開されていた形態と風船**で行う。同ターンの `detailschange` では `start` を動かさない。
- 返り値は4つに分ける：
  - `known`：選択時点で公開されていた免疫への攻撃（不合理）。
  - `possible`：その同ターンのメガがあって初めて免疫になった攻撃（`post-choice mega`）。不合理に数えない。メガを読む予測は戦術の問題で、確定した知識とは別。
  - `switchedIn`：そのターンにこちらが交代で出した相手への攻撃（pr96 の規則を維持）。
  - `locked`：下記 §3 の固定技の継続。
- 次のターンはメガが公開済みなので `known` になる。実 Battle で、T1 = possible、T2 = known に分かれることを確認した。
- 免疫を理解する相手（マスク器）は、もともと**選択時点の `bot.foeActive`**（T1 は通常 Altaria）を使っている。実 Battle で、T1 はマスクされず、T2 だけがマスクされて Flash Cannon を選び直した。つまり**マスク器には漏洩がなかった**。誤っていたのは事後の監査だけ。
- 公開済みで、まだ割れていない Air Balloon への地面技も、`known`（`public airballoon`）に加えた。pr96 の検出器はこれを数えていなかった。

## 2. P1：Mold Breaker が Air Balloon まで貫通すると扱っていた
**再現**：`publicImmuneMoves`（pr96）で、相手が Mold Breaker のとき、公開済み風船の Garchomp への Earthquake が `[]` になった。マスクされない。

**固定 Showdown の実 Battle**（テスト専用の変種。育成の推奨ではない）
- 自軍は reportedLive で、Garchomp だけ Air Balloon に変更。
- 相手は reportedLive の Tyranitar を、合法な Mold Breaker Excadrill（Jolly、Earthquake / Iron Head / Rock Slide / Swords Dance、hp2/atk32/spe32、Focus Sash）に替えた。両チームとも TeamValidator を通過。
- 結果：
  - 素朴な相手が T1 に Earthquake を撃つと、風船の Garchomp には `-immune`。
  - 同じ条件で Levitate の Rotom-Wash には命中した（Mold Breaker は**特性は貫通する**が、**道具は貫通しない**）。
  - 風船は、T1 の選択より前に `|-item|…|Air Balloon` で公開されている。
  - pr96 のマスク器：マスクしない（P1）。
  - `publicImmuneMoves98`：マスクして選び直した。選択エラーは 0。
  - Levitate の Rotom-Wash に対しては、pr98 でもマスクしない（正しい）。

**修正**：pr96 の結果に、「相手の特性が Mold Breaker 系で、公開済みの Air Balloon がある」場合の地面技（Thousand Arrows を除く）だけを足す。Mold Breaker でない相手では、pr96 と同じ結果になる（テストで同値性を確認）。

## 3. PR #97 の評価への実際の影響：全 Battle を再実行して測った
保存 JSON には Battle ログも、選択時点の情報もない。そこで `pr96-eval.js` を**変更せずに**、`node -r ./pr98-shadow-hook.js` で再実行した。

hook は、すべての Battle で次の2つを記録するだけで、行動は変えない：
- 同じログに対する pr96 と pr98 の検出器の結果。
- 相手の毎回の決定で、同じ request と公開状態に対する pr96 と pr98 のマスク器の結果。

| | FINAL（N5/N6） | DEV（A/C/F2/F3/N1–N4） |
|---|---|---|
| 再実行した方策行（pick / meanAce / worstAceCell / meanAll / meanRat94 / masked / residual / irrational） | 144 行、**差分 0** | 560 行、**差分 0** |
| 判定（fails） | 保存版と同一 | 保存版と同一 |
| hook を通った Battle（選出・T1/T2 表を含む） | 110,658 | 248,370 |
| **P0**：同ターンのメガによる誤ラベル | **0** | **0** |
| **P1**：pr96 と pr98 のマスク器の不一致 | **0** | **0** |
| 【新】pr96 が不合理と数えた固定技の継続（相手は免疫を理解する方） | 249 件（うち T1/T2 にかかる試合 141） | 1,455 件（T1/T2 にかかる試合 310） |
| 免疫を理解する相手で、pr98 の known が T1/T2 にある試合 | **0** | **0** |

- **P0/P1 が PR #97 の数値に影響しない理由**：自軍 `reportedLive` のメガは Metagross だけで、メガ前後でタイプは変わらない（鋼/エスパー）。メガ前後の特性も免疫系ではない（Clear Body → Tough Claws）。Air Balloon の持ち主もいない。つまり、**現行6体を自軍とする評価では、この2つのバグは発火しない**。Altaria のように、メガでタイプや免疫が変わる個体を自軍に入れた研究でだけ効く。
- **【新規発見】固定技の継続**：
  - `|move|…|Outrage|…|[from]lockedmove`（例：前のターンに Outrage で Metagross を倒し、こちらが Primarina を出した次のターン）は、**そのターンの選択ではない**。pr96 の検出器は、これを公開免疫への不合理な攻撃として数えていた。
  - 免疫を理解する相手で、pr96 が T1/T2 の不合理と数えた試合は、FINAL 141 / DEV 310。これは pr98 では **すべて誤り**（known 0 件）。
  - 素朴な相手（PR #95 の連続性用）の T1/T2 known（DEV 1,135 試合）は、pr96 と pr98 で一致した。大半は Levitate の Rotom-Wash への Earthquake / High Horsepower / Earth Power で、検出器は本物の不合理を引き続き捉えている。
  - 影響範囲：`irrationalGame` → `pairedIntersection` の感度分析と、選出スコアの `residualImmune` / `irrational` の監査列だけ。選出規則 `decidePR94` はこれらを使わない。だから**選出・meanAce は不変**（上の差分 0 と一致）。
- **T3 以降に残る known**：免疫を理解する相手で FINAL 101 試合、DEV 746 試合。例：Encore された Overqwil が Gunk Shot を Metagross に撃つ。
  - マスク器が免疫の技を外したあとも、元の技のまま返していた。コード上、これは「全技がマスクされ、交代もできない」`none (no alternative)` の経路だけで起こる（branch スクリプトも base AI も `disabled` を守る）。
  - これは**強制された行動**なので、`irrationalGame98` では、そのターンに `none (no alternative)` の記録があれば数えない。
  - ただし、hook はマスク器の記録そのものを取っていない。そのため、この経路だったことは**コードからの推論**であり、記録では未確認。

## 4. 重大な回帰の診断（保存 JSON の再集計。上の再実行で同値を確認済み）
| セル | legacy | v2 | pr96 | 機構（負けログ・選出） |
|---|---|---|---|---|
| A/H0 rational | .300 | **0** | .075 | 下記の A 共通 |
| A/H1 rational | .325 | **1.0** | .250 | 下記の A 共通 |
| A/H2 rational | .400 | **0** | .150 | 下記の A 共通 |
| A 合計 rational（3仮説 × 40） | 41/120 | 40/120 | **19/120** | legacy と比べた Fisher 検定 p≈.002（独立性を仮定。同一セル・seed の相関は無視） |
| A 合計 tm（3 × 80） | 146/240 | 68/240 | 157/240 | tm では pr96 が最良 |
| N2/a rational / tm | .66/.49 | **.99/.99** | .84/.87 | 下記の N2/a |
| N6/a tm | **1.0**（60/60） | .917 | .917（55/60） | pr96・pr95・v2 は同じ選出（Rotom-Wash>Metagross>Garchomp）。差は5試合で、Fisher 検定 p≈.057。pr96 固有の悪化ではなく、v2 も同じ (b) に該当する |

**A 共通の機構**：pr96 の選出は Primarina>Hydreigon>Garchomp（Primarina 先発）。
- 相手 Primarina と同族対面になる。同じ型（S2）なので**同速の乱数勝負**。そのうえ Moonblast の撃ち合いで、Sitrus 込みの乱数差で負ける例が多い。
- 例：H1、seed `[49625,15064,19228,3695]`、左側。T3 に相手が先に動き、こちらの Primarina が倒れる。
- v2 の Metagross 先発は、H1 では 1.0、H0/H2 では 0。単一の仮説に最適化しているだけで、v2 を基準にするのは不適切。legacy（Hydreigon 先発）は3仮説とも .3〜.4 で、最も安定している。

**N2/a の機構**：pr96 は Scarf Garchomp を先発させる。
- 相手 Heracross は T1 にメガ＋剣の舞。Dragon Claw 2発では倒しきれず（残り 20/157）、+2 Close Combat で Garchomp が倒れる。
- v2 は Metagross 先発で、Psychic Fangs が効果抜群。.99。
- T1/T2 表は、この局面に規則を持っていない（`used:{}`）。

**選出時間**：pr96 の選出は 17〜32 秒、T1/T2 表は 22〜45 秒（CI の 4 CPU。ローカル再実行ではおよそ2倍）。合計 1 分前後〜それ以上の計算が必要。**人間が見せ合いの時間内に実行できる形ではない**。

**seed A/B の分岐**（10個の公開6のうち4個：A、F2、N5、N6）：差は順位の僅差（例：N6 では選出スコア .969 vs .962）。標本の不確実性の範囲内なので、**ABSTAIN 相当**として扱うべき。

## 5. 新 holdout と合格判定：実行しなかった
- 今回の修正（P0・P1・固定技の継続）は、**選出にも勝率にも影響しない**ことを全 Battle の再実行で示した。そのため、同じ選出器で新しい holdout（N7/N8）を評価しても、PR #97 の結論（NOT READY）を言い換えるだけになる。依頼書の「十分な改善の見込みがない場合は大規模評価を無駄に回さない」に従い、**事前宣言も FINAL も行わなかった**。
- 回帰（A、N2/a）を直すには、選出規則そのものの変更が必要になる。例：同速の同族対面を先発に置かない、エース先発に対して効果抜群がない先発を避ける。これは新しい変種なので、**別の依頼として、事前宣言 → DEV → 新しい未知 holdout で FINAL を1回**、という手順で行うべき。

## 6. 改善・不成立・未確認・実戦への影響
- **改善**：
  - 監査の時間境界（P0）を修正した。
  - 風船と Mold Breaker（P1）を修正した。
  - 固定技の継続を「不合理」と誤って数えていた問題を新たに見つけ、修正した。
  - 公開済みの風船を検出器に追加した。
  - 強制された行動（`none (no alternative)`）を不合理から除いた。
  - テスト6件を追加した（うち2件は固定 Showdown の実 Battle、残りは元の関数での合成ログ再現と修正確認）。
- **不成立**：PR #97 の NOT READY は変わらない（A rational で legacy に劣る、N2/a、N6/a tm、T1/T2 の実用性、選出時間、7 TODO）。
- **未確認**：
  - T3 以降に残る known が `none` 経路だったことは、コードからの推論。
  - Gravity / Iron Ball / Smack Down で風船が無効になる場合は扱っていない。
  - Mold Breaker でない相手が風船を割ったあと、`-enditem` を正しく反映するかは、pr96 の Bot に依存する（Bot の 188 行目で消去されている）。
- **実戦への影響**：なし。現行6体・育成・main・費用は変更していない。新規育成の推奨もない。

## 7. ChatGPT に反証してほしい点
1. `possible`（同ターンのメガ）を不合理から外すことは妥当か。メガが公開6から確実に予測できる場合（メガストーンを持てる候補が1体だけ、など）は、`possible` を不合理寄りに扱うべきか。
2. 固定技の継続の除外。Outrage の**1ターン目**（選択した攻撃）は数えている。混乱終了のタイミングなどで、別の抜けがないか。
3. 「T3 以降の known = 強制された行動」という推論を、マスク器の記録で直接確認すべきか（hook の拡張）。
4. A で legacy を回帰の基準にする案。v2 は H1 にだけ合っている。
5. 「新 holdout を回さない」という判断。

## 再現手順
```
# 固定 Showdown を SHOWDOWN_DIR に build したうえで
npm test && npm run check
node --test test/pr98.test.js            # P0/P1/固定技の継続：合成ログ＋実 Battle
PHASE=FINAL OUT=/tmp/final.json PR98_SHADOW_FILE=/tmp/final.jsonl node -r ./pr98-shadow-hook.js pr96-eval.js
node pr98-replay-compare.js reports/data/pr96-eval-final.json /tmp/final.json /tmp/final.jsonl
# DEV も同じ（PHASE=DEV）。保存 JSON は上書きしない（OUT を指定する）
```
保存した集計：`reports/data/pr98-replay-final.json`、`reports/data/pr98-replay-dev.json`。
