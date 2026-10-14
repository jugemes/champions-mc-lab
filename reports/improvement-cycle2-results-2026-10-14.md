# Improvement cycle 2 — factual checkpoint (2026-10-14)

GitHub Actions: https://github.com/jugemes/champions-mc-lab/actions/runs/38530987623

Fixed simulator, both sides independently pick 3 from visible 6, synthetic eight opponent previews, matched battle seeds. 10 conditions × 8 scenarios × 75 games = 6,000 games. Candidate AI policy v2; opposing AI baseline, except one C policy-baseline control.

| Candidate | Wins/600 | Worst scenario |
| --- | ---: | ---: |
| C unchanged, legacy AI | 271 | 17.3% |
| C unchanged, v2 | 271 | 16.0% |
| C Corviknight to Rillaboom | 317 | 13.3% |
| C Corviknight to Eelektross | 281 | 13.3% |
| C Garchomp to Starmie | 167 | 9.3% |
| E unchanged, v2 | 278 | 4.0% |
| E Gholdengo to Eelektross | 232 | 4.0% |
| E Primarina to Eelektross | 312 | 29.3% |
| E Starmie Trick to Thunderbolt | 285 | 4.0% |
| B unchanged, v2 | 274 | 14.7% |

C→Rillaboom improves standard rain wins 12/75 to 55/75 but worsens steel+setup 27 to 10 and old-master 36 to 23. E→Eelektross in Primarina slot improves steel+setup 3 to 41, but worsens old-master 50 to 22 and fast offense 49 to 25. These are meaningful trade-offs requiring next-cycle adaptation, not completed builds.

Matching-pair flips: C→Rillaboom 102 improvements and 56 regressions; E→Eelektross 140 improvements and 106 regressions. This is a synthetic-heuristic test, **not** competitive ranked win percentage. The next experiment must preserve these two controls and target their new weaknesses.
