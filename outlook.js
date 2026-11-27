(()=>{"use strict";
const $=id=>document.getElementById(id);
const api=()=>{try{let u=localStorage.getItem("why-gold-api-base")||"https://why-is-gold-movingm.appsfor319.workers.dev";while(u.endsWith("/"))u=u.slice(0,-1);return u}catch{return"https://why-is-gold-movingm.appsfor319.workers.dev"}};
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const money=n=>n==null||!Number.isFinite(Number(n))?"—":"$"+Number(n).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});
const stamp=x=>x?new Date(x).toLocaleString("en-GB",{timeZone:"Africa/Algiers",hour12:false})+" Algeria time":"Timestamp unavailable";
let busy=false,last=null;
function marketContext(d){const m=d?.market||{},g=m.gold||{};return{price:g.value,change_pct:g.change_pct,change_period:g.change_period,updated_at:d?.updated_at,dxy:m.dxy,yield:m.yield,silver:m.silver,oil:m.oil,briefing:d?.briefing,news:(d?.news||[]).slice(0,15),calendar:(d?.calendar||[]).slice(0,8),positioning:d?.positioning,sources:d?.sources};}
function sourceCard(s){const url=s.url||s.source_url||"",valid=url.startsWith("https://")||url.startsWith("http://");return'<article class="outlook-source"><div class="outlook-source-meta">'+esc(s.source||s.author||"Source")+' · '+esc(stamp(s.published_at||s.timestamp))+'</div><h4>'+esc(s.title||s.headline||"Market source")+'</h4><p>'+esc(s.summary||s.reason||"")+'</p>'+(valid?'<a href="'+esc(url)+'" target="_blank" rel="noopener noreferrer">Open original ↗</a>':'<span class="fine">Source link unavailable</span>')+'</article>'}
function render(o,d){
 const direction=String(o.direction||"").toLowerCase(),label=direction.includes("bull")?"BULLISH":direction.includes("bear")?"BEARISH":direction.includes("neutral")?"NEUTRAL":direction||"UNASSESSED";
 $("outlook-direction").textContent=label;$("outlook-direction").className=direction.includes("bull")?"bull":direction.includes("bear")?"bear":"";
 $("outlook-confidence").textContent=o.confidence!=null?"Confidence: "+o.confidence+(typeof o.confidence==="number"?"%":""):"Confidence not provided";
 $("outlook-summary").textContent=o.summary||o.headline||"No summary supplied.";
 $("outlook-why-title").textContent=o.why_title||"Main drivers";
 $("outlook-why").textContent=o.why||o.drivers_explanation||"No verified causal explanation returned.";
 $("outlook-stuck-title").textContent=o.obstacle||o.resistance_support||"Current obstacle not identified";
 $("outlook-stuck").textContent=o.obstacle_reason||o.why_stuck||"No verified reason supplied for the current stall.";
 const target=o.next_target; $("outlook-next-target").textContent=typeof target==="object"?money(target.price):target==null?"—":String(target);
 $("outlook-next-reason").textContent=o.next_target_reason||o.target_reason||"Target reasoning not supplied.";
 const levels=Array.isArray(o.levels)?o.levels:[];
 $("outlook-levels").innerHTML=levels.length?levels.map(l=>'<article class="outlook-level"><span class="level-kind">'+esc(l.type||l.label||"Level")+'</span><strong>'+esc(money(l.price))+'</strong><p>'+esc(l.reason||"Reason not supplied")+'</p><small>'+esc(l.consensus_count==null?"Independent sources not counted":l.consensus_count+" independent mentions")+'</small></article>').join(""):'<div class="empty">No verified price levels in the response. Do not invent them.</div>';
 const scenarios=Array.isArray(o.scenarios)?o.scenarios:[];
 $("outlook-scenarios").innerHTML=scenarios.length?scenarios.map(s=>'<article class="outlook-scenario"><h4>'+esc(s.name||s.direction||"Scenario")+'</h4><p><b>Trigger:</b> '+esc(s.trigger||"Not specified")+'</p><p><b>Path / target:</b> '+esc(s.target||s.path||"Not specified")+'</p><p><b>Why:</b> '+esc(s.reason||"Not explained")+'</p><p><b>Invalidation:</b> '+esc(s.invalidation||"Not specified")+'</p></article>').join(""):'<div class="empty">No scenarios returned.</div>';
 const c=o.consensus||{},opinions=Array.isArray(c.opinions)?c.opinions:[];
const verified=Array.isArray(o.verified_analysts)?o.verified_analysts:(Array.isArray(c.verified_analysts)?c.verified_analysts:[]);const vbox=$("outlook-verified-scorecards");if(vbox)vbox.innerHTML=verified.length?verified.map(a=>'<article class="outlook-source"><div class="outlook-source-meta">'+esc(a.institution||"Research institution")+' · '+esc(a.status||"AUDIT STATUS")+'</div><h4>'+esc(a.name||"Analyst")+'</h4><p>'+esc(a.summary||"")+'</p><div class="scorecard-metrics">'+["sample_size","direction_accuracy","target_hit_rate","mean_error","benchmark","timeframe"].map(k=>a[k]!=null?'<span><b>'+esc(k.replaceAll("_"," "))+'</b> '+esc(a[k])+'</span>':"").join("")+'</div>'+(a.url&&a.url.startsWith("https://")?'<a href="'+esc(a.url)+'" target="_blank" rel="noopener noreferrer">Audit record ↗</a>':"")+"</article>").join(""):'<div class="empty">No individual win-rate records are independently audited yet. Published opinions are not ranked by accuracy until a forecast history is verified.</div>";
 $("outlook-consensus").innerHTML=(c.sources_analyzed!=null?'<div class="consensus-count"><strong>'+esc(c.sources_analyzed)+'</strong><span>sources analyzed</span><strong>'+esc(c.bullish_count??"—")+'</strong><span>bullish</span><strong>'+esc(c.bearish_count??"—")+'</strong><span>bearish</span><strong>'+esc(c.neutral_count??"—")+'</strong><span>neutral</span></div>':'')+(c.summary?'<p class="consensus-summary">'+esc(c.summary)+'</p>':'')+(opinions.length?opinions.map(sourceCard).join(""):'<div class="empty">No individual professional opinions supplied. Counts are withheld until sources are available and deduplicated.</div>');
 const src=Array.isArray(o.sources)?o.sources:[];$("outlook-sources").innerHTML=src.length?src.map(sourceCard).join(""):'<div class="empty">No source list returned.</div>';
 $("outlook-status").textContent="Outlook updated "+stamp(o.updated_at||d?.updated_at)+" · "+(o.engine||"analysis engine")+" · "+(o.data_freshness||"freshness not specified");
}
function node(tag,cls,text){const e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;return e}
function renderResearchSnapshot(s,id){
 if(!s)return;const pane=$("pane-outlook");if(!pane)return;
 const live=!!s.live;const sectionId=id||(live?"live-research-snapshot":"claude-research-snapshot");
 let section=$(sectionId);if(!section){section=node("section","outlook-section");section.id=sectionId;pane.insertBefore(section,pane.querySelector(".outlook-foot"))}
 section.textContent="";
 const head=node("div","outlook-section-head");head.append(node("p","eyebrow",live?"AUTO-REFRESHED · HEURISTIC, NOT AI":"IMPORTED RESEARCH · NOT LIVE"));head.append(node("h3",null,(live?"Automatic market snapshot":"Claude research snapshot")+" · "+s.snapshot_date));section.append(head);
 const warning=node("div","outlook-snapshot-warning",s.caveat||"Imported snapshot; not independently verified.");section.append(warning);
 const overview=node("div","outlook-snapshot-grid");section.append(overview);
 const overviewCards=live?[["Short-term lean",s.short_term_direction,s.short_term_confidence],["Current gold",money(s.price),"Latest quote · auto-refresh"],["5-day range",s.range_usd?.map(v=>money(v)).join(" – ")||"Not supplied","Observed high / low"],["Engine",s.engine||"Heuristic","Not a calibrated model"]]:[["Short-term",s.short_term_direction,s.short_term_confidence],["6–12 months",s.long_term_direction,"Long-horizon view"],["Snapshot price",s.price_range_usd?.map(v=>money(v)).join(" – ")||"Not supplied","USD range at time of research"],["Likely range",s.range_usd?.map(v=>money(v)).join(" – ")||"Not supplied","Snapshot scenario range"]];
 overviewCards.forEach(([a,b,c])=>{const card=node("article","outlook-card");card.append(node("span","outlook-label",a.toUpperCase()),node("h3",null,b||"Not stated"),node("p",null,c||""));overview.append(card)});
 const sum=node("p","outlook-snapshot-summary",s.summary||"");section.append(sum);
 if(s.market_inputs){const mi=s.market_inputs;const data=node("div","outlook-snapshot-grid");section.append(node("h4",null,"Market inputs at research time"),data);[[ "Gold change",mi.gold?.change_5d_pct!=null?mi.gold.change_5d_pct.toFixed(2)+"%":mi.gold?.daily_change_pct!=null?mi.gold.daily_change_pct.toFixed(2)+"%":"—"],["DXY",mi.dxy?.price!=null?String(mi.dxy.price)+(mi.dxy.change_pct!=null?" ("+mi.dxy.change_pct.toFixed(2)+"%)":""):"Unavailable"],["Silver",mi.silver?.price!=null?money(mi.silver.price):"Unavailable"],["10Y real yield",mi.real_yield_10y?.value!=null?mi.real_yield_10y.value.toFixed(2)+"%":"Unavailable"],["Oil",mi.oil?.price!=null?money(mi.oil.price):"Unavailable"]].forEach(([k,v])=>{const c=node("article","outlook-level");c.append(node("span","level-kind",k),node("strong",null,String(v)));data.append(c)});}
 if(s.market_inputs?.headlines?.length){const news=node("div","outlook-sources");section.append(node("h4",null,live?"Fresh headlines (RSS)":"Headlines from research sources"),news);s.market_inputs.headlines.slice(0,8).forEach(n=>{const c=node("article","outlook-source");c.append(node("div","outlook-source-meta",n.source||"News feed"),node("h4",null,n.title));if(n.published_at)c.append(node("p",null,n.published_at));if(n.url){const a=node("a",null,"Open source ↗");a.href=n.url;a.target="_blank";a.rel="noopener noreferrer";c.append(a)}news.append(c)});}
 const levels=node("div","outlook-snapshot-grid");section.append(node("h4",null,live?"Range-derived levels (auto-updated)":"Snapshot levels (not refreshed)"),levels);
 [["Near resistance",s.near_resistance],["Support",s.support],["Major resistance",[s.major_resistance]],["Upside targets",s.upside_targets],["Downside targets",s.downside_targets]].forEach(([label,vals])=>{if(!Array.isArray(vals)||!vals.length)return;const card=node("article","outlook-level");card.append(node("span","level-kind",label),node("strong",null,vals.map(v=>money(v)).join(" · ")));levels.append(card)});
 const scenarios=node("div","outlook-scenarios");section.append(node("h4",null,"Conditional paths"),scenarios);
 (s.scenarios||[]).forEach(x=>{const card=node("article","outlook-scenario");card.append(node("h4",null,x.name),node("p",null,"Trigger: "+x.trigger),node("p",null,"Path: "+x.path),node("p",null,"Why: "+x.reason),node("p",null,"Invalidation: "+x.invalidation));scenarios.append(card)});
 const drivers=node("div","outlook-snapshot-grid");section.append(node("h4",null,live?"Signals used by the heuristic":"Drivers cited in the snapshot"),drivers);
 (s.drivers||[]).forEach(x=>{const card=node("article","outlook-card");card.append(node("span","outlook-label",x.bias||"MIXED"),node("h3",null,x.title),node("p",null,x.detail));drivers.append(card)});
 const consensus=node("div","outlook-snapshot-grid");section.append(node("h4",null,live?"Analyst consensus (not connected)":"Analyst views · all unverified in this snapshot"),consensus);
 const cc=s.analyst_consensus||{};const c1=node("article","outlook-card");c1.append(node("span","outlook-label","SHORT TERM"),node("p",null,cc.short_term||"No verified consensus."));consensus.append(c1);
 const c2=node("article","outlook-card");c2.append(node("span","outlook-label","LONG TERM"),node("p",null,cc.long_term||"No verified consensus."));consensus.append(c2);
 (cc.unverified_opinions||[]).forEach(x=>{const card=node("article","outlook-source");card.append(node("div","outlook-source-meta",x.status),node("h4",null,x.source),node("p",null,x.view),node("p",null,x.levels));consensus.append(card)});
 const src=node("div","outlook-sources");section.append(node("h4",null,live?"Data-source notes":"Sources attached to the imported research"),src);
 (s.sources||[]).forEach(x=>{const card=node("article","outlook-source");card.append(node("div","outlook-source-meta",x.source),node("h4",null,x.title));const a=node("a",null,"Open source ↗");a.href=x.url;a.target="_blank";a.rel="noopener noreferrer";card.append(a);src.append(card)});
}
function renderDestination(d){
 if(!d)return;const $d=id=>document.getElementById(id);const fmt=n=>"$"+Number(n).toLocaleString("en-US",{maximumFractionDigits:2});
 $d("destination-updated").textContent=d.snapshot_label+" · Ref quote "+fmt(d.price_reference.low)+"–"+fmt(d.price_reference.high);
 $d("destination-bias").textContent=d.bias;
 $d("destination-bottomline").textContent=d.bottom_line;
 const lev=$d("destination-levels");lev.textContent="";
 (d.levels||[]).forEach(l=>{const c=node("article","destination-level");c.append(node("span","level-label",l.label),node("strong",null,fmt(l.price)),node("p",null,l.note));lev.append(c)});
 const paths=$d("destination-paths");paths.textContent="";
 (d.paths||[]).forEach(p=>{const c=node("article","destination-path");c.append(node("h4",null,p.name),node("p",null,"Trigger: "+p.trigger),node("p",null,"Path: "+p.target),node("p",null,"Invalidation: "+p.invalidation));paths.append(c)});
 function sourceCards(id,items){const el=$d(id);el.textContent="";(items||[]).forEach(a=>{const c=node("article","destination-source");c.append(node("div","destination-source-label",a.horizon||a.label||a.published||a.source),node("h4",null,a.source),node("p",null,a.view));const link=node("a",null,"Read source ↗");link.href=a.url;link.target="_blank";link.rel="noopener noreferrer";c.append(link);el.append(c)})}
 sourceCards("destination-pros",d.professional_views);sourceCards("destination-community",d.community_views);
 $d("destination-positioning").textContent=d.positioning;
 const src=$d("destination-sources");src.textContent="";(d.sources||[]).forEach(s=>{const a=node("a",null,s.name);a.href=s.url;a.target="_blank";a.rel="noopener noreferrer";src.append(a)});
 $d("destination-limitations").textContent=d.limitations||"Views are source summaries, not recommendations. Quote may be delayed.";
 const ask=$d("ask-claude-research");if(ask&&!ask.dataset.bound){ask.dataset.bound="1";ask.addEventListener("click",async()=>{const brief=["Refresh and critically verify this gold outlook using current primary and trusted sources. Do not blindly agree.","Current desk view: "+d.bias,"Price reference: "+d.price_reference.low+"–"+d.price_reference.high,"Summary: "+d.bottom_line,"Scenarios:\\n"+(d.paths||[]).map(p=>p.name+" | trigger: "+p.trigger+" | target path: "+p.target+" | invalidation: "+p.invalidation).join("\\n"),"Professional opinions:\\n"+(d.professional_views||[]).map(p=>p.source+" ("+p.horizon+"): "+p.view+" Source: "+p.url).join("\\n"),"Community opinions (not vetted):\\n"+(d.community_views||[]).map(p=>p.source+": "+p.view+" Source: "+p.url).join("\\n"),"Sources to verify:\\n"+(d.sources||[]).map(s=>s.name+" "+s.url).join("\\n"),"Please give an evidence-weighted view, conflicting evidence, key price levels, what whales/positioning can actually be verified, and what would invalidate each path. Do not fabricate live prices, X posts, forecasts, win rates, or sources. Separate intraday, swing, and long-term."] .join("\\n\\n");try{await navigator.clipboard.writeText(brief);ask.textContent="Brief copied — paste it in Claude";}catch{ask.textContent="Clipboard blocked — brief not copied";}window.open("https://claude.ai/new","_blank","noopener");});}
}
fetch("./research/where-gold-going-2026-11-27.json",{cache:"no-store"}).then(r=>{if(!r.ok)throw Error("snapshot HTTP "+r.status);return r.json()}).then(renderDestination).catch(e=>{const el=document.getElementById("destination-bottomline");if(el)el.textContent="Source-checked outlook unavailable: "+e.message});
Promise.all([fetch("./research/live-market-outlook.json",{cache:"no-store"}).then(r=>r.ok?r.json():null).catch(()=>null),fetch("./research/claude-market-snapshot-2026-11-27.json",{cache:"no-store"}).then(r=>r.ok?r.json():null).catch(()=>null)]).then(([live,legacy])=>{if(live)renderResearchSnapshot(live,"live-research-snapshot");if(legacy)renderResearchSnapshot(legacy,"claude-research-snapshot")});
function renderFallback(d){
 const ctx=marketContext(d),g=ctx.price,change=ctx.change_pct,brief=ctx.briefing||{};
 $("outlook-direction").textContent=change==null?"UNASSESSED":Number(change)>0?"GOLD UP TODAY":Number(change)<0?"GOLD DOWN TODAY":"FLAT TODAY";
 $("outlook-direction").className=change==null?"":Number(change)>0?"bull":"bear";
 $("outlook-confidence").textContent="Market snapshot only · no forecast engine connected";
 $("outlook-summary").textContent=brief.headline||brief.body||"Live market readings are available, but the forecast/research endpoint has not been connected.";
 $("outlook-why-title").textContent="Current market briefing";
 $("outlook-why").textContent=brief.body||"The existing Why Is Gold Moving? briefing is the only verified explanation currently available.";
 $("outlook-stuck-title").textContent="No verified obstacle level";
 $("outlook-stuck").textContent="This site currently has no dedicated live consensus/price-level research endpoint. We will not invent resistance, support, or targets.";
 $("outlook-next-target").textContent="Not available";
 $("outlook-next-reason").textContent="The forecast engine must return sourced levels before this can be populated.";
 $("outlook-levels").innerHTML='<div class="empty">No sourced support/resistance levels yet.</div>';
 $("outlook-scenarios").innerHTML='<div class="empty">Scenario analysis is not active until the Worker outlook endpoint is added.</div>';
 $("outlook-consensus").innerHTML='<div class="empty">Professional/social consensus collection is not connected. No counts or fake agreement displayed.</div>';
 const headlines=(ctx.news||[]).slice(0,8).map(n=>({source:n.source,title:n.title,summary:n.summary,published_at:n.published_at,url:n.url}));
 $("outlook-sources").innerHTML=headlines.length?headlines.map(sourceCard).join(""):'<div class="empty">No news sources in current data.</div>';
 $("outlook-status").textContent="Snapshot "+stamp(d?.updated_at)+" · forecast/research backend not connected";
}
async function load(force=false){
 if(busy)return;busy=true;$("outlook-status").textContent="Researching live gold market…";
 const d=window.goldTerminalData;
 if(!d){$("outlook-status").textContent="Waiting for the main terminal to load live data.";busy=false;return;}
 renderFallback(d);
 try{
  const r=await fetch(api()+"/api/market-outlook",{method:"POST",headers:{"content-type":"application/json"},cache:"no-store",body:JSON.stringify({market:marketContext(d),request:{force_refresh:force,focus:"Where XAUUSD is most likely going now; why price is moving or stuck; sourced support/resistance/targets; credible analyst consensus; bullish and bearish scenarios; catalysts and invalidation.",instructions:"Do not use the user's trading strategy. Explain the live market story in plain language. PRIORITIZE recognized professional forecast sources: LBMA annual and snapshot surveys and historical forecast-vs-actual; Fastmarkets forecast competitions and published rankings; original bank/commodity research desks (HSBC, UBS, TD Securities, RBC, Standard Chartered, Bloomberg Intelligence, StoneX, Metals Focus, Heraeus, CPM Group, Capital Economics, MKS PAMP) only when accessible. Reuters institutional polls and reporting are context, not individual win-rate records. Social accounts and TradingView are discovery-only; include only verified identity, affiliation and original calls. Every target and level needs a source or market evidence. Count only independent opinions, deduplicate reposts, disclose inaccessible sources and stale data, never fabricate analyst counts, citations, credentials or win rates. Individual accuracy metrics require dated forecasts independently audited: minimum 30 for provisional stats, preferably 100+. Include sample size, timeframe, directional accuracy, target hit rate, mean error, losses, methodology and comparison against simply buying gold. Without audited history mark UNVERIFIED and assign zero performance weight. Separate annual survey forecasts from intraday/daily calls. Return a structured outlook with direction, calibrated confidence, summary, why, obstacle, next target and reason, levels, scenarios, consensus and sources."}}),signal:AbortSignal.timeout(45000)});
  if(!r.ok)throw Error("HTTP "+r.status);
  const payload=await r.json(),outlook=payload.outlook||payload.analysis||payload;
  if(!outlook||typeof outlook!=="object")throw Error("Invalid outlook payload");
  render(outlook,d);last=Date.now();
 }catch(e){
  $("outlook-status").textContent="Showing current market snapshot · outlook endpoint unavailable ("+e.message+")";
  console.warn("Market outlook unavailable:",e);
 }
 busy=false;
}
window.addEventListener("gold-terminal-updated",()=>{if($("pane-outlook")?.classList.contains("active"))load(false)});
document.querySelectorAll(".tab").forEach(b=>{if(b.dataset.tab==="outlook")b.addEventListener("click",()=>load(false))});
$("outlook-refresh")?.addEventListener("click",()=>load(true));
setInterval(()=>{if($("pane-outlook")?.classList.contains("active")&&(!last||Date.now()-last>15*60*1000))load(false)},60000);
if($("pane-outlook")?.classList.contains("active"))load(false);
})();