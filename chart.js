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
let interval="5min",lastStreamTick=0,chart,candleSeries,volumeSeries,chartData=null,overlaySeries=[],priceLines=[],markersApi=null,lastAnalysisCandle=null,analysisBusy=false,obZoneLayer=null,analysisLayer=null,latestIndicatorResult=null,activeZoneData=[],activeFvgData=[],fitOnNextLoad=true,streamSocket=null,streamHeartbeat=null,streamRetry=null,streamConnected=false,streamUnavailable=false,latestResearchLevels=[],latestResearchUpdated=null;
const tfLabel={"5min":"5m","15min":"15m","30min":"30m","1h":"1H"};
function localParts(ts,tz){
 const p=new Intl.DateTimeFormat("en-CA",{timeZone:tz,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(new Date(ts*1000));
 const o={};p.forEach(x=>o[x.type]=x.value);return{date:o.year+"-"+o.month+"-"+o.day,minute:Number(o.hour)*60+Number(o.minute)};
}
function sessionCloseTime(ts,s){
 const lp=localParts(ts,s.timezone),h=Number(s.end.slice(0,2)),m=Number(s.end.slice(2)),[y,mo,d]=lp.date.split("-").map(Number);
 let target=Date.UTC(y,mo-1,d,h,m,0),guess=target;
 for(let i=0;i<3;i++){
  const p=new Intl.DateTimeFormat("en-CA",{timeZone:s.timezone,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(new Date(guess));
  const o={};p.forEach(x=>o[x.type]=x.value);
  const seen=Date.UTC(Number(o.year),Number(o.month)-1,Number(o.day),Number(o.hour),Number(o.minute),0);
  guess+=target-seen;
 }
 return Math.floor(guess/1000);
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
  const broken=bars.some(b=>b.time>=o.activatedAt&&(o.direction==="bullish"?b.close<o.bottom:b.close>o.top));
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
 const width=$("xau-chart").clientWidth,scale=chart.timeScale(),visible=scale.getVisibleRange();
 function drawZone(o,type){
  const rawX=scale.timeToCoordinate(o.time),y1=candleSeries.priceToCoordinate(o.top),y2=candleSeries.priceToCoordinate(o.bottom);
  if(y1==null||y2==null)return;
  let x=rawX;if(x==null&&visible&&o.time<visible.from)x=0;if(x==null)return;
  const left=Math.max(0,Math.floor(x)),right=Math.max(left,width-68),top=Math.max(0,Math.floor(Math.min(y1,y2))),height=Math.max(2,Math.abs(y2-y1));
  if(left>=width-68||top>$("xau-chart").clientHeight)return;
  const box=document.createElement("div");box.className="ob-zone "+(o.direction==="bullish"?"bull":"bear")+(type==="fvg"?" fvg-zone":"");
  box.style.left=left+"px";box.style.top=top+"px";box.style.width=(right-left)+"px";box.style.height=height+"px";
  const label=document.createElement("span");label.textContent=type==="fvg"?(o.direction==="bullish"?"Bullish FVG":"Bearish FVG"):(o.direction==="bullish"?"Demand · Bullish OB":"Supply · Bearish OB")+" · "+(o.timeframe||"1H");box.appendChild(label);obZoneLayer.appendChild(box);
 }
 activeZoneData.forEach(o=>drawZone(o,"ob"));activeFvgData.forEach(o=>drawZone(o,"fvg"));
}
function detectFvgs(bars){
 const found=[];const from=Math.max(2,bars.length-180);
 for(let i=from;i<bars.length;i++){
  const a=bars[i-2],b=bars[i];
  if(b.low>a.high)found.push({direction:"bullish",top:b.low,bottom:a.high,time:a.time});
  if(b.high<a.low)found.push({direction:"bearish",top:a.low,bottom:b.high,time:a.time});
 }
 return found.filter(z=>!bars.slice(-Math.min(80,bars.length)).some(b=>b.time>z.time&&(z.direction==="bullish"?b.low<=z.bottom:b.high>=z.top))).slice(-5);
}
function renderWhereTable(summary,bars){
 const root=$("where-chart-rows");if(!root)return;
 const price=Number(summary.last?.close);if(!Number.isFinite(price)){root.innerHTML='<tr><td colspan="3">No valid live quote.</td></tr>';return}
 const recent=bars.slice(-Math.min(180,bars.length)),highs=[],lows=[];
 for(let i=2;i<recent.length-2;i++){const b=recent[i];if(b.high>recent[i-1].high&&b.high>recent[i-2].high&&b.high>=recent[i+1].high&&b.high>=recent[i+2].high)highs.push(b.high);if(b.low<recent[i-1].low&&b.low<recent[i-2].low&&b.low<=recent[i+1].low&&b.low<=recent[i+2].low)lows.push(b.low);}
 const nearest=(a,above)=>a.filter(x=>above?x>price:x<price).sort((x,y)=>Math.abs(x-price)-Math.abs(y-price)).slice(0,2);
 const levels=[...latestResearchLevels.map(x=>({label:x.label,price:Number(x.price),note:x.note,source:true})).filter(x=>Number.isFinite(x.price)),...nearest(highs,true).map((x,i)=>({label:i?"Next swing resistance":"Nearest swing resistance",price:x,note:"Recent confirmed pivot high on "+tfLabel[interval]+" chart."})),...nearest(lows,false).map((x,i)=>({label:i?"Next swing support":"Nearest swing support",price:x,note:"Recent confirmed pivot low on "+tfLabel[interval]+" chart."}))];
 const seen=new Set(),unique=levels.sort((a,b)=>Math.abs(a.price-price)-Math.abs(b.price-price)).filter(x=>{const k=x.price.toFixed(2);if(seen.has(k))return false;seen.add(k);return true}).slice(0,8).sort((a,b)=>b.price-a.price);
 root.innerHTML=unique.length?unique.map(x=>'<tr class="'+(x.price>=price?"resistance-row":"support-row")+'"><td>'+escapeHtml(x.label)+'</td><td><b>'+fmt(x.price)+'</b></td><td>'+escapeHtml(x.note||"Published reference level.")+'</td></tr>').join(""):'<tr><td colspan="3">No confirmed nearby levels yet. Waiting for more candles.</td></tr>';
 const above=unique.filter(x=>x.price>price).sort((a,b)=>a.price-b.price),below=unique.filter(x=>x.price<price).sort((a,b)=>b.price-a.price);
 const r=above[0],sup=below[0],bull=$("where-bull-case"),bear=$("where-bear-case");
 const nextR=above[1],nextS=below[1];
  if(bull)bull.textContent=r?"BUYERS: wait for a 5m/15m candle close above "+fmt(r.price)+" and a successful retest. Next upside target: "+(nextR?fmt(nextR.price):"next confirmed liquidity above")+". No entry on a wick alone.":"No confirmed resistance above price; wait for fresh structure and do not guess a breakout.";
 if(bear)bear.textContent=sup?"SELLERS: wait for a 5m/15m close below "+fmt(sup.price)+" and a failed reclaim. Next downside target: "+(nextS?fmt(nextS.price):"next confirmed liquidity below")+". No entry on a wick alone.":"No confirmed support below price; wait for fresh structure and do not guess a breakdown.";
 const status=$("where-chart-status");if(status)status.textContent="Live chart: "+fmt(price)+" · "+tfLabel[interval]+" structure · "+(latestResearchUpdated?"Research levels dated "+new Date(latestResearchUpdated).toLocaleString("en-GB",{timeZone:"Africa/Algiers",hour12:false})+" ALG":"chart-derived levels only");
}
async function loadResearchLevels(){
 try{const r=await fetch("./research/where-gold-going-latest.json?v="+Date.now(),{cache:"no-store"});if(!r.ok)return;const d=await r.json();const age=Date.now()-new Date(d.updated_at).getTime();if(!Number.isFinite(age)||age>12*3600000)return;latestResearchLevels=d.levels||[];latestResearchUpdated=d.updated_at;if(chartData)renderWhereTable(calculateIndicator(chartData.candles,chartData.order_block_candles||[]).summary,chartData.candles);}catch{}
}
function removeOverlays(){
 overlaySeries.forEach(s=>{try{chart.removeSeries(s)}catch{}});
 overlaySeries=[];
 priceLines.forEach(x=>{try{x.series.removePriceLine(x.line)}catch{}});
 priceLines=[];
}
function analysisLevels(result,bars){
 const price=Number(bars[bars.length-1].close),above=[],below=[];
 const research=latestResearchLevels.filter(x=>Number.isFinite(Number(x.price))).map(x=>({price:Number(x.price),label:x.label||"Published level",source:true}));
 const structure=[...(result.summary.structure.recent_swing_highs||[]).map(x=>({price:Number(x),label:"Recent swing high"})),...(result.summary.structure.recent_swing_lows||[]).map(x=>({price:Number(x),label:"Recent swing low"}))];
 [...research,...structure].forEach(x=>{if(x.price>price)above.push(x);else if(x.price<price)below.push(x)});
 above.sort((a,b)=>a.price-b.price);below.sort((a,b)=>b.price-a.price);
 const unique=a=>a.filter((x,i)=>a.findIndex(y=>Math.abs(y.price-x.price)<0.08)===i);
 return {price,bull:unique(above)[0]||null,bear:unique(below)[0]||null,nextBull:unique(above)[1]||null,nextBear:unique(below)[1]||null};
}
function drawAnalysisOverlay(result,bars){
 if(!analysisLayer||!chart||!candleSeries||!result||!bars?.length)return;
 analysisLayer.innerHTML="";
 const width=$("xau-chart").clientWidth,height=$("xau-chart").clientHeight;
 if(width<120||height<120)return;
 const levels=analysisLevels(result,bars),scale=chart.timeScale(),last=bars[bars.length-1];
 const xNow=scale.timeToCoordinate(last.time),x1=Math.max(8,Math.min(width-78,xNow==null?width*.68:xNow));
 const ns="http://www.w3.org/2000/svg",svg=document.createElementNS(ns,"svg");
 svg.setAttribute("viewBox","0 0 "+width+" "+height);svg.setAttribute("width",width);svg.setAttribute("height",height);svg.setAttribute("aria-hidden","true");
 const addLine=(xA,yA,xB,yB,color,dash,opacity=1)=>{
  const l=document.createElementNS(ns,"line");l.setAttribute("x1",xA);l.setAttribute("y1",yA);l.setAttribute("x2",xB);l.setAttribute("y2",yB);l.setAttribute("stroke",color);l.setAttribute("stroke-width","1.7");l.setAttribute("stroke-dasharray",dash);l.setAttribute("opacity",opacity);svg.appendChild(l);
 };
 const addText=(x,y,value,color)=>{
  const t=document.createElementNS(ns,"text");t.setAttribute("x",x);t.setAttribute("y",y);t.setAttribute("fill",color);t.setAttribute("font-size","10");t.setAttribute("font-family","DM Mono, monospace");t.setAttribute("font-weight","600");t.setAttribute("paint-order","stroke");t.setAttribute("stroke","#101820");t.setAttribute("stroke-width","3");t.textContent=value;svg.appendChild(t);
 };
 const drawLevel=(item,side)=>{
  if(!item)return null;
  const y=candleSeries.priceToCoordinate(item.price);if(y==null||y<8||y>height-18)return null;
  const bullish=side==="bull",color=bullish?"#36c47b":"#ef7772";
  addLine(x1,y,width-76,y,color,"6 4",.95);
  addText(Math.max(8,width-250),Math.max(13,Math.min(height-5,y-7)),(bull?"BUYERS":"SELLERS")+" · "+fmt(item.price),color);
  return {x:width-78,y};
 };
 const bullPoint=drawLevel(levels.bull,"bull"),bearPoint=drawLevel(levels.bear,"bear");
 const currentY=candleSeries.priceToCoordinate(levels.price);
 if(currentY!=null&&currentY>=0&&currentY<=height){addLine(x1,currentY,width-76,currentY,"#e4b85f","2 5",.55);addText(10,Math.max(13,currentY-7),"LIVE "+fmt(levels.price),"#e4b85f");}
 const drawProjection=(point,target,color,label)=>{
  if(!point||!target)return;
  const y=candleSeries.priceToCoordinate(target.price);if(y==null||y<8||y>height-18)return;
  const xStart=Math.max(x1+12,width-250),xEnd=width-82;
  const p=document.createElementNS(ns,"path");p.setAttribute("d","M "+xStart+" "+point.y+" L "+xEnd+" "+y);p.setAttribute("fill","none");p.setAttribute("stroke",color);p.setAttribute("stroke-width","2");p.setAttribute("stroke-dasharray","5 5");p.setAttribute("opacity",".85");svg.appendChild(p);
  addText(Math.max(10,xEnd-165),Math.max(13,y-9),label+" → "+fmt(target.price),color);
 };
 drawProjection(bullPoint,levels.nextBull,"#36c47b","NEXT UPSIDE LIQUIDITY");
 drawProjection(bearPoint,levels.nextBear,"#ef7772","NEXT DOWNSIDE LIQUIDITY");
 analysisLayer.appendChild(svg);
 const banner=document.createElement("div");banner.className="chart-consensus-overlay";
 banner.textContent="CONSENSUS CHECK · NO UNANIMOUS DIRECTION · WAIT FOR CONFIRMED CLOSE + RETEST";
 analysisLayer.appendChild(banner);
}
function drawIndicator(result,bars){
 removeOverlays();latestIndicatorResult=result;
 const swingHighs=result.summary.structure.recent_swing_highs||[],swingLows=result.summary.structure.recent_swing_lows||[];
 swingHighs.forEach((p,i)=>{const line=candleSeries.createPriceLine({price:p,color:"rgba(239,81,77,.62)",lineWidth:i===swingHighs.length-1?1:1,lineStyle:LightweightCharts.LineStyle.Dotted,axisLabelVisible:false,title:"Recent swing high"});priceLines.push({series:candleSeries,line})});
 swingLows.forEach((p,i)=>{const line=candleSeries.createPriceLine({price:p,color:"rgba(54,196,123,.62)",lineWidth:1,lineStyle:LightweightCharts.LineStyle.Dotted,axisLabelVisible:false,title:"Recent swing low"});priceLines.push({series:candleSeries,line})});
 result.liquidity.forEach(l=>{
  const line=candleSeries.createPriceLine({price:l.price,color:l.isHigh?"rgba(239,81,77,.62)":"rgba(54,196,123,.62)",lineWidth:1,lineStyle:LightweightCharts.LineStyle.Dashed,axisLabelVisible:false,title:l.label});
  priceLines.push({series:candleSeries,line});
 });
 result.activeObs.forEach(o=>{
  [o.top,o.bottom].forEach((p,i)=>{
   const line=candleSeries.createPriceLine({price:p,color:o.direction==="bullish"?"rgba(54,196,123,.72)":"rgba(239,81,77,.72)",lineWidth:1,lineStyle:LightweightCharts.LineStyle.Dotted,axisLabelVisible:false,title:(o.direction==="bullish"?"Demand OB ":"Supply OB ")+(i?"low":"high")});
   priceLines.push({series:candleSeries,line});
  });
 });
 const marks=[];
 result.sweeps.forEach(s=>marks.push({time:s.time,position:s.direction==="high"?"aboveBar":"belowBar",color:"#e4b85f",shape:s.direction==="high"?"arrowDown":"arrowUp",text:s.label}));
 marks.sort((a,b)=>a.time-b.time);
 activeZoneData=result.activeObs;activeFvgData=detectFvgs(bars);updateObZones();renderWhereTable(result.summary,bars);drawAnalysisOverlay(result,bars);
 const recentSweep=result.sweeps.find(s=>s.time===bars[bars.length-1].time);
 $("chart-indicator-status").textContent=(recentSweep?"SWEEP ALERT · "+recentSweep.label+" · "+fmt(recentSweep.price):"Analysis map · "+result.activeObs.length+" active OBs · "+activeFvgData.length+" unfilled FVGs · "+result.liquidity.length+" liquidity levels")+" · close + retest scenarios";
 if(LightweightCharts.createSeriesMarkers){
  if(markersApi&&markersApi.setMarkers)markersApi.setMarkers(marks);
  else markersApi=LightweightCharts.createSeriesMarkers(candleSeries,marks);
 }
}
function initChart(){
 const el=$("xau-chart");if(!el||!window.LightweightCharts)return;
 chart=LightweightCharts.createChart(el,{width:el.clientWidth,height:el.clientHeight,layout:{background:{type:LightweightCharts.ColorType.Solid,color:"#101820"},textColor:"#a9b6c2",fontFamily:"DM Mono, monospace"},grid:{vertLines:{color:"#1e2b35"},horzLines:{color:"#1e2b35"}},rightPriceScale:{borderColor:"#34424e"},timeScale:{borderColor:"#34424e",timeVisible:true,secondsVisible:false},crosshair:{mode:LightweightCharts.CrosshairMode.Normal},localization:{priceFormatter:fmt}});
 candleSeries=chart.addSeries(LightweightCharts.CandlestickSeries,{upColor:"#36c47b",downColor:"#ef514d",borderUpColor:"#36c47b",borderDownColor:"#ef514d",wickUpColor:"#36c47b",wickDownColor:"#ef514d"});
 volumeSeries=chart.addSeries(LightweightCharts.HistogramSeries,{priceFormat:{type:"volume"},priceScaleId:"volume",lastValueVisible:false,priceLineVisible:false});
 chart.priceScale("volume").applyOptions({scaleMargins:{top:.82,bottom:0},visible:false});
 obZoneLayer=document.createElement("div");obZoneLayer.className="ob-zones";el.appendChild(obZoneLayer);analysisLayer=document.createElement("div");analysisLayer.className="analysis-overlay-layer";el.appendChild(analysisLayer);
 chart.timeScale().subscribeVisibleTimeRangeChange(()=>{updateObZones();drawAnalysisOverlay(latestIndicatorResult,chartData?.candles)});
 const ro=new ResizeObserver(entries=>{for(const e of entries){if(e.contentRect.width>0&&e.contentRect.height>0){chart.applyOptions({width:Math.floor(e.contentRect.width),height:Math.floor(e.contentRect.height)});updateObZones();drawAnalysisOverlay(latestIndicatorResult,chartData?.candles)}}});
 ro.observe(el);
}
function renderPrice(data){
 const bars=data.candles;
 candleSeries.setData(bars.map(b=>({time:b.time,open:b.open,high:b.high,low:b.low,close:b.close})));
 volumeSeries.setData(bars.map(b=>({time:b.time,value:b.volume||0,color:b.close>=b.open?"rgba(54,196,123,.22)":"rgba(239,81,77,.22)"})));
 if(fitOnNextLoad){chart.timeScale().fitContent();fitOnNextLoad=false;}
 const last=bars[bars.length-1],first=bars[Math.max(0,bars.length-2)];
 $("chart-last-price").textContent="$"+fmt(last.close);
 const ch=last.open?((last.close/last.open)-1)*100:0;
 $("chart-last-change").textContent=(ch>=0?"+":"")+ch.toFixed(2)+"% · latest candle";
 $("chart-last-change").style.color=ch>=0?"#36c47b":"#ef514d";
 $("chart-feed-status").textContent="DATA CONNECTED · "+data.source+" · refresh "+data.refresh_seconds+"s";
 $("chart-candle-time").textContent=tfLabel[interval]+" candles · last bar "+new Date(last.time*1000).toLocaleString("en-GB",{timeZone:"Africa/Algiers",hour12:false})+" Algeria";
 $("chart-indicator-status").textContent="XAUUSD market structure · swing support/resistance · order blocks · FVGs · session liquidity";
}
function renderExplanation(a){
 const html='<div class="chart-ai-label">CHART + MACRO EXPLANATION · '+(a.engine==="gemini-chart"?"AI":"RULES FALLBACK")+'</div><h3>'+escapeHtml(a.headline||"Chart analysis")+'</h3><p>'+escapeHtml(a.body||"Waiting for chart analysis.")+'</p><div class="chart-ai-meta">Confidence: '+escapeHtml(a.confidence||"LOW")+' · '+new Date(a.updated_at||Date.now()).toLocaleTimeString("en-GB",{timeZone:"Africa/Algiers",hour12:false})+' Algeria time</div>';
 if($("chart-ai-context"))$("chart-ai-context").innerHTML=html;
 if($("live-move-explainer"))$("live-move-explainer").innerHTML='<p>'+escapeHtml(a.body||"Waiting for chart analysis.")+'</p>';
 if($("live-move-headline"))$("live-move-headline").textContent=a.headline||"Chart analysis";
 if($("live-move-time"))$("live-move-time").textContent="Updated "+new Date(a.updated_at||Date.now()).toLocaleTimeString("en-GB",{timeZone:"Africa/Algiers",hour12:false})+" Algeria time · "+(a.engine==="gemini-chart"?"Gemini chart analysis":"rules-based evidence");
 const liveCard=$("live-move-headline")?.closest(".live-move-card");if(liveCard){liveCard.classList.remove("direction-bullish","direction-bearish");const text=String(a.body||"").toLowerCase();if(/bullish|higher highs|reclaim|buyers hold|upside/.test(text))liveCard.classList.add("direction-bullish");else if(/bearish|lower lows|breakdown|sellers hold|downside/.test(text))liveCard.classList.add("direction-bearish");}
 window.dispatchEvent(new Event("gold-chart-analysis-updated"));
}
function escapeHtml(s){return String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));}
async function explain(summary,force){
 const candle=summary.last?.time;
 if(analysisBusy||(!force&&candle===lastAnalysisCandle))return;
 window.goldChartSummary=summary;
 analysisBusy=true;lastAnalysisCandle=candle;
 try{
  const terminal=window.goldTerminalData||{};
  let communityIdeas=window.goldTradingViewIdeas||[];
  try{const ideaResponse=await fetch(apiBase()+"/api/tradingview-gold-ideas",{cache:"no-store",signal:AbortSignal.timeout(8000)});if(ideaResponse.ok){const ideaData=await ideaResponse.json();communityIdeas=(ideaData.ideas||communityIdeas).slice(0,8);window.goldTradingViewIdeas=communityIdeas;}}catch{}
  const response=await fetch(apiBase()+"/api/chart-analysis",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({chart:summary,market:terminal.market||{},headlines:(terminal.news||[]).slice(0,6).map(n=>({title:n.title,source:n.source,published_at:n.published_at})),community_ideas:communityIdeas}),signal:AbortSignal.timeout(14000)});
  if(!response.ok)throw Error("Chart analysis HTTP "+response.status);
  const data=await response.json();if(data.analysis)renderExplanation(data.analysis);
 }catch(e){renderExplanation({headline:"Chart is live; AI explanation unavailable",body:"The chart and indicator are still updating. The analysis service returned: "+e.message,confidence:"LOW",engine:"offline",updated_at:new Date().toISOString()})}
 finally{analysisBusy=false}
}
let lastExternalContextAnalysisAt=0;
window.addEventListener("gold-terminal-updated",()=>{if(window.goldChartSummary&&Date.now()-lastExternalContextAnalysisAt>180000){lastExternalContextAnalysisAt=Date.now();explain(window.goldChartSummary,true)}});
window.addEventListener("gold-tradingview-ideas-updated",()=>{if(window.goldChartSummary&&Date.now()-lastExternalContextAnalysisAt>60000){lastExternalContextAnalysisAt=Date.now();explain(window.goldChartSummary,true)}});
function applyLiveTick(tick){
 lastStreamTick=Date.now();
 if(!chartData||!Array.isArray(chartData.candles)||!tick||!Number.isFinite(Number(tick.price))||!Number.isFinite(Number(tick.timestamp)))return;
 const price=Number(tick.price);window.goldLastTickPrice=price;window.goldLastTickAt=Number(tick.timestamp);const step=({"5min":300,"15min":900,"30min":1800,"1h":3600})[interval]||300,bucket=Math.floor(Number(tick.timestamp)/step)*step,bars=chartData.candles,last=bars[bars.length-1];
 if(!last||bucket<last.time)return;
 let next,closedBar=false;
 if(bucket===last.time){next={...last,high:Math.max(last.high,price),low:Math.min(last.low,price),close:price};bars[bars.length-1]=next;}
 else{next={time:bucket,open:price,high:price,low:price,close:price,volume:0};bars.push(next);if(bars.length>500)bars.shift();closedBar=true;}
 candleSeries.update({time:next.time,open:next.open,high:next.high,low:next.low,close:next.close});
 volumeSeries.update({time:next.time,value:next.volume||0,color:next.close>=next.open?"rgba(54,196,123,.22)":"rgba(239,81,77,.22)"});
 $("chart-last-price").textContent="$"+fmt(price);
 $("chart-last-change").textContent="LIVE TICK · "+new Date(Number(tick.timestamp)*1000).toLocaleTimeString("en-GB",{timeZone:"Africa/Algiers",hour12:false});
 $("chart-last-change").style.color=next.close>=next.open?"#36c47b":"#ef514d";
 $("chart-candle-time").textContent=tfLabel[interval]+" candles · live tick "+new Date(Number(tick.timestamp)*1000).toLocaleString("en-GB",{timeZone:"Africa/Algiers",hour12:false})+" Algeria";
 if(closedBar){const ind=calculateIndicator(bars,chartData.order_block_candles||[]);drawIndicator(ind,bars);explain(ind.summary,false);}else if(latestIndicatorResult){drawAnalysisOverlay(latestIndicatorResult,bars);}
 const prior=Number(last.close),movePct=prior>0?(price/prior-1)*100:0,shock=Math.abs(movePct)>=0.15||Math.abs(price-Number(last.open||prior))>=5;
 if(shock&&Date.now()-(window.lastGoldShockAnalysisAt||0)>90000&&!closedBar){window.lastGoldShockAnalysisAt=Date.now();const ind=calculateIndicator(bars,chartData.order_block_candles||[]);drawIndicator(ind,bars);explain(ind.summary,true);}
}
function connectLiveStream(){
 if(streamSocket&&(streamSocket.readyState===WebSocket.OPEN||streamSocket.readyState===WebSocket.CONNECTING))return;
 try{
  const base=new URL(apiBase());base.protocol=base.protocol==="https:"?"wss:":"ws:";base.pathname=base.pathname.replace(/\/$/,"")+"/api/stream";base.search="";
  streamSocket=new WebSocket(base.toString());
  streamSocket.addEventListener("open",()=>{streamConnected=true;$("chart-feed-status").textContent="LIVE TICK STREAM · TWELVE DATA";streamHeartbeat=setInterval(()=>{if(streamSocket?.readyState===WebSocket.OPEN)streamSocket.send(JSON.stringify({action:"heartbeat"}))},10000);});
  streamSocket.addEventListener("message",event=>{try{const msg=JSON.parse(event.data);if(msg.event==="price"&&msg.symbol==="XAU/USD")applyLiveTick(msg);else if(msg.event==="subscribe-status"&&msg.status!=="ok"){streamUnavailable=true;streamConnected=false;$("chart-feed-status").textContent="LIVE STREAM NOT AVAILABLE ON THIS TWELVE DATA PLAN · REST FALLBACK";try{streamSocket.close()}catch{}}}catch{}});
  streamSocket.addEventListener("error",()=>{$("chart-feed-status").textContent="LIVE STREAM ERROR · reconnecting";});
  streamSocket.addEventListener("close",()=>{streamConnected=false;if(streamHeartbeat)clearInterval(streamHeartbeat);streamHeartbeat=null;if(streamRetry)clearTimeout(streamRetry);if(!streamUnavailable)streamRetry=setTimeout(connectLiveStream,5000);});
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
 loadResearchLevels();loadChart(true);connectLiveStream();setInterval(loadResearchLevels,5*60*1000);setInterval(()=>{if(!streamConnected||!lastStreamTick||Date.now()-lastStreamTick>90000)loadChart(false);},60000);
});
})();