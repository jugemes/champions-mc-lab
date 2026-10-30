# Claude独立監査：PR #80（PR #79反証後）— 方策の同一性・実行方策・左右固定・実戦用 3体＋先発＋T1/T2（2026-10-31）

- 依頼：PR #80 `docs/claude-requests/pr79-policy-cache-and-human-choices-20261031.md`、ChatGPTレビュー #5718315491、Issue #20。
- 基点：PR #79 head `a1996a1`（未マージ。PR #77の上に積まれている）。本PRの**差分は、`a1996a1`より後のコミットだけ**。
  - `6cc82d9`：HX_sandを事前宣言した
  - `575587b`：項目1〜4
  - `8b0df97`：項目5〜7の評価器と、v2探索のデータ
  - その後のコミット：評価データと本レポート
- 環境：Showdown `3a766f2cfb5e51c1e428cfe87d0dba91a8f01640`（読み込んだcheckoutの`git rev-parse HEAD`で確認）、`gen9championsbssregmc`、66P、TeamValidator、Node 22、4 worker。
- 数字はすべて**ヒューリスティックAI同士の結果**であり、**ランク対戦の勝率ではない**。1セル6試合の値は不確実である。
- main・実戦6体・育成・`public-six-preview.js`（PR #77）は変更していない。課金の追加もない。

## 結論（先に）

| 項目 | 結果 |
|---|---|
| P0/P1 1〜4 | **4件とも未修正のPR #79コードで再現した**（下の§1）。修正後は、分離テスト10件と実Battle 2件で検証した |
| 探索の再現 | v2で同じseed・同じparamsの探索をやり直した。**9公開6すべてで、PR #79のraw supportと試合数が完全に一致した** |
| 実行方策のsecurity | 実際にsupportとして出す方策のsecurityは、PR #79の報告値より**0〜0.024低い**（HX_rain 0.209→0.191、HX_gyarados 0.236→0.212、HOLD_psychic 0.550→0.532） |
| 評価（相手の真の型） | 新評価でも `general` の値はPR #79の評価と同じだった（混合の値は変わらない。評価器はもともと再正規化していた） |
| 人間が実行できる単一選出 `human1` | 20仮説の平均勝率は**0.720**。混合は0.656、legacyは0.710。一方、securityが0より大きいのは**20仮説中1つだけ**。0/6になる相手選出は延べ185個で、legacyの199個とほぼ同じである |
| 合理的な相手のT1/T2分岐での最悪値 | 混合 0.343、human1 0.342、top2 0.353、legacy 0.317。いずれかの分岐で0になる仮説の数は、混合2、human1 10、legacy 13 |
| 感度（n1=12、r2=4） | human1の選出は、CでもHX_rainでも**変わらなかった**。混合のsupportは大きく入れ替わり、securityは下がった（C 0.227→0.203、HX_rain 0.191→0.157）。**混合の構成も、securityの数値も安定していない** |
| 実用性 | 新しい公開6の探索には102〜167秒かかる。**見せ合い中には探索しない**ことを既定にした（`allowSearch=false`）。キャッシュが当たらないときは、理由を付けたfallbackを即座に返す |
| 新しい未見holdout（HX_sand） | 探索・評価より前に宣言し、コミットした。混合のsecurityは0.344/0.603。**human1は2仮説とも0**（0/6の相手選出が12個と15個） |

**採否：研究用のopt-inとしてのみ提出する。暫定完成とは主張しない。** 理由は§6に書く。
- 単一選出（human1）は、どの公開6でも最悪の相手選出に0/6で負ける。
- 混合のsecurityは、相手がこちらの混合に最適応答するという仮定の上の数字である。人間の見せ合いで、この保証は実行できない。

新規育成は推奨しない。

## 1. 再現した失敗（未修正のPR #79コード `a1996a1`）

本セッションで実行した結果：

