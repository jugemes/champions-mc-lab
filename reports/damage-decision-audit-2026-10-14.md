# M-C public-damage / decision-audit checkpoint (2026-10-14)

## Source of truth

- Base: `9e3ba93a5192537f5eab34bfd4d0141f1133ad6d`; passing baseline Actions [38516089233](https://github.com/jugemes/champions-mc-lab/actions/runs/38516089233).
- Code: merged [PR #1](https://github.com/jugemes/champions-mc-lab/pull/1), with corrective follow-ups ending at `03dfde19a55602ee6ff439efa01638ff6b5cca7b`.
- Latest successful Actions: [38519505498](https://github.com/jugemes/champions-mc-lab/actions/runs/38519505498): 29/29 node tests; 8/8 legality; speed probe passed; 160/160 smoke/stress matches completed.
- Both runs pinned Showdown to `3a766f2cfb5e51c1e428cfe87d0dba91a8f01640`, format `gen9championsbssregmc`. Same synthetic opponents, seed formula, 10 games per match, and reversed sides.

## Changes retained

- `damage.js` uses Champions level-50 stat-point formula (distinct from SV EV mechanics), min/max opponent defences and HP based on unknown stat points and natures, accuracy, observed boosts, known immunity items/abilities, and observed opposing attacking moves.
- `lab.js` uses range-based move utility, observed attacking coverage and boost-aware defensive risk for switches, and handles `-enditem` on revealed Air Balloon. No opponent private team set is passed to decision code.
- Five new regression tests: stat formula, Air Balloon immunity, offensive boosts and Unaware, observed-move risk, and actual bot choice.
- A newly attempted *team-preview selection* score based on max range-damage was **reverted** due to severe regression. The preview selection score remains the baseline heuristic. It was not validated as an improvement.

## Comparison: AI stress-test wins per 10 (before → after)

| Fixture | Rain | Gholdengo setup | Toxapex stall | Salamence setup |
|---|---:|---:|---:|---:|
| A_rillaboom | 10→9 | 0→0 | 10→10 | 7→10 |
| B_eelektross | 5→10 | 0→0 | 10→10 | 7→10 |
| C_master | 0→0 | 10→1 | 1→3 | 10→10 |
| D_starmieS29 | 10→9 | 0→0 | 10→10 | 7→10 |

These are deliberately constrained, scripted heuristic-agent matchups. They are NOT ranked-play win rates, match-up percentages, or evidence that B is superior to A.

## Findings / blockers

1. The previous C/Gholdengo-success policy would repeatedly Earthquake a Gholdengo whose Air Balloon was *already revealed*, yielding `|-immune|`. Fixing this factual error is necessary; the C setup score subsequently fell sharply. Inspect the updated C setup full event trace and alternatives rather than reintroducing invalid Earthquakes simply to restore wins.
2. A/B vs Gholdengo setup remain 0/10. Selection (6→3), safe forced-switch choice, speed, and actual KO ranges must be reviewed as a continuous win condition, not maximized immediate base power.
3. The temporarily introduced range-based preview selector dropped key defensive or cleaning options: A vs Salamence dropped Skeledirge; C vs setup dropped Golisopod. This version ran [38519305043](https://github.com/jugemes/champions-mc-lab/actions/runs/38519305043) but was **reverted** before the current green run.
4. Current damage model is a bounded approximation, **not** the complete Showdown event damage engine: move-specific mechanics, Mega form stat conversion before attacking, terrain/weather, field effects, revealed move-lock states, dynamic attacker HP, Speed/turn order, and exact integer intermediate rounding require further work. Max observed public STAB risk is also not a real attack-choice probability.
5. Original `matchup()` still feeds preview selection; its score differs in scale and assumptions from `moveUtility()`. Do not assume combining them is meaningful.
6. The comparison holds inputs fixed, but altered AI policies on both sides still affect outcomes. Stronger opponent variety and independently audited decisions are mandatory before team recommendations or high-N simulations.

## Next engineering gate

- Add targeted **action-level trace** on the C setup and A/B setup first three turns, capturing legal action candidates, estimated damage, incoming risk, revealed items and selected decision. Compare against public log facts.
- Preserve variant independence (selection-only, damage-only, switch-only ablation) and the baseline. Correct errors in damage range and prioritization before trying selection optimization again.
- Add regression tests for known Choice Scarf move lock, observed Air Balloon disappearance, Mega form offensive stats, Ground vs airborne, Unaware and priority versus possible KO.
- Only after transparent choice audits, test diverse opponent policies and documented rank-relevant sets. Do not inflate to 10k matches yet.
