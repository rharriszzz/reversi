"""Read-only Linux perf-event probes; no privilege/configuration changes.

The direct syscall separates a missing perf frontend from kernel event support.
Run on x86-64 Linux only. Opening a sampling event tests eligibility, not that
interrupt samples have actually been delivered or precisely attributed.
"""
import ctypes
import errno
import gzip
import json
import os
import platform
import shutil
import subprocess
import tempfile
from pathlib import Path


def main():
    assert platform.system() == 'Linux' and platform.machine() == 'x86_64'
    libc = ctypes.CDLL(None, use_errno=True)
    libc.syscall.restype = ctypes.c_long
    # perf_event_attr ABI: type, size, config, period, sample_type,
    # read_format, flags, followed by zero-filled optional fields.
    class Attr(ctypes.Structure):
        _fields_ = [('type', ctypes.c_uint32), ('size', ctypes.c_uint32),
                    ('config', ctypes.c_uint64), ('period', ctypes.c_uint64),
                    ('sample_type', ctypes.c_uint64), ('read_format', ctypes.c_uint64),
                    ('flags', ctypes.c_uint64), ('rest', ctypes.c_ubyte * 72)]

    rows = []
    for name, kind, config in [('cycles', 0, 0), ('instructions', 0, 1),
                               ('ref-cycles', 0, 9), ('cpu-clock', 1, 0)]:
        for precise in ([0, 2] if kind == 0 else [0]):
            attr = Attr(type=kind, size=ctypes.sizeof(Attr), config=config,
                        period=1000000, sample_type=1,
                        flags=1 | (1 << 5) | (1 << 6) | (precise << 15))
            ctypes.set_errno(0)
            fd = libc.syscall(298, ctypes.byref(attr), 0, -1, -1, 0)
            error = ctypes.get_errno() if fd < 0 else 0
            rows.append({'event': name, 'type': kind, 'config': config,
                         'precise_ip': precise, 'userOnly': True,
                         'opened': fd >= 0, 'errno': error,
                         'errnoName': errno.errorcode.get(error),
                         'message': os.strerror(error) if error else 'opened'})
            if fd >= 0:
                os.close(fd)
    local = Path('.local-research/windows-pc-20261030/perf-tools/usr/lib/linux-tools-5.15.0-202/perf')
    perf = shutil.which('perf') or (str(local.resolve()) if local.exists() else None)
    commands = [['uname', '-a'], ['id'], ['cat', '/proc/sys/kernel/perf_event_paranoid']]
    if perf:
        commands += [[perf, '--version'], [perf, 'stat', '-e',
                     'cycles:u,instructions:u', '--', 'sleep', '0.2'],
                     [perf, 'stat', '-e', 'cpu-clock:u', '--', 'sleep', '0.2']]
    outputs = []
    for command in commands:
        result = subprocess.run(command, text=True, capture_output=True, timeout=10)
        outputs.append({'command': command, 'returnCode': result.returncode,
                        'stdout': result.stdout, 'stderr': result.stderr})
    dmesg = subprocess.run(['dmesg'], text=True, capture_output=True, timeout=10)
    kernel = [line for line in dmesg.stdout.splitlines()
              if any(s in line for s in ['Performance Events:', 'Hypervisor detected:', 'NMI watchdog:'])]
    config = []
    if Path('/proc/config.gz').exists():
        config = [line for line in gzip.open('/proc/config.gz', 'rt')
                  if line.startswith(('CONFIG_PERF_EVENTS=', 'CONFIG_HW_PERF_EVENTS=', 'CONFIG_X86_LOCAL_APIC='))]
    # CPUID is guest-visible evidence, independent of perf/kernel frontend.
    with tempfile.TemporaryDirectory() as tmp:
        source = Path(tmp)/'cpuid.cpp'
        source.write_text('#include <cpuid.h>\n#include <cstdio>\nint main(){unsigned a,b,c,d; __cpuid_count(0xa,0,a,b,c,d);printf("leaf_0A EAX=%08x EBX=%08x ECX=%08x EDX=%08x\\n",a,b,c,d);}\n')
        subprocess.run([os.environ.get('CXX', 'g++'), str(source), '-o', str(Path(tmp)/'cpuid')], check=True, capture_output=True)
        cpuid = subprocess.check_output([str(Path(tmp)/'cpuid')], text=True).strip()
    print(json.dumps({'eventSources': sorted(p.name for p in Path('/sys/bus/event_source/devices').iterdir()),
                      'kernelMessages': kernel, 'kernelConfig': config, 'guestCpuid': cpuid,
                      'syscall': 'perf_event_open, x86-64 syscall 298, current thread, any CPU',
                      'probes': rows, 'commands': outputs}, indent=2))


if __name__ == '__main__':
    main()
