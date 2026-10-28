// Isolated C++17 research prototype. Original engine remains the reference.
#include <algorithm>
#include <array>
#include <chrono>
#include <cmath>
#include <cstdint>
#include <ctime>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <stdexcept>
#include <vector>
using U=uint64_t;
constexpr U A=0x0101010101010101ULL,H=A<<7;
U shift(U x,int d){switch(d){case 0:return (x&~H)<<1;case 1:return (x&~A)>>1;case 2:return x<<8;case 3:return x>>8;case 4:return (x&~H)<<9;case 5:return (x&~A)<<7;case 6:return (x&~H)>>7;default:return (x&~A)>>9;}}
U legal(U own,U opp){U result=0,empty=~(own|opp);for(int d=0;d<8;d++){U run=shift(own,d)&opp;for(int k=0;k<5;k++)run|=shift(run,d)&opp;result|=shift(run,d)&empty;}return result;}
U flips(U own,U opp,int q){U result=0;for(int d=0;d<8;d++){U ray=shift(U(1)<<q,d),run=0;while(ray&opp){run|=ray;ray=shift(ray,d);}if(ray&own)result|=run;}return result;}
int pop(U x){int n=0;while(x){x&=x-1;n++;}return n;}
struct Pattern{uint32_t size;std::vector<uint32_t> squares;std::vector<float> table;};
std::vector<Pattern> patterns;uint32_t phases=4,phaseStart=16;
uint32_t word(std::ifstream& f){uint32_t v;f.read(reinterpret_cast<char*>(&v),4);if(!f)throw std::runtime_error("truncated model");return v;}
void load(const char* path){std::ifstream f(path,std::ios::binary);if(word(f)!=0x52565431)throw std::runtime_error("model magic");phases=word(f);phaseStart=word(f);auto n=word(f);for(uint32_t i=0;i<n;i++){Pattern p;auto len=word(f);p.size=word(f);for(uint32_t k=0;k<len;k++)p.squares.push_back(word(f));p.table.resize(p.size*phases);f.read(reinterpret_cast<char*>(p.table.data()),p.table.size()*4);if(!f)throw std::runtime_error("model tables");patterns.push_back(std::move(p));}}
double evaluate(U black,U white,int player){int occupied=pop(black|white),phase=std::clamp((occupied-int(phaseStart))*int(phases)/(64-int(phaseStart)),0,int(phases)-1);double score=0;for(const auto& p:patterns){int code=0,power=1;for(auto q:p.squares){int cell=((black>>q)&1)?2:((white>>q)&1)?0:1;code+=cell*power;power*=3;}score+=p.table[phase*p.size+code];}return std::clamp(score,-1000.0,1000.0)*player;}
uint64_t nodes=0,evaluations=0;
double search(U black,U white,int player,int depth,double alpha,double beta){nodes++;U own=player==1?black:white,opp=player==1?white:black,moves=legal(own,opp);if(!moves){if(legal(opp,own))return -search(black,white,-player,depth,-beta,-alpha);int margin=(pop(black)-pop(white))*player;return margin==0?0:(margin>0?10000:-10000)+margin;}if(depth<=0){evaluations++;return evaluate(black,white,player);}double best=-1e9;for(int q=0;q<64;q++)if(moves&(U(1)<<q)){U f=flips(own,opp,q),a=own|f|(U(1)<<q),b=opp&~f;double v=-search(player==1?a:b,player==1?b:a,-player,depth-1,-beta,-alpha);best=std::max(best,v);alpha=std::max(alpha,best);if(alpha>=beta)break;}return best;}
int main(int argc,char**argv){try{if(argc!=2)throw std::runtime_error("model path required");const auto loadStart=std::chrono::steady_clock::now();load(argv[1]);double loadMs=std::chrono::duration<double,std::milli>(std::chrono::steady_clock::now()-loadStart).count();std::cout<<std::setprecision(17);int n,depth,repeats;std::cin>>n>>depth>>repeats;std::vector<std::array<U,3>> rows;for(int i=0;i<n;i++){U b=0,w=0;int player;std::cin>>player;for(int q=0;q<64;q++){int v;std::cin>>v;if(v==1)b|=U(1)<<q;else if(v==-1)w|=U(1)<<q;}rows.push_back({b,w,U(player==1?1:0)});}
const auto start=std::chrono::steady_clock::now();const auto cpu=std::clock();double checksum=0;
for(int rep=0;rep<repeats;rep++)for(int i=0;i<n;i++){auto [b,w,side]=rows[i];int p=side?1:-1;U own=p==1?b:w,opp=p==1?w:b,m=legal(own,opp);double score=search(b,w,p,depth,-1e9,1e9);checksum+=score;if(rep==0){std::cout<<"row "<<i<<" "<<m<<" "<<evaluate(b,w,p)<<" "<<score<<"\n";for(int q=0;q<64;q++)if(m&(U(1)<<q)){U f=flips(own,opp,q),a=own|f|(U(1)<<q),c=opp&~f;std::cout<<"move "<<i<<" "<<q<<" "<<(p==1?a:c)<<" "<<(p==1?c:a)<<"\n";}}}
double ms=std::chrono::duration<double,std::milli>(std::chrono::steady_clock::now()-start).count();std::cout<<"stats "<<ms<<" "<<1000.0*(std::clock()-cpu)/CLOCKS_PER_SEC<<" "<<loadMs<<" "<<nodes<<" "<<evaluations<<" "<<checksum<<"\n";
}catch(const std::exception& e){std::cerr<<e.what()<<"\n";return 1;}}
