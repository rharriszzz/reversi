// Sorted full SHA-256 keys: ~32 bytes/key rather than millions of JS strings.
import { readFileSync, openSync, writeFileSync, fsyncSync, closeSync, renameSync } from 'node:fs';
import { createHash } from 'node:crypto';
export class KeyIndex {
  constructor(bytes) {if(bytes.length%32)throw Error('Malformed historical key index');this.bytes=bytes;this.size=bytes.length/32;}
  static from(keys) {
    const sorted=[...keys].sort(),bytes=Buffer.allocUnsafe(sorted.length*32);
    for(let i=0;i<sorted.length;i++)bytes.write(sorted[i],i*32,32,'hex');
    return new KeyIndex(bytes);
  }
  has(hex) {
    const target=Buffer.from(hex,'hex');if(target.length!==32)throw Error('Malformed historical key');
    let lo=0,hi=this.size;
    while(lo<hi){const mid=(lo+hi)>>>1,c=target.compare(this.bytes,mid*32,mid*32+32);if(c===0)return true;if(c<0)hi=mid;else lo=mid+1;}
    return false;
  }
  digest(){return createHash('sha256').update(this.bytes).digest('hex');}
  save(path) {
    const tmp=`${path}.tmp-${process.pid}`,fd=openSync(tmp,'w');
    try{writeFileSync(fd,this.bytes);fsyncSync(fd);}finally{closeSync(fd);}renameSync(tmp,path);
  }
  static load(path){return new KeyIndex(readFileSync(path));}
}
