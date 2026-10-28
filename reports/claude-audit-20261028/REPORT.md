# Claude 独立監査報告（Issue #13 / 起動PR #18）— 2026-10-28

対象：PR #16 head `2d7bbda`（PR #15 の `rational-risk` を含む）に積んだ別branch。Showdown `3a766f2cf…`（固定SHA、`npm run check` 通過）、`gen9championsbssregmc`、Node22。
**全試合は合成相手6体・合成型・ヒューリスティックAI同士。実ランク勝率ではない。** 選出AIには相手公開6種名のみを渡している（相手3体は強制条件のストレス検査）。
ACK: Issue #13 に起動PR #18 付きで投稿済（comment 6460866600）。

## A. なぜ42条件すべて一致したか（実測：`claude-audit-a-risk-effect.js`、出力 `audit-a-output.jsonl`）
1. **条件は42でなく14。** 3つのモード（rational / forced-pressure / forced-alternative）は相手の3体を変えるだけで、こちらの選出入力（相手公開6）は同一。選出一致の「42」は実質14個の独立入力の3重カウント。
2. **ペナルティ非ゼロは 12/1008 セル**（14構築×こちら6体×Mega有無×相手6）。非ゼロは構築11（Indeedee/Volcarona）と14（Volcarona）のみ。`PROBES` 対象のうち Garchomp(Rock Slide)/Gyarados/Chandelure は我々の6体に対し STAB 基準を超える被害増がなく、Garchomp は 8構築で在籍してもゼロ。
3. **チーム補正は全14構築・全候補で 0。** `Math.min(...three penalty)` が、3体のうち1体でもゼロなら相手ごとの補正を消す。実際に非ゼロの2構築でも各相手に対し必ずゼロのメンバーがいる。→ ゼロ効果の支配的原因は「プローブ対象不足」＋「min による構造的な打ち消し」の両方で、目的関数が選出に効く経路は先発補正のみ。
4. 先発補正が非ゼロなのは構築11の1件のみ（8.3/0/12.5）。ただし先発確率は老版と同一（Tyranitar 1.00。点差が `leadRange` 12 を超える）。
5. 上位2候補の点差は 6〜24 点で候補プールは 1〜4 トリオ（`SAMPLE.range`=20）。ほぼ決定的に選出され、小さな補正では順位が変わらない。
結論：`rational-risk` は実行されたが選出には事実上効いていない。PR #15/#16 の「差分なし」は実装上の必然。

## B. ターン単位監査（`claude-audit-b-turn-logs.js`、ログ要約 JSON 同梱）
再現（12戦、同一シード式）：01×forced-pressure **0/12**、06×forced-pressure 2/12、07×forced-pressure 1/12（報告値の再現）。ただし rational-opponent では 01=8/12、06=3/12、07=6/12 で、「0/12」は固定3体ストレス条件に限る。
代表敗戦（01 seed0/4、06 seed7、07 seed1）の事実：
- Golisopod は初手で Mega 進化（Bug/Steel、Def175/SpD120、特性 Tough Claws）→ こちらの Rotom-Wash（Thunderbolt）は約25〜30%しか削れず、Swords Dance 後に Leech Life で回復しつつ倒される。優先度の Sucker Punch が Metagross を締める。ゲーム処理はShowdownが行っており不正選択エラー0。
- **選出AIの欠陥（確認）**：選出は相手を基底種 Golisopod（Bug/Water）として評価し、Mega後の Bug/Steel（炎4倍・地面2倍）を見ない。Rotom-Wash先発を選びやすい。同じ相手3体・同じ6体で、こちらの3体だけ固定すると：Tyranitar/Hydreigon/Garchomp 5/12、Garchomp/Hydreigon/Tyranitar 3/12、Hydreigon/Garchomp/Primarina 2/12、**Hydreigon/Garchomp/Metagross 0/12（4ターン全敗）**。選出が結果を左右する＝構築に元から対応不能とは言えない。ただし固定条件の勝敗は選出率の根拠にならない。
- **立ち回りの欠陥（確認）**：Hydreigon 先発は Mega前の基底型想定で Draco Meteor を選び、Golisopod に耐えられ返しの Leech Life で落ちる。同じ Hydreigon が後出しで Flamethrower（Mega後は炎4倍）を撃つと1撃で倒す。相手のMega進化を公開情報で予見し切れないため、これは単純な「バグ」ではなく不確実性下の判断問題。
- 「相手が非合理」ではない：相手は強制3体＋v3で、Swords Dance・Sucker Punch・Leech Life と妥当。固定条件が有利すぎる点は「強制圧力3体」であることが原因（rational-opponent では 8/12）。
- エンジン/技評価のバグは今回のログでは確認できず。

## C. 代替案（反証可能・同シード対比較、14構築×3モード×各12戦×4変種＝2016戦、エラー0。`claude-audit-c-alternatives.js`、セル別 JSON 同梱）
- 案1 `rational-foe-mega`（選出）：相手の公開種に Mega 形態がある場合、攻撃値は全形態の min、被害値は max（ミニマックス、重みなし）。
- 案2 `foeMegaHedge`（立ち回り）：相手が登場直後で未行動の間、技評価を全形態の min。

| mode | base | 案1 | 案2 | 案1+案2 |
|---|---|---|---|---|
| rational-opponent | 92/168 | 94 | 90 | 97 |
| forced-pressure | 95/168 | 98 | 95 | 104 |
| forced-alternative | 113/168 | 123 | 113 | 123 |

- 案1：01×forced-pressure は 0→9/12 に改善したが、同じ01の rational-opponent は 8→4/12、06 は 3→11（rational-opponent）と上がる一方 07 は 6→3、03 は 9→7、04×pressure 2→0。**構築別の符号が混在し、総計 +15/504 は個別の符号反転を打ち消せるほど安定していない。採用根拠なし（未確定）**。反証用に 01・07 の rational-opponent で base を下回る点を提示。
- 案2：ほぼ全セルで base と同一（Hydreigon が Draco→Dark Pulse に変わるだけで結果不変）。ミニマックスでは Flamethrower の4倍上振れを選べないため**不採用**。上振れを採るには Mega 保持確率（使用率）が必要で、出所のない数値は作らない。
- 実戦で使える仮説（採用判断ではない）：Mega Golisopod 想定の6では Rotom-Wash 先発より Tyranitar/Hydreigon/Garchomp を検討する価値がある（上記固定条件で 0→5/12）。ただし最終判断はユーザー。

## 未解決・ChatGPTが反証すべき点
1. 案1が rational-opponent で悪化する構築（01, 07, 03）の原因：相手が実際に選ぶ3体（Primarina先発）とミニマックスの目標のずれ。
2. 12戦/セルは信頼区間が広い（±約28pt）。セル単位の差は有意とみなせない。
3. 相手の型・Mega保持は合成仮説。使用率・採用率は未取得。
4. `Math.min` 集約を `mean` に変えると rational-risk が効くか（本PRでは未検証。重みの後付けを避けるため未実施）。
5. ログ比較は B の列挙のみ。`candidateForced` はテスト専用でプレビューAIからは参照されない。

## 変更物
`lab.js`（opt-in: `candidateForced`, `foeMegaHedge`, `rational-foe-mega`）、`preview-foe-mega.js`、`claude-audit-{a,b,c}-*.js`、本ディレクトリ。既定の挙動・mainは未変更。**マージ禁止（ユーザー判断後）**。
