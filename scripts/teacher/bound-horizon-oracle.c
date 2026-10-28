/* GPL-3.0-only. Engineering test harness linked to the external Edax evaluator.
 * Rules, pass/terminal logic and alpha-beta below are independent of Edax search.
 * This is never part of the independent exact solver or production engine. */
#define main edax_unused_program_main
#include "all.c"
#undef main
static int bh_board[100],bh_cells[64],bh_steps[8]={-11,-10,-9,-1,1,9,10,11};
static unsigned long long bh_nodes,bh_leaves;
typedef struct {uint64_t p,o;int depth,value,best,valid,exact;} BHEntry;
static BHEntry bh_table[1<<18];
static clock_t bh_started;
static Eval bh_eval;

static int bh_moves(int player,int *moves){
 int n=0;
 for(int i=0;i<64;i++){int at=bh_cells[i];if(bh_board[at])continue;
  for(int d=0;d<8;d++){int q=at+bh_steps[d];if(bh_board[q]!=-player)continue;while(bh_board[q]==-player)q+=bh_steps[d];if(bh_board[q]==player){moves[n++]=at;break;}}
 }return n;
}
static int bh_make(int at,int p,int *flips){
 int n=0;bh_board[at]=p;
 for(int d=0;d<8;d++){int q=at+bh_steps[d];while(bh_board[q]==-p)q+=bh_steps[d];if(bh_board[q]!=p)continue;for(q=at+bh_steps[d];bh_board[q]==-p;q+=bh_steps[d]){flips[n++]=q;bh_board[q]=p;}}
 return n;
}
static void bh_undo(int at,int p,int n,int *flips){bh_board[at]=0;for(int i=0;i<n;i++)bh_board[flips[i]]=-p;}
static Board bh_native(int p){Board b={0,0};for(int i=0;i<64;i++){if(bh_board[bh_cells[i]]==p)b.player|=1ULL<<i;else if(bh_board[bh_cells[i]]==-p)b.opponent|=1ULL<<i;}return b;}
static int bh_terminal(int p){int margin=0,empty=0;for(int i=0;i<64;i++){margin+=p*bh_board[bh_cells[i]];empty+=bh_board[bh_cells[i]]==0;}return margin+(margin>0?empty:margin<0?-empty:0);}
static int bh_visit(int depth,int p,int alpha,int beta){
 int moves[64],other[64],n=bh_moves(p,moves);bh_nodes++;
 if((bh_nodes&4095)==0 && (double)(clock()-bh_started)/CLOCKS_PER_SEC>20){fputs("horizon oracle cap\n",stderr);exit(124);}
 Board key=bh_native(p);unsigned slot=(unsigned)((key.player^(key.player>>32)^key.opponent^(key.opponent>>27))*2654435761u)&((1<<18)-1);BHEntry *e=bh_table+slot;
 int match=e->valid&&e->p==key.player&&e->o==key.opponent&&e->depth==depth,originalAlpha=alpha,originalBeta=beta,bestMove=-1;
 if(match&&e->exact)return e->value;
 if(match)for(int i=0;i<n;i++)if(moves[i]==e->best){int t=moves[0];moves[0]=moves[i];moves[i]=t;break;}
 for(int i=1;i<n;i++)if(moves[i]==11||moves[i]==18||moves[i]==81||moves[i]==88){int t=moves[0];moves[0]=moves[i];moves[i]=t;break;}

 if(!n&&!bh_moves(-p,other))return bh_terminal(p);
 if(depth==0){Board b=bh_native(p);eval_set(&bh_eval,&b);int score=eval_accumulate(&bh_eval);score+=(score>0?64:-64);score/=128;bh_leaves++;score=score < -63?-63:score>63?63:score;*e=(BHEntry){key.player,key.opponent,depth,score,-1,1,1};return score;}
 if(!n)return -bh_visit(depth,-p,-beta,-alpha);
 int best=-65;
 for(int i=0;i<n;i++){int flips[64],k=bh_make(moves[i],p,flips),value=-bh_visit(depth-1,-p,-beta,-alpha);bh_undo(moves[i],p,k,flips);if(value>best){best=value;bestMove=moves[i];}if(value>alpha)alpha=value;if(alpha>=beta)break;}
 *e=(BHEntry){key.player,key.opponent,depth,best,bestMove,1,best>originalAlpha&&best<originalBeta};return best;
}
static int bh_value(int depth,int p){Board b=bh_native(p);int low=2*get_stability(b.player,b.opponent)-64,high=64-2*get_stability(b.opponent,b.player),v=bh_visit(depth,p,-65,65);return v<low?low:v>high?high:v;}
int main(int argc,char **argv){
 if(argc!=5||strlen(argv[2])!=64)return 2;
 for(int i=0;i<100;i++)bh_board[i]=9;
 for(int i=0;i<64;i++){bh_cells[i]=11+(i/8)*10+i%8;char c=argv[2][i];if(c!='X'&&c!='O'&&c!='-')return 2;bh_board[bh_cells[i]]=c=='X'?1:c=='O'?-1:0;}
 int p=argv[3][0]=='X'?1:-1,depth=atoi(argv[4]);if(depth<0||depth>12)return 2;
 bh_started=clock();edge_stability_init();eval_open(argv[1]);eval_init(&bh_eval);
 int value=bh_value(depth,p),moves[64],n=bh_moves(p,moves);printf("{\"value\":%d,\"rows\":[",value);
 for(int i=0;i<n;i++){int flips[64],k=bh_make(moves[i],p,flips),score=-bh_value(depth>0?depth-1:0,-p);bh_undo(moves[i],p,k,flips);int at=moves[i],index=(at/10-1)*8+at%10-1;printf("%s{\"move\":%d,\"value\":%d}",i?",":"",index,score);}
 printf("],\"nodes\":%llu,\"leaves\":%llu}\n",bh_nodes,bh_leaves);eval_free(&bh_eval);eval_close();return 0;
}
