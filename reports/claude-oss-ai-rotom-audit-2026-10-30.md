# Claude独立監査｜PR #47 OSS MCTS選出試作 と ai-rotom（2026-10-30）

発注：PR #48 `docs/claude-requests/oss-ai-rotom-review-20261030.md`／報告先 Issue #20。
対象：PR #47 head `8ccf054e69392ce1373c1cb57dd7a1ab7acefea1`、poke-engine `f7b147f13637ceecc1b0d1e9172ec232af4d45d0`、ai-rotom `4172a077db9b7e507dc209605889500009b9c78d`、比較正本 Showdown `3a766f2cfb5e51c1e428cfe87d0dba91a8f01640`（`data/pokedex.ts`、`data/mods/champions/*`）。
本PRはdocs-only。main・L6体・Showdown固定版・PR #47のコードは変更していない。

## 0. 結論（短く）
- **PR #47：パーサ単体としては正しいが、「選出候補エンジン」としては不承認（修正必要）。** 7/7テストは本監査でもNode 22.22.0でpassした。ただし、①入力の`stateString`をそのまま受け取るため、公開情報だけを使ったかどうかを検査できない、②依存先のpoke-engineに**M-C固有の重大な機構差が4件以上**ある（下記2）、③乱数シードを固定できず再現できない、④visits/scoreの意味が勝率でもShowdown局面でもない。この4点が解決するまで、出力を実戦の選出参考に使うことは禁止すべき。
- **poke-engine固定SHA：M-C正本と一致しない。** メガグソクムシャの特性が「ききかいひ」（正本は**かたいツメ**）、メガガブリアスZが「すなのちから」（正本は**ふゆう**）、メガルカリオZが「てきおうりょく」（正本は**Aura Guard＝接触ダメージ半減**）、メガスターミーのAが140（正本100）。さらに**Piercing Drill／Unseen Fistの0.25倍が、まもる無関係に全接触技へかかる**。**メガシンカ1回制限も未実装**。Issue #20で中心になっているメガグソクムシャ対面を、このエンジンで評価してはいけない。
- **ai-rotom：発注書の仮説はコード・データ上で確定。** ミトム（技未指定）は`hydropump`だけに絞られ、ボルトチェンジ・10まんボルト・おにびが分析から消える。逆に**メガ形態はlearnsetキーが無く空集合になり、フィルタが「全技解禁」にフォールバック**するため、メガグソクムシャ等のダメージは覚えない技で過大評価される。`analyze_selection`の`damageEstimate`は自分→相手の一方向だけで、60選出の推奨・スコアも出さない。
- 実戦勝率の推定はしていない。どの数字も対人勝率ではない。

## 1. 実施したこと／していないこと
|項目|状態|
|---|---|
|PR #47 `node --test test/oss-engine-mcts-probe.test.js`|**実行・7/7 pass**（Node v22.22.0、作業ツリー外で隔離実行）|
|poke-engine固定SHAのソース読解（`state.rs`、`generate_instructions.rs`、`mcts.rs`、`evaluate.rs`、`base_stats.rs`、`abilities.rs`、`io.rs`）|実施|
|poke-engine `MegaEvolveData` 全96件と固定Showdown `pokedex.ts` の機械照合（付録A）|**実施・不一致6件**|
|poke-engineの`cargo build --features bss`とバイナリ実行|**未実行**（このセッションで外部コードのビルド・実行が許可されなかった）。以下のMCTS挙動の記述はすべてソース読解による|
|ai-rotomのlearnsets/pokemon JSONの読み取り（付録B）|実施（データ読み取りだけで、ai-rotomのコードは実行していない）|
|ai-rotom MCPの実行（Node>=24）|**未実行**|
|Showdownでの同条件ダメージ比較|**未実行**（提案のみ。3節）|
|foul-play `requirements.txt` / poke-engine issue #32 の再確認|未実施（発注書の記載をそのまま引用）|

## 2. 重大欠陥（根拠つき）

### 2-1. poke-engineのメガ定義がM-C正本と食い違う【重大】
`src/genx/base_stats.rs`（poke-engine `f7b147f`）と `data/pokedex.ts`（Showdown `3a766f2`）を照合した。付録Aのスクリプトで再現できる。

