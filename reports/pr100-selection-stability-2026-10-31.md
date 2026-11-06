# PR #100 依頼への回答：公開6の選出安定性・合理敵 A/N2 回帰・実行可能 T1/T2・マスク後の合法性（2026-10-31）

判定：**NOT READY（変わらず）**。合法性（新 P1）と監査の実証（項目5）は完了した。選出の安定化（項目1）と実行可能な T1/T2（項目3）は、DEV で候補が**同時回帰の条件を満たさなかった**。そのため、停止条件に従い、新しい未知公開6の FINAL は**実行していない**（項目2）。

- 起点：PR #99 head `6041ffc`（その上に積む stack）。既存コード・保存 JSON・現行実戦6体・main は**未変更**。追加したのは新規ファイルだけ：
  - `pr100-legal.js`、`pr100-join-hook.js`、`pr100-join-audit.js`、`pr100-join-summary.js`、`pr100-seed-fallback.js`、`pr100-t1-probe.js`
  - `test/pr100.test.js`
  - `reports/data/pr100-*.json`
- 固定 Showdown `3a766f2cfb5e51c1e428cfe87d0dba91a8f01640`（ローカルで同じ SHA を build）、`gen9championsbssregmc`、自軍 `reportedLive`。
- テスト：
  - `npm test`：267 tests / 260 pass / 0 fail / **7 TODO（未解決のまま）**。PR #99 の 261 件に、新規 6 件を足した数。
  - `npm run check`：LEGALITY CHECK PASSED: 12 teams。
- すべて AI 同士・構築済み仮説での結果。**対人勝率ではない**。

## 1. 新 P1：マスク後の再決定を合法性チェックしていなかった（項目4）
**観測した失敗**（ChatGPT review #5722319208、隔離 V8 上の合成 request）
- `immuneAware98`（および pr96 の `immuneAware`）は、免疫の技を `req2` で disabled にした後、`decideWith(req2)` が返した手を**再確認しない**。
- `disabled` を無視するスクリプトが `move 1` を返すと、その手がそのまま出力される。さらに記録には `replacement:'move:Earthquake'` と残る。

**再現**（`test/pr100.test.js`）
- 合成 request：元の pr98 と pr96 の両方で `move 1` が出力され、記録は `move:Earthquake` になる。ChatGPT の反例と一致した。
- **固定 Showdown の実 Battle**
  - 条件：PR #98 と同じテスト専用の変種。自軍は風船 Garchomp、相手は合法な Mold Breaker Excadrill。相手には `disabled` を無視するスクリプトを使った。
  - pr98：エンジンは `move 1` を受理した（実 request ではその枠が disabled ではないため）。T1 に Earthquake を撃ち、公開済みの風船に `-immune`。記録は「Earthquake に置換」となり、**記録と実行が食い違う**。
  - pr100：その手を拒否して記録した（`rejected:[{turn:1,choice:'move 1'}]`）。T1 に Earthquake は出ず、選択エラーは 0。
- **既存 Battle での発生**：0 件。
  - これまで使ってきたスクリプト（pr82 BRANCHES、rivalScriptV2、ratSwitch、base Bot）は、すべて `disabled` と `pp>0` を守る。
  - 後述 §5 の全 Battle 結合で、「代替がある状況で、マスク済みの技が送られた」ケースは **0 件**だった。
  - したがってこの P1 は**潜在的な欠陥**であり、PR #97 と PR #99 の数値は変わらない。

**修正**（`pr100-legal.js` の `immuneAware100`。pr98 は上書きしていない）
1. 再決定した手を `legalUnder100(req2, choice)` で確認する。確認内容：
   - 技：枠が存在する、disabled でない、PP が残っている、`mega` は `canMegaEvo` のときだけ。
   - 交代：trapped / maybeTrapped でない、控えが存在して瀕死でない。
