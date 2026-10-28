`edax-bound.patch` and the linked `bound-horizon-oracle.c` harness are distributed
under GPL-3.0-only. The patch is a derivative patch to Edax 4.6 and is distributed under
GNU GPL version 3, reproduced in `EDAX_PATCH_LICENSE`. The original code is
Copyright 1998–2024 Richard Delorme and the other upstream contributors; their
notices and complete license remain in each separate local source build.

Corresponding source: https://github.com/abulmo/edax-reversi at commit
713a434f13b3d15fb69c61b9ba3641aed82c496c, plus `edax-bound.patch`.
`bound-setup.py` reproducibly constructs that source tree and records its exact
files, patch, build command, compiler and binary hashes. No Edax executable,
complete engine implementation or learned evaluation data is included in this
repository or the browser player. The patch applies only to the external test
teacher; it is never imported into the independent solver or ordinary engine.