|メガ|poke-engine|Showdown正本|影響|
|---|---|---|---|
|メガグソクムシャ|特性 Emergency Exit（ききかいひ）。しかもEEの処理は未実装で、enum定義のみ|**Tough Claws**|アイアンヘッド・であいがしら・きゅうけつ等の接触技が×1.3されない。Issue #20の「即アイアンヘッドでアシレ約74–84%」は、PE上では約57–65%相当まで過小評価される見込み（推定であり、実行値ではない）|
|メガガブリアスZ|Sand Force|**Levitate**|PEでは地面技が当たる。正本では無効|
|メガルカリオZ|Adaptability|**Aura Guard**（接触技の被ダメージ0.5倍）|攻撃は過大評価、物理接触への耐久は過小評価|
|メガアブソルZ|Magic Bounce|**Sharpness**|切る技の火力・状態技の反射がずれる|
|メガスターミー|A=140|**A=100**（ちからもち）|物理火力が1.4倍の過大評価|
|メガドラミドロ|D=114|D=116|軽微|

### 2-2. Piercing Drill／Unseen Fistの0.25倍が常時かかる【重大・メガドリュウズ等】
- PE：`src/genx/abilities.rs:2255-2260`の`ability_modify_attack_being_used`が、接触技なら**無条件に** `base_power *= 0.25` する。この関数は`generate_instructions.rs:1692`から毎回呼ばれ、まもる判定はその後に行われる。
- 正本：`data/abilities.ts` `piercingdrill.onHitProtect`、`mods/champions/abilities.ts` `unseenfist.onHitProtect`、`mods/champions/scripts.ts:298-301`。0.25倍になるのは**まもるを貫通した場合（`bypassProtect`）だけ**。
- 結果として、メガドリュウズの接触技はPEで常に1/4になり、評価が壊れる。

### 2-3. メガシンカの1回制限が無い【重大・6見せ3】
`src/genx/state.rs` `can_mega_evolve`のコメントに「another pkmn on the team already mega evolved でも可能。不正確だが通常は複数メガストーンを持たない」と明記されている。Championsの6見せ3では、メガストーンを2個以上見せる構築が普通にある。この状態だと**メガ持ち2体を同時に選ぶ候補が過大評価**される。アダプタ側で状態を「メガストーン保持者は1体だけ」に分割する必要がある（4節）。

### 2-4. PR #47の探索結果は再現できず、意味の解釈にも制約がある【修正必要】
- `src/mcts.rs`は`rand::rng()`（スレッドRNG）を使い、シードを渡すCLI引数が無い。そのため**同じ入力でも同じ出力にならない**。CLAUDE.mdの「同シード比較」を満たせない。
- rolloutはランダムプレイではなく、葉の静的評価`sigmoid(evaluate(state) − root_eval)`（`mcts.rs:196-208`）。`evaluate`は生存+30、HP割合×100、状態異常などの手書きヒューリスティック。選出直後の葉は双方3体・満タンなので、浅い探索では差が**登場時特性（ひでり・すなおこし・いかく等）**くらいしか出ない。visitsはこの評価に対するDUCTの周辺分布で、勝率でも対人選出率でもない。PR #47の`notice`の注記自体は正しい。
- 根の同時手は60×60=3600通り。既定の`timeMs=300`では、1組あたりの深掘りが不足する可能性が高い。**ただしiteration数は未実測**。この予算で順位が安定するかは、ビルド後に「同じ入力を複数回実行したときの順位の相関」で確かめる必要がある。
- PE側は、相手（side two）が**こちらの持ち物・技・能力を完全に知った状態**で探索する。CLAUDE.mdの「双方とも公開6から考える」とは非対称で、相手の千里眼が入る。この結果を「合理的な相手の選出」と呼んではいけない。

### 2-5. PR #47コード固有の指摘
|#|箇所|内容|判定|
|---|---|---|---|
|a|`runExperimentalProbe`|`stateString`を検査なしで受け取る。`scenarioProvenance`は自己申告の文字列で、side twoに実際の未公開3体・実持ち物が入っていても通ってしまう。side oneが`ownSix`と一致するかも照合していない|**修正必要**（4節のビルダー経由に限定する）|
|b|`runExperimentalProbe`|`binary`は絶対パスでさえあれば何でも実行できる。shell=falseなのでシェル注入は無いが、「信頼できる固定バイナリ」であることはsha256で照合すべき|修正推奨|
|c|`inspectPreview`|PEの`TeamPreview.to_string`はpokemon idを使う（`state.rs:75-79`）。ownSixにメガ後の形態名（例`Charizard-Mega-Y`）を渡すと、PE出力の`charizard`と一致せず例外になる。安全側に失敗するので重大ではないが、仕様として明記すべき|軽微|
|d|`inspectPreview`|bench順の正規化と重複拒否は、PE `bss_team_preview_get_all_options`（`state.rs:830-845`、組合せi<j<kごとに先発3通り）と合っている。60件網羅チェックも妥当|問題なし|
|e|`parseMctsOutput`|PE出力の形式`{move},{total:.2},{visits}`（`io.rs:148-178`）と合っている。side twoの行を無視するのも妥当。`NaN`/`inf`は正規表現で拒否される|問題なし|
|f|テスト|すべて合成文字列だけで、実際のPE出力のゴールデンテストが無い。Rust未起動・Showdown未照合はPR本文にも書かれているとおり|ゴールデン出力の追加が必要|
|g|`spawnSync` timeout|`timeMs+4000`。PEのプロセス起動とstate解析には十分だが、`iterations>0`の場合はPEが時間制限を見ない（`mcts.rs:320`）ので、ここでkillされる。killは失敗扱いになるので安全|問題なし（仕様として明記推奨）|

