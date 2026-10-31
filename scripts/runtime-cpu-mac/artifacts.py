"""Preserve pinned historical artifacts and prove two-build byte identity."""
import hashlib,json,os,subprocess,sys
from pathlib import Path
OUT=Path(os.environ['REVERSI_FLIP_RUN']).resolve()
def sha(b):return hashlib.sha256(b).hexdigest()
def parse(b):return json.loads(b.decode().split('export default ')[1].strip().removesuffix(';'))
def main():
    OUT.mkdir(parents=True,exist_ok=True);mode=sys.argv[1]
    if mode=='old':
        assert not (OUT/'old-manifest.js').exists(),'Preserve existing reference'
        show=lambda p:subprocess.check_output(['git','show','6b480ed1bc6ddcdde2fdb37872c0ca8d0a804425:'+p])
        data=show('src/wasm/manifest.js');manifest=parse(data)
        for name,digest in manifest['artifacts'].items():
            content=show('src/wasm/'+name);assert sha(content)==digest
            assert not (OUT/name).exists();(OUT/name).write_bytes(content)
        (OUT/'old-manifest.js').write_bytes(data)
    elif mode=='first':
        assert not (OUT/'new-manifest-first.js').exists(),'Preserve first build'
        data=Path('src/wasm/manifest.js').read_bytes();manifest=parse(data)
        for name,digest in manifest['artifacts'].items():
            content=(Path('src/wasm')/name).read_bytes();assert sha(content)==digest
            assert not (OUT/name).exists();(OUT/name).write_bytes(content)
        (OUT/'new-manifest-first.js').write_bytes(data)
    elif mode=='compare':
        data=Path('src/wasm/manifest.js').read_bytes();manifest=parse(data)
        same={name:(OUT/name).read_bytes()==(Path('src/wasm')/name).read_bytes() for name in manifest['artifacts']}
        same['manifest.js']=(OUT/'new-manifest-first.js').read_bytes()==data;assert all(same.values())
        result={'passed':True,'byteIdentical':same,'fingerprint':manifest['fingerprint'],'manifestSha256':sha(data),'artifacts':manifest['artifacts']}
        (OUT/'reproducibility.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
    else:raise ValueError('Expected old, first or compare')
if __name__=='__main__':main()
