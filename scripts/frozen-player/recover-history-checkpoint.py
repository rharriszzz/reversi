#!/usr/bin/env python3
"""Recover compressed-member boundary for an early exporter checkpoint.

Only new local engineering output is mutable. Imported evidence is never touched.
"""
import json, os, sys, zlib
from pathlib import Path
root=Path(sys.argv[1]); path=root/'checkpoint.json'
if (root/'manifest.json').exists(): raise ValueError('Completed export is immutable')
c=json.loads(path.read_text()); target=c['occurrenceCount']; count=0; offset=0
with (root/'occurrences.jsonl.gz').open('rb') as stream:
    decoder=zlib.decompressobj(31)
    while True:
        pending=stream.read(1024*1024)
        if not pending:raise ValueError('Checkpoint boundary missing')
        while pending:
            output=decoder.decompress(pending);count+=output.count(b'\n')
            if decoder.eof:
                offset+=len(pending)-len(decoder.unused_data);pending=decoder.unused_data
                if count==target:break
                if count>target:raise ValueError('Checkpoint did not end at gzip member boundary')
                decoder=zlib.decompressobj(31)
            else:offset+=len(pending);pending=b''
        if count==target and decoder.eof:break
c['occurrenceBytes']=offset
repair=dict(kind='engineering-gzip-checkpoint-boundary-recovery',occurrences=count,compressedPrefixBytes=offset,
            reason='Completed extraction exceeded Node readFileSync 2-GiB limit while hashing. Stream hashing replaces that call; committed extraction is retained.')
(root/'checkpoint-recovery.json').write_text(json.dumps(repair))
with path.with_suffix('.tmp').open('w') as f:
    json.dump(c,f,separators=(',',':'));f.flush();os.fsync(f.fileno())
os.replace(path.with_suffix('.tmp'),path)
print(json.dumps(repair))