```
F1 wrong sha/format/params accepted: true            // usableSaved({...HX_rain, showdown:'WRONG-SHA', format:'wrong', params:{n1:1}})
F2 level1/IV0 same ownHash: true
F3 HX_rain support mass 0.9507 / HX_gyarados 0.9571
F4 p1 Garchomp/Metagross/Hydreigon 0.0853 / p2 Tyranitar/Primarina/Garchomp 0.1688   // seed [6,1,2,3]
```

ChatGPTの指摘どおりである。
- F3：HX_rainで、Tyranitar>Primarina/Garchompの保存値は0.1605だが、実際に引かれる確率は0.1688である。
- F4：保存済みのHX_rainで、同じseedでも左右で別の選出になる。

## 2. 修正（`public-six-general.js`）

### 1. キャッシュの同一性
`policyIdentity` を次の値で作る。
- version `general-v2`
- 実際に読み込んだエンジンのSHA（`git -C $SHOWDOWN_DIR rev-parse HEAD`）
- format
- code revision：探索とworkerが読み込むrepo内のモジュール（31本）のsha。新しい子プロセスで列挙するので、呼び出し側が何をrequireしていたかに左右されない
- `searchParams`（workersだけを除く）
- `OWN_AI`
- `ownHash`

`cacheCheck` は、一致しない項目を**理由付き**で返す。code revisionの不一致では、どのファイルが違うかも示す。
- 判定対象：保存データの検査、およびプロセス内memoのキー（identity hash）。
- 保存データのsupportの合計が1でない場合も拒否する。
- `searchPublicSix` 自体も、固定SHA以外のエンジンでは実行を拒否する。

### 2. ownHash
`lab.normalize` 後の、実際にシミュレートされる型（Lv50・IV31）をhashする。技の順番もhashに含める（turn AIが技のindexを使うため）。
- 次の入力は**明示的に例外にする**：Lv≠50、IV≠31、シミュレーションで捨てられるフィールド（gender等）。
- 実戦のIVは未確認である。現在の対戦への影響を立証したとは主張しない。

### 3. 実行方策
`emitSupport` の処理：
- pが0.03未満の項目を切る。
- 残りを再正規化し、1e-4に丸める。丸めの残差は最大の項目に寄せる。
- この結果を `support` として保存し、合計を厳密に1にする。

その他の扱い：
- `security`・`securityAll`・`mean` は、このsupportで計算し直す。
- 元の解xの値は `raw.*` に、切り捨てた質量は `raw.droppedMass` に分けて残す。
- 入口が返す `pickProbability` は、保存されたpと一致する（テストあり）。
- 探索内部の拘束セル判定と拡張は、PR #79と同じraw xのままにした。だから探索結果は完全に一致する。

### 4. 左右
- 抽選は既定で左右に依存しない。`sideDependentDraw:true` でPR #79の挙動を再現できる（テストで確認：p1 Garchomp>…、p2 Tyranitar>…）。
- `sideFixedRegression` を追加した。こちらの3体＋先発を**1回だけ**引き、相手の3体＋先発、相手の型、seedを固定したまま、p1とp2の両方で実Battleを行う。
- Monte Carloの方策評価（`public-six-general-eval.js`。選出ごとに左右を固定）とは別に置いた。

### 7. 実用時の動き（`choosePublicSixGeneral`）
次の順に判定する。
1. 同一性の一致した保存データ（`cache:'saved'`）
2. 同じidentityのmemo（`'memo'`）
3. `allowSearch:true` のときだけ、オフラインで探索する（`'searched'`）
4. それ以外は `status:'fallback'`：
   - `public-six-preview.js` を使う（Aは登録行列、それ以外はlegacy chooseThree）
   - `cacheRejected`（拒否理由）、`reason`、`warning`（「legacyはPR #79の18仮説中17でsecurity 0」）を返す
   - **古いキャッシュや別の6体用のキャッシュを黙って使うことはない**

