param([Parameter(Mandatory=$true)][string]$Endpoint)
$ErrorActionPreference = 'Stop'
[Console]::InputEncoding = [System.Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
# One CDP socket over stdio. Windows owns the browser; no listening Windows
# interface, firewall exception, service or user browser preference is needed.
Add-Type -TypeDefinition @'
using System;
using System.IO;
using System.Net.WebSockets;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
public class ReversiCdp {
 public static void Run(string endpoint) {
  using(var ws=new ClientWebSocket()) {
   ws.ConnectAsync(new Uri(endpoint),CancellationToken.None).GetAwaiter().GetResult();
   var send=Task.Run(async()=>{
    string line;
    while((line=Console.ReadLine())!=null) {
     var data=Encoding.UTF8.GetBytes(line);
     await ws.SendAsync(new ArraySegment<byte>(data),WebSocketMessageType.Text,true,CancellationToken.None);
    }
   });
   var receive=Task.Run(async()=>{
    var buffer=new byte[65536];
    while(ws.State==WebSocketState.Open) {
     using(var stream=new MemoryStream()) {
      WebSocketReceiveResult r;
      do {
       r=await ws.ReceiveAsync(new ArraySegment<byte>(buffer),CancellationToken.None);
       if(r.MessageType==WebSocketMessageType.Close)return;
       stream.Write(buffer,0,r.Count);
      } while(!r.EndOfMessage);
      Console.WriteLine(Encoding.UTF8.GetString(stream.ToArray()));Console.Out.Flush();
     }
    }
   });
   Task.WaitAny(send,receive);
  }
 }
}
'@
[ReversiCdp]::Run($Endpoint)
