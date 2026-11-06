# PR #88 依頼：DEV/FINAL非重複（P0-1）と公開6→3+初手（P0-2）— Claude独立成果（NOT READY）

依頼書：`docs/claude-requests/pr87-disjoint-final-and-public-six-selection-20261031.md`（PR #88）
起点：PR #87 head `d7c152f`（#87以前は未マージstack）。固定Showdown `3a766f2cfb5e51c1e428cfe87d0dba91a8f01640`、`gen9championsbssregmc`、こちらは `reportedLive`（現行実戦6体、変更なし）。
**AI同士の合成戦。対人勝率ではない。研究用ランク候補の暫定完成は宣言しない。**

## 作業順（コミット順）
1. `32e3c74` **戦闘前に宣言**：`holdout-20261031-pr88.js` — FINAL2 seed（8680000+）、新しい未見公開6を3つ（F1 Gallade / F2 Feraligatr / F3 Glimmora、各a=エースMega・b=Megaなし、全種がリポジトリ内の他 `*.js` に未登場＝テストで確認）、相手視点の合理的3+先発セル規則（legacy / view1 / view2 / aceLead / aceBack）、選出FINAL seed 8690000+、選出DEV seed 8710000+。
2. `86b5fde` P0-1修正＋FINAL2を1回実行／選出器を DEV で開発し凍結。
3. 選出 FINAL を1回実行（凍結後）。本報告。

## P0-1 DEV/FINAL重複（ChatGPT反証を再現・修正）
- **再現**：`pr86-eval.js` の旧経路（`PR86_BUG=1`）は保存済み PR #86 の DEV/FINAL セルを22/22仮説で完全再現し、`HX_sand/a | Rotom-Heat/Excadrill/Kingambit` が DEV `lead3` と FINAL `aceBack2` に重複することを `assertDisjoint` が検出（テスト内で throw を確認）。
- **修正**：`buildMeta` / `phaseCells` / `assertDisjoint` を `pr86-eval.js` から export。**eval とテストが同じ関数を通る**。FINAL の `used` に DEV セルを追加し、各 `仮説|相手3体（先発順）` で train/test・PR #85 holdout・DEV・FINAL の重複ゼロを**戦闘前にassert**。
- 影響：FINALセルが変わったのは2仮説のみ（`HX_sand/a` aceBack2 → `Hippowdon/Excadrill/Sylveon`、`HOLD_sun_balance/case` aceBack2 → `Eelektross/Charizard/Toxapex`。後者は重複ではなく、DEVセルを `used` に入れたことでハッシュ順位がずれたため）。
- **FINAL2（新seed `hashSeed(8680000+ci*100+{0,1})`・左右・6分岐、5,280戦、1回のみ）**。凍結ゲートは PR #86 のまま `loco_t2`（再選択していない）：

| ゲート | rational 22仮説平均 | abstain比 worse/better | 対の反転 | 発動 |
|---|---|---|---|---|
| abstain | 0.690 | – | – | 0 |
| **loco_t2（凍結）** | **0.690** | 0/0 | 0/0 | **0** |
| v3 | 0.732 | 1/5 | +49/−21 | 418 |
| t2only | 0.698 | 0/2 | +10/−3 | 58 |

  凍結ゲートは再び発動0（素AIと同一）。V3は今回＋だが、PR #85 holdout −、PR #86 DEV −、PR #86 FINAL ＋、FINAL2 ＋ と符号が揺れており、**FINAL2を見てゲートを差し替えることはしない**（事後選択になるため）。
- FINAL2 でも低い：A/H0 0.075、A/H2 0.15、A/H1 0.20、C/X 0.05、C/Y 0.10。→ T1/T2 ではなく**選出（human1）の問題**。