PR #79の `general-v1` 保存ファイルは、入口では拒否される。評価器は、それを過去の方策として評価に使うことはできる（`searchAccepted:false` と記録する）。

## 3. テスト

| 内容 | ファイル |
|---|---|
| 次の誤りで拒否され、理由が返る：SHA誤り、format誤り、params誤り（n1:1）、AI誤り、code誤り（ファイル名つき）、v1。PR #79の正確な反例も含む | `test/pr80-policy-identity.test.js` |
| TINYで探索した後、既定paramsでは**memoを使わずfallback**になる。TINYでの再利用は`memo`、別paramsではfallback | 同上（実際の探索を実行） |
| 同じ入力（並び順が違うだけ）なら再利用する。workers数は同一性に影響しない | 同上 |
| Lv1・IV0・genderは例外。Lv50/IV31を明示した場合は同じhash。技の順番・性格が違えば別のhash | 同上 |
| emitSupportで0.1605/0.9507→0.1688。rawと実行方策で指標が異なる例。入口のpickProbabilityが保存pと一致 | 同上 |
| seed [6,1,2,3] でp1とp2が同じ選出。`sideDependentDraw` でPR #79の左右の値を再現 | 同上 |
| **実Battle**：HX_rain/aで、1回引いた選出を相手のエース先発選出に対して左右で対戦し、両側の先発がログに出ることを確認 | 同上 |
| **実Battle**：utility分岐で相手がStealth Rockを要求し、それがエンジンで実行される | 同上 |
| PR #79の既存テスト2件は、新しいidentityに合わせて更新した（意味は保持） | `test/pr78-general-public-six.test.js` |

- `npm test`：186件中 **179 pass・0 fail・7 todo**（todoは既存の7件）。所要47秒。
- `npm run check`：**LEGALITY CHECK PASSED: 12 teams**。
- HX_sandの2仮説はTeamValidatorで合法。dev/holdoutの公開6とは重ならない。

## 4. 評価（項目6）：同じ相手選出・同じ型・同じseed・左右両方

- 対象：dev 12仮説、holdout 6仮説、HX_sand 2仮説。
- 相手は60選出すべて。各セルは3seed×左右＝6試合。
- 加えて、PR #77の相手視点の選出（legacyとエース先発）を、5分岐（ai/attack/setup/switch/**utility**）で対戦させた。
- 要求した行動とエンジンの実行ログの照合：**全20仮説でmismatch 0**。
- 例外：A/H1でforcedOutが188（ききかいひ）。

`human1`（探索の`pure[0]`）と`top2`（実行supportの上位2つ）のルールは、評価を実行する前にコミットした（`8b0df97`）。

| 方策 | sec>0 | 平均 | ace被覆 | 0/6の相手選出（延べ） | 合理的分岐の最悪値（平均） | 合理的分岐で0になる仮説 |
|---|---|---|---|---|---|---|
| general（混合） | 19/20 | 0.656 | 0.643 | 1 | 0.343 | 2 |
| **human1（単一）** | 1/20 | **0.720** | 0.701 | 185 | 0.342 | 10 |
| top2 | 8/20 | 0.679 | 0.668 | 59 | 0.353 | 9 |
| legacy fallback | 1/20 | 0.710 | 0.711 | 199 | 0.317 | 13 |

- human1の平均は、20仮説中15で混合を上回った。
- **単一選出は、相手が60選出の中から最適応答すれば必ず0になる**（例外はIndeedee/scarfの0.333だけ）。人間の相手が最適応答するとは限らない。ただ、こちらの選出が固定されていれば、それを読まれる危険はある。

### 不一致タグ（v3、分岐試合）

| 方策 | 分岐試合 | 相手の不一致 | 自分の不一致 |
|---|---|---|---|
| general | 8820 | 2065 | 2019 |
| human1 | 1110 | 300 | 138 |

### 感度（`pr80-sensitivity.js`、n1=12・r2=4、153〜184秒）