### 2-6. ai-rotom【発注仮説を確定】
- `data/champions/learnsets.json`：`rotomwash`=`["hydropump"]`、`rotomheat`=`["overheat"]`（fan/frost/mowも1技ずつ）。共通の`rotom`に`voltswitch`/`thunderbolt`/`willowisp`/`hydropump`以外の42技がある。
- `data-store.ts:191-197` `getLearnsetMoveIdSet`はフォーム単独のキーしか引かない → `selection-analysis.ts:284`でその集合を使う → `shared/src/calc/filters/learnset-filter.ts:15-24`は**集合が空でなければ**それで絞り込む。
  - **ミトム（技未指定）：候補がハイドロポンプだけになる。** 電気技・おにびは消える。発注書の仮説はコード経路として確定した（MCP実行による出力の再現は未実施）。
  - **メガ形態**：`golisopodmega`、`metagrossmega`、`charizardmegay`などはlearnsetキーが無い（メガで含まれるキーは`meganium`だけ）。そのため集合は空 → フィルタは**全件返却**。`damage-calculator.ts:197以降`の`calculateAllMoves`は`gen.moves`の威力>0の**全技**を計算するので、メガで入力した相手は覚えない技の最大ダメージで評価される。過大評価の危険が大きい。
- `selection-analysis.ts`の`damageEstimate`は`mine.input → opp.input`の一方向だけ（相手→自分はタイプ倍率と素早さ比較のみ）。60選出の推奨やスコアは無い。PR #47報告のとおり。
- 種族データ（特性・種族値）は、2-1の6件すべてで**ai-rotomが固定Showdownと一致**していた（付録B）。ただし`@smogon/calc 0.12.0`がAura Guard/Piercing Drillを計算に反映しているかは未確認。作者READMEにも未反映の特性・道具があると書かれている。
- upstream issue候補（**投稿はユーザー承認待ち。投稿していない**）：①`getLearnsetMoveIdSet`はロトム各フォームで基本形`rotom`との和集合を返すべき（Showdownでは`rotomwash`が`rotom`のlearnsetを継承する）、②メガ形態は`baseSpecies`のlearnsetにフォールバックすべきで、空集合を「全技許可」として扱うのは危険、③`analyze_selection`に相手→自分方向の推定ダメージが無い。

## 3. M-C機構の最小比較テスト案（すべて未実行）
同じ能力P・性格・持ち物で、固定Showdownの`Battle`とPEの`calculate-damage`／1ターン`generate_instructions`を比べる。各項目は「正本値・PE値・差」を記録する。
1. メガグソクムシャ@グソクムシャナイト（A32 いじっぱり）がアイアンヘッド→アシレーヌ（H32 B2）：Showdownではかたいツメ×1.3。**PEとの差が出る見込み（2-1）**。
2. ガブリアス@ガブリアスナイトZがメガ後に地震を受ける：正本は無効、PEは被弾。
3. メガルカリオZがインファイト（接触）を受ける／はどうだん（非接触）を撃つ：正本はAura Guardで被ダメ半減、STABは1.5。PEはてきおうりょく2.0で被ダメ等倍。
4. メガドリュウズの接触技（まもる無し／まもる有り）：正本は1.0倍／0.25倍、PEは0.25倍／0.25倍。
5. リザードンX/Y：メガした同じターンにひでりが発動するか、そのターンの行動順にメガ後の素早さが使われるか、晴れでソーラービームが溜め無しになるか、水技が半減するか。Xのかたいツメ。
6. ききかいひ（通常グソクムシャ）＋相手ボルトチェンジ：正本Champions `emergencyexit`の挙動と比べる。PEはEE未実装。
7. こだわりスカーフ：素早さ×1.5と技固定。交代後に固定が解除されるか。
8. ふゆう（ミトム）が地震無効か。アンコールの3ターン固定と、アンコール中の交代。
9. 能力P66：任意の32/32/2配分で、PE `calculate_stats_from_base_stats`（`8*SP-4`をEV換算）とShowdown `mods/champions/scripts.ts:13-27`（`2*SP-1`）が一致するか。**ソース上は等価**（floor((8SP−4)/4)=2SP−1）だが、実数値で確認する。
10. メガストーン2個のチームで、同じ試合中に2回メガシンカできてしまうか（PEは可能。正本は`sim/battle-actions.ts:1895-1903`で1回に制限）。
11. 同じ入力・同じ予算でPE MCTSを10回実行し、60候補順位のKendall τを測って再現性を数値化する。

