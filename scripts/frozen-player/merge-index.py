#!/usr/bin/env python3
"""Streaming unique merge of sorted full-SHA binary shards, with bounded heap."""
import hashlib, heapq, json, mmap, os, sys
from pathlib import Path
out, base, chunks = map(Path,sys.argv[1:])
paths = [base, *sorted(chunks.glob('*.bin'))]
files = [p.open('rb') for p in paths]
maps = [mmap.mmap(f.fileno(),0,access=mmap.ACCESS_READ) for f in files if os.fstat(f.fileno()).st_size]
for m in maps:
    if len(m)%32: raise ValueError('Malformed full SHA shard')
def keys(m):
    for i in range(0,len(m),32): yield m[i:i+32]
count=0; old=None; digest=hashlib.sha256()
with out.with_suffix('.tmp').open('wb') as stream:
    for key in heapq.merge(*(keys(m) for m in maps)):
        if key!=old:
            stream.write(key);digest.update(key);count+=1;old=key
    stream.flush();os.fsync(stream.fileno())
os.replace(out.with_suffix('.tmp'),out)
for m in maps:m.close()
for f in files:f.close()
print(json.dumps(dict(keys=count,sha256=digest.hexdigest(),shards=len(paths))))
