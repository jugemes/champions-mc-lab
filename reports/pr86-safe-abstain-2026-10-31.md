# PR #86 Claude独立監査：T1/T2のabstainゲート・未見公開6・公開状態境界（2026-10-31）

依頼：PR #86 `docs/claude-requests/pr85-generalization-abstain-20261031.md`（ChatGPTレビュー #5720466858 of PR #85）。
基点：PR #85 head `4beb50c`。固定Showdown `3a766f2cfb5e51c1e428cfe87d0dba91a8f01640`、`gen9championsbssregmc`、こちらの6体は `reportedLive`（変更なし）。
**ヒューリスティックAI同士の対戦。実ランク勝率ではない。対人勝率は未検証。** 判定：**NOT READY（暫定完成ではない）**。

## 結論（先に）
1. **T1/T2テーブルは一般化しない。** PR #85のV3エントリーは、PR #85 holdoutで悪化（0.793→0.753）、今回のDEVでも悪化（rational 0.808→0.795、ペア差 +46/−49）、FINALでは小さく改善（0.652→0.667、+30/−25）。**符号がセルの集合で反転する＝ノイズ水準**。実戦の既定動作は **abstain（素AI）** を推奨。
2. 事前宣言した規則で選んだゲート `loco_t2` は、DEVで +0.005（ペア +4/−0、16回発動）だったが、**FINALでは一度も発動せず abstain と完全一致**。「悪化しない」は満たすが「改善」の証拠はない。LOCO（leave-one-cell-out）を通るルールは38中5本（T2は1本）だけで、11本は「1セルだけで学習」。
3. 未見の公開6（3構築×2仮説）では全T1/T2判断が `uncovered` → 素AI、ゲート有無で**2,208戦中ゲーム差0**（安全に素AIへフォールバックすることを実Battleで確認）。
4. **主な負け筋は T1/T2 ではなく選出（3+先発）にある。** FINALで A/H0 0.175・A/H1 0.05・A/H2 0.20・C/Y 0.10・C/X 0.05・B 0.25/0.40（human1固定選出）。未見U2（メガプテラ）では legacy 選出 `Primarina>Tyranitar>Garchomp` が 0.40（aceLead・legacyLead2 は全分岐0勝）、quick 探索選出 `Rotom-Wash>Metagross>Primarina` は 0.98。一方U1 hyp b では quick が 0.78（0勝セル×分岐3）で legacy 0.97 より悪い。**現行6体＋現行選出関数で実用候補は「不成立」**（A・C・未見構築の一部に回避不能に近い不利が残る）。

## 実施内容（コミット順＝事前宣言の証拠）
| commit | 内容 |
|---|---|
| `b622b2c` | P1：`condSig` のネスト検証（下記）。`pr84-reaudit.js` の utility 原因分類を `utilCause()` に**無変更で**切り出し |
| `6e38df3` | **戦闘前の事前宣言**：DEV/FINALセル、未見公開6（3構築×2仮説）、seed、ゲート5種と選択規則（`holdout-20261031-pr86.js`, `pr86-safe-entry.js`, `pr86-eval.js`） |
| （次） | Pain Split の実HP判定（opt-in V2）＋テスト |
| （次） | DEV結果と **ゲート凍結ファイル** `reports/data/pr86-gate-freeze.json`（FINAL前） |
| （最後） | FINAL＋UNSEEN結果、本レポート |

## 1. 再現（R）
- PR #85 の stage1（14,280戦）＋stage2-v3（14,280戦）を**同じtrain seed・セル・分岐・左右**で、PR #85自身のworker（`pr84-reaudit.js --pr84-worker`）経由で再実行。**V3テーブル200キー（rule 38/base 58/uncovered 104）の status/action が保存版と完全一致**（不一致なら停止する実装）。
- utility原因ラベル：保存済み6例すべてで現行 `utilCause` が保存ラベルと一致、`byCause` 合計＝n=18。**77,136戦の修正版完全再実行は未実施**（6例＋集計整合のみ）。

