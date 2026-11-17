(()=>{
"use strict";
const $=id=>document.getElementById(id);
const apiBase=()=>{try{return(localStorage.getItem("why-gold-api-base")||"https://why-is-gold-movingm.appsfor319.workers.dev").replace(/\/+$/,"")}catch{return"https://why-is-gold-movingm.appsfor319.workers.dev"}};
const fmt=n=>Number(n).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});
const sessions=[
 {key:"asia",name:"Asia/Tokyo",timezone:"Asia/Tokyo",start:"0900",end:"1800",color:"#26c6da"},
 {key:"london",name:"Europa/London",timezone:"Europe/London",start:"0800",end:"1700",color:"#ff9800"},
 {key:"newyork",name:"New York",timezone:"America/New_York",start:"0800",end:"1700",color:"#2196f3"}
];
let interval="5min",chart,candleSeries,volumeSeries,chartData=null,overlaySeries=[],priceLines=[],markersApi=null,lastAnalysisCandle=null,analysisBusy=false,obZoneLayer=null,activeZoneData=[],fitOnNextLoad=true,streamSocket=null,streamHeartbeat=null,streamRetry=null,streamConnected=false;
const tfLabel={"5min":"5m","15min":"15m","30min":"30m","1h":"1H"};
function localParts(ts,tz){
 const p=new Intl.DateTimeFormat("en-CA",{timeZone:tz,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(new Date(ts*1000));
 const o={};p.forEach(x=>o[x.type]=x.value);return{date:o.year+"-"+o.month+"-"+o.day,minute:Number(o.hour)*60+Number(o.minute)};
}
function inSession(minute,s){
 const a=Number(s.start.slice(0,2))*60+Number(s.start.slice(2)),b=Number(s.end.slice(0,2))*60+Number(s.end.slice(2));
 return a<=b?minute>=a&&minute<b:minute>=a||minute<b;
}
function calculateIndicator(bars,htf){
 const ranges=[],liquidity=[],sweeps=[],sessionState=[];
 sessions.forEach(s=>{
  const groups=new Map();
  bars.forEach((bar,i)=>{
   const lp=localParts(bar.time,s.timezone);
   if(!inSession(lp.minute,s))return;
   if(!groups.has(lp.date))groups.set(lp.date,{date:lp.date,first:bar.time,last:bar.time,firstIndex:i,lastIndex:i,high:bar.high,low:bar.low});
   const g=groups.get(lp.date);g.last=bar.time;g.lastIndex=i;g.high=Math.max(g.high,bar.high);g.low=Math.min(g.low,bar.low);
  });
  const arr=[...groups.values()].sort((a,b)=>a.first-b.first);
  arr.forEach(g=>{
   const active=g.lastIndex===bars.length-1;
   ranges.push({session:s.key,name:s.name,color:s.color,date:g.date,start:g.first,end:g.last,high:g.high,low:g.low,active});
   if(active)sessionState.push({name:s.name,date:g.date,high:g.high,low:g.low});
   if(!active){
    const later=bars.slice(g.lastIndex+1);
    let hiSweep=null,loSweep=null;
    for(const bar of later){
     if(!hiSweep&&bar.high>g.high)hiSweep={time:bar.time,price:bar.high};
     if(!loSweep&&bar.low<g.low)loSweep={time:bar.time,price:bar.low};
     if(hiSweep&&loSweep)break;
    }
    if(hiSweep)sweeps.push({time:hiSweep.time,price:g.high,label:"HH session · "+s.name,direction:"high"});
    else liquidity.push({price:g.high,isHigh:true,label:"HH session · "+s.name,session:s.name,date:g.date});
    if(loSweep)sweeps.push({time:loSweep.time,price:g.low,label:"HL session · "+s.name,direction:"low"});
    else liquidity.push({price:g.low,isHigh:false,label:"HL session · "+s.name,session:s.name,date:g.date});
   }
  });
 });
 const kept=[];
 for(const side of [true,false]){
  liquidity.filter(x=>x.isHigh===side).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,4).forEach(x=>kept.push(x));
 }
 const obs=[];
 for(let i=1;i<htf.length;i++){
  const prev=htf[i-1],cur=htf[i];
  const bull=cur.close>prev.high&&prev.close<prev.open;
  const bear=cur.close<prev.low&&prev.close>prev.open;
  if(bull)obs.push({direction:"bullish",top:prev.high,bottom:prev.low,time:prev.time,activatedAt:cur.time});
  if(bear)obs.push({direction:"bearish",top:prev.high,bottom:prev.low,time:prev.time,activatedAt:cur.time});
 }
 const activeObs=[];
 obs.forEach(o=>{
  const broken=bars.concat(htf).some(b=>b.time>=o.activatedAt&&(o.direction==="bullish"?b.close<o.bottom:b.close>o.top));
  if(!broken)activeObs.push(o);
 });
 const capped=[];
 ["bullish","bearish"].forEach(d=>activeObs.filter(x=>x.direction===d).slice(-3).forEach(x=>capped.push(x)));
 const pivH=[],pivL=[];
 for(let i=2;i<bars.length-2;i++){
  const b=bars[i];
  if(b.high>bars[i-1].high&&b.high>bars[i-2].high&&b.high>=bars[i+1].high&&b.high>=bars[i+2].high)pivH.push(b.high);
  if(b.low<bars[i-1].low&&b.low<bars[i-2].low&&b.low<=bars[i+1].low&&b.low<=bars[i+2].low)pivL.push(b.low);
 }
 let direction="mixed / range";
 if(pivH.length>=2&&pivL.length>=2){
  const hh=pivH[pivH.length-1]>pivH[pivH.length-2],hl=pivL[pivL.length-1]>pivL[pivL.length-2];
  const lh=pivH[pivH.length-1]<pivH[pivH.length-2],ll=pivL[pivL.length-1]<pivL[pivL.length-2];
  if(hh&&hl)direction="higher highs and higher lows";
  else if(lh&&ll)direction="lower highs and lower lows";
  else if(hh||hl)direction="partly bullish structure";
  else if(lh||ll)direction="partly bearish structure";
 }
 const last=bars[bars.length-1],prev=bars[bars.length-2];
 return{
  ranges,liquidity:kept,sweeps:sweeps.sort((a,b)=>b.time-a.time).slice(0,8),activeObs:capped,
  summary:{timeframe:interval,last:{time:last.time,open:last.open,high:last.high,low:last.low,close:last.close,change_pct:prev?((last.close/prev.close)-1)*100:null},structure:{direction,recent_swing_highs:pivH.slice(-2),recent_swing_lows:pivL.slice(-2)},session:sessionState.slice(-1)[0]||null,session_ranges:ranges.slice(-9).map(x=>({name:x.name,date:x.date,high:x.high,low:x.low,active:x.active})),active_liquidity:kept.map(x=>({price:x.price,label:x.label,side:x.isHigh?"above":"below"})),recent_sweeps:sweeps.sort((a,b)=>b.time-a.time).slice(0,5).map(x=>({price:x.price,label:x.label,time:x.time})),order_blocks:capped.map(x=>({direction:x.direction,top:x.top,bottom:x.bottom,time:x.time})),candle_window:{from:bars[0].time,to:last.time,count:bars.length}}
 };
}
function updateObZones(){
 if(!obZoneLayer||!chart||!candleSeries)return;
 obZoneLayer.innerHTML="";
 const width=$("xau-chart").clientWidth;
 activeZoneData.forEach(o=>{
  const scale=chart.timeScale(),visible=scale.getVisibleRange(),rawX=scale.timeToCoordinate(o.time),y1=candleSeries.priceToCoordinate(o.top),y2=candleSeries.priceToCoordinate(o.bottom);
  if(y1==null||y2==null)return;
  let x=rawX;
  if(x==null&&visible&&o.time<visible.from)x=0;
  if(x==null)return;
  const left=Math.max(0,Math.floor(x)),right=Math.max(left,width-68),top=Math.max(0,Math.floor(Math.min(y1,y2))),height=Math.max(2,Math.abs(y2-y1));
  if(left>=width-68||top>$("xau-chart").clientHeight)return;
  const box=document.createElement("div");box.className="ob-zone "+(o.direction==="bullish"?"bull":"bear");
  box.style.left=left+"px";box.style.top=top+"px";box.style.width=(right-left)+"px";box.style.height=height+"px";
  const label=document.createElement("span");label.textContent=(o.direction==="bullish"?"Bullish":"Bearish")+" Order Block · 1H";box.appendChild(label);obZoneLayer.appendChild(box);
 });
}
function removeOverlays(){
 overlaySeries.forEach(s=>{try{chart.removeSeries(s)}catch{}});
 overlaySeries=[];
 priceLines.forEach(x=>{try{x.series.removePriceLine(x.line)}catch{}});
 priceLines=[];
}
function drawIndicator(result,bars){
 removeOverlays();
 const ranges=result.ranges,latest=bars[bars.length-1];
 ranges.forEach(r=>{
  const end=Math.max(r.end,latest.time);
  if(end>r.start){
   const source=chart.addSeries(LightweightCharts.LineSeries,{color:r.color,lineWidth:r.active?2:1,lineStyle:r.active?LightweightCharts.LineStyle.Solid:LightweightCharts.LineStyle.Dashed,priceLineVisible:false,lastValueVisible:false,crosshairMarkerVisible:false,pointMarkersVisible:false});
   source.setData([{time:r.start,value:r.high},{time:end,value:r.high}]);overlaySeries.push(source);
   const low=chart.addSeries(LightweightCharts.LineSeries,{color:r.color,lineWidth:r.active?2:1,lineStyle:r.active?LightweightCharts.LineStyle.Solid:LightweightCharts.LineStyle.Dashed,priceLineVisible:false,lastValueVisible:false,crosshairMarkerVisible:false,pointMarkersVisible:false});
   low.setData([{time:r.start,value:r.low},{time:end,value:r.low}]);overlaySeries.push(low);
  }
 });
 const swingHighs=result.summary.structure.recent_swing_highs||[],swingLows=result.summary.structure.recent_swing_lows||[];
 swingHighs.forEach((p,i)=>{const line=candleSeries.createPriceLine({price:p,color:"rgba(239,83,80,.9)",lineWidth:i===swingHighs.length-1?2:1,lineStyle:LightweightCharts.LineStyle.Dotted,axisLabelVisible:true,title:"5M Swing High"});priceLines.push({series:candleSeries,line})});
 swingLows.forEach((p,i)=>{const line=candleSeries.createPriceLine({price:p,color:"rgba(38,166,154,.9)",lineWidth:i===swingLows.length-1?2:1,lineStyle:LightweightCharts.LineStyle.Dotted,axisLabelVisible:true,title:"5M Swing Low"});priceLines.push({series:candleSeries,line})});
 result.liquidity.forEach(l=>{
  const line=candleSeries.createPriceLine({price:l.price,color:l.isHigh?"#ef5350":"#26a69a",lineWidth:1,lineStyle:LightweightCharts.LineStyle.Dashed,axisLabelVisible:true,title:l.label});
  priceLines.push({series:candleSeries,line});
 });
 result.activeObs.forEach(o=>{
  [o.top,o.bottom].forEach((p,i)=>{
   const line=candleSeries.createPriceLine({price:p,color:o.direction==="bullish"?"rgba(38,166,154,.9)":"rgba(239,83,80,.9)",lineWidth:1,lineStyle:LightweightCharts.LineStyle.Dotted,axisLabelVisible:true,title:(o.direction==="bullish"?"Bull OB ":"Bear OB ")+(i?"low":"high")});
   priceLines.push({series:candleSeries,line});
  });
 });
 const marks=[];
 result.ranges.forEach(r=>{const mid=r.start+Math.floor((r.end-r.start)/2),bar=bars.reduce((best,x)=>Math.abs(x.time-mid)<Math.abs(best.time-mid)?x:best,bars[0]);if(bar)marks.push({time:bar.time,position:"aboveBar",color:r.color,shape:"circle",text:r.name})});
 result.sweeps.forEach(s=>marks.push({time:s.time,position:s.direction==="high"?"aboveBar":"belowBar",color:"#e4b85f",shape:s.direction==="high"?"arrowDown":"arrowUp",text:s.label}));
 marks.sort((a,b)=>a.time-b.time);
 activeZoneData=result.activeObs;updateObZones();
 const recentSweep=result.sweeps.find(s=>s.time===latest.time);
 $("chart-indicator-status").textContent=(recentSweep?"SWEEP ALERT · "+recentSweep.label+" · "+fmt(recentSweep.price):"UFD S&L · "+ranges.length+" session ranges · "+result.liquidity.length+" liquidity levels · "+result.activeObs.length+" active OBs")+" · swing highs/lows";
 if(LightweightCharts.createSeriesMarkers){
  if(markersApi&&markersApi.setMarkers)markersApi.setMarkers(marks);
  else markersApi=LightweightCharts.createSeriesMarkers(candleSeries,marks);
 }
}
function initChart(){
 const el=$("xau-chart");if(!el||!window.LightweightCharts)return;
 chart=LightweightCharts.createChart(el,{width:el.clientWidth,height:el.clientHeight,layout:{background:{type:LightweightCharts.ColorType.Solid,color:"#101820"},textColor:"#a9b6c2",fontFamily:"DM Mono, monospace"},grid:{vertLines:{color:"#1e2b35"},horzLines:{color:"#1e2b35"}},rightPriceScale:{borderColor:"#34424e"},timeScale:{borderColor:"#34424e",timeVisible:true,secondsVisible:false},crosshair:{mode:LightweightCharts.CrosshairMode.Normal},localization:{priceFormatter:fmt}});
 candleSeries=chart.addSeries(LightweightCharts.CandlestickSeries,{upColor:"#55c89b",downColor:"#ee8178",borderUpColor:"#55c89b",borderDownColor:"#ee8178",wickUpColor:"#55c89b",wickDownColor:"#ee8178"});
 volumeSeries=chart.addSeries(LightweightCharts.HistogramSeries,{priceFormat:{type:"volume"},priceScaleId:"volume",lastValueVisible:false,priceLineVisible:false});
 chart.priceScale("volume").applyOptions({scaleMargins:{top:.82,bottom:0},visible:false});
 obZoneLayer=document.createElement("div");obZoneLayer.className="ob-zones";el.appendChild(obZoneLayer);
 chart.timeScale().subscribeVisibleTimeRangeChange(updateObZones);
 const ro=new ResizeObserver(entries=>{for(const e of entries){if(e.contentRect.width>0&&e.contentRect.height>0){chart.applyOptions({width:Math.floor(e.contentRect.width),height:Math.floor(e.contentRect.height)});updateObZones()}}});
 ro.observe(el);
}
function renderPrice(data){
 const bars=data.candles;
 candleSeries.setData(bars.map(b=>({time:b.time,open:b.open,high:b.high,low:b.low,close:b.close})));
 volumeSeries.setData(bars.map(b=>({time:b.time,value:b.volume||0,color:b.close>=b.open?"rgba(85,200,155,.22)":"rgba(238,129,120,.22)"})));
 if(fitOnNextLoad){chart.timeScale().fitContent();fitOnNextLoad=false;}
 const last=bars[bars.length-1],first=bars[Math.max(0,bars.length-2)];
 $("chart-last-price").textContent="$"+fmt(last.close);
 const ch=first?((last.close/first.close)-1)*100:0;
 $("chart-last-change").textContent=(ch>=0?"+":"")+ch.toFixed(2)+"% · latest candle";
 $("chart-last-change").style.color=ch>=0?"#55c89b":"#ee8178";
 $("chart-feed-status").textContent="DATA CONNECTED · "+data.source+" · refresh "+data.refresh_seconds+"s";
 $("chart-candle-time").textContent=tfLabel[interval]+" candles · last bar "+new Date(last.time*1000).toLocaleString("en-GB",{timeZone:"Africa/Algiers",hour12:false})+" Algeria";
 $("chart-indicator-status").textContent="UFD Sessions & Liquidity · Asia / London / New York · 1H OB";
}
function renderExplanation(a){
 if(!$("chart-ai-context"))return;
 $("chart-ai-context").innerHTML='<div class="chart-ai-label">CHART + MACRO EXPLANATION · '+(a.engine==="gemini-chart"?"AI":"RULES FALLBACK")+'</div><h3>'+escapeHtml(a.headline||"Chart analysis")+'</h3><p>'+escapeHtml(a.body||"Waiting for chart analysis.")+'</p><div class="chart-ai-meta">Confidence: '+escapeHtml(a.confidence||"LOW")+' · '+new Date(a.updated_at||Date.now()).toLocaleTimeString("en-GB",{timeZone:"Africa/Algiers",hour12:false})+' Algeria time</div>';
}
function escapeHtml(s){return String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));}
async function explain(summary,force){
 const candle=summary.last?.time;
 if(analysisBusy||(!force&&candle===lastAnalysisCandle))return;
 analysisBusy=true;lastAnalysisCandle=candle;
 try{
  const terminal=window.goldTerminalData||{};
  const response=await fetch(apiBase()+"/api/chart-analysis",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({chart:summary,market:terminal.market||{},headlines:(terminal.news||[]).slice(0,6).map(n=>({title:n.title,source:n.source,published_at:n.published_at}))}),signal:AbortSignal.timeout(14000)});
  if(!response.ok)throw Error("Chart analysis HTTP "+response.status);
  const data=await response.json();if(data.analysis)renderExplanation(data.analysis);
 }catch(e){renderExplanation({headline:"Chart is live; AI explanation unavailable",body:"The chart and indicator are still updating. The analysis service returned: "+e.message,confidence:"LOW",engine:"offline",updated_at:new Date().toISOString()})}
 finally{analysisBusy=false}
}
function applyLiveTick(tick){
 if(!chartData||!Array.isArray(chartData.candles)||!tick||!Number.isFinite(Number(tick.price))||!Number.isFinite(Number(tick.timestamp)))return;
 const price=Number(tick.price),step=({"5min":300,"15min":900,"30min":1800,"1h":3600})[interval]||300,bucket=Math.floor(Number(tick.timestamp)/step)*step,bars=chartData.candles,last=bars[bars.length-1];
 if(!last||bucket<last.time)return;
 let next,closedBar=false;
 if(bucket===last.time){next={...last,high:Math.max(last.high,price),low:Math.min(last.low,price),close:price};bars[bars.length-1]=next;}
 else{next={time:bucket,open:price,high:price,low:price,close:price,volume:0};bars.push(next);if(bars.length>500)bars.shift();closedBar=true;}
 candleSeries.update({time:next.time,open:next.open,high:next.high,low:next.low,close:next.close});
 volumeSeries.update({time:next.time,value:next.volume||0,color:next.close>=next.open?"rgba(85,200,155,.22)":"rgba(238,129,120,.22)"});
 $("chart-last-price").textContent="$"+fmt(price);
 $("chart-last-change").textContent="LIVE TICK · "+new Date(Number(tick.timestamp)*1000).toLocaleTimeString("en-GB",{timeZone:"Africa/Algiers",hour12:false});
 $("chart-last-change").style.color=price>=next.open?"#55c89b":"#ee8178";
 $("chart-candle-time").textContent=tfLabel[interval]+" candles · live tick "+new Date(Number(tick.timestamp)*1000).toLocaleString("en-GB",{timeZone:"Africa/Algiers",hour12:false})+" Algeria";
 if(closedBar){const ind=calculateIndicator(bars,chartData.order_block_candles||[]);drawIndicator(ind,bars);explain(ind.summary,false);}
}
function connectLiveStream(){
 if(streamSocket&&(streamSocket.readyState===WebSocket.OPEN||streamSocket.readyState===WebSocket.CONNECTING))return;
 try{
  const base=new URL(apiBase());base.protocol=base.protocol==="https:"?"wss:":"ws:";base.pathname=base.pathname.replace(/\/$/,"")+"/api/stream";base.search="";
  streamSocket=new WebSocket(base.toString());
  streamSocket.addEventListener("open",()=>{streamConnected=true;$("chart-feed-status").textContent="LIVE TICK STREAM · TWELVE DATA";streamHeartbeat=setInterval(()=>{if(streamSocket?.readyState===WebSocket.OPEN)streamSocket.send(JSON.stringify({action:"heartbeat"}))},10000);});
  streamSocket.addEventListener("message",event=>{try{const msg=JSON.parse(event.data);if(msg.event==="price"&&msg.symbol==="XAU/USD")applyLiveTick(msg);else if(msg.event==="subscribe-status"&&msg.status!=="ok")$("chart-feed-status").textContent="STREAM SUBSCRIPTION FAILED · "+(msg.message||"check Twelve Data plan");}catch{}});
  streamSocket.addEventListener("error",()=>{$("chart-feed-status").textContent="LIVE STREAM ERROR · reconnecting";});
  streamSocket.addEventListener("close",()=>{streamConnected=false;if(streamHeartbeat)clearInterval(streamHeartbeat);streamHeartbeat=null;if(streamRetry)clearTimeout(streamRetry);streamRetry=setTimeout(connectLiveStream,5000);});
 }catch(e){$("chart-feed-status").textContent="LIVE STREAM UNAVAILABLE · "+e.message;}
}
async function loadChart(forceAnalysis){
 $("chart-feed-status").textContent="UPDATING · TWELVE DATA";
 try{
  const r=await fetch(apiBase()+"/api/chart?interval="+encodeURIComponent(interval),{cache:"no-store",signal:AbortSignal.timeout(20000)});
  if(!r.ok){const d=await r.json().catch(()=>({}));throw Error(d.error||"Chart API HTTP "+r.status)}
  const data=await r.json();if(!Array.isArray(data.candles)||!data.candles.length)throw Error("No chart candles returned");
  chartData=data;renderPrice(data);
  const ind=calculateIndicator(data.candles,data.order_block_candles||[]);
  drawIndicator(ind,data.candles);
  await explain(ind.summary,!!forceAnalysis);
 }catch(e){$("chart-feed-status").textContent="FEED ERROR · "+e.message}
}
function setIntervalChart(v){
 if(!tfLabel[v])return;interval=v;lastAnalysisCandle=null;fitOnNextLoad=true;
 document.querySelectorAll(".chart-tf").forEach(b=>b.classList.toggle("active",b.dataset.interval===v));
 loadChart(true);
}
window.addEventListener("gold-terminal-updated",()=>{if(!chartData||!chart)return;const ind=calculateIndicator(chartData.candles,chartData.order_block_candles||[]);explain(ind.summary,true)});
document.addEventListener("DOMContentLoaded",()=>{
 if(!$("xau-chart"))return;
 if(!window.LightweightCharts){$("chart-feed-status").textContent="Chart library failed to load";return}
 initChart();
 document.querySelectorAll(".chart-tf").forEach(b=>b.addEventListener("click",()=>setIntervalChart(b.dataset.interval)));
 loadChart(true);setInterval(()=>loadChart(false),60000);
});
})();