| 公開6 | 既定のsec | 感度のsec | human1 |
|---|---|---|---|
| C | 0.227 | 0.203 | 不変 |
| HX_rain | 0.191 | 0.157 | 不変 |

- 混合のsupportの上位は入れ替わった。
  - C：Garchomp>Metagross/Primarinaが1位になった。
  - HX_rain：Primarina>Metagross/HydreigonとTyranitar>Metagross/Hydreigonが上位になった。
- PR #79のHX_rainの最大項目Tyranitar>Primarina/Garchompは、HX_rain/aで平均0.222である。最大の確率を持つ選出が、実際には弱い選出だったことになる。
- **n1=8・1試合スクリーンの混合は、seedに敏感である。** 単一の推奨（human1）のほうが安定している。

## 5. 実戦用の具体案（項目5）：3体＋先発、条件付きT1/T2

全表：`reports/data/pr80-decision-trees.md`（JSONは`.json`）。

- 「こちらT1/T2」は、こちらのturn AIがエンジン上で実際に行った行動の最頻値である。
- 条件として使うのは、T1の時点で見える相手の先発と、T2の前に見える相手のT1行動だけである。
- 相手の3体は、相手視点で選んだlegacy選出とエース先発選出である（PR #77）。
- 相手の型は評価用の仮説で、選出の時点では参照していない。
- **合計の数字は、相手視点の2選出×5分岐だけの値である。60選出全体の最悪値ではない。**

| 公開6 | human1（先発>裏） | 相手視点の合計 | 主な負け筋（エンジンのログ） |
|---|---|---|---|
| A | Primarina>Garchomp/Rotom-Wash | 94/180 | 相手もPrimarina先発でMoonblastの撃ち合いになり1/6。エース先発のMega Golisopodが剣舞→こちらはT2にアンコールしたが6/12 |
| B | Rotom-Wash>Metagross/Garchomp | 109/120 | 相手Primarina先発のattack分岐で2/12（ロトム10万→Moonblastで落ちる） |
| C（Y/X） | Rotom-Wash>Metagross/Garchomp | 88/120 | 相手legacy（Baxcalibur先発）がT1にGarchompへ交代し、こちらはMetagrossへ交代、そこへEarthquakeで**0/12**。エース先発Mega Charizardのattack（Earthquake）で6/12 |
| Indeedee | Rotom-Wash>Primarina/Garchomp | 178/180 | Indeedee Trickのutility分岐で10/12 |
| E | Rotom-Wash>Metagross/Garchomp | 56/120 | **エース先発Mega Charizard YのSolar BeamでRotomが落ちる**（setup 0/12、attack 1/12）。回答はない |
| HX_rain | Garchomp>Metagross/Hydreigon | 60/120 | エース先発Swampertのattack（Earthquake）で**0/12** |
| HX_gyarados | Primarina>Metagross/Hydreigon | 110/120 | T1にGholdengoへ交代され、Thunderboltで0/6 |
| HOLD_psychic | Rotom-Wash>Garchomp/Tyranitar | 52/60 | Mega AlakazamのExpanding Force→Tyranitarに交代、で4/6 |
| HOLD_sun | Rotom-Wash>Metagross/Garchomp | 20/30 | Mega Charizard Yの**Roost（utility分岐）**で2/6 |
| HX_sand（未見） | Hydreigon>Garchomp/Rotom-Wash | 60/60 | 相手視点の2選出には全勝した。ただし60選出全体ではsecurity 0（0/6の選出が12個と15個）。合理的と見た2選出の外に穴がある |

**人間が使う場合の注意：**
- E・HX_rain・Cでは、human1のまま採用できない。相手のエース先発（リザY／スワンプート）、またはT1交代の一手で崩れる。
- これらの公開6で使う場合は、「相手が出しうる先発の中に、こちらの先発を一撃で落とすものがいないか」を先に確認する。その上で次のどちらかを取る。
  - 混合のsupportのうち、この相手先発に強い選出へ寄せる。
  - legacyと比べる。