## 2. P1：公開状態キーのネスト検証
- 原因：`COND_KEYS` はトップレベルだけ検査、`sig()` が `ownBoosts` 等の任意キーをキー化。
- 修正：boost は `atk/def/spa/spd/spe/accuracy/evasion` の整数 −6..6、side condition は `-sidestart` で公開される id の allow-list（0..3層）、status/weather/terrain は列挙値、HPは0..1数値、Encoreはboolean。それ以外は **throw**。
- 回帰：ChatGPT再現 `ownBoosts:{hiddenHeldItem:'Choice Specs'}` → throw。隠し値を変えた全変種が throw（キー分岐しない）。**保存済み200キーを全て再構成して同一文字列**になることを確認（PR #85の値は再現可能）。DEV/FINAL/UNSEEN の 12,168戦で throw なし。
- 現行 `condFromBot` 経由の実漏洩は**未立証のまま**（今回も見つけていない）。
- 追加境界：`decideEarlyV3` は `legal` 省略時に rule を返さないことをテスト化（PR #84コメントの `decideEarly` 境界はV3では閉じている。旧 `decideEarly` は保存値再現のため未変更）。

## 3. P1：Pain Split（PR #84 コメント #6537030779）
- 合法性：Pain Split は M-C で合法（HX_sand Rotom-Heat 型が TeamValidator 通過）。最大HPは Champions L50 で `base+points+75`、points 0..32。固定Showdownの実 `maxhp` と一致をテストで確認。
- 相手の最大HPは非公開（pointsが不明）→ **範囲の全域で結論が同じときだけ** rational/irrational、跨ぐなら `unknown`。最大HPの決め打ちはしない。
- ChatGPTの2反例（90/200 vs 80/100、80/100 vs 100/200）で旧ラベルの逆判定を再現し、V2は正しい側を返す。
- **旧 `rationalityFromState` と保存値は未変更**。V2を utilityAudit/utilityRational に配線した再評価は**未実施**（発生数・勝率影響は未確認）。

## 4. abstainゲート（P0-1）
公開情報のみ：入力は V3 観測（非公開フィールドは throw）＋凍結テーブル＋凍結trainゲーム由来のLOCOキー集合。相手3体・型・分岐・仮説・事後勝敗は実行時に参照しない。

| gate | 内容 |
|---|---|
| abstain | 常に素AI（基準） |
| v3 | PR #85のまま |
| t2only | T2ルールのみ（T1は相手の後ろ2体の情報なしで確定するため） |
| loco | 2セル以上で学習 かつ 各セルを抜いても同じルール かつ 抜いたセルでルール平均 ≥ 素AI |
| loco_t2 | loco かつ T2のみ |

選択規則（宣言済み）：DEVで rational 22仮説平均 ≥ abstain かつ「0.05超の悪化仮説数 ≤ 改善仮説数」の中で最大、なければ abstain。
**rational** = 相手分岐 `utility`（無意味な補助技を撃ち得るPR #81分岐）を除外し、T1/T2に `irrational` 補助技が出た試合を除外（相手の非合理fallbackでの勝ちを加点しない）。

### DEV（22仮説×DEVセル×6分岐×2seed×左右、seed 8650000+）
| gate | rational平均 | 全試合平均 | 悪化/改善仮説 | ペア(勝/負) | 発動 |
|---|---|---|---|---|---|
| abstain | 0.808 | 0.821 | – | – | 0 |
| v3 | **0.795** | 0.805 | 3/5 | 46/49 | 322 |
| t2only | 0.813 | 0.824 | 1/2 | 12/9 | 82 |
| loco | 0.811 | 0.821 | 1/2 | 10/10 | 88 |
| **loco_t2（凍結）** | 0.813 | 0.825 | 0/1 | 4/0 | 16 |

### FINAL（1回のみ、seed 8660000+）
| gate | rational平均 | 全試合平均 | 悪化/改善 | ペア | 発動 |
|---|---|---|---|---|---|
| abstain | 0.652 | 0.667 | – | – | 0 |
| v3 | 0.667 | 0.671 | 1/2 | 30/25 | 408 |
| t2only | 0.656 | 0.669 | 0/0 | 5/2 | 48 |
| loco | 0.652 | 0.667 | 0/0 | 0/0 | 24（全て同結果） |
| **loco_t2（凍結）** | 0.652 | 0.667 | 0/0 | 0/0 | **0** |

反例（実ログ `pr86-final.json` FINAL v3 lossExamples）：A/H0 swapIn `Primarina/Garchomp/Golisopod`、ai/attack分岐、V3が T1 **Encore** を相手Primarinaの Moonblast（攻撃技）に打つ → 相手はT2に合理的にGolisopodへ交代しEncoreが無駄、Emergency Exitで再度Primarina → 負け。abstainは同seedで勝ち。**「失敗するEncore」を学習セルの外で選ぶ典型**。

## 5. 未見の公開6（UNSEEN、seed 8670000+）
リポジトリの全 `*.js` に名前が出ない種で構成（こちらの6体とも非重複）、各2仮説（メガ1体）、TeamValidator合法。Champions の道具プールに合わせ（Choice Band/Specs, AV, Orb なし）。相手の合理的セル＝相手視点 legacy、legacy 2番手先発、エース先発、エース後置。