2. 不正な手だった場合の代替は、次の順で試す：
   1. base AI（req2 で判断するので disabled と PP を守る）
   2. マスクされていない最初の合法技
   3. 合法な交代
   4. どれも無ければ「強制」。元の手を送り、記録に `none (no alternative)` と `reason`（trapped / no bench）を残す。
3. pr98 にあった `b[0].i` の例外経路（再決定が null で、交代もできない場合）も除去した。
4. **同値性**：`disabled` を守るスクリプトでは、出力も記録も pr98 と一致する（テストで確認）。
5. **Choice / Encore**：Showdown は、ロック中の request で他の枠を disabled にする。そのため、ロック中の技が免疫で控えもいなければ「強制」になり、控えがいれば交代する（テストで確認）。

**公開の接地状態**（`publicImmuneMoves100`、必要最小限）
- 次の場合は、地面技の免疫（飛行タイプ・Levitate・Air Balloon）をマスクから外す：
  - 場の Gravity：`-fieldstart|move: Gravity`。Bot の `terrain` に `gravity` として残る。
  - 自軍側の、公開済みの Iron Ball。
- 固定 Showdown の実 Battle
  - 相手はテスト専用の合法な Forretress（Gravity + Earthquake）。T1 に Gravity、T2 に Earthquake を撃つ。自軍は reportedLive の Rotom-Wash 先発。
  - 素朴な相手：T2 の Earthquake が Levitate の Rotom-Wash に**命中**した。
  - pr98：マスクしてしまい、この技を撃たない（過剰マスク）。
  - pr100：マスクせず、命中した。
- 残る問題：
  - Iron Ball の公開（Frisk や Trick など）は合成テストだけで確認した。
  - Smack Down、Thousand Arrows による接地、Ingrain、Magnet Rise、Roost は、Bot が公開状態として持っていないので**未対応**。
  - Gravity が残っている間に別のフィールドが張られると、Bot の `terrain` が上書きされる。これは既存 Bot の制約で、Gravity が見えなくなり、旧来どおりマスクする側に倒れる。

## 2. 監査の実証：T3 以降の known を、マスク器の決定と直接結合した（項目5）
PR #99 は、T3 以降に残る known（FINAL 101 / DEV 746）を「`none (no alternative)` の経路だろう」と**コードから推論**しただけだった。

**手順**
- `pr100-join-hook.js` を preload して、`pr96-eval.js` FINAL を**変更せずに**全パイプライン再実行した（選出器・T1/T2 表・評価を含む）。
- 相手が決定するたびに、次を記録した：
  - 実際に見た request（有効な技、マスクされていない技、trapped、控えの数、ロック理由、道具）
  - マスク器の免疫リスト
  - 返した手
- 各 known（`publicImmune98`）を、**同じターンの決定**と結合した。

| | FINAL 再実行 |
|---|---|
| hook を通った Battle | 110,658（PR #99 と同数） |
| 決定論：方策行（pick / meanAce / worstAceCell / meanAll / meanRat94 / masked / residual / irrational） | 144 行、**差分 0**。選出・seed B・判定 fails も同一 |
| aware 相手で known がある Battle | **101**（すべて T3 以降。PR #99 と同数） |
| aware 相手の known hit | **141 件すべて「強制」**：Choice ロック＋控えなし 139、Encore ロック＋控えなし 2 |
| 代替がある状況でマスク済みの技を送った | **0** |
| 決定時点の免疫リストに入っていない | **0** |

- 代表例（Battle ログと request の結合。`reports/data/pr100-join-final.json` の `awareExamples`）
  - seed `[42285,36805,45693,6394]`、左側、T10。相手は Choice Scarf で、有効な技は `Headlong Rush` だけ、控え 0。返した手 `move 1` が Hydreigon に `-immune`。
  - seed `[20454,43226,62999,46769]`、右側、T9。相手は Encore されていて、有効な技は `Psychic` だけ、控え 0。Hydreigon に `-immune`。
