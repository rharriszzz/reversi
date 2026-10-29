import { existsSync } from 'node:fs';
import { atomic, read } from '../research/io.mjs';
import { hash } from './protocol.mjs';
export function verifyReceipt(receipt,identity) {
  const {checksum,...body}=receipt;
  if(checksum!==hash(body)||receipt.identity!==identity) throw Error('Receipt identity/digest mismatch');
  return receipt.result;
}
// Sequential coordinator only; an existing receipt is immutable, never repaired.
export async function receipt(path,identity,work) {
  if(existsSync(path)) return verifyReceipt(read(path),identity);
  const start=performance.now(),result=await work(),body={identity,result,wallMs:performance.now()-start};
  atomic(path,{...body,checksum:hash(body)}); return result;
}
