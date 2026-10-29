"""Independent sampled occupancy. Active native searches differ from pool slots."""
import json
import os
from pathlib import Path
import sys
import time
out=Path(sys.argv[1])
while True:
    try:
        state=json.loads((out/'manifest.json').read_text())
        if state['status']!='running':break
        native=[]
        for proc in Path('/proc').iterdir() if Path('/proc').exists() else []:
            if not proc.name.isdigit():continue
            try:
                if os.readlink(proc/'exe')==state['pin']['binary']:native.append(int(proc.name))
            except OSError:pass
        row={'at':time.time(),'stage':state['stage'],'configuredWorkers':state['configuredWorkers'],
             'safeCap':state.get('resources',{}).get('workers'),'actualPool':state.get('actualPool'),
             'activeLabelTasks':state.get('activeLabelTasks'),'activeNativeSearches':len(native) if Path('/proc').exists() else None,'nativePids':native}
        with (out/'occupancy.jsonl').open('a') as f:f.write(json.dumps(row)+'\n')
        time.sleep(15)
    except (OSError,ValueError):break
