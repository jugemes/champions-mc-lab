# Claude再監査：M-8構築3案レポートPR #42の事実誤認を訂正し、根拠付きの採用順位へ（2026-10-29）

前回CLAUDE-TASK PR #41→成果PR #42は構築比較の第一歩だが、**ChatGPTがP0級の事実誤認を発見**した。Claudeの独立監査を必須にする以上、誤ったタイプ相性や未実証の選出4/4を放置せず、根拠を再検収してからユーザーへ報告すること。

## 最初に必ず確認すること
PR #42 への独立検収・反論コメント https://github.com/jugemes/champions-mc-lab/pull/42#issuecomment-6485949334 を全文読み、PR #42のreports/claude-m8-three-roster-comparison-2026-10-29.md およびm8-three-roster-compare.jsを照合する。

## 修正必須P0
1. ラウドボーンはほのお・ゴーストで**じめん2倍弱点**。レポート§2-Bの「カバルドンじしん等倍」は誤り。§3「スカーフガブ地震にラウド211HP無傷で受かる」は元CI #40689274253のラウド残HP67～89/211と矛盾。タイプ相性、地面弱点の数、無効枠減少を明記・訂正。
2. §2-Aで現行Lのアシレ先発/メタ/サザン4/4、§2-Eで現行Lのガブ先発/メタ/アシレ4/4と書いた試行の**具体的な実行コード・Run URL・seed・own3事前固定**を示せない場合、検証と呼ばず[仮説]に格下げ。PR #35のm7-predeclared-triples-stress.jsはヒトムHのみ対象で、Lの強制選出は行っていないため混同に注意。
3. Mega Goliのオーバーヒート154%はメガ進化する条件のみ。元グソクムシャはBug/WaterでFireは等倍。相手がメガしないで受ける分岐も調べる。10/27 M-7使用率 https://pokechamdb.com/en/pokemon/golisopod?format=single&season=M-7 : Sucker Punch 80%, Leech Life 77%, Swords Dance 64%, Iron Head 46%, Drill Run 25%, First Impression 24%。FI前提の合成結果を過大評価しない。
4. L/H/Sを6体全体で比較。SはサザンLevitate喪失でGround無効2→1、Ground弱点2→3、かつ水弱点・ドラゴン/悪の高速特殊打点喪失。HはGround無効2を維持する一方、カバ/雨/地面+水/対ミミッキュ後出しで失点。ガブ#1、アシレ#2、ミミッキュ#3、カバ#4、Goli#5、リザ#6、ルカリオ#7、サーフゴー#9、イダイトウ#10をカバー。
5. HはメガルカリオZが相手のグループで0/4（自分3体選出の不合理）を未解析、Sは選出AIがラウドを14群中4群しか選ばない。合成勝数L36/H42/S31からH>L>Sを確定した結論として使わず、合理的な3体と初手・相手A/B・交代/攻撃を見て暫定優先順位を出す。

## 出口
最初にこの発注PR番号入りACKをIssue #20へ投稿。次にPR #42のレポートを差分訂正するか、訂正版の根拠付き比較レポートを新しいclaude/* branchのPRで提出（main不可）。重大なコード誤りや不合理があれば率直に「不承認」。少なくともタイプ相性の誤りが解消し、[検証]と[仮説]が一致するまで構築の採用序列を承認しない。Claudeの独立判断をChatGPTが別途再検収する。

本人は現行6体でランクマ継続。Claude Team既存Routineのみ。追加API課金・クレジット・有料runner・main変更・CI FAILED通知連発・本番6体変更をしない。既存Showdown pinned SHA 3a766f2cfb5e51c1e428cfe87d0dba91a8f01640、M-Cを使う。