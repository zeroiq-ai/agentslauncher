import json,time,urllib.request,concurrent.futures as cf
R='https://rpc.mainnet.chain.robinhood.com'
TP=json.load(open('/tmp/tokpx.json')); TOK={k:v for k,v in TP['tok'].items() if k in TP['px']}; PX={k:{int(t):v for t,v in d.items()} for k,d in TP['px'].items()}
ADDR2SYM={v:k for k,v in TOK.items()}
TRANSFER='0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'
def rpc(m,p,retry=4):
    for i in range(retry):
        try:
            req=urllib.request.Request(R,data=json.dumps({'jsonrpc':'2.0','id':1,'method':m,'params':p}).encode(),headers={'content-type':'application/json','user-agent':'curl/8.5.0'})
            d=json.loads(urllib.request.urlopen(req,timeout=40).read())
            if 'error' in d: raise RuntimeError(d['error'])
            return d['result']
        except Exception as e:
            err=e; time.sleep(1.5*(i+1))
    raise err
latest=int(rpc('eth_blockNumber',[]),16)
b_now=rpc('eth_getBlockByNumber',[hex(latest),False]); b_old=rpc('eth_getBlockByNumber',[hex(latest-2_000_000),False])
t_now=int(b_now['timestamp'],16); t_old=int(b_old['timestamp'],16); bps=2_000_000/(t_now-t_old)
start=latest-int(30*86400*bps)
print('blocks/s',round(bps,2),'start block',start)
DEC={s:int(rpc('eth_call',[{'to':a,'data':'0x313ce567'},'latest']),16) for s,a in TOK.items()}
def ts_of(bn): return t_now-(latest-bn)/bps
def price(sym,t):
    d=PX[sym]; day=int(t//86400*86400)
    ks=sorted(d); best=min(ks,key=lambda k:abs(k-day)); return d[best]
pad=lambda a:'0x'+'0'*24+a[2:].lower()
def fetch_all(ws):
    P=[pad(w) for w in ws]; chunks=list(range(start,latest+1,100000)); res=[]
    def rng(a,b,side):
        topics=[TRANSFER,None,None]; topics[side]=P
        try: return [(side,l) for l in rpc('eth_getLogs',[{'fromBlock':hex(a),'toBlock':hex(b),'address':list(TOK.values()),'topics':topics}],retry=1 if b-a>2000 else 4)]
        except Exception as e:
            if 'exceeds limit' in str(e) and b>a: m=(a+b)//2; return rng(a,m,side)+rng(m+1,b,side)
            if 'exceeds limit' not in str(e): return rng(a,b,side) if b-a<=2000 else (rng(a,(a+b)//2,side)+rng((a+b)//2+1,b,side))
            raise
    def q(args):
        a,side=args; return rng(a,min(a+99999,latest),side)
    jobs=[(a,s) for a in chunks for s in (1,2)]
    with cf.ThreadPoolExecutor(6) as ex:
        for k,r in enumerate(ex.map(q,jobs)):
            res+=r
            if k%100==0: print('chunk',k,'/',len(jobs),'logs',len(res),flush=True)
    return res
def wallet(w,logs):
    bal_now={}
    for s,a in TOK.items():
        bal_now[s]=int(rpc('eth_call',[{'to':a,'data':'0x70a08231'+pad(w)[2:]},'latest']),16)/10**DEC[s]
    net={s:0.0 for s in TOK}; buys={s:0.0 for s in TOK}; buy_usd=0.0; sell_usd=0.0; n=0; days=set()
    for side,l in logs:
        s=ADDR2SYM[l['address'].lower()]; amt=int(l['data'],16)/10**DEC[s]; t=ts_of(int(l['blockNumber'],16)); p=price(s,t); days.add(int(t//86400))
        if side==2: net[s]+=amt; buys[s]+=amt; buy_usd+=amt*p
        else: net[s]-=amt; sell_usd+=amt*p
        n+=1
    start_q={s:max(0.0,bal_now[s]-net[s]) for s in TOK}
    t0=ts_of(start); start_val=sum(start_q[s]*price(s,t0) for s in TOK)
    now_val=sum(bal_now[s]*price(s,t_now) for s in TOK)
    invested=start_val+buy_usd
    if invested<50: return dict(w=w,n=n,invested=invested,skip=True)
    actual=now_val+sell_usd
    hold=sum((start_q[s]+buys[s])*price(s,t_now) for s in TOK)
    held=sorted([(s,round(bal_now[s]*price(s,t_now))) for s in TOK if bal_now[s]*price(s,t_now)>1],key=lambda x:-x[1])
    return dict(w=w,n=n,days=len(days),invested=round(invested),now_val=round(now_val),r=round((actual/invested-1)*100,2),hold=round((hold/invested-1)*100,2),vs=round((actual-hold)/invested*100,2),held=held,skip=False)
O=json.load(open('owners.json')); own=O['owners']; ov=O['ovol']
top=sorted([w for w in own if own[w]<10],key=lambda w:-ov.get(w,0))[:100]
keep=[{'w':w,'vol':ov.get(w,0)} for w in top]
cat={w:('frequent (10+ tx in ~50 min)' if own[w]>=10 else 'occasional') for w in top}
import os
if os.path.exists('logs2.json'): ALL=[tuple(x) for x in json.load(open('logs2.json'))]
else:
    ALL=fetch_all([r['w'] for r in keep]); json.dump(ALL,open('logs.json','w'))
by={r['w']:[] for r in keep}
for side,l in ALL:
    w='0x'+l['topics'][side][-40:]
    if w in by: by[w].append((side,l))
out=[]
with cf.ThreadPoolExecutor(4) as ex:
    futs={ex.submit(wallet,w,by[w]):w for w in by}
    for f in cf.as_completed(futs):
        try: x=f.result(); x['cat']=cat[x['w']]; out.append(x)
        except Exception as e: out.append(dict(w=futs[f],err=str(e)[:120]))
json.dump(dict(start=start,latest=latest,t_now=t_now,out=out),open('/home/claude/research/history2.json','w'),indent=1)
ok=[x for x in out if not x.get('skip') and 'err' not in x]
print('wallets',len(out),'ok',len(ok),'errors',sum(1 for x in out if 'err' in x),'tiny',sum(1 for x in out if x.get('skip')))
