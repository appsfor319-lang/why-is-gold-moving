(()=>{"use strict";
const root=document.getElementById("gold-session-days");
if(!root)return;
const holidays={
 "2026-12-25":"Christmas Day · major market closure",
 "2027-01-01":"New Year's Day · major market closure",
 "2027-03-26":"Good Friday · major market closure",
 "2027-12-24":"Christmas Eve · verify broker early close",
 "2027-12-25":"Christmas Day · major market closure"
};
const fmtDate=d=>new Intl.DateTimeFormat("en-GB",{timeZone:"Africa/Algiers",day:"2-digit",month:"short",year:"numeric"}).format(d);
const fmtDay=d=>new Intl.DateTimeFormat("en-GB",{timeZone:"Africa/Algiers",weekday:"long"}).format(d);
const key=d=>new Intl.DateTimeFormat("en-CA",{timeZone:"Africa/Algiers",year:"numeric",month:"2-digit",day:"2-digit"}).format(d);
function render(){
 const now=new Date(),todayKey=key(now),items=[];
 for(let i=0;i<14;i++){
  const d=new Date(now.getTime()+i*86400000),k=key(d),day=fmtDay(d),weekday=new Date(k+"T12:00:00+01:00").getDay();
  const holiday=holidays[k],weekend=weekday===0||weekday===6;
  let open=!weekend&&!holiday,status=open?"OPEN":"CLOSED",hours=open?"Typical session · 00:00–23:00":"No regular session";
  let reason=holiday|| (weekday===6?"Saturday · weekend closure":weekday===0?"Sunday · opens around midnight Algeria time": "");
  if(k===todayKey){
   const alg=new Intl.DateTimeFormat("en-GB",{timeZone:"Africa/Algiers",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(now);
   hours+=" · now "+alg+" ALG";
  }
  if(weekday===5&&!holiday){hours="Typical session · closes around 23:00 ALG";}
  if(weekday===0&&!holiday){hours="Opens around 00:00 Monday ALG";}
  items.push({day,date:fmtDate(d),open,status,hours,reason});
 }
 root.innerHTML=items.map(x=>'<article class="gold-session-day '+(x.open?"is-open":"is-closed")+'"><div class="day-name">'+x.day+'</div><div class="day-date">'+x.date+'</div><div class="day-status">'+x.status+'</div><div class="day-hours">'+x.hours+'</div>'+(x.reason?'<div class="day-reason">'+x.reason+'</div>':"")+'</article>').join("");
}
render();setInterval(render,60000);
})();