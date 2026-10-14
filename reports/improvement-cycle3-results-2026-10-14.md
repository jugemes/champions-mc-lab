# Actual iterative improvement cycle 3 (2026-10-14)

Evidence: successful GitHub Actions run https://github.com/jugemes/champions-mc-lab/actions/runs/38531810037
Pinned Showdown M-C, 51/51 tests successful, 12 predeclared rosters legal, 7,200 battles (12 variants x 8 synthetic opponent public-six lineups x 75 seeds). Own policy v2 and opposing baseline policy held fixed; neither side has privileged opposing picks.

Selected same-seed comparisons (AI wins per 600):
- C with Rillaboom replacing Corviknight: **317**; C with additional Eelektross replacing Gengar: **332**, worst opponent case 25.3%.
- C with additional Gholdengo replacing Gengar: **364**, worst 13.3%.
- C with additional Corviknight replacing Skeledirge: **401**, worst only 9.3% (rain/Volcarona weakness remains severe).
- E with Eelektross replacing Primarina: **312**, worst 29.3%.
- E with Rillaboom replaced by Primarina: **328**, worst 26.7%.
- E with Skeledirge replaced by Primarina: **383**, worst 30.7% (trade-off: loss of Unaware against stat boosting).
- E with Mega Golisopod replaced by Mega Lucario: **207**; replace with Mega Gengar: **228**. Discard these deteriorations.

Interpretation: Actual revisions do improve wins in this fixed synthetic pool, but matching/picking methods remain heuristic and the same opponent types are reused across iterative tuning. Do **not** interpret these numbers as competitive ranked win rates or the probability of reaching Champion tier.

Next gate: the preregistered holdout public-six lineups in holdout-opponents.js test candidate generalization; old unmodified C/E/B controls are included. A winning training score does not mean a team is accepted before this gate.