## 4. 公開情報だけを使う最小インターフェース案
- 入力は3つに限る。`ownSix`（自分の確定個体。リポジトリの実戦記録から作る）、`oppPublicSix`（種族名だけ。公開プレビューに出る情報）、`hypothesisLibrary`（種族ごとの型仮説。出所・確認日・ID付きで事前にコミットしたもの。対戦ログからは生成しない）。
- PEの`stateString`は**このビルダーだけが生成**し、プローブは生の`stateString`を受け付けない（2-5 a）。ビルダーは、対戦後の分析ファイル（例：`reports/`内の実際の相手3体・持ち物）を読めないディレクトリ構成にし、テストで「入力に含まれる種族集合 = 公開6」を検査する。
- メガ制約（2-3）：相手の公開6にメガ候補がm体いれば、「メガストーン保持者は1体」の状態をm通り作り、それぞれ別に探索する。自分側も実際の保持者1体で固定する。
- 出力：仮説k×シードsごとの60候補について、**最悪仮説での順位・中央値・ばらつき**を出す。単一の「最善3体」は出さない。確定情報と仮説を混ぜない（仮説IDを出力に残す）。
- 相手の千里眼（2-4）：結果に「相手はこちらの型を完全に知っている前提」とラベルを付ける。対称性を検査したいときは、こちらの型を相手から見た公開仮説に置き換えた逆向き探索を1回追加する。
- 負荷の見積り（未実測）：仮説8×シード5×2秒＝相手6体1組あたり約80秒（単スレッド）。GitHub-hostedの公開リポジトリ無料枠で回せる規模だが、cargoビルドのキャッシュが前提。**2-1〜2-3を直さないうちに回しても意味が無い**。

## 5. 最終判断（提案。採否はユーザー）
|候補|今期M-7の実戦支援|M-8構築研究|採用条件|
|---|---|---|---|
|poke-engine `f7b147f`（MCTS）|**不採用**。2-1〜2-3の誤差が、まさに今期の主要な相手（メガグソク／ルカリオZ／ガブZ）に当たる|条件付きで価値あり|フォークまたはアダプタでメガ定義6件・Piercing Drill・メガ1回制限を修正し、3節の1〜10がShowdownと一致し、11の順位再現性を確認したあと|
|poke-engine 0.0.48 / foul-play|不採用（発注どおり導入禁止）|不採用|—|
|ai-rotom 1.3.5|**技を明示した単発ダメージ計算だけ**なら、第二の情報源として限定的に使える。`analyze_selection`の技未指定モードは不採用|同左|ロトム各フォームとメガは必ず技を明示する。固定Showdownと同条件で数値を突き合わせる。Node 24は研究CI（Node 22）と分けて扱う|
|PR #47パーサ|研究用として残してよい|同左|2-5 a/bの修正、PE実出力のゴールデンテスト、「実戦参考には使わない」の明記|

**今期実戦への改善効果は、現時点ではゼロと見るべき。** 既存の自作Showdown検証のほうが機構の正しさで上回っている。OSS導入は、M-8研究の長期投資として、上の修正順序（2-1→2-2→2-3→3節の比較→4節のアダプタ→順位の再現性）で進めることを提案する。

## 6. ChatGPTが反証すべき点
- 付録Aの照合は`pokedex.ts`の基本データだけを見ている。`mods/champions/`には`pokedex.ts`の上書きファイルが無いことと、`abilities.ts`を目視で確認した。実際のバトルで`Mega Golisopod`の特性表示を1回確認してほしい。
- 「PE上でアシレ被ダメ約57–65%」は、74–84%を1.3で割っただけの概算。PEを実行した値ではない。
- メガシンカ1回制限は、固定Showdownの`sim/battle-actions.ts:1895-1903`（`// Limit one mega evolution`で味方全員の`canMegaEvo=false`）で確認済み。Champions modでの上書きは`scripts.ts`をgrepした範囲では見つからなかったが、実バトルでの確認はまだ。
- MCTSのiteration数と順位の安定性は未計測。300msで十分に安定する可能性もある。
- ai-rotomの挙動はコードとデータの読解に基づく。MCPを実際に呼んで、ミトムの技候補とメガグソクムシャの最大ダメージ技を表示させ、確認してほしい。

