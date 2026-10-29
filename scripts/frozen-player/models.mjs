import assert from 'node:assert/strict';
import { read } from '../research/io.mjs';
import { makeModel, verifyModel } from '../next-residual/linear.mjs';
import { makePattern, verifyPattern } from '../next-residual/model.mjs';
import { PROTOCOL, hash } from './protocol.mjs';
export function frozenModels(path='docs/data/next-residual-coefficients-20261029.json') {
  const evidence=read(path), L=makeModel(evidence.linearCorrections,evidence.linearMetadata);
  const P=makePattern(L,evidence.coefficients,evidence.patternMetadata);
  verifyModel(L); verifyPattern(P);
  assert.equal(L.checksum,PROTOCOL.models.L,'Exact L reconstruction required');
  assert.equal(P.checksum,PROTOCOL.models.P,'Exact P reconstruction required');
  assert.equal(evidence.linearModelChecksum,L.checksum); assert.equal(evidence.patternModelChecksum,P.checksum);
  assert.deepEqual(L.weights,evidence.linearWeights); assert.deepEqual(P.pattern,evidence.patternSpecification);
  assert.equal(hash(evidence.distinctTrainingSourceSupport),P.metadata.supportHash);
  for(let i=0;i<P.coefficients.length;i++) if(!evidence.distinctTrainingSourceSupport[i]) assert.equal(P.coefficients[i],0);
  return {B:'B',L,P};
}