- これは方策を変えずに、表から読み取れる範囲の助言である。新しい方策としては検証していない。

## 6. 暫定完成としない理由と、残るTODO/P0

1. **P0**：単一選出の最悪値は、Indeedee/scarfを除くすべてで0である。混合のsecurityは、相手が混合に最適応答するという仮定の上の値である。人間の見せ合いで、この保証は実行できない。
2. **P0**：E（リザY先発）とHX_rain（スワンプート先発）では、human1が相手のエース先発に0〜1/12で負ける。
3. **P1**：混合はseedやn1に敏感である（§4の感度）。1試合のスクリーンでは候補を落としている可能性がある。
4. **P1**：探索には102〜167秒かかる。オフラインで作ったキャッシュがない公開6では、legacyにfallbackする。
   - fallbackはsecurity 0で、legacyと同等である。
   - **未見の公開6に対して、即時に使える頑健な方策はまだない。**
5. **P1**：utility分岐はT1/T2に限られる。相手のT3以降はbase AIのままである。
6. **P2**：`public-six-preview.js`（PR #77、Aの登録行列）は、ownHashに同じ欠陥（Lv/IVを見ない）がある。抽選も左右依存のままである。本PRの対象外なので変更していない。
7. **範囲外**：ユーザーゲート（a）〜（d）は満たしていない。ChatGPTの独立レビューも未了である。

## 7. ChatGPTに反証してほしい点

- `codeRevision` が、探索に影響するモジュールをすべて覆っているか。子プロセスでrequireしてファイルを列挙する方式に、漏れがないか。
- 探索内部の拘束セルの判定と拡張を、raw xのまま残したことの是非。実行方策で判定し直すと、探索結果が変わる。
- human1（`pure[0]`）は、探索のセル上の最悪シナリオ平均で選んでいる。これを「人間向け」と呼んでよいか。代わりに、エース先発への勝率を制約にして選ぶべきか。
- HX_sandで、相手視点の2選出には60/60だったのに、60選出全体では0/6の選出が12〜15個あった。この差は、相手視点の選出モデル（legacyとエース先発）が弱いことを示していないか。
- E/HX_rainでhuman1が負けた件：Rotom-Wash先発 対 Mega Charizard YのSolar Beam、Garchomp先発 対 SwampertのEarthquake。これはturn AIの判断の問題か（交代しない、など）、それとも選出の問題か。

## 再現コマンド

```
export SHOWDOWN_DIR=<pinned 3a766f2c checkout, built>
npm test && npm run check
WORKERS=4 CASES=A_golisopod,B_lucarioZ,C_charizardY,Real_indeedee_scarf,NEW_realE_sun OUT=reports/data/pr80-search-dev-v2.json node public-six-general.js
WORKERS=4 HOLDOUT=1 CASES=HX_rain,HX_gyarados,HOLD_psychic_offense,HOLD_sun_balance OUT=reports/data/pr80-search-holdout-v2.json node public-six-general.js
WORKERS=4 HOLDOUT_PR80=1 CASES=HX_sand OUT=reports/data/pr80-search-hxsand-v2.json node public-six-general.js
SET=dev SEARCH=reports/data/pr80-search-dev-v2.json OUT=reports/data/pr80-eval-dev-v2.json node public-six-general-eval.js   # holdout / pr80 similarly
EVALS=reports/data/pr80-eval-dev-v2.json,reports/data/pr80-eval-holdout-v2.json,reports/data/pr80-eval-hxsand-v2.json OUT=reports/data/pr80-decision-trees node pr80-decision-trees.js
node pr80-sensitivity.js
```

- 評価器を `EVAL_BRANCHES=ai,attack,setup,switch` で実行すると、PR #79の分岐集合になる。
- 保存済みの `general-v1` 探索ファイルは変更していないので、PR #79の結果はそのまま再現できる。
