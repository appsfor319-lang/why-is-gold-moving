// Keyless auto-refresh market snapshot. No API key. This is a transparent heuristic, not AI or consensus.
const fs=require("fs");
const OUT="research/live-market-outlook.json";
const H={"user-agent":"Mozilla/5.0 (compatible; GoldMarketDesk/1.0)"};
async function fetchText(url){const r=await fetch(url,{headers:H,signal:AbortSignal.timeout(15000)});if(!r.ok)throw new Error(url+" HTTP "+r.status);return r.text();}
async function quote(symbol){
 const u="https://query1.finance.yahoo.com/v8/finance/chart/"+encodeURIComponent(symbol)+"?range=5d&interval=1h";
 const j=await (await fetch(u,{headers:H,signal:AbortSignal.timeout(15000)})).json();
 const x=j.chart?.result?.[0];if(!x)throw Error("No Yahoo chart for "+symbol);
 const q=x.indicators.quote[0],cl=(q.close||[]).filter(Number.isFinite),hi=(q.high||[]).filter(Number.isFinite),lo=(q.low||[]).filter(Number.isFinite);
 if(cl.length<2)throw Error("Not enough observations for "+symbol);
 return {price:cl.at(-1),previous:cl.at(-2),first:cl[0],high:Math.max(...hi),low:Math.min(...lo),closes:cl};
}
function decode(s){return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,"$1").replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(+n));}
function tag(block,name){const m=block.match(new RegExp("<"+name+"(?:\\s[^>]*)?>([\\s\\S]*?)<\\/"+name+">","i"));return m?decode(m[1].trim()):"";}
function rss(xml){return [...xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)].map(m=>{const b=m[1],link=tag(b,"link")||tag(b,"guid"),source=tag(b,"source");return{title:tag(b,"title"),url:link,published_at:tag(b,"pubDate"),source,summary:""};}).filter(x=>x.title&&x.url);}
const feeds=["https://news.google.com/rss/search?q=gold+XAU+when%3A1d&hl=en-US&gl=US&ceid=US:en","https://news.google.com/rss/search?q=Federal+Reserve+inflation+US+dollar+gold+when%3A1d&hl=en-US&gl=US&ceid=US:en"];
const positive=/lower yields|rate cut|cuts|weak dollar|dollar falls|safe haven|central bank buy|buying|inflow|escalat|war|risk off|inflation cool|dovish|bullish|rally|surge|record high/i;
const negative=/higher yields|rate hike|hawkish|strong dollar|dollar rises|dollar gain|sell|outflow|liquidat|inflation hot|sticky inflation|risk on|bearish|falls|drop|plunge|slump/i;
const pct=(a,b)=>a&&b?(a/b-1)*100:null;
(async()=>{
 const errors=[],data={};
 for(const [k,sym] of Object.entries({gold:"XAUUSD=X",dxy:"DX-Y.NYB",silver:"SI=F",us10y:"^TNX",oil:"CL=F"})){try{data[k]=await quote(sym);}catch(e){errors.push(k+": "+e.message)}}
 let news=[];for(const u of feeds){try{news.push(...rss(await fetchText(u)));}catch(e){errors.push("News feed: "+e.message)}}
 news=[...new Map(news.map(x=>[x.title,x])).values()].sort((a,b)=>new Date(b.published_at)-new Date(a.published_at)).slice(0,20);
 if(!data.gold?.price)throw Error("Gold quote unavailable; do not publish stale or empty result.");
 const g=data.gold,gm=pct(g.price,g.first),last=pct(g.price,g.previous),dxy=data.dxy?pct(data.dxy.price,data.dxy.first):null,yieldMove=data.us10y?data.us10y.price-data.us10y.first:null;
 let pos=0,neg=0;for(const n of news){if(positive.test(n.title))pos++;if(negative.test(n.title))neg++;}
 const score=(gm||0)*1.8+(last||0)*1.2+(neg*-0.15+pos*0.15)+(dxy!=null?-dxy:0)+(yieldMove!=null?-yieldMove*0.1:0);
 const lean=score>.3?"Bullish lean":score<-.3?"Bearish lean":"Neutral / mixed";
 const confidence=Math.min(58,Math.max(32,Math.round(35+Math.abs(score)*7)));
 const hi=g.high,lo=g.low,range=hi-lo,round=x=>Math.round(x*100)/100;
 const supports=[lo,lo-range*.15,g.price-range*.25].map(round).sort((a,b)=>b-a);
 const resist=[hi,hi+range*.15,g.price+range*.25].map(round).sort((a,b)=>a-b);
 const fmt=x=>"$"+x.toLocaleString("en-US",{maximumFractionDigits:2});
 const obj={source:"Automated market-data snapshot",snapshot_type:"live_heuristic",snapshot_date:new Date().toISOString().slice(0,10),updated_at:new Date().toISOString(),live:true,engine:"Market data + simple headline keyword heuristic",caveat:"Auto-refreshed data; heuristic only, not calibrated forecasting or professional consensus. Market quotes may be delayed or unavailable; verify quote timestamps before trading.",price:g.price,price_range_usd:[g.price,g.price],short_term_direction:lean,short_term_confidence:confidence+"% heuristic score (not statistical confidence)",long_term_direction:"Not modeled",summary:"Direction is calculated from 5-day and latest-hour gold momentum, cross-market moves when available, and keyword counts in recent headlines. It is not an AI-generated forecast.",range_usd:[lo,hi],near_resistance:resist.slice(0,2),support:supports.slice(0,2),major_resistance:hi,upside_targets:resist.slice(1,3),downside_targets:supports.slice(1,3),scenarios:[{name:"Range-high breakout",trigger:"Hourly acceptance above "+fmt(hi),path:"Range extension toward "+fmt(resist[1]),reason:"Range-based projection only",invalidation:"Falls back below range high"},{name:"Range / rejection",trigger:"Rejection from "+fmt(hi),path:"Revisit range low "+fmt(lo)+" and next support "+fmt(supports[1]),reason:"Recent 5-day range",invalidation:"Breakout and hold above range high"},{name:"Range-low breakdown",trigger:"Hourly acceptance below "+fmt(lo),path:"Extension toward "+fmt(supports[1]),reason:"Range-based projection only",invalidation:"Reclaims range low"}],drivers:[{bias:gm>=0?"positive":"negative",title:"Gold momentum",detail:"5-day move "+(gm==null?"N/A":gm.toFixed(2)+"%")+"; latest interval "+(last==null?"N/A":last.toFixed(2)+"%")},{bias:dxy==null?"unknown":dxy<0?"positive":"negative",title:"Dollar",detail:dxy==null?"Unavailable":"5-day move "+dxy.toFixed(2)+"%"},{bias:yieldMove==null?"unknown":yieldMove<0?"positive":"negative",title:"US 10Y yield",detail:yieldMove==null?"Unavailable":"5-day move "+yieldMove.toFixed(2)+" index points"},{bias:pos>neg?"positive":neg>pos?"negative":"mixed",title:"Headline tone",detail:pos+" supportive / "+neg+" negative keyword hits in "+news.length+" headlines"}],analyst_consensus:{short_term:"Not collected by this automated engine. Do not treat heuristic direction as consensus.",long_term:"Not modeled.",unverified_opinions:[]},market_inputs:{gold:{price:g.price,change_5d_pct:gm,latest_change_pct:last,high_5d:hi,low_5d:lo,source:"Yahoo Finance XAUUSD=X"},dxy:data.dxy?{price:data.dxy.price,change_5d_pct:dxy,source:"Yahoo Finance DX-Y.NYB"}:null,silver:data.silver?{price:data.silver.price,change_5d_pct:pct(data.silver.price,data.silver.first),source:"Yahoo Finance SI=F"}:null,us10y:data.us10y?{value:data.us10y.price,change_5d_points:yieldMove,source:"Yahoo Finance ^TNX"}:null,oil:data.oil?{price:data.oil.price,change_5d_pct:pct(data.oil.price,data.oil.first),source:"Yahoo Finance CL=F"}:null,headline_sentiment:{positive:pos,negative:neg,net:pos-neg},headlines:news},sources:[{source:"Yahoo Finance",title:"Market quote source",url:"https://finance.yahoo.com/"},{source:"Google News RSS",title:"Headline source",url:"https://news.google.com/"}],errors};
 fs.mkdirSync("research",{recursive:true});fs.writeFileSync(OUT,JSON.stringify(obj,null,2)+"\n");console.log("Published snapshot",g.price,lean,news.length,"headlines; errors:",errors.join(" | "));
})();