"""Read-only macOS resource snapshots. RSS is not unique physical allocation."""
import datetime,json,re,shutil,subprocess,sys

def command(*args):
    p=subprocess.run(args,text=True,capture_output=True)
    return p.stdout.strip() if p.returncode==0 else {'exit':p.returncode,'stderr':p.stderr.strip()}

def snapshot():
    raw=command('vm_stat');pages={k:int(v) for k,v in re.findall(r'^([^:\n]+):\s+(\d+)\.',raw,re.M)}
    size=int(re.search(r'page size of (\d+)',raw)[1])
    # macOS has no Linux MemAvailable. This cache-headroom estimate is not a
    # measured intersection of inactive/file-backed sets or a guaranteed floor.
    reclaimable=(pages.get('Pages free',0)+pages.get('Pages speculative',0)+min(pages.get('Pages inactive',0),pages.get('File-backed pages',0)))*size
    return {'utc':datetime.datetime.now(datetime.UTC).isoformat(),'model':command('sysctl','-n','hw.model'),
      'chip':command('sysctl','-n','machdep.cpu.brand_string'),'memoryBytes':int(command('sysctl','-n','hw.memsize')),
      'estimatedReadilyReclaimableBytes':reclaimable,'estimateDefinition':'free + speculative + min(inactive, file-backed) pages; not an exact OS available-memory value',
      'freeAndSpeculativeBytes':(pages.get('Pages free',0)+pages.get('Pages speculative',0))*size,
      'fileBackedResidentBytes':pages.get('File-backed pages',0)*size,
      'vmPages':pages,'pageBytes':size,'memoryPressure':command('memory_pressure','-Q'),
      'pressureLevel':command('sysctl','-n','kern.memorystatus_vm_pressure_level'),
      'swap':command('sysctl','vm.swapusage'),'diskFreeBytes':shutil.disk_usage('.').free,
      'processes':command('ps','-Ao','pid,pcpu,pmem,rss,comm','-r').splitlines()[:20]}

def check():
    r=snapshot()
    if r['estimatedReadilyReclaimableBytes']<4*2**30 or r['pressureLevel']!='1':
        raise RuntimeError('Resource headroom/pressure gate: '+json.dumps(r))
    return r
if __name__=='__main__':print(json.dumps(snapshot(),indent=2))
