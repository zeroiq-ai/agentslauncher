import json,os,urllib.request,collections,concurrent.futures as cf,time
R='https://rpc.mainnet.chain.robinhood.com'
TP=json.load(open('/tmp/tokpx.json')); STOCK={v.lower():k for k,v in TP['tok'].items()}
T='0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'
pools=json.load(open('/tmp/stockpools.json')); POOLS={p[0].lower() for p in pools if len(p[0])==42}
trades=[]
for i in range(len(pools)):
    f=f'/tmp/trades/p{i}.json'
    if os.path.exists(f):
        try: trades+= [x['attributes'] for x in json.load(open(f))['data']]
        except Exception: pass
txs=list({t['tx_hash'] for t in trades}); print('unique tx',len(txs))
def batch(hs):
    body=json.dumps([{'jsonrpc':'2.0','id':i,'method':'eth_getTransactionReceipt','params':[h]} for i,h in enumerate(hs)]).encode()
    for k in range(4):
        try:
            r=urllib.request.urlopen(urllib.request.Request(R,data=body,headers={'content-type':'application/json','user-agent':'curl/8.5.0'}),timeout=60).read()
            return [x.get('result') for x in json.loads(r)]
        except Exception as e: err=e; time.sleep(2*(k+1))
    raise err
rcs={}
if os.path.exists('receipts.json'): rcs=json.load(open('receipts.json'))
else:
    chunks=[txs[i:i+40] for i in range(0,len(txs),40)]
    with cf.ThreadPoolExecutor(4) as ex:
        for hs,res in zip(chunks,ex.map(batch,chunks)):
            for h,r in zip(hs,res):
                if r: rcs[h]=r
    json.dump(rcs,open('receipts.json','w'))
print('receipts',len(rcs))
# intermediaries: addresses that appear as both sender and receiver of stock tokens in many different txs
seen=collections.Counter(); out=collections.Counter(); inn=collections.Counter()
for h,r in rcs.items():
    addrs=set()
    for l in r['logs']:
        if l['topics'] and l['topics'][0]==T and l['address'].lower() in STOCK and len(l['topics'])==3:
            a='0x'+l['topics'][1][-40:]; b='0x'+l['topics'][2][-40:]; out[a]+=1; inn[b]+=1; addrs|={a,b}
    for a in addrs: seen[a]+=1
inter={a for a in seen if a in POOLS or (seen[a]>=25 and inn[a]>0 and out[a]>0 and abs(inn[a]-out[a])<=max(3,0.1*seen[a]))}
owners=collections.Counter(); ovol=collections.Counter(); tx_owner={}
for h,r in rcs.items():
    c=collections.Counter()
    for l in r['logs']:
        if l['topics'] and l['topics'][0]==T and l['address'].lower() in STOCK and len(l['topics'])==3:
            for a in ('0x'+l['topics'][1][-40:],'0x'+l['topics'][2][-40:]):
                if a not in inter and a!='0x'+'0'*40: c[a]+=1
    if c: o=c.most_common(1)[0][0]; owners[o]+=1; tx_owner[h]=o
for t in trades:
    o=tx_owner.get(t['tx_hash'])
    if o: ovol[o]+=float(t['volume_in_usd'] or 0)
print('intermediaries (pools/routers)',len(inter),'| distinct real owners',len(owners))
print('owners by tx count:',collections.Counter(min(v,10) for v in owners.values()))
relayers=collections.Counter(r['from'].lower() for r in rcs.values())
print('distinct tx senders',len(relayers),'| owners that are also the tx sender',sum(1 for h,o in tx_owner.items() if rcs[h]['from'].lower()==o))
json.dump(dict(owners=owners,ovol=ovol,inter=list(inter)),open('owners.json','w'))
