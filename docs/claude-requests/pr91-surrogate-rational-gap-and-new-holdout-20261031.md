# CLAUDE-TASK — PR #91 独立反証後：guard仮説の合理敵カバレッジ・新未知公開6・実戦判断

2026-10-31 JST。**唯一の新規正式Claude依頼**。前依頼 #90 は成果 #91（head `459a1b058a2d08de7ed9bb0eaff12b65b9845165`）を受領済みであり再発注しない。ChatGPTレビュー [#5721340698](https://github.com/jugemes/champions-mc-lab/pull/91#pullrequestreview-5721340698) と Issue #20 を最初に読む。

## 目的・現状
PR #91 は同seed左右ペア・適格候補の見逃し・公開済み道具/特性キーの一部を修正した。ただし **NOT READY**。公開6のみでの実用3体＋初手＋T1/T2を選べるとは未実証。PR #91 の新コード/保存結果を尊重し、`#91 head` から別 `claude/*` branch で最小増分PRを作る（旧stack/mainは書き換えない）。

ChatGPTが保存JSONを独立結合した新P0：guard内部のロール仮説評価と、別に構成した合理敵3+初手・T1/T2評価が大きく乖離。
- F2/a `Primarina>Metagross>Hydreigon`：guard worst/mean `.958/.970`、外部合理セル mean `.550` / worst `.100`、新seed同選出 `.475`。事後最良 `Metagross>Hydreigon/Garchomp` は新seed `1.000`。
- A/H0 `Metagross>Garchomp>Rotom-Wash`：guard `.729/.758`、外部合理 `.350` / worst `0`、新seed `.450`。事後最良 `Primarina>Hydreigon/Rotom-Wash` `.925`。
- A/H2 同じguard `.729/.758`、外部合理 `.450` / worst `0`、新seed `.400`。事後最良 `Rotom-Wash>Primarina/Garchomp` `.875`。
**両者は異なる仮説/セル分布なので校正誤差の同一母集団比較ではない**。しかし重大な合理敵カバレッジ欠落を示す。事後最良は相手の真の型を参照する**診断用oracle**であり、実戦の選出器に流用禁止。

PR #91 F1新選出 `Tyranitar>Metagross/Garchomp` は未評価。左右同seedの結果は多くが複製（DEV 0/11520、F1 114/1920、F2 7/2304、F3 0/1920が左右勝敗不一致）。試合数でなく独立seed/pair単位で不確実性を評価。既存7 TODOは残す。

## 必須の作業と検収
1. **事前宣言コミットを先に作成**：未使用の新しい公開6（最低2構築、各複数合法型）、未知の相手3+先発（エース先発・後置・合理的交代）、T1/T2分岐、未使用seed、評価指標・停止条件・予算を、評価実行前に確定。既知A/H0,H2・F2/aは**診断/開発用**、F1/F2/F3および旧holdoutは**新たな未知holdout扱いしない**。
2. **合理敵の穴をモデル化**：公開6体からのみ、相手の有力エース・先発・後置・交代/積みを複数合法仮説として構築する。隠れ3/技/道具/結果を確定値として選出器に渡さない。AのPrimarina+Garchomp/Golisopod、F2のHatterene+Infernape/Feraligatrの負け筋を、事後oracleを選出器へ直接注入せずに説明・防止できるか確認。公開メガ形態、天候、Choice、Encore、強制交代、ゴツメ、技無効、能力66P各32・合法4技をエンジンで確認。
3. **比較対象を固定**：legacy / quick / #89 guarded / #91 V2 / 提案版。自軍6体は `reportedLive`（サザンドラ/メガメタグロス/アシレーヌ/スカーフガブリアス/バンギラス/ウォッシュロトム）から不変更。A/H0,H2、C/X,Y、F2/a、F3/aと真の新未知6を、合理的な相手3+初手/T1/T2の同一セルで比較。seed左右は対応付けて監査し、左右が同じ勝敗でも独立nを水増ししない。相手エースを選ばなかった勝ちを対策成功としない。勝率だけでなくセル別最悪・負け筋と回帰を報告。
4. **実行可能な人間用方策**：公開6→自分3+先発を具体的に返し、観測可能な状態だけからT1/T2の条件分岐を返す。T2は未知技/道具/未公開3を見ない。選出器のタイムアウトを含め4-worker実測を報告。現行38–58秒の選出処理がゲーム内の実制限に適合するかは未確認なので、確認不能なら**オフライン事前探索**と**実戦時の即時選択**を明確に分離し、期限超過はabstainを正しく記録する。
5. **固定Showdown実Battle**：SHA `3a766f2cfb5e51c1e428cfe87d0dba91a8f01640`、`gen9championsbssregmc`、TeamValidator、左右・seed・相手3+先発・T1/T2実行ログ・メガ/天候/公開情報を保存。新コードのユニットテストと実Battleの両方を行う。保存JSON再集計と新Battle実行を区別。データにない対人勝率を断定しない。
6. **完成判定を厳格に**：未知公開6での合理敵への回帰悪化、A/F2の致命的セル、非公開情報漏洩、T1/T2未実装が残る場合は明確にNOT READY。CI成功・試合数・事後oracleの好成績だけで合格しない。独立レビュー用に再現コマンド、実コード、ログ、評価用JSON、実測時間、既存TODOを明記。

## 絶対禁止
main/既存stackの自動merge・ユーザー実戦6体・育成・課金・有料runner・常時PCの変更。Claude Team既存Routine以外の追加有料利用、重複CLAUDE-TASK、FAILED連投、無駄なCI再実行、他のClaude作業と競合する同一コード上書き。**成果PRを出したら ChatGPT の独立コード/固定Battle反証レビューを待つ**。未完なら未完と報告する。
