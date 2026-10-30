# Claude｜合法4技仮説×固定Showdown短期分岐の選出AI `legal-search`（opt-in）とPR #63監査（発注PR #64 / Issue #20）2026-10-30

**結論：不採用。研究基盤（仮説生成・短期分岐・比較ハーネス）としてのみ提出する。**
- PR #63の`shortlist→上位4技組`方式には、構造上の欠陥が3つある（§1）。代わりに、公開種族名だけから**役割別の一貫した完全セット**を作る`legal-role-hypotheses.js`を実装した。固定TeamValidatorに加えて、Validatorが見ない整合性も検査する。
- その仮説を使い、固定Showdownで3ターンの短期分岐（相手T1：ターンAI／最大打点／積み／最善の受け出し）を実際に打たせる選出AI `legal-search`を実装した。**全体として既存AIを上回らない。** さらに**選出が seed と仮説生成の小変更で入れ替わる**（§4）。シードを1つ替えるだけで1位が変わり、1位と2位のスコア差は0.00〜0.05である。現在の評価はノイズに支配されている。
- 比較はAI対AIの数字であり、両者baselineターンAIの結果である。**対人勝率ではない。** main・実戦L6体・legacy/strategic・Showdown pinは変更していない。

## 0. 再現条件
- Showdown `3a766f2cfb5e51c1e428cfe87d0dba91a8f01640`（ローカルでbuild）、`gen9championsbssregmc`、Node 22.22.0。
- 自分側：`reported-live-roster-20261027.js`。
- 相手側：
  - `environment-m7-teams.js`と`holdout-20261030.js`は、PR #62と同一の内容をそのままコピーした。
  - **新holdout** `holdout-20261030-claude.js`は実戦反例Eの公開6体（ライチュウ/マスカーニャ/リザードン/ガブリアス/イダイトウ/アーマーガア）。セットは**手書きの合法仮説**であり、legal-searchを走らせる前に作成した。生成器の出力ではない（テストで確認済み）。
- `SHOWDOWN_DIR=... node legal-search-compare.js`（約2分）→ `reports/data/legal-search-compare-20261030.json`（150KB、失敗seed一覧と負けたセルごとのT1〜T3ログ付き）。
- `SHOWDOWN_DIR=... node legal-search-stability.js`（約4分）→ `reports/data/legal-search-stability-20261030.json`。
- 各セルは3 seed base（7400000/7500000/7600000）×2×左右反転の12戦。同じseedを全方式で共有するので、**同じ3体を選んだ方式どうしは同じ試合を共有しており、独立な標本ではない**。

## 1. PR #63の独立監査（固定Showdownで実行）
| 検査 | 結果 |
|---|---|
| CI #41038350763 | success（ただしテストは「合法な4技が出る」ことしか見ていない） |
| `validateSet`の能力P | Champions上限を正しく検出する。67合計、A33、SV式252はすべて拒否される |
| `validateSet`の道具/メガ | **ガブリアス＋リザードナイトYを合法と判定する。** メガ石と種族の整合はValidatorでは保証されない → `coherenceProblems`を別途実装し、テストで固定した |
| 拒否数 | 調べた15種すべてで`rejected:{}`だった。習得プールの段階で合法なので、Validatorは**フィルタとして機能していない** |
| `shortlist`と上位4技組 | 技スコアの和の上位24組には、つるぎのまいがガブ・グソクで**0/24**、はねやすめがガア **0/24**、なまけるがカバ **0/24**、まもるが**全種で0**しか入らない。代わりにはかいこうせん/ギガインパクト/とっておき/みらいよち/はやてがえし（Upper Hand）が枠を埋める |
| 型の一貫性 | 性格・能力Pが固定（Adamant/A32S32/Sitrus）なので、特殊型メガYにも物理補正がかかり、フレアドライブとブラストバーンが混在する。スカーフと積み技の混在も弾かない |

## 2. 実装
- `legal-role-hypotheses.js`：公開種族名を入力に、役割ごとの完全セット（attacker / setup / scarf / bulky(S0) / lead）を作る。メガ石は種族と一致するものだけを使う（例：リザX/Y、ガブ通常/Z、ルカ通常/Z）。
  - 技は全習得プールから選ぶ。STABの後、18タイプへの被覆を貪欲に足す。条件付き・非実用な技（溜め/反動/とっておき等）は除外する。
  - 各セットに`provenance`（出典＝公開習得技＋役割テンプレート、**使用率ではない**）と`problems`を付ける。
  - チーム仮説`rivalScenario(k)`は**1種族1セットに固定**し、分岐中に変えない。アイテム条項の衝突時は、その種族の次の完全仮説を採る（スカーフ技構成のまま持ち物だけ残飯に替える、ということはしない）。
