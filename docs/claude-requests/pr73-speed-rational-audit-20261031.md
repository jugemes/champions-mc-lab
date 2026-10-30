# CLAUDE-TASK｜PR #73独立反証：Encore速度ガードの偽陰性・合理分岐タグ・公開6選出ゲート（2026-10-31）

**正本**：Issue #20、発注PR #72→Claude成果 [PR #73](https://github.com/jugemes/champions-mc-lab/pull/73) head `560274912e7e90ee843146bd5ec39f68e0113446`、ChatGPT独立レビュー [#5715279320](https://github.com/jugemes/champions-mc-lab/pull/73#pullrequestreview-5715279320)。旧#72の成果は受領済み。これは**新しい反例を修正する一件の後続依頼**。前の#68/#70/#72を未回答扱いして重複発注しない。

## P0-A: `encoreGuard:'speed'` の偽陰性を固定Showdown実Battleで再現し最小修正

`lab.js` の `encoreWouldFail` は、相手の前回技が未記録でも `ownSpeed < foeMinimumSpeed` だけでEncoreを許可する。ChatGPTが関数式を隔離Nodeで再現：アシレーヌ speed82 / ガブリアス最低speed109 → `encoreWouldFail=false`。**相手が負優先度の技（トリックルーム-7、ほえる-6など）を使うと、Encore優先度0が先に出て失敗する。** 速い相手が未行動のまま眠り/まひで `|cant|` となるケースも同様。実Battle未再実行なので、Claudeは固定champions形式で合法な技・能力ポイントを使い実際のプロトコルを検証し、事実と反例を確定すること。相手の隠れた技や持ち物を知っている前提のガードは禁止。リスクがある場合は保守的に抑止し、速度ガードを既定ONにしない。v1の正常ケース（確実に遅く、相手が通常優先度で先に動いた後のEncore成功）も残す。可能なら実Battleの最小回帰テストを作る。

## P0-B: `a-branch-audit.js` の合理分岐分類を実行ログ基準に修正

`classify()` は `Status` をSwords Dance以外すべてplausible（Encore空振り、満HP回復、既設ステロ、+6積みを未検査）。`script()` の `ai` / `ratSwitch` も無条件にplausible、指定技が無効ならベースAIへフォールバックして `ai` と記録する。実際に**実行した**技・交代先・着地HP・PP・優先度・Encore/Choice・自分と相手の公開状態をログと照合し、分類不明はunknownとして除外すること。特に「合理分岐最悪0/84」の分母を修正前後で示し、非合理な交代や空振りで勝ち数が水増し/過小評価されないか検証する。全34,560戦を漫然と再実行せず、最小反例→少数固定seed左右→必要時のみ拡張。

## P0-C: 公開6→3の**実際に使える**選出関数と仮説不確実性

60×60行列は有用だが、H0/H1の真値を知った事後均衡は実戦で使える選出ポリシーではない。H0=メガグソク/スカーフガブ、H1=メガガブZ/ラムグソクはどちらも合法な**仮説**であり実際の採用率は未確認。公開種族名6のみから、H0/H1等の複数仮説のリスクを併記し、未知の敵3/技/持ち物を渡さず選出3+先発を決めるopt-inの実装（または実装不能理由）を示す。Aで合理的な初手攻撃・交代に耐えるか、B/C/Indeedee/E/未学習公開6 holdoutで旧方式と同seed左右を比較。単一仮説・相手のプレミ・0/84最悪値だけで「人間には勝てない」と断定しない。

## 提出・検収

- 最初にPR #73のコード/保存集計/CIを読み、ChatGPTの反例を独立検証。異論があれば根拠を示す。
- 新しい `claude/*` ブランチに**コード・実Battle seed/左右・新テスト・ログの短い機械可読集計・合理性の反証・採否**を提出。既存PR/Issue #20に結果保存。ChatGPTが再レビューするまで「Claude必須検収済み」としない。
- 固定Showdown SHA `3a766f2cfb5e51c1e428cfe87d0dba91a8f01640`、`gen9championsbssregmc`、66P・メガ仕様・TeamValidator。テストを無効化しない。CI failedを連投しない。main/ユーザー現行6体/育成を無断変更しない。
- 既存Claude Team Routine枠のみ、API追加課金・有料runner・PC常時起動なし。人間向け結論は「対人勝率未検証」を明記。
