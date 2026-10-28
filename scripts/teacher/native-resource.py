#!/usr/bin/env python3
"""Run one native command; wait4 accounts actual child CPU and maximum RSS."""
import json, os, sys, time, signal

def parent_death_signal():
    if sys.platform.startswith("linux"):
        import ctypes
        parent = os.getppid()
        ctypes.CDLL(None).prctl(1, signal.SIGKILL)
        if parent == 1 or os.getppid() != parent: os._exit(125)
from pathlib import Path

def main():
    target, command = Path(sys.argv[1]), sys.argv[2:]
    parent_death_signal()
    start = time.monotonic()
    pid = os.fork()
    if pid == 0:
        try:
            parent_death_signal()
            os.nice(10)
            os.execv(command[0], command)
        except BaseException as error:
            print(str(error), file=sys.stderr)
            os._exit(127)
    def expire(_signum, _frame):
        try: os.kill(pid, signal.SIGKILL)
        except ProcessLookupError: pass
    signal.signal(signal.SIGALRM, expire)
    signal.setitimer(signal.ITIMER_REAL, float(os.environ.get('REVERSI_NATIVE_TIMEOUT_MS', '180000'))/1000)
    _, status, usage = os.wait4(pid, 0)
    signal.setitimer(signal.ITIMER_REAL, 0)
    result = dict(userSeconds=usage.ru_utime, systemSeconds=usage.ru_stime,
                  maxRssBytes=usage.ru_maxrss * (1 if sys.platform == 'darwin' else 1024),
                  elapsedSeconds=time.monotonic()-start, status=os.waitstatus_to_exitcode(status),
                  accounting='POSIX wait4 child rusage; excludes Python wrapper')
    target.write_text(json.dumps(result))
    return result['status'] if result['status'] >= 0 else 128-result['status']

if __name__ == '__main__':
    sys.exit(main())
