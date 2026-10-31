import {readFileSync} from 'node:fs';
// Preserve the qualified corpus generator, mailbox reference and timing loop.
export function microSource(enhanced=false,label='selected') {
 let source=readFileSync(new URL('../fast-flips/micro.cpp',import.meta.url),'utf8');
 if(enhanced)source=source.replace('using Bits=uint64_t;', 'namespace reversi::cpu_enhanced {Bits flips(Bits,Bits,int);Board play(Board,int,int);}\nusing Bits=uint64_t;').replaceAll('reversi::flips','reversi::cpu_enhanced::flips').replaceAll('reversi::play','reversi::cpu_enhanced::play');
 return source.replace('const std::array<Fn,6> functions={kernel0,kernel1,kernel2,kernel3,kernel4,','const std::array<Fn,1> functions={')
  .replace('const char* names[]={"original","masked-loop","unrolled","doubling","ray-table","selected"};',`const char* names[]={"${label}"};`)
  .replace('at<6;at++','at<1;at++').replace('int tag=(at+rep)%6;if(rep%2)tag=5-tag;','int tag=0;');
}
