import { load, pinFor, makeFixture, validateSuite, task } from './suite.mjs';
const [mode, fixtureFile, buildFile, evalFile, output, kind, index] = process.argv.slice(2);
const pin = pinFor(buildFile, evalFile);
const result = mode === 'fixture' ? await makeFixture(pin) : mode === 'validate'
  ? await validateSuite(load(fixtureFile), pin, output + '.validation')
  : await task(load(fixtureFile), pin, kind, Number(index));
// Includes full model packing, receipt serialization, fsync and directory fsync.
const { atomic } = await import('../research/io.mjs');
atomic(output, result);
console.log(JSON.stringify({ output, kind, numericalHash: result.numericalHash, passed: result.passed }));