- `preview-legal-search.js`：入力は「自分の6セット（既知）」と「相手の**種族名6つ**」だけ。オブジェクトを渡すと拒否する。
  - 相手の候補3体は、相手視点（相手仮説セット vs こちらの公開種族名）で選ぶ。相手のlegacy選出、上位2組、各種族を含む最良3体（エースを落とさない）を集め、v2では各3体の全員を先発候補にする。
  - 自分は上位6組×先発3通り。各セルを固定Showdownで3ターン打ち、相手は最も有利な分岐を採ると仮定する。スコアは`0.5·最悪セル＋0.5·平均`。
- `legal-search-compare.js`：legacy / strategic / legal-search-v1（相手先発1通り）/ legal-search（全先発）の選出を、各ケースの実際の仮説セットに対してフル試合で比較する。相手はforcedA・forcedB・相手自身のlegacy選出の3通り。
  - 各試合に**ターンAIのプレミ**タグを付ける：同じポケモンの積み技3連打、アンコール連打、こだわり固定で無効技を連打。プレミ込みの勝利は分けて表示する。

## 3. 比較表（AI対AI、各セル12戦、mis＝相手のプレミが出た試合での勝利数）
|case|policy|three (lead first)|forcedA|forcedB|rival own preview|total|wins w/o rival misplay|
|---|---|---|---|---|---|---|---|
|A_golisopod|legacy|Hydreigon/Primarina/Metagross|10/12 (10 mis)|5/12|0/12|15/36|5/24|
|A_golisopod|strategic|Primarina/Metagross/Garchomp|12/12 (12 mis)|12/12|6/12|30/36|18/24|
|A_golisopod|legal-search-v1|Primarina/Metagross/Rotom-Wash|12/12 (12 mis)|8/12|6/12 (5 mis)|26/36|9/19|
|A_golisopod|legal-search|Garchomp/Primarina/Rotom-Wash|0/12|0/12|0/12|0/36|0/20|
|B_lucarioZ|legacy|Garchomp/Hydreigon/Metagross|11/12 (2 mis)|2/12|0/12|13/36|11/34|
|B_lucarioZ|strategic|Garchomp/Metagross/Hydreigon|11/12 (2 mis)|2/12|0/12|13/36|11/34|
|B_lucarioZ|legal-search-v1|Primarina/Metagross/Garchomp|11/12|2/12|0/12|13/36|13/36|
|B_lucarioZ|legal-search|Primarina/Garchomp/Rotom-Wash|6/12|2/12|7/12 (6 mis)|15/36|9/30|
|C_charizardY|legacy|Tyranitar/Hydreigon/Metagross|10/12|12/12|0/12|22/36|22/36|
|C_charizardY|strategic|Tyranitar/Metagross/Hydreigon|10/12|12/12|0/12|22/36|22/36|
|C_charizardY|legal-search-v1|Tyranitar/Metagross/Rotom-Wash|10/12 (10 mis)|8/12|10/12 (10 mis)|28/36|8/12|
|C_charizardY|legal-search|Hydreigon/Primarina/Tyranitar|4/12|2/12|3/12|9/36|9/36|
|C_charizardX|legacy|Tyranitar/Hydreigon/Metagross|12/12|12/12|0/12|24/36|24/36|
|C_charizardX|strategic|Tyranitar/Hydreigon/Garchomp|12/12|4/12|0/12|16/36|16/36|
|C_charizardX|legal-search-v1|Tyranitar/Metagross/Rotom-Wash|10/12|6/12|10/12 (10 mis)|26/36|16/18|
|C_charizardX|legal-search|Tyranitar/Metagross/Rotom-Wash|10/12|6/12|10/12 (10 mis)|26/36|16/18|
|Real_indeedee_scarf|legacy|Garchomp/Primarina/Rotom-Wash|12/12|12/12 (2 mis)|12/12 (2 mis)|36/36|32/32|
|Real_indeedee_scarf|strategic|Garchomp/Primarina/Rotom-Wash|12/12|12/12 (2 mis)|12/12 (2 mis)|36/36|32/32|
|Real_indeedee_scarf|legal-search-v1|Rotom-Wash/Primarina/Tyranitar|12/12|12/12 (2 mis)|12/12 (4 mis)|36/36|30/30|
|Real_indeedee_scarf|legal-search|Primarina/Metagross/Garchomp|12/12|0/12|12/12|24/36|24/36|
|Real_indeedee_sash|legacy|Garchomp/Primarina/Rotom-Wash|12/12 (12 mis)|12/12 (8 mis)|10/12|34/36|14/16|
|Real_indeedee_sash|strategic|Tyranitar/Metagross/Primarina|0/12|10/12|6/12|16/36|16/36|
|Real_indeedee_sash|legal-search-v1|Primarina/Metagross/Garchomp|10/12 (8 mis)|2/12|12/12|24/36|16/28|
|Real_indeedee_sash|legal-search|Primarina/Metagross/Garchomp|10/12 (8 mis)|2/12|12/12|24/36|16/28|
|NEW_realE_sun **holdout**|legacy|Tyranitar/Garchomp/Primarina|12/12 (2 mis)|2/12|2/12|16/36|14/34|
|NEW_realE_sun **holdout**|strategic|Tyranitar/Primarina/Garchomp|12/12 (6 mis)|2/12|2/12|16/36|10/30|
|NEW_realE_sun **holdout**|legal-search-v1|Garchomp/Primarina/Rotom-Wash|12/12 (12 mis)|12/12|0/12|24/36|12/24|
|NEW_realE_sun **holdout**|legal-search|Rotom-Wash/Garchomp/Tyranitar|12/12|12/12|0/12|24/36|24/24|

