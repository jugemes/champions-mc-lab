# 2026-10-14: Actual feedback cycles and robustness result

This report corrects the prior process in which unmodified static teams were merely ranked. Three actual changes were tested with **matched seeds and unchanged controls**, followed by two generalization / opponent-policy checks.

## Cycle 1: decision policy ablation
[CI](https://github.com/jugemes/champions-mc-lab/actions/runs/38530300939) / 4,000 battles (5 teams × 8 public-six opponents × 50 seeds × 2 decision policies).
Candidate A: 139/400 to 167/400; E:169/400 to191/400; B:182 to188; C:188 to184; J:174 to176. v2 corrected avoidable Trick/status in danger. Opponent policy held unchanged. v2 is retained as **candidate experimental policy**, not globally asserted better.

## Cycle 2: specific bad-matchup countermeasures
[CI](https://github.com/jugemes/champions-mc-lab/actions/runs/38530987623) / 6,000 battles.
C with Corviknight→Rillaboom: 271/600 to317/600; standard rain 12/75 to55/75, steel+setup 27→10 (regressed). E with Primarina→Eelektross: 278/600 to312/600; steel+setup 3→41, previous-master 50→22 (regressed).

## Cycle 3: changes directed at new weaknesses
[CI](https://github.com/jugemes/champions-mc-lab/actions/runs/38531810037) / 7,200 battles.
C + Rillaboom control317/600; further Mega Gengar→Gholdengo364/600 (worst scenario13.3%); further Skeledirge→Corviknight401/600 but worst scenario9.3%.
E + Eelektross control312/600; further Skeledirge→Primarina383/600, worst scenario30.7%. The latter sacrifices Unaware, a serious human-play risk.

## Cycle 4: different synthetic opponent compositions
[CI](https://github.com/jugemes/champions-mc-lab/actions/runs/38532389842) / 8,000 games; eight new six-species preview lineups not used for tuning.
C original296/800 (37.0%); E original430/800 (53.75%).
C with Rillaboom and Gholdengo for Corviknight/Gengar: **538/800 (67.25%)**, worst 40%.
E with Eelektross and Primarina replacing Primarina/Skeledirge stepwise: **487/800 (60.88%)**, worst31%.

## Cycle 5: alternative opposing tactical policy
[CI](https://github.com/jugemes/champions-mc-lab/actions/runs/38532981719) / 6,000 battles. Same alternative opponent preview lineups but opponent move/switch AI is now v2 instead of baseline.
C original466/1000 (46.6%); E original621/1000 (62.1%).
C improved: **716/1000 (71.6%)**, worst45.6%.
E improved: **752/1000 (75.2%)**, worst48%.
Under paired seeds, C beats E in 162 discordant outcomes, E beats C in 198 (exact paired sign test p≈0.065). The relative ranking reverses across different opposing tactical policies; neither is unambiguously superior.

## Valid candidate for limited real-ranked trial
**C revised:** Golisopod (Golisopite), Garchomp (Choice Scarf), Primarina (Sitrus Berry), Rillaboom (Miracle Seed), Skeledirge (Leftovers), Gholdengo (Air Balloon).

**E revised:** Starmie (Choice Scarf), Rillaboom (Miracle Seed), Golisopod (Golisopite), Gholdengo (Air Balloon), Primarina (Sitrus Berry), Eelektross (Rocky Helmet).

All variants and changes are in code and pass the pinned Showdown validator. These results are **NOT Pokémon Champions ranked win rates**. Enemy move/selection policies are heuristic; the eight holdout preview lineups are constructed, not metagame-frequency sampled; both policies share implementation flaws. Real ladder/replay testing is required before Champion-tier claims.

Unlike the previously misleading five-cycle static-ranking experiment, these trials actually followed failure→AI fix→team change→matchup-specific change→separate tests. Sample sizes were selected for paired diagnosis, NOT five repeats of 10,000 games each.