## 付録A：poke-engine メガ定義 vs 固定Showdown（再現手順）
```sh
git clone https://github.com/pmariglia/poke-engine pe && git -C pe checkout f7b147f13637ceecc1b0d1e9172ec232af4d45d0
mkdir ps && cd ps && git init -q && git remote add origin https://github.com/smogon/pokemon-showdown.git \
  && git fetch --depth 1 origin 3a766f2cfb5e51c1e428cfe87d0dba91a8f01640 && git checkout FETCH_HEAD && cd ..
python3 -I megadiff.py pe ps
```
```python
# megadiff.py
import re,sys
pe=open(sys.argv[1]+'/src/genx/base_stats.rs').read()
ps=open(sys.argv[2]+'/data/pokedex.ts').read()
fd=open(sys.argv[2]+'/data/mods/champions/formats-data.ts').read()
def norm(s): return re.sub(r'[^a-z0-9]','',s.lower())
legal=set()
for m in re.finditer(r'\n\t([a-z0-9]+): \{\n(.*?)\n\t\},',fd,re.S):
    if 'isNonstandard' not in m.group(2): legal.add(m.group(1))
rx=re.compile(r'\(PokemonName::(\w+), Items::(\w+)\) => Some\(MegaEvolveData \{\s*id: PokemonName::(\w+),\s*types: \(PokemonType::(\w+), PokemonType::(\w+)\),\s*ability: Abilities::(\w+),\s*base_stats: \(([^)]*)\)',re.S)
n=bad=0
for base,item,mid,t1,t2,ab,bs in rx.findall(pe):
    n+=1; pid=norm(mid); i=ps.find('\n\t'+pid+': {')
    if i<0: print('PS_MISSING',pid); continue
    blk=ps[i:ps.find('\n\t},',i+3)]
    pt=[norm(x) for x in re.findall(r'"(\w+)"',re.search(r'types: \[(.*?)\]',blk).group(1))]
    pb=[int(x) for x in re.findall(r'\d+',re.search(r'baseStats: \{(.*?)\}',blk).group(1))]
    pa=norm(re.search(r'abilities: \{ 0: "(.*?)"',blk).group(1))
    et=[norm(t1)]+([] if t2=='TYPELESS' else [norm(t2)]); eb=[int(x) for x in bs.split(',')]
    d=[]
    if et!=pt: d.append(f'types PE={et} PS={pt}')
    if norm(ab)!=pa: d.append(f'ability PE={norm(ab)} PS={pa}')
    if eb!=pb: d.append(f'stats PE={eb} PS={pb}')
    if d: bad+=1; print(('MC-LEGAL ' if pid in legal else 'notlegal ')+pid,'|','; '.join(d))
print('checked',n,'mismatched',bad)
```
本監査での出力：
```
MC-LEGAL starmiemega | stats PE=[60, 140, 105, 130, 105, 120] PS=[60, 100, 105, 130, 105, 120]
MC-LEGAL drampamega | stats PE=[78, 85, 110, 160, 114, 36] PS=[78, 85, 110, 160, 116, 36]
MC-LEGAL golisopodmega | ability PE=emergencyexit PS=toughclaws
MC-LEGAL absolmegaz | ability PE=magicbounce PS=sharpness
MC-LEGAL garchompmegaz | ability PE=sandforce PS=levitate
MC-LEGAL lucariomegaz | ability PE=adaptability PS=auraguard
checked 96 mismatched 6
```
（`MC-LEGAL`は、Champions modの`formats-data.ts`で`isNonstandard`が付いていない種族という意味。BSS Reg M-Cの追加制限までは見ていない。）

## 付録B：ai-rotomデータ確認（`4172a077`）
```
learnsets.json: rotomwash=['hydropump'] rotomheat=['overheat'] rotom=42技(voltswitch, thunderbolt, willowisp, …)
learnsetsのmegaキー: ['meganium'] のみ（golisopodmega/metagrossmega/charizardmegay等は無し→空Set→全技）
pokemon.json: golisopodmega=Tough Claws, garchompmegaz=Dragon/Levitate, lucariomegaz=Aura Guard,
              absolmegaz=Sharpness, starmiemega A100, drampamega D116 ← Showdown正本と一致
```
