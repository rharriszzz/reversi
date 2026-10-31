// Independent profiling model and accounting. No HIS_profile code is reused.
export const VERSION = 1;
const fail = message => { throw new Error(message); };
const finite = x => typeof x === 'number' && Number.isFinite(x);
const hex = x => typeof x === 'string' && /^0x[0-9a-f]+$/i.test(x);
export function validateProfile(p) {
  if (!p || p.version !== VERSION || !['ip','stacks'].includes(p.kind)) fail('Unsupported profile version or kind');
  for (const key of ['id','workloadId','workloadFingerprint','buildId','method']) if (typeof p[key] !== 'string' || !p[key].trim()) fail(`Missing ${key}`);
  if (!p.event || typeof p.event.name !== 'string' || !p.event.name.trim() || typeof p.event.unit !== 'string' || !p.event.unit.trim()) fail('Missing event labeling');
  if (!Array.isArray(p.frames) || !Array.isArray(p.samples) || !p.accounting) fail('Missing sample records');
  if (p.kind === 'ip' && p.stacks !== undefined) fail('IP records cannot acquire caller relationships');
  if (p.kind === 'stacks' && !Array.isArray(p.stacks)) fail('Missing real stacks');
  if (p.frames.length > 200000 || p.samples.length > 2000000) fail('Profile exceeds local viewer limits');
  for (const f of p.frames) {
    if (!f || typeof f.name !== 'string' || typeof f.module !== 'string') fail('Malformed frame');
    if (f.address !== null && !hex(f.address)) fail('Invalid instruction address');
    if (p.kind==='ip' && f.address===null && !f.unresolved) fail('An IP location without an address must remain unresolved');
    if (f.start != null || f.end != null) {
      if (![f.start,f.end,f.relativeAddress].every(hex)) fail('Incomplete address containment');
      const [a,b,x] = [f.start,f.end,f.relativeAddress].map(BigInt);
      if (a >= b || x < a || x >= b) fail('Address outside half-open symbol interval');
    }
  }
  if (p.kind === 'stacks') for (const stack of p.stacks) {
    if (!Array.isArray(stack) || stack.length > 2048 || stack.some(i => !Number.isInteger(i) || !p.frames[i])) fail('Invalid stack frame reference');
  }
  if (p.timestamps && (p.timestamps.originTraceNs!=null || p.timestamps.endTraceNs!=null) && (!finite(p.timestamps.originTraceNs) || !finite(p.timestamps.endTraceNs) || p.timestamps.endTraceNs<=p.timestamps.originTraceNs)) fail('Invalid capture timestamp boundaries');
  let count = 0, weight = 0, unresolvedWeight = 0, unresolvedContextWeight = 0, last = -Infinity;
  for (const s of p.samples) {
    if (!Array.isArray(s) || s.length < 4 || !Number.isInteger(s[1]) || !finite(s[2]) || s[2] < 0) fail('Malformed weighted sample');
    if (s[0] !== null && (!finite(s[0]) || s[0] < 0 || s[0] < last)) fail('Invalid or unsorted sample timestamp');
    if (s[0] !== null && (typeof p.timestamps?.provenance!=='string' || !p.timestamps.provenance.trim())) fail('Timestamp has no provenance');
    if (s[0] !== null && finite(p.timestamps?.endTraceNs) && s[0]>p.timestamps.endTraceNs-p.timestamps.originTraceNs) fail('Sample timestamp lies outside capture boundaries');
    if (s[0] !== null) last = s[0];
    if (!(p.kind === 'ip' ? p.frames[s[1]] : p.stacks[s[1]])) fail('Sample references missing location');
    const f = leafFrame(p,s); if (!f || f.unresolved) unresolvedWeight += s[2];
    if(p.kind==='stacks' && (!p.stacks[s[1]].length || p.stacks[s[1]].some(i=>p.frames[i].unresolved))) unresolvedContextWeight+=s[2];
    count++; weight += s[2];
  }
  if (!count || weight<=0) fail('Profile contains no positive accepted sample weight');
  const close = (a,b) => finite(a) && Math.abs(a-b) <= Math.max(1,Math.abs(b))*1e-10;
  if (count !== p.accounting.samples || !close(p.accounting.weight,weight) || !close(p.accounting.unresolvedWeight,unresolvedWeight)) fail('Sample denominator or unresolved mass does not balance');
  if (p.accounting.unresolvedContextWeight!==undefined && (p.kind!=='stacks' || !close(p.accounting.unresolvedContextWeight,unresolvedContextWeight))) fail('Unresolved caller-context mass does not balance');
  if (p.accounting.lost !== null && (!Number.isInteger(p.accounting.lost) || p.accounting.lost < 0)) fail('Invalid lost count');
  if (!Number.isInteger(p.accounting.discarded) || p.accounting.discarded < 0) fail('Invalid discarded count');
  return p;
}
export function leafFrame(p,s) {
  return p.frames[p.kind === 'ip' ? s[1] : p.stacks[s[1]].at(-1)];
}
export const symbolKey = f => f ? `${f.module}::${f.symbol || f.name}` : '(empty stack)';
export function hotspots(p, level='function', query='') {
  const map = new Map();
  for (const s of p.samples) {
    const f=leafFrame(p,s), key=level==='instruction'?`${symbolKey(f)}@${f?.relativeAddress || f?.address || '?'}`:symbolKey(f);
    if (!map.has(key)) map.set(key,{key,name:f?.symbol || f?.name || '(empty stack)',module:f?.module || 'Unresolved',address:f?.relativeAddress || f?.address || '—',frame:f,count:0,self:0,inclusive:0});
    const r=map.get(key);r.count++;r.self+=s[2];
  }
  if (p.kind==='stacks' && level==='function') for (const s of p.samples) {
    for (const key of new Set(p.stacks[s[1]].map(i=>symbolKey(p.frames[i])))) {
      if (!map.has(key)) {
        const f=p.frames[p.stacks[s[1]].find(i=>symbolKey(p.frames[i])===key)];
        map.set(key,{key,name:f.symbol || f.name,module:f.module,address:f.relativeAddress || f.address || '—',frame:f,count:0,self:0,inclusive:0});
      }
      map.get(key).inclusive+=s[2];
    }
  }
  return [...map.values()].filter(r=>`${r.name} ${r.module} ${r.address}`.toLowerCase().includes(query.toLowerCase())).sort((a,b)=>b.self-a.self || a.key.localeCompare(b.key));
}
function node(name,key=name) {return {name,key,weight:0,count:0,self:0,children:[]};}
function child(n,name,key=name,extra={}) {
  let c=n.children.find(x=>x.key===key);if(!c){c=Object.assign(node(name,key),extra);n.children.push(c);}return c;
}
export function callTree(p) {
  if (p.kind!=='stacks') fail('A call tree requires actual sampled calling stacks');
  const root=node('All sampled stacks');
  for (const s of p.samples) {
    let n=root;n.weight+=s[2];n.count++;
    for (const i of p.stacks[s[1]]) {
      const f=p.frames[i];n=child(n,f.symbol || f.name,symbolKey(f)+(f.inlined?' [inline]':''),{frame:f});n.weight+=s[2];n.count++;
    }
    n.self+=s[2];
  }
  return root;
}
export function addressTree(p) {
  const root=node('All sampled instruction locations');
  for (const s of p.samples) {
    const f=leafFrame(p,s);let n=root;n.weight+=s[2];n.count++;
    const parts=[['module',f?.module || 'Unresolved'],['symbol',f?.containingSymbol || f?.symbol || f?.name || '(empty stack)']];
    if (f?.relativeAddress && f.start != null) {
      const pc=BigInt(f.relativeAddress),start=BigInt(f.start),end=BigInt(f.end);
      for (const size of [256n,64n,16n,4n]) {
        const a=start+((pc-start)/size)*size,b=a+size<end?a+size:end;
        parts.push([`${size}`,`0x${a.toString(16)}–0x${b.toString(16)}`]);
      }
    } else parts.push(['address',f?.address || '(unresolved)']);
    for(const [kind,name] of parts){n=child(n,name,`${kind}:${name}`,{frame:f});n.weight+=s[2];n.count++;}
    n.self+=s[2];
  }
  return root;
}
// Presentation-only grouping. Every low-count descendant remains accessible.
export function visibleChildren(n, fraction=.005) {
  const sorted=[...n.children].sort((a,b)=>b.weight-a.weight),keep=[],small=[];
  for(const c of sorted)(c.weight < n.weight*fraction?small:keep).push(c);
  if(small.length){const other=node(`Other (${small.length} branches)`,'Other');other.children=small;other.weight=small.reduce((a,b)=>a+b.weight,0);other.count=small.reduce((a,b)=>a+b.count,0);keep.push(other);}
  return keep;
}
export function differential(a,b,paths=false) {
  if(a.workloadId!==b.workloadId || a.workloadFingerprint!==b.workloadFingerprint || a.event.name!==b.event.name || a.event.unit!==b.event.unit || a.method!==b.method) fail('Differential profiles require matched workloads, events, units and methods');
  if(paths && (a.kind!=='stacks'||b.kind!=='stacks')) fail('Calling-path differences require real stacks');
  const collect=p=>{
    const m=new Map();for(const s of p.samples){const key=paths?p.stacks[s[1]].map(i=>symbolKey(p.frames[i])).join(' → '):symbolKey(leafFrame(p,s));m.set(key,(m.get(key)||0)+s[2]);}return m;
  },am=collect(a),bm=collect(b);
  return [...new Set([...am.keys(),...bm.keys()])].map(key=>({key,before:100*(am.get(key)||0)/a.accounting.weight,after:100*(bm.get(key)||0)/b.accounting.weight})).map(r=>({...r,delta:r.after-r.before})).sort((x,y)=>Math.abs(y.delta)-Math.abs(x.delta));
}
export function speedscope(p) {
  if(p.kind!=='stacks') fail('Speedscope export requires sampled calling stacks');
  return {$schema:'https://www.speedscope.app/file-format-schema.json',shared:{frames:p.frames.map(f=>({name:f.name,...(f.source?{file:f.source,line:f.line||undefined}:{})}))},profiles:[{type:'sampled',name:`${p.id}: ${p.event.name} (${p.event.unit})`,unit:'none',startValue:0,endValue:p.accounting.weight,samples:p.samples.map(s=>p.stacks[s[1]]),weights:p.samples.map(s=>s[2])}],activeProfileIndex:0,exporter:'Reversi local profiling explorer'};
}
