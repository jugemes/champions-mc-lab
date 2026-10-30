# Claude independent task — PR #83 review: forced switch classification and truly out-of-sample public T1/T2

Date: 2026-10-31 JST. **The only new formal request** following PR #82 → Claude result PR #83 (head `b168ceee56bb07b8f637bf8069135d69ad968af8`), independently reviewed by ChatGPT: [review #5719818884](https://github.com/jugemes/champions-mc-lab/pull/83#pullrequestreview-5719818884). Do not reissue PR #82 or duplicate this task.

## Ground truth / constraints
Read latest `main`, `CLAUDE.md`, `docs/HYBRID-COLLAB-2026-10-27.md`, `docs/REAL-BATTLE-CASES-2026-10-27.md`, Issue #20, PR #81, PR #83 report/code/tests/CI, and the ChatGPT review. PR #83 is stacked on PR #81/#79/#77, **not merged**. Work on an isolated `claude/*` branch; explain incremental diffs; PR against main, no automatic merge. Pinned Showdown SHA `3a766f2cfb5e51c1e428cfe87d0dba91a8f01640`, format `gen9championsbssregmc`, 66 AP total/max 32, legal four moves and TeamValidator. No changes to user's six (Hydreigon/Mega Metagross/Primarina/Choice Scarf Garchomp/Tyranitar/Rotom-Wash), trained sets, main, payments or runner setup. Existing Claude Team Routine only.

## New independently reproduced P0: a forced switch masquerades as a voluntary requested switch
In PR #83 `pr82-switch-utility-t1t2.js`, original `voluntarySwitch()` returns the first same-side `|switch|` before a same-side `|move|`, `|faint|` or `|drag|`. It does not exclude an **Emergency Exit** activation or **Eject Button** that forces a switch after an opponent attack but before the side's move. ChatGPT fetched the exact original file and executed `checkRequestedV2` in isolation.

Input request: `[{turn:1,choice:'switch 2',active:'Golisopod',move:null,target:'Archaludon'}]`.
Synthetic protocol:
```
|turn|1
|move|p1a: Garchomp|Earthquake|p2a: Golisopod
|-damage|p2a: Golisopod|45/100
|-activate|p2a: Golisopod|ability: Emergency Exit
|switch|p2a: Archaludon|Archaludon, L50|100/100
|turn|2
```
**Actual PR #83 output:** `{result:'executed',effect:null,actual:'Archaludon',target:'Archaludon'}`. Replacing `|-activate|` with `|-enditem|p2a: Golisopod|Eject Button` also returns `executed`. Genuine voluntary switch to Archaludon returns `executed` too. Therefore an equal target is not sufficient evidence of voluntary choice. This is an **isolated synthetic boundary**, not yet proof of a particular fixed-Showdown occurrence or exact engine log sequence.

**Required**: verify actual fixed-Showdown log sequence with legal Golisopod/Emergency Exit and Eject Button, then implement the smallest robust distinction between voluntary, forced exit (ability/item), phazing/drag, pivot U-turn/Volt Switch, and post-KO replacement; regression-test both sides, same/different target, preemption and choice order. Re-run the PR #83 requested-action audit to report actual frequency. Preserve `executed` vs `effective` vs `rational` separation; avoid classifying forced exits as rational opponent decisions.

## Still failing completion gate
PR #83 improved the checker and added a callable public-only T1/T2 entry, but **Claude itself declared NOT READY**. ChatGPT independently reaggregated saved `pr82-eval.json`: across 22 hypothetical sets, human1 mean 0.556 (158/510 zero cells), human1+entry 0.682 (102/510), general mixture 0.636 (7/510), top2 0.690 (34/510), legacy 0.685 (119/510), quick 0.605 (137/510). The entry learned from the same rival cells as test (only seeds differ). In predeclared genuinely new `HX_fairy`, entry deteriorated a 0.979→0.854 and b 0.750→0.667; `HX_rain` Swampert Rock Slide rule also deteriorated 0.167→0. The 40 rules, 54 base, 54 uncovered table does not establish robust human action choice. There were **28/23,742** unresolved requested-own-action vs executed-action mismatches. PR #83 T2 observation key does not include publicly observable own HP/status, hazards, weather, boosts, PP/Choice/Encore state, so distinct legal and strategically different positions may receive identical rules. The first discarded training run / changed criterion must be documented as selection-bias risk.

**Required follow-up**:
1. Minimal fixed-Showdown real-Battle regression first for forced-switch cause and the 28 mismatches. No large CI-fail/retry loop; do not rerun 55k games until the targeted checks pass.
2. For T1/T2, make the public-state key or safety guard sufficient for HP/status/hazards/weather/boosts/Choice/Encore and legal move availability; test two positions with identical six/lead but different public conditions and assert appropriately different decision or `uncovered`. No hidden opponent three, hidden item/moves, future event or experiment branch at decision time. Mark post-KO replacements as forced, not actions.
3. Predeclare **new opponent three/lead, rational T1/T2 branch** within known public six and **new public six** before tuning; evaluate a frozen policy on those holdouts, both sides and same seeds, and include E Mega Charizard Y, C Garchomp switch, HX_rain Swampert, HX_sand alternate and HX_fairy failures. If no safe rule, return `uncovered` and do not present as a human recommendation.
4. Opponent utilityRational: investigate 18 actions later marked irrational; classify decision-time public rationality separately from ex-post effect. Do not count wins relying on ineffective rival actions as robust. Distinguish oracle worst-case from observable rival policy.
5. Recheck legal four-move sets, AP/mega, `npm test`, `npm run check`, fixed-Showdown SHA, CI job logs, reproducible actual Battle logs. State what was independently run by Claude vs saved JSON reaggregation. Keep 7 existing TODOs explicit.
6. Provide a concise human-readable table of public six → 3+lead → conditional T1/T2 → known losses/unknown, plus latency and confidence. Do not claim actual ladder win rate, do not auto-merge, do not alter live six or paid setup.

Review requirement: Claude independently reviews code, tests and real Battle, opens one result `claude/*` PR, waits for ChatGPT's counter-review. The completion gate is NOT MET until all public-information, rational-turn, mechanics, reproducibility and dual-review requirements pass.