| 公開6 | 選出 path（時間） | 自選出 | hyp a 平均 | hyp b 平均 | 0勝セル×分岐 |
|---|---|---|---|---|---|
| U1 Gardevoir/Incineroar/Gliscor/Milotic/Weavile/Kommo-o | cache miss→legacy（0.09s） | Primarina>Metagross>Garchomp | 1.00 | 0.97 | 0 |
| 〃 | quick 探索（14.1s, 1,920戦） | Rotom-Wash>Metagross>Hydreigon | 0.88 | 0.78 | b:3 |
| U2 Aerodactyl/Mamoswine/Greninja/Goodra/Talonflame/Klefki | legacy（0.01s） | Primarina>Tyranitar>Garchomp | **0.40** | 0.79 | a:12, b:3 |
| 〃 | quick（10.6s） | Rotom-Wash>Metagross>Primarina | 0.98 | 1.00 | 0 |
| U3 Lopunny/Snorlax/Chandelure/Krookodile/Hawlucha/Florges | legacy / quick（10.2s） | Primarina>Metagross>Garchomp | 1.00 | 1.00 | 0 |

- T1/T2エントリー：全判断 `uncovered`（V3・凍結ゲートとも）、abstainとの**ゲーム差0/1,104**。キャッシュミス時は legacy に落ち、warningを返す（安全側だが選出品質は保証しない）。
- U2負け筋（ai分岐ログ）：Goodra 先発の Sludge Bomb 2発で Primarina が落ち、Mamoswine の EQ で後続が崩れる／メガプテラ先発は SR を撒いて倒れ Goodra→Mamoswine が通る。**選出の問題でT1/T2では救えない**。
- U1/U3 がほぼ1.00なのは、手書き構築と相手ヒューリスティックAIの弱さの可能性が高い。**未見構築への強さの証拠として使わない**。

## 6. 既知負け筋の状態（未解消）
| 構築 | 状態 |
|---|---|
| A/H0, H1, H2 | FINAL（aceBack2/swapIn）で 0.05–0.20。human1選出 `Primarina>Garchomp/Rotom-Wash` の問題。**未解消** |
| Indeedee/scarf | DEV/FINAL 1.00（今回セル）だが PR #85 holdout で V3 が 1.00→0.67 悪化。abstain なら悪化なし。**解消を主張しない** |
| C（リザY/X） | FINAL 0.10 / 0.05（aceBack2 `Gholdengo/Charizard/Garchomp` 等）。**未解消** |
| HX_rain a | DEV aceLeadB で V3 が 0.50→0.10 に悪化（abstain 0.50）。**未解消** |
| HX_fairy b | FINAL V3 0.95→0.85、abstain 0.95 |
| Cガブ交代・EメガリザY個別ログ | 今回は個別ログ追跡していない（**未検証**） |

## 7. ChatGPTに反証してほしい点
1. DEV/FINALのセル生成規則が「合理的な相手3体」か（相手 legacy chooseThree とハッシュ順のエース含みピックに依存）。特に FINAL の A/C 低勝率セルが実戦で選ばれるか。
2. `rational` 除外（utility分岐とT1/T2の irrational 補助技）が過剰／不足でないか。
3. LOCO の「セル」を `仮説|セル` 単位にした妥当性（同じ相手3体が別仮説で別セル扱い）。
4. 未見6の手書き型が弱すぎないか（U1/U3 の 1.00）。実在の上位構築での再試験が必要。
5. quick 探索（10–14秒）を実戦既定にすべきかは本結果では決められない（U2で大改善・U1bで悪化、PR #82では legacy 比で安全でない）。
6. Pain Split V2 は未配線。配線した場合の utilityRational 分岐の変化は未計測。

## 再現
```
SHOWDOWN_DIR=... PHASE=R,DEV node pr86-eval.js      # reports/data/pr86-dev.json, pr86-gate-freeze.json（R: 28,560戦, DEV: 4,680戦, 203s/4 workers）
SHOWDOWN_DIR=... PHASE=FINAL,UNSEEN node pr86-eval.js # reports/data/pr86-final.json（FINAL 5,280戦, UNSEEN 2,208戦, 82s）
SHOWDOWN_DIR=... npm test && npm run check
```
main・現行実戦6体・育成・既存保存値は変更していない。PR #85以前の関数・保存値は再現可能（V3テーブル再構築一致）。