## P0-2 公開6のみの3体＋先発（`pr88-guarded-preview.js`、研究opt-in、未採用）
入力は**相手の公開6体の種族名（文字列）だけ**（オブジェクトなどは throw、テストあり）。隠れた3体・技・道具・結果は渡さない。
1. `searchPublicSix` を MED 設定で実行（公開種族の合法ロールテンプレート4シナリオ、相手視点セル＋全メンバー先発、相手T1分岐 ai/attack）。
2. **guard**：候補＝legacy `chooseThree` の選出＋探索の上位3（worst-scenario順）。全候補を**同じセル×相手分岐 ai/attack/setup/switch×2seed×左右交互**で再試合（対の比較）。
3. **legacyを置き換えるのは、候補の worst-scenario 平均が legacy＋0.10 以上かつ平均が legacy−0.02 以上の場合だけ**。それ以外は legacy 維持。予算超過時は `abstain`（legacy）を返し「安全」とは呼ばない。
4. **DEV で追加（FINAL前）**：ロールテンプレートは各種族を atk≧spa の1カテゴリでしか作らないため、特殊型 Kommo-o（U1/a）が探索に存在せず、DEV v1 で guard が legacy 0.90 → 0.38 に**回帰**させた。対策：低い方の攻撃種族値が高い方の 0.85 以上の種族ごとに、もう一方のカテゴリの攻撃型を1シナリオ追加（TeamValidator確認、相手視点セル）。
- 実測時間：1公開6あたり **25〜37秒**（4 workers、探索約2,000〜3,000戦＋guard約600〜1,300戦）。quick は 9〜12秒。

### DEV（既知・既見の公開6：A/B/C＋PR #86 U1/U2/U3。もう未見ではない。seed 8710000+、3,360戦）
相手3+先発は `rationalCells`（相手自身の型で我々の公開6を見た legacy/view1/view2/aceLead/aceBack）、6分岐、2seed×左右。数値は rational 平均（utility分岐とT1/T2非合理補助技の試合を除外）。

| 仮説 | legacy | quick | **guarded** | human1（保存済み全探索） |
|---|---|---|---|---|
| A/H0 | 0.100 | 0.400 | **0.350** | 0.400 |
| A/H1 | 0.512 | 0.325 | **0.925** | 0.325 |
| A/H2 | 0.175 | 0.400 | **0.450** | 0.400 |
| B/case | 0.275 | 0.975 | **0.975** | 0.975 |
| B/B2 | 0.375 | 0.975 | **0.975** | 0.975 |
| C/Y | 0.700 | 0.725 | **0.750** | 0.275 |
| C/X | 0.375 | 0.700 | **0.750** | 0.175 |
| U1/a | 0.900 | 0.780 | **0.900**（v1は0.380） | – |
| U1/b | 0.975 | 0.800 | **0.975** | – |
| U2/a | 0.800 | 1.000 | **1.000** | – |
| U2/b | 0.900 | 1.000 | **1.000** | – |
| U3/a,b | 0.925 / 1.0 | 0.925 / 1.0 | 0.925 / 1.0 | – |
| **平均** | 0.616 | 0.770 | **0.844** | 0.504（7仮説） |

DEV v1（alt-categoryなし）は `reports/data/pr88-selection-dev-v1.json` に保存（平均 0.804、U1/a 0.38）。

### FINAL（新しい未見公開6、選出器凍結後に1回のみ、seed 8690000+、1,704戦）

| 仮説 | legacy | quick | **guarded** | guarded の選出 |
|---|---|---|---|---|
| F1 Gallade/a | 0.120 | 0.990 | **0.990** | Primarina>Metagross/Tyranitar |
| F1 Gallade/b | 0.360 | 1.000 | **1.000** | 同上 |
| F2 Feraligatr/a | 0.400 | 0.550 | **0.550** | Primarina>Metagross/Hydreigon |
| F2 Feraligatr/b | 0.750 | 1.000 | **1.000** | 同上 |
| F3 Glimmora/a | 0.775 | **1.000** | 0.775 | legacy維持 Primarina>Garchomp/Hydreigon |
| F3 Glimmora/b | 1.000 | 1.000 | 1.000 | 同上 |
| **平均** | 0.568 | **0.923** | 0.886 | |
| worst cell 平均 | 0.267 | 0.858 | 0.742 | |