- 補足：
  - プランが ai の評価試合だけを再実行した `pr100-join-aiplan-final.json` では、3,080 試合、264 セル差分 0、known は 0 件だった。PR #99 の 101 件は、**選出器と T1/T2 表を作る試合**に由来する。
  - DEV（248,370 Battle）の結合は**未実施**。FINAL での件数一致と、全件「強制」の確認までにとどめた。
- 結論：監査タグの誤りはない。T3 以降の known は、**選択ミスではなく、ロック中で控えがいない状況での強制行動**だった。選出勝率やプレミとは混同しない。

## 3. 公開6の選出が seed で割れる問題：abstain / fallback の検証（項目1、DEV のみ、新しい試合 0）
- 保存済みの PR #97 データでは、10 の公開6のうち **4つ**（A、F2、N5、N6）で、pr96 の選出が seed A と seed B で割れていた。
- PR #97 は legacy / v2 / pr96 を**同一の job**（同じ seed・左右・セル・相手モデル）で対戦させている。そのため、フォールバック方策の値は保存済みのセル値から正確に読める（`pr100-seed-fallback.js`）。
- 指標は、相手側がエースを含むセルでの勝率（meanAce）。

| aware、plan ai | legacy | v2 | pr96 | **割れたら legacy** | **割れたら v2** |
|---|---|---|---|---|---|
| A 全 H、rational | .342（41/120） | .333 | .158 | .342 | .333 |
| A 全 H、tm | .608 | .283 | .654 | .608 | .283（最悪セル 0） |
| N2/a、rational | .66 | **.99** | .84 | .84 | .84 |
| DEV 全体、rational | .668 | .821 | **.835** | .802 | .843（最悪セル 0） |
| DEV 全体、tm | .763 | .781 | **.888** | .839 | .807 |
| N6（使用済み FINAL、参考）、rational | .600 | .775 | .775 | **.600** | .775 |

- **不採用**：
  - 「割れたら legacy」は A の rational を pr96 より戻す（.158 → .342）。しかし DEV 全体の rational と tm で pr96 を下回り、N2/a は不変、N6 は事後に回帰する。
  - 「割れたら v2」は A の tm が .283 に崩れ、最悪セルが 0 になる。
  - どちらも「A 全 H・N2・N6 を同時に回帰させない」を満たさない。
- seed 安定性は、**選出が正しいことを意味しない**。N2 は seed が一致していたが、pr96 は v2 に負けている。
- このため、人間向けに断定した推奨は出さない。

## 4. 実行可能な T1 ルールの候補と、その否定（項目1/3、DEV のみ）
**N2/a の負け筋**（固定 Showdown、保存 seed で再現）
- seed `[5619,3428,14210,18518]` 左側、seed `[7294,3627,123,36187]` 右側。
- 自軍は Scarf Garchomp 先発、相手は Heracross 先発。
- T1：Garchomp が Dragon Claw。Heracross はメガ進化して剣の舞、残り HP 84/157。
- T2：Dragon Claw で 20/157。+2 の Close Combat で Garchomp が倒れる（Rough Skin で相手は 1/157）。
- その後、Mega Metagross の Psychic Fangs が Heracross を倒すが、残りの2体に押し切られる。
- 同じ seed で T1 の行動だけを替えた結果（`T1 →` の数値は、T1 の攻撃後の Heracross の残り HP）：

| T1 の行動 | 結果 |
|---|---|
| Earthquake | T1 → 112/157、**敗北** |
| Poison Jab | T1 → 108/157、**敗北** |
| Dragon Claw（実際の手） | T1 → 84/157、**敗北** |
| Metagross に交代 | 剣の舞の間に交代し、T2 の Psychic Fangs で倒す。**両 seed とも勝利** |

- どの攻撃でも Garchomp は救えない。

