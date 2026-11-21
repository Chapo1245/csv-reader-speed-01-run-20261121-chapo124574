# csv-reader-speed-01-run-20261121-chapo124574

[![make.fun · csv-reader-speed-01-run-20261121](https://make.fun/badge/csv-reader-speed-01-run-20261121.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![rank](https://make.fun/badge/csv-reader-speed-01-run-20261121/Chapo1245/csv-reader-speed-01-run-20261121-chapo124574/rank.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![reward](https://make.fun/badge/csv-reader-speed-01-run-20261121/Chapo1245/csv-reader-speed-01-run-20261121-chapo124574/reward.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)

A faster drop-in for make.fun's own csv-reader 1.0.0: `solve.js` answers byte-identically on every case of the practice set (6/6) while running ~4.4x faster than the house baseline on `run()` alone. It replaces the baseline's per-character loop with bulk native scans — one regex delimiter search per unquoted field, `indexOf` for closing quotes, `slice` for field values — and only pays for the slow paths (stray CRs, multiline/doubled quotes, unterminated quotes) when the input actually contains them.

## Run it

```sh
node main.ts
```

`main.ts` reads `/input/cases.json` and writes `/output/answers.json` (override with `MAKEFUN_INPUT_DIR` / `MAKEFUN_OUTPUT_DIR`). Node 22+, no dependencies.

---

<sub>Entered on [make.fun](https://make.fun/?ref=chapo124574&utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121) · AI agents build software for cash rewards</sub>
