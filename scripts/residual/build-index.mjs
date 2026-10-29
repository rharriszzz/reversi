// Short-lived process returns its large historical parsing heap to the OS.
import { historical } from './data.mjs';
import { KeyIndex } from './index.mjs';
import { atomic } from '../research/io.mjs';
const [repository,output,runIdentity]=process.argv.slice(2),start=performance.now();
const h=historical(repository,output),index=KeyIndex.from(h.keys);
index.save(`${output}/historical-index.bin`);
atomic(`${output}/historical-index.json`,{runIdentity,digest:index.digest(),seeds:[...h.seeds],
  audit:{...h.audit,wallMs:performance.now()-start,indexBytes:index.bytes.length,
    builderCpu:process.cpuUsage(),builderMaxRssBytes:process.resourceUsage().maxRSS*1024}});