**候補ルール**（公開情報だけ：自軍の先発、相手の先発種族、合法な交代）
- 「T1、自軍 Garchomp、相手が Heracross → Metagross に交代」。
- PR #97 DEV と同じ job で比較した（`pr100-t1-probe.js`、`reports/data/pr100-t1-probe-n2-dev.json`）。

| N2、pr96 の選出 | ルールなし | ルールあり |
|---|---|---|
| a（メガ＋剣舞型）、rational | .84（最悪 .60） | **.98**（最悪 .95） |
| a、tm | .87 | .92 |
| b（Scarf Guts 型）、rational | .79 | **.56** |
| b、tm、Heracross 先発 | .85 | **.15** |
| 同一 job の勝敗反転 | | 勝ち→負け 44 / 負け→勝ち 26 |

- **不採用**：
  - T1 の選択時点では、a と b を区別できない。メガ進化は、両者の選択が終わった後に公開される。
  - 型 a の事後最適化は、型 b で大きく負ける。依頼が警告していた「単一の仮説だけの最適化」の実例。
  - N2 は開発済みのデータで、ルールもログを読んでから作った。つまり**標本内の結果であり、汎化の証拠ではない**。
- 人間向けの T1/T2 判断は**改善していない**。PR #97 の pr96 T1/T2 表は、N2 で有効ルール 1 件、Heracross に関するルールは 0 件だった。**未完成**。

## 5. 実施していないこと（停止条件による）
- **新しい未知公開6（N7/N8）の FINAL**：DEV で事前宣言に値する候補がなかったため、宣言も実行もしていない。依頼の「改善の見込みがなければ大量試合を止める」に従った。
- Primarina 同族の同速リスクの説明：今回は**未調査**。
- 選出 17–32 秒、T1/T2 表 22–45 秒という時間の問題：**未改善**。
- 7 TODO：**未解決**。

## 6. 成立 / 未成立
- **成立**：
  - 新 P1 の再現と修正（合成 request と固定 Showdown の実 Battle）。
  - Gravity による過剰マスクの修正。
  - 監査の実証（141/141 が強制。決定論は 144 行・差分 0）。
- **未成立**：
  - 公開6からの安定した 3 体＋初手。
  - A 全 H・N2・N6 を同時に回帰させない選出器。
  - 実行可能な T1/T2。
  - 新しい holdout での一般化。
- **新しい反例**：N2 の Heracross 先発に対する T1 交代は、型 a では勝ち筋だが、型 b では負け筋になる（上の seed で再現できる）。
- **実戦6体と育成への影響**：なし。新しい育成の推奨もない。

## 7. ChatGPT に反証してほしい点
1. `legalUnder100` の判定は十分か。特に、`maybeTrapped` を「交代不可」と扱う点（保守的な扱い）と、Struggle や PP が undefined の枠の扱い。
2. 結合 hook の分類は、相手の決定のうち**そのターン最後の request** を使っている。同じターンに複数の request がある場合（強制交代の後など）に、誤って分類していないか。
3. フォールバック評価は保存済みのセル値で行い、paired（同一 job）を前提にしている。この前提が成り立たないセルはないか。
4. N2 の T1 ルールの否定は、型 b（Scarf Guts）の妥当性に依存する。b の型の出所は仮説であり、使用率データの根拠はない。型 a/b 以外の分布ならどうなるか。
5. 接地を判定する `bot.terrain==='gravity'` が上書きされるケースの影響（過剰マスクに戻るだけで、漏洩はない、という主張の確認）。

---
再現：
- `SHOWDOWN_DIR=<固定SHA> npm test`
- `PHASE=FINAL node -r ./pr100-join-hook.js pr96-eval.js`（`PR100_JOIN_FILE` と `OUT` を指定）→ `node pr100-join-summary.js reports/data/pr96-eval-final.json <replay.json> <join.jsonl>`
- `node pr100-seed-fallback.js <out.json>`
- `node pr100-t1-probe.js`
