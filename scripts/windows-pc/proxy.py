"""Private WSL loopback websocket -> Windows loopback CDP, through stdio."""
import asyncio
import contextlib
import sys
from pathlib import Path
from websockets.asyncio.server import serve

PS='/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe'

async def main():
    script=await asyncio.create_subprocess_exec('wslpath','-w',str(Path(__file__).with_name('cdp.ps1')),stdout=asyncio.subprocess.PIPE)
    path=(await script.communicate())[0].decode().strip()
    async def relay(socket):
        proc=await asyncio.create_subprocess_exec(PS,'-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',path,'-Endpoint',sys.argv[1],stdin=asyncio.subprocess.PIPE,stdout=asyncio.subprocess.PIPE,stderr=asyncio.subprocess.DEVNULL,limit=128*1024*1024)
        async def send():
            async for message in socket:
                proc.stdin.write(message.encode()+b'\n');await proc.stdin.drain()
        async def receive():
            while line:=await proc.stdout.readline():
                await socket.send(line.decode().strip())
        tasks=[asyncio.create_task(send()),asyncio.create_task(receive())]
        try:
            await asyncio.wait(tasks,return_when=asyncio.FIRST_COMPLETED)
        finally:
            for t in tasks:t.cancel()
            if proc.returncode is None:proc.terminate()
            await proc.wait()
            for t in tasks:
                with contextlib.suppress(asyncio.CancelledError,Exception):await t
    async with serve(relay,'127.0.0.1',0,max_size=128*1024*1024) as server:
        print('ws://127.0.0.1:'+str(server.sockets[0].getsockname()[1]),flush=True)
        await asyncio.Future()

if __name__=='__main__':asyncio.run(main())