ケースごとの「相手自身のlegacy選出」：
- A：アシレ/ガブ/サーフゴー
- B：アシレ/ガブ/ルカ
- C：セグレイブ/アシレ/ガブ
- イエッサン-スカーフ：カバ/ガブ/イエッサン
- イエッサン-タスキ：ガブ/ゲンガー/ブラッキー
- E：ガブ/マスカーニャ/アーマーガア

**読み方**
- A：forcedA（メガグソク）でlegacy・strategic・v1が得た勝利は**全数がグソクのSD連打プレミ込み**。「A対策成功」とは評価できない。
- E（新holdout）：legal-searchのforcedA 12/12はプレミなしである。ただし相手自身の選出（ガブ/マスカ/ガア）には**全方式が0〜2/12**。Eで負けたこと自体はまだ再現していない。
- C：XとYは公開情報が同一（リザードン）なので、legal-searchは同じ選出になる（隠れ情報を見ていない証拠）。CXのv1/v2の勝利のうち、相手legacy選出で10/12はプレミ込み。
- イエッサン：スカーフとタスキは同じ公開6体なので、legal-searchの選出は同一。スカーフ版でforcedB（ギャラ/カバ/ブラッキー）に**0/12**。legacyは12/12。

## 4. 不採用の根拠（反例）
1. **不安定**：seedBaseだけを替えると、Aでは「ガブ/アシレ/ロトム」と「アシレ/メタ/ロトム」の間で選出が反転する。Eでも1位が入れ替わる。1位と2位の差は0.00〜0.05。
2. **仮説生成の小変更に過敏**：アイテム条項の処理順を直しただけで、Aの選出が「アシレ/メタ/ガブ（30/36）」から「ガブ/アシレ/ロトム（**0/36**）」に変わった。
   - 敗北ログ（seed 24607-37498-61142-45282）：スカーフガブ先発 vs メガグソク。T1でこちらはいわなだれを選び、相手はSDを積む。T2もいわなだれ、相手はきゅうけつで、ガブが倒れる。
   - 短期分岐側では、シナリオ0のグソクに**SDのないattacker型**が割り当てられていた。そのため、この負け筋がスコアに入らなかった。
3. **3ターンのHP差**は、Mega X/DDなど4ターン目以降に効く積みと、裏の一貫性を測れない。ブースト0.08/段は根拠のない係数である。
4. こちらのターンAI自体にも、スカーフ固定の無理な技選択やWoW連打がある。先発評価にはターンAIの質が混入する。

## 5. テスト
`test/legal-role-hypotheses.test.js`（8件、npm test 98 pass / 0 fail、`npm run check` 合格）：
- ValidatorがメガYをガブに通してしまう反例を固定し、coherenceで検出できることを確認する。
- 18種すべての仮説が4つの異なる技・公開プール内・Validator合格・整合性合格であることを確認する。
- PR #63で消えていた戦術（スカーフガブ、SD、グソクのSD＋ふいうち、ガアのはねやすめ、カバのなまける、イエッサンのねこだまし、リザX/Y、ルカZ、S0/S32）がすべて表現されていることを確認する。
- アイテム条項の下でもセットが分解されないこと、チームとして合法であることを確認する。
- 短期分岐で、強制した相手T1行動（SD、交代）が実際にShowdownのログに出ることを確認する。
- 実セットが違っても公開種族が同じなら、選出とスコアが完全一致すること（隠れ情報の非参照）を確認する。
- プレミタグ検出の単体テスト。

## 6. ChatGPTが反証すべき点
- 役割テンプレートの技選択（貪欲被覆）は実戦型と一致しない。例：メガYはソーラービームではなくねっさのだいちを選び、ガブスカーフにはいわなだれが入らない。**実使用率による重み付けは未実装**であり、出所のある型分布で置き換えるべきかどうか。
- プレミタグは3種類だけである。こちら側のプレミや、交代読みの失敗は検出していない。
- 比較の独立標本数は小さい（同じ3体＝同じ試合）。7ケースのうち4つ（A/B/C/イエッサン）は、過去サイクルで繰り返し見たケースである。
- 次に試すべきこと：短期分岐の数（seed×分岐）を増やして順位の信頼区間を出し、差が区間内なら既存AIを維持する。終局評価を「HP差」から「その盤面からのターンAIプレイアウト複数seed勝率」に替えるかどうか。

## 7. 育成への影響
なし。新規育成の推奨はしない。