- guarded は FINAL・DEV とも**legacy より悪化した仮説 0**。ただし FINAL では quick の方が高い（F3/a で guard が legacy を残し −0.225）。DEV では逆（U1 で quick が −0.12〜−0.18 回帰）。**どちらが良いかは本サンプルから決められない。**
- 0勝セル×分岐（rational前）：FINAL legacy 66、quick 11、guarded 14／DEV legacy 90、quick 43、guarded 36、human1 55（7仮説）。

## 必ず提示する最悪対面（実Battleログは JSON の `logs`、ai分岐 seed0 左右）
- **A/H0（guarded 0.35）**：Metagross>Garchomp/Rotom-Wash vs `Primarina>Garchomp/Golisopod`（view1）0.0、`Golisopod` 先発（aceLead）0.0。T1 メガメタグロス Thunder Punch → Primarina Sparkling Aria、Garchomp 交代から Earthquake。A は全方針で 0.35〜0.45 程度（H1除く）。**未解決。**
- **C/X（guarded 0.75）**：Primarina>Metagross/Garchomp vs `Baxcalibur>Primarina/Gholdengo`（view1）で負け。Baxcalibur Earthquake 連打に Primarina Moonblast 撃ち合い負け。
- **U2/a**：legacy 0.80（Aerodactyl先発 Stealth Rock→Goodra 交代）→ guarded 1.00。
- **U1/a 回帰**：v1 guarded 0.38（Rotom-Wash 先発が特殊 Kommo-o の Clanging Scales 2発で落ちる、T1 Will-O-Wisp は特殊型に無意味）。v2 は legacy 維持で 0.90。それでも legacy 自体が view1 `Kommo-o>Gliscor/Milotic` で 0.6。
- **F2/a（全方針 ≤0.55）**：`Hatterene>Infernape/Feraligatr` などで Metagross が Mega Feraligatr（Dragonize）の竜舞を止められない。メガフェラルの対策が現6体の選出だけでは不十分。

## 合法性・テスト
- `npm test`：213件 pass 206 / fail 0 / todo 7（既存TODO 7件のまま）。新規 `test/pr88.test.js` 4件。
- `npm run check`：12 teams LEGALITY PASSED。新未見6（6仮説）・alt-categoryシナリオは TeamValidator 通過。
- 非公開情報：選出器の引数は公開6文字列のみ（throwテスト）。相手セルは相手自身の型（相手が知る情報）で我々の公開6に対して作成。

## 精度境界・未実施
- 未見6は手書き構築（使用率重みなし）。quick/guarded の高い数値は**相手AIと手書き型の弱さ**を含む可能性。
- alt-category は DEV（U1/a）を見て追加した。FINAL前に凍結したが、DEV への適合を含む。
- guard の 0.10 マージンは事前値。チューニングしていない。
- Pain Split V2 の utilityAudit 配線は**未実施**（P1）。強制交代・Encore・Choice 等の既存回帰はテストで維持。
- rational 指標は「utility分岐と非合理補助技の除外」のみ。不利なエース不選出などの判定は未実装。

## 判定：NOT READY
- P0-1：修正・assert・FINAL2 完了。凍結ゲートは引き続き発動0で、**T1/T2 改善の証拠はない**。
- P0-2：guarded は legacy・human1 比で DEV/FINAL とも改善し、legacy 比の回帰0。しかし A（0.35〜0.45）・F2/a（0.55）・C/X 0.75 が残り、FINAL で quick に劣る仮説がある。**実戦既定にする根拠はまだない**。
- 現行6体・育成・main は変更なし。新規育成の推奨なし。
