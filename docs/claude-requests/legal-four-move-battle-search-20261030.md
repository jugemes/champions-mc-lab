# CLAUDE-TASK｜合法な4技仮説 × 固定Showdown：選出AIを実戦研究候補まで改善する（2026-10-30）

## 背景と優先順位
「強そうに見える数値モデル」から一旦離れ、**ゲームとして存在可能な相手の4技・持ち物・特性・メガ・天候・素早さの一貫した候補を、固定ShowdownのBattleで具体的に検査すること**を優先。従来の`threat-aware-v1/v2`は相手の攻撃/先制/積み/回復を4技枠を超えて合成する構造的欠陥があり、Aの改善も双方Botのアンコール/つるぎのまい連打というプレミに依存。**v2は採用不可**でありコード量/CI/対戦数だけで評価を逆転させない。

GitHub正本：`CLAUDE.md`、`docs/REAL-BATTLE-CASES-2026-10-27.md`、`docs/HYBRID-COLLAB-2026-10-27.md`、Issue #20。今期M-7実戦のL6体は固定。`gen9championsbssregmc`、Showdown pinned `3a766f2cfb5e51c1e428cfe87d0dba91a8f01640`、Node22。

- 旧公開6モデル[Claude PR #62](https://github.com/jugemes/champions-mc-lab/pull/62)（#59への成果）と[ChatGPTの独立review #5710721286](https://github.com/jugemes/champions-mc-lab/pull/62#pullrequestreview-5710721286)。Claude報告では合理的な相手4条件: legacy **749/1216** vs v2 **632/1216**、Bグループ0/16、Indeedee別3で悪化。**1ケースAの14/16は全体合格ではない**。保存JSON巨大でChatGPT再集計不可・一部CI未確認；追試。
- **ChatGPT独立試作PR #63** https://github.com/jugemes/champions-mc-lab/pull/63、branch `chatgpt/legal-four-move-hypotheses-20261030`、`legal-four-move-hypotheses.js`と`test/legal-four-move-hypotheses.test.js`。既存mainから切り分けて、公開学習技pool→4技組み合わせ→`TeamValidator.validateSet`で合法性をテストする最小研究素材。**未完成・draft・CI #41038350763 は2026-10-30 19時台に実行開始、結果必ず確認**。検証不合格ならコード/条件を修正し、PRレビューで根因を指摘する。これは相手の実セット/採用率を推測したと称してはいけない。
- 研究で確定した別の有効修正 [PR #57](https://github.com/jugemes/champions-mc-lab/pull/57) の公開Garchomp-Mega-Z Levitateは実Battleメガ→交代→再登場テストとClaude #62独立監査が通っているが、main未マージ。相手の公開メガ特性を隠れ情報と誤扱いしない。

## 完了条件｜発注ACK/書類や単体CIで終わらない
1. **PR #63を独立監査**。関数`shortlist`が重要な先制/積み/回復を間引きすぎていないか、`getMovePool`がChampions専用の完全な技源か、`validateSet`が**Championsの能力P、フォーム/メガ石、複数技の相互互換、アイテム**まで合法化できるかを固定Showdownで実行検証。さらに該当技から**実際の1つの4技セット**を構成できない場合をテストし、合成技を確定打点と扱わない。全候補は出典/検証ステータスをログ化。全技羅列の重い探索にせず戦術役割別の代表的4技セットを複数選ぶ。
2. **一貫した型仮説**：相手の公開種族6だけから、合法4技・特性・持ち物・メガと素早さPの候補を複数生成（各シナリオに固定し、対面やターンの都合で変えない）。**自分の6セットは既知、相手の真の3・技・持ち物・能力P・将来行動は選出AIの入力に入れない**。相手の実Battle使用セットは対照検証だけに使う。合理的な相手候補選出3を20組から検討する際も型の事前根拠・役割・最悪脅威を示す。
3. **実Battleで短い反実仮想**：少数の相手先発と自分の3選出/初手候補について、合理的な相手がT1攻撃・積み・交代し、T2にアンコール解除/居座りや受け出しを行う**複数の合法手**を選ぶ短い固定Showdownの枝を試す。Turn AIのアシレ再アンコール/相手グソクSD連打、スカーフ無効連打、ゴツメ雷パンチ、メガYの晴れを見落とす試合は勝数として加点しない。長い独立戦闘エンジンや欠陥既知の`poke-engine`は使わない。
4. **対照テスト**：Aグソク＋ミミ（A先発が他の相手先発に弱い問題も）、BルカリオZ＋ガア＋アーキ（特にミトム不選出・ゴツメ羽休め）、CメガリザX/Y＋スカーフガブ（天候上書き）、ユーザー実対人Indeedee/カバ/ガブ/ブラッキー/ゲンガー/ギャラ（相手スカーフ未確認）と、未学習の新公開6holdout。各ケースで候補3+初手、回答役、相手が合理的な別3を選んだ時の弱点を説明。固定Showdown同seed/左右反転でlegacy・strategic・新方式を比較し、**非合理な敵AI相手だけ増えた勝数を強化の証拠にしない**。
5. **成果PR**：`claude/*`新branchの**opt-in**機能コード、事前反例テスト、固定Showdownの実Battle・失敗シード、両AI行動ログ、TeamValidator、比較表（件数の独立性に注意）、新未使用holdout、CIログ、既知欠陥をレビュー可能なPRに提出。Issue #20にも次に続けられる再現条件を書き込む。ChatGPTの独立レビューで実戦採用を判断し、不合格なら単に一層の複雑化でなく失敗原因から改善。**main/旧モデル/実戦L6/新規育成/追加課金/有料runnerを無断変更禁止**。

## 協業運用
この発注PRは既存Claude Team Routineの`PR opened/author=jugemes/head=chatgpt/claude-request-*/base=main/title=CLAUDE-TASK:/draft=false`で起動する。Issue #20に受領ACKを残すが**ACKは完了ではない**。成果PR → ChatGPTが独立検証 → 欠点があればPRへ差戻し → Claude再修正と再監査を継続する。ユーザーに再び「進めて」と言わせない。失敗CIメール乱発は避け、十分にローカルテストしてからまとめてpushする。
