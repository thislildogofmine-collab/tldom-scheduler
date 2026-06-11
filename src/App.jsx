import { useState, useMemo, useRef, useCallback } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// GEO
// ─────────────────────────────────────────────────────────────────────────────
const ZIP_COORDS={
  "78634":[30.4977,-97.5744],"78660":[30.3955,-97.5341],"78702":[30.2577,-97.7166],
  "78703":[30.2888,-97.7566],"78704":[30.2488,-97.7666],"78717":[30.4577,-97.7566],
  "78721":[30.2677,-97.6866],"78723":[30.3077,-97.6966],"78725":[30.2463,-97.6344],
  "78727":[30.4193,-97.7091],"78735":[30.2697,-97.8466],"78745":[30.2088,-97.7866],
  "78746":[30.2977,-97.8066],"78749":[30.2288,-97.8366],"78750":[30.4388,-97.7766],
  "78752":[30.3388,-97.7066],"78753":[30.3788,-97.6766],"78754":[30.3677,-97.6612],
  "78756":[30.3188,-97.7366],"78757":[30.3488,-97.7366],"78758":[30.3888,-97.7127],
};
function haversine([la1,lo1],[la2,lo2]){
  const R=3958.8,dL=(la2-la1)*Math.PI/180,dO=(lo2-lo1)*Math.PI/180;
  const a=Math.sin(dL/2)**2+Math.cos(la1*Math.PI/180)*Math.cos(la2*Math.PI/180)*Math.sin(dO/2)**2;
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}
function distMiles(z1,z2){const a=ZIP_COORDS[z1],b=ZIP_COORDS[z2];return(a&&b)?haversine(a,b):999;}
function extractJobZip(ci){
  if(!ci)return null;
  const z=(ci.split(",").pop()||"").trim();
  return(z.length===5&&/^[0-9]{5}$/.test(z))?z:null;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────
const BLOCK_MAP={
  "Morning Time Block 7am -10am":"morning",
  "Mid-day Time Block 11am - 3pm":"midday",
  "Evening Time Block 5pm - 8pm":"evening",
  "Overnight time block 6pm - 8am":"overnight",
};
const BLOCKS=[
  {key:"morning",  label:"Morning",  sub:"7–10am",  color:"#F59E0B",light:"#fffbeb"},
  {key:"midday",   label:"Mid-day",  sub:"11am–3pm",color:"#3B82F6",light:"#eff6ff"},
  {key:"evening",  label:"Evening",  sub:"5–8pm",   color:"#8B5CF6",light:"#f5f3ff"},
  {key:"overnight",label:"Overnight",sub:"6pm–8am", color:"#1E293B",light:"#f8fafc"},
];
const BLOCK_ORDER={morning:0,midday:1,evening:2,overnight:3};
const PALETTE=["#E53935","#1E88E5","#43A047","#FB8C00","#8E24AA","#00897B","#F4511E","#3949AB","#D81B60","#546E7A"];

const REGULAR_ROSTER=[
  {name:"Alicia Kae Miller",zip:"78702"},
  {name:"Nicholas Romano",  zip:"78735"},
  {name:"Jonathan Tarbay",  zip:"78754"},
  {name:"Jasmine Heyliger", zip:"78634"},
  {name:"Monroe Page",      zip:"78758"},
  {name:"Stefan Gill",      zip:"78717"},
  {name:"Reagan Norman",    zip:"78660"},
  {name:"Mark Carter",      zip:"78750"},
];
const PRN_ROSTER=[
  {name:"Latrise", zip:"78727",telegram:"@latrisepage"},
  {name:"Yejide",  zip:"78725",telegram:"@yejideMyers"},
  {name:"Brianna", zip:"78727",telegram:"@BriannaVoorhies"},
];
const MARKETING_TASKS=[
  "Post Instagram reel — behind-the-scenes walk footage",
  "Send follow-up to inactive clients (90+ days)",
  "Drop flyers in a target neighborhood",
  "Request Google reviews from recent clients",
  "Post to Nextdoor for zone coverage",
  "Film a quick testimonial with a current client",
  "Reach out to Domain area apartment complex manager",
  "Update TTP client notes from last week",
  "Post 'Meet the Team' story for a sitter",
  "Schedule next TLDOM newsletter",
  "DM 3 local businesses for referral partnerships",
  "Check pending TTP service requests",
  "Take neighborhood walk photos for social content",
  "Send a pet birthday message to a client 🐾",
];

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function makeColor(i){const bg=PALETTE[i%PALETTE.length];return{bg,light:bg+"22"};}
function parseISO(s){return s?new Date(s.trim()):null;}
function shortName(f){return(f||"").trim().split(" ")[0];}
function fmtDate(d){return new Date(d+"T12:00:00").toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"});}
function fmtDateShort(d){return new Date(d+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric"});}

function isBlockOff(dateStr,blockKey,timeOffs){
  const ranges={morning:[7,10],midday:[11,15],evening:[17,20],overnight:[18,32]};
  const[bS,bE]=ranges[blockKey]||[0,0];
  const base=new Date(dateStr+"T00:00:00");
  const bs=new Date(base);bs.setHours(bS,0,0,0);
  const be=new Date(base);be.setHours(bE>24?bE-24:bE,0,0,0);
  if(bE>24)be.setDate(be.getDate()+1);
  return timeOffs.some(to=>{
    const s=parseISO(to.startISO),e=parseISO(to.endISO);
    return s&&e&&bs<e&&be>s;
  });
}

function buildPRNMessage(prnName,job){
  const block=BLOCKS.find(b=>b.key===job.blockKey);
  return`Hi ${prnName}! 🐾 TLDOM needs PRN coverage:\n\n📅 ${fmtDate(job.date)}\n⏰ ${block?.label} (${block?.sub})\n📍 Zip: ${job.jobZip||"TBD"}\n👤 Client: ${job.client}\n\nAre you available? Please confirm ASAP. Thank you! 🙏`;
}
function openTelegram(prn,job){
  const msg=buildPRNMessage(prn.name,job);
  if(prn.telegram){
    window.open(`https://t.me/${prn.telegram.replace("@","")}?text=${encodeURIComponent(msg)}`,"_blank");
  }else{
    navigator.clipboard.writeText(msg).then(()=>alert(`Copied! Open Telegram and send to ${prn.name} 📋`));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// AUTO-MATCH ENGINE
// Distributes jobs evenly among available sitters, proximity as tiebreaker
// ─────────────────────────────────────────────────────────────────────────────
function autoMatch(jobs, sitters, timeOffMap){
  const regularSitters=sitters.filter(s=>!s.prn);
  // Track assignment counts per sitter for even distribution
  const counts={};
  regularSitters.forEach(s=>counts[s.id]=0);

  const matched=jobs.map(job=>{
    // Find available sitters for this block/date
    const available=regularSitters.filter(s=>
      !isBlockOff(job.date,job.blockKey,timeOffMap[s.name]||[])
    );
    if(available.length===0)return{...job,assignedTo:null,prnStatus:null};

    // Score: primary = fewest assignments (even distribution), tiebreaker = distance
    const scored=available.map(s=>({
      s,
      count:counts[s.id]||0,
      dist:distMiles(s.zip,job.jobZip),
    }));
    scored.sort((a,b)=>{
      if(a.count!==b.count)return a.count-b.count; // fewer assignments first
      return a.dist-b.dist; // closer first as tiebreaker
    });
    const winner=scored[0].s;
    counts[winner.id]=(counts[winner.id]||0)+1;
    return{...job,assignedTo:winner,prnStatus:null};
  });
  return matched;
}

// Sort a sitter's jobs geographically: home → farthest → nearest → home
function sortJobsGeographically(jobs,sitterZip){
  if(jobs.length<=1)return jobs;
  const remaining=[...jobs];
  const sorted=[];
  let currentZip=sitterZip;
  while(remaining.length>0){
    // Find farthest from current position first (go out), then nearest on way back
    const idx=sorted.length===0
      ? remaining.reduce((bi,j,i)=>distMiles(currentZip,j.jobZip||currentZip)>distMiles(currentZip,remaining[bi].jobZip||currentZip)?i:bi,0)
      : remaining.reduce((bi,j,i)=>distMiles(currentZip,j.jobZip||currentZip)<distMiles(currentZip,remaining[bi].jobZip||currentZip)?i:bi,0);
    sorted.push(remaining[idx]);
    currentZip=remaining[idx].jobZip||currentZip;
    remaining.splice(idx,1);
  }
  return sorted;
}

function buildMapsURL(sitterZip,jobs){
  const homeC=ZIP_COORDS[sitterZip];
  if(!homeC||jobs.length===0)return null;
  const geoJobs=sortJobsGeographically(jobs,sitterZip);
  const origin=`${homeC[0]},${homeC[1]}`;
  const waypoints=geoJobs.map(j=>{
    const c=ZIP_COORDS[j.jobZip];
    return c?`${c[0]},${c[1]}`:(j.jobZip||"Austin TX");
  }).join("/");
  return`https://www.google.com/maps/dir/${origin}/${waypoints}/${origin}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// CSV PARSERS
// ─────────────────────────────────────────────────────────────────────────────
function parseScheduleCSV(text){
  const lines=text.split("\n");
  const headers=lines[0].split(",").map(h=>h.trim().replace(/^"|"$/g,""));
  const rows=[];
  for(let i=1;i<lines.length;i++){
    if(!lines[i].trim())continue;
    const cols=[];let cur="",inQ=false;
    for(const ch of lines[i]){
      if(ch==='"'){inQ=!inQ;}else if(ch===','&&!inQ){cols.push(cur.trim());cur="";}else cur+=ch;
    }
    cols.push(cur.trim());
    const row={};
    headers.forEach((h,i)=>row[h]=(cols[i]||"").replace(/^"|"$/g,""));
    rows.push(row);
  }
  return rows;
}
function parseTimeOffCSV(text){
  const lines=text.split("\n");
  const headers=lines[0].split(",").map(h=>h.trim().replace(/^"|"$/g,""));
  const rows=[];
  for(let i=1;i<lines.length;i++){
    if(!lines[i].trim())continue;
    const cols=lines[i].split(",").map(c=>c.trim().replace(/^"|"$/g,""));
    const row={};headers.forEach((h,idx)=>row[h]=cols[idx]||"");rows.push(row);
  }
  return rows;
}
function scheduleRowsToJobs(rows){
  return rows.map((r,i)=>{
    const blockKey=BLOCK_MAP[(r["Client Time Display"]||"").trim()]||null;
    const clientInfo=r["Client Info"]||"";
    const clientName=clientInfo.split(",")[0].trim();
    const jobZip=extractJobZip(clientInfo);
    const serviceTime=r["Service Time"]||"";
    const datePart=serviceTime.split(" ").slice(1,4).join(" ");
    const dateObj=new Date(datePart+" 12:00:00");
    const isoDate=isNaN(dateObj)?"":dateObj.toISOString().split("T")[0];
    return{id:i+1,staffFull:r["Staff"]||"",client:clientName,date:isoDate,
           blockKey,jobZip,service:r["Service"]||"",assignedTo:null,prnStatus:null};
  }).filter(j=>j.date&&j.blockKey);
}
function timeOffRowsToMap(rows){
  const map={};
  rows.forEach(r=>{
    const staff=r["Staff"]||"";
    if(!staff||!r["Start (Sortable)"])return;
    if(!map[staff])map[staff]=[];
    map[staff].push({startISO:r["Start (Sortable)"],endISO:r["End (Sortable)"],type:r["Type"]||""});
  });
  return map;
}

// ─────────────────────────────────────────────────────────────────────────────
// INIT SITTERS
// ─────────────────────────────────────────────────────────────────────────────
function initSitters(){
  const reg=REGULAR_ROSTER.map((r,i)=>({id:i+1,name:r.name,zip:r.zip,prn:false,color:makeColor(i),
    blocks:{morning:true,midday:true,evening:true,overnight:true}}));
  const prn=PRN_ROSTER.map((r,i)=>({id:100+i,name:r.name,zip:r.zip,prn:true,telegram:r.telegram,
    color:{bg:"#7c3aed",light:"#faf5ff"},blocks:{morning:true,midday:true,evening:true,overnight:true}}));
  return[...reg,...prn];
}

// ─────────────────────────────────────────────────────────────────────────────
// BLOCK BADGE
// ─────────────────────────────────────────────────────────────────────────────
function BlockBadge({blockKey,small}){
  const b=BLOCKS.find(x=>x.key===blockKey);
  if(!b)return null;
  return<span style={{background:b.color,color:"#fff",borderRadius:4,
    padding:small?"1px 4px":"2px 7px",fontSize:small?9:11,fontWeight:700,whiteSpace:"nowrap"}}>
    {b.label}</span>;
}

// ─────────────────────────────────────────────────────────────────────────────
// PRN SECTION (shown on unmatched jobs)
// ─────────────────────────────────────────────────────────────────────────────
function PRNSection({job,prnSitters,onContact,onStatusChange}){
  const ps=job.prnStatus;
  return(
    <div style={{marginTop:8,borderTop:"1px dashed #e5e7eb",paddingTop:8}}>
      <div style={{fontSize:11,fontWeight:700,color:"#7c3aed",marginBottom:6}}>🔄 PRN BACKUP</div>
      {ps&&(
        <div style={{background:ps.status==="confirmed"?"#f0fdf4":ps.status==="denied"?"#fff1f1":"#faf5ff",
          border:`1px solid ${ps.status==="confirmed"?"#86efac":ps.status==="denied"?"#fca5a5":"#c4b5fd"}`,
          borderRadius:8,padding:"6px 10px",marginBottom:8,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span style={{fontSize:12,fontWeight:700,
            color:ps.status==="confirmed"?"#166534":ps.status==="denied"?"#991b1b":"#6d28d9"}}>
            {ps.status==="pending"&&`⏳ Waiting on ${ps.prnName}…`}
            {ps.status==="confirmed"&&`✅ ${ps.prnName} confirmed!`}
            {ps.status==="denied"&&`❌ ${ps.prnName} unavailable`}
          </span>
          <div style={{display:"flex",gap:5}}>
            {ps.status==="pending"&&<>
              <button onClick={()=>onStatusChange(job.id,"confirmed",ps.prnName,ps.prnId)}
                style={{...mBtn,background:"#22c55e",color:"#fff"}}>✓ Yes</button>
              <button onClick={()=>onStatusChange(job.id,"denied",ps.prnName,ps.prnId)}
                style={{...mBtn,background:"#ef4444",color:"#fff"}}>✗ No</button>
            </>}
            {(ps.status==="confirmed"||ps.status==="denied")&&
              <button onClick={()=>onStatusChange(job.id,null,null,null)}
                style={{...mBtn,background:"#f1f5f9",color:"#374151"}}>Reset</button>}
          </div>
        </div>
      )}
      {(!ps||ps.status==="denied")&&(
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          {prnSitters.map(p=>(
            <div key={p.id} style={{border:"2px dashed #c4b5fd",borderRadius:10,padding:"6px 10px",
              background:"#faf5ff",display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
              <span style={{fontWeight:700,fontSize:12,color:"#6d28d9"}}>{p.name}</span>
              <button onClick={()=>onContact(p,job)} style={{background:"#7c3aed",color:"#fff",border:"none",
                borderRadius:6,padding:"3px 10px",fontSize:11,fontWeight:700,cursor:"pointer"}}>
                ✈️ Contact
              </button>
              <button onClick={()=>onStatusChange(job.id,"pending",p.name,p.id)} style={{
                background:"transparent",color:"#7c3aed",border:"1px solid #c4b5fd",
                borderRadius:6,padding:"2px 8px",fontSize:10,fontWeight:600,cursor:"pointer"}}>
                Mark Pending
              </button>
            </div>
          ))}
        </div>
      )}
      {ps?.status==="denied"&&(
        <div style={{marginTop:6,background:"#fff1f1",border:"1px solid #fca5a5",borderRadius:6,
          padding:"6px 10px",fontSize:11,color:"#991b1b",fontWeight:600}}>
          🚨 All PRN unavailable — manual escalation needed
        </div>
      )}
    </div>
  );
}
const mBtn={border:"none",borderRadius:5,padding:"3px 8px",fontSize:11,fontWeight:700,cursor:"pointer"};

// ─────────────────────────────────────────────────────────────────────────────
// IMPORT PANEL
// ─────────────────────────────────────────────────────────────────────────────
function ImportPanel({onImport,jobCount,toCount}){
  const schedRef=useRef(),toRef=useRef();
  const[schedLoaded,setSchedLoaded]=useState(false);
  const[toLoaded,setToLoaded]=useState(false);
  const[msg,setMsg]=useState("");

  function readFile(file,cb){const r=new FileReader();r.onload=e=>cb(e.target.result);r.readAsText(file,"latin1");}

  function handleSched(e){
    const file=e.target.files[0];if(!file)return;
    readFile(file,text=>{
      const jobs=scheduleRowsToJobs(parseScheduleCSV(text));
      onImport("jobs",jobs);setSchedLoaded(true);
      setMsg(m=>`✅ ${jobs.length} jobs loaded`+(m.includes("time-off")?" · "+m.split(" · ")[1]:""));
    });
  }
  function handleTO(e){
    const file=e.target.files[0];if(!file)return;
    readFile(file,text=>{
      const map=timeOffRowsToMap(parseTimeOffCSV(text));
      onImport("timeoff",map);setToLoaded(true);
      setMsg(m=>(m.includes("jobs")?m.split(" · ")[0]+" · ":"")+`✅ Time-off for ${Object.keys(map).length} staff`);
    });
  }

  return(
    <div>
      <h2 style={styles.sectionTitle}>📂 Import from TTP</h2>
      <p style={styles.hint}>Upload both CSVs and the schedule auto-matches instantly.</p>
      <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:14}}>
        <div style={{...styles.card,borderLeft:schedLoaded?"4px solid #22c55e":"4px solid #e5e7eb"}}>
          <div style={{fontWeight:700,fontSize:13,marginBottom:4}}>
            {schedLoaded?"✅":"1."} Schedule CSV
            <span style={{fontWeight:400,color:"#6b7280",fontSize:11}}> (Reporting → Schedule → Visits)</span>
          </div>
          <input type="file" accept=".csv" ref={schedRef} onChange={handleSched} style={{fontSize:13}}/>
        </div>
        <div style={{...styles.card,borderLeft:toLoaded?"4px solid #22c55e":"4px solid #e5e7eb"}}>
          <div style={{fontWeight:700,fontSize:13,marginBottom:4}}>
            {toLoaded?"✅":"2."} Time Off CSV
            <span style={{fontWeight:400,color:"#6b7280",fontSize:11}}> (Reporting → Time → Time Off)</span>
          </div>
          <input type="file" accept=".csv" ref={toRef} onChange={handleTO} style={{fontSize:13}}/>
        </div>
      </div>
      {msg&&<div style={{background:"#f0fdf4",border:"1px solid #86efac",borderRadius:8,
        padding:"10px 14px",fontSize:13,color:"#166534",marginBottom:14}}>{msg}</div>}
      <div style={{...styles.card,background:"#faf5ff",borderLeft:"4px solid #7c3aed"}}>
        <div style={{fontSize:11,fontWeight:700,color:"#6d28d9",marginBottom:6,letterSpacing:".05em"}}>PRN BACKUP TEAM</div>
        {PRN_ROSTER.map(p=>(
          <div key={p.name} style={{display:"flex",justifyContent:"space-between",fontSize:12,color:"#4c1d95",marginBottom:2}}>
            <span>🔄 <strong>{p.name}</strong></span>
            <span style={{color:p.telegram?"#6d28d9":"#9ca3af"}}>{p.telegram||"@handle pending"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CALENDAR VIEW
// ─────────────────────────────────────────────────────────────────────────────
function CalendarPanel({jobs,sitters,setJobs,timeOffMap}){
  const[view,setView]=useState("2week"); // "2week" | "month"
  const[refDate,setRefDate]=useState(()=>{
    const d=new Date();d.setDate(1);return d;
  });
  const[selectedJob,setSelectedJob]=useState(null);
  const prnSitters=sitters.filter(s=>s.prn);

  // Compute calendar days
  const days=useMemo(()=>{
    const result=[];
    if(view==="2week"){
      // Start from Monday of current week
      const start=new Date(refDate);
      const dow=start.getDay();
      start.setDate(start.getDate()-(dow===0?6:dow-1));
      for(let i=0;i<14;i++){
        const d=new Date(start);d.setDate(start.getDate()+i);
        result.push(d.toISOString().split("T")[0]);
      }
    }else{
      // Full month
      const start=new Date(refDate.getFullYear(),refDate.getMonth(),1);
      const end=new Date(refDate.getFullYear(),refDate.getMonth()+1,0);
      // Pad to start on Sunday
      const startPad=start.getDay();
      for(let i=-startPad;i<=end.getDate()-1;i++){
        const d=new Date(start);d.setDate(start.getDate()+i);
        result.push(d.toISOString().split("T")[0]);
      }
    }
    return result;
  },[view,refDate]);

  // Group jobs by date
  const jobsByDate=useMemo(()=>{
    const m={};
    jobs.forEach(j=>{if(!m[j.date])m[j.date]=[];m[j.date].push(j);});
    return m;
  },[jobs]);

  function navigate(dir){
    setRefDate(d=>{
      const nd=new Date(d);
      if(view==="2week")nd.setDate(nd.getDate()+dir*14);
      else nd.setMonth(nd.getMonth()+dir);
      return nd;
    });
  }

  const today=new Date().toISOString().split("T")[0];

  // Title
  const title=useMemo(()=>{
    if(view==="2week"&&days.length>=14){
      return`${fmtDateShort(days[0])} – ${fmtDateShort(days[13])}`;
    }
    return refDate.toLocaleDateString("en-US",{month:"long",year:"numeric"});
  },[view,days,refDate]);

  function handleStatusChange(jobId,status,prnName,prnId){
    setJobs(prev=>prev.map(j=>j.id===jobId?{...j,prnStatus:status?{status,prnName,prnId}:null}:j));
    if(selectedJob?.id===jobId)setSelectedJob(prev=>({...prev,prnStatus:status?{status,prnName,prnId}:null}));
  }

  const DOW=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

  return(
    <div>
      {/* Calendar controls */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10,flexWrap:"wrap",gap:8}}>
        <div style={{display:"flex",gap:6}}>
          <button onClick={()=>setView("2week")} style={{...styles.tabPill,
            background:view==="2week"?"#0f172a":"#f1f5f9",color:view==="2week"?"#fff":"#374151"}}>2 Weeks</button>
          <button onClick={()=>setView("month")} style={{...styles.tabPill,
            background:view==="month"?"#0f172a":"#f1f5f9",color:view==="month"?"#fff":"#374151"}}>Month</button>
        </div>
        <div style={{fontWeight:700,fontSize:14,color:"#1a1a2e"}}>{title}</div>
        <div style={{display:"flex",gap:6}}>
          <button onClick={()=>navigate(-1)} style={{...styles.tabPill,background:"#f1f5f9",color:"#374151"}}>‹ Prev</button>
          <button onClick={()=>navigate(1)}  style={{...styles.tabPill,background:"#f1f5f9",color:"#374151"}}>Next ›</button>
        </div>
      </div>

      {/* Legend */}
      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:10}}>
        {sitters.filter(s=>!s.prn).map(s=>(
          <span key={s.id} style={{fontSize:10,background:s.color.bg,color:"#fff",
            borderRadius:4,padding:"2px 7px",fontWeight:600}}>{shortName(s.name)}</span>
        ))}
        <span style={{fontSize:10,background:"#ef4444",color:"#fff",borderRadius:4,padding:"2px 7px",fontWeight:600}}>🔴 Unmatched</span>
      </div>

      {/* Day-of-week header */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:1,marginBottom:1}}>
        {DOW.map(d=>(
          <div key={d} style={{textAlign:"center",fontSize:10,fontWeight:700,color:"#64748b",padding:"4px 0"}}>{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2}}>
        {days.map(dateStr=>{
          const dayJobs=jobsByDate[dateStr]||[];
          const isToday=dateStr===today;
          const isCurrentMonth=new Date(dateStr+"T12:00:00").getMonth()===refDate.getMonth();
          return(
            <div key={dateStr} style={{
              minHeight:view==="month"?70:90,
              background:isToday?"#eff6ff":isCurrentMonth?"#fff":"#f8fafc",
              border:isToday?"2px solid #3B82F6":"1px solid #e5e7eb",
              borderRadius:6,padding:"4px",
              opacity:isCurrentMonth||view==="2week"?1:0.5,
            }}>
              <div style={{fontSize:11,fontWeight:isToday?800:600,color:isToday?"#3B82F6":"#374151",marginBottom:3}}>
                {new Date(dateStr+"T12:00:00").getDate()}
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:2}}>
                {dayJobs.slice(0,view==="month"?3:6).map(j=>{
                  const unmatched=!j.assignedTo&&!j.prnStatus?.status==="confirmed";
                  const confirmed=j.prnStatus?.status==="confirmed";
                  const bg=j.assignedTo?j.assignedTo.color.bg:confirmed?"#7c3aed":"#ef4444";
                  return(
                    <div key={j.id}
                      onClick={()=>setSelectedJob(j)}
                      style={{background:bg,color:"#fff",borderRadius:3,
                        padding:"1px 4px",fontSize:9,fontWeight:600,
                        cursor:"pointer",whiteSpace:"nowrap",overflow:"hidden",
                        textOverflow:"ellipsis",lineHeight:1.4}}>
                      {j.assignedTo?shortName(j.assignedTo.name):"🔴"} {j.client}
                    </div>
                  );
                })}
                {dayJobs.length>(view==="month"?3:6)&&(
                  <div style={{fontSize:9,color:"#64748b",textAlign:"center"}}>
                    +{dayJobs.length-(view==="month"?3:6)} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Job detail modal */}
      {selectedJob&&(()=>{
        const j=selectedJob;
        const liveJob=jobs.find(x=>x.id===j.id)||j;
        const block=BLOCKS.find(b=>b.key===j.blockKey);
        return(
          <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.5)",
            zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}
            onClick={()=>setSelectedJob(null)}>
            <div style={{background:"#fff",borderRadius:16,padding:20,maxWidth:400,width:"100%",
              maxHeight:"80vh",overflowY:"auto"}}
              onClick={e=>e.stopPropagation()}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
                <div>
                  <div style={{fontWeight:800,fontSize:16}}>{j.client}</div>
                  <div style={{fontSize:12,color:"#6b7280",marginTop:2}}>{fmtDate(j.date)}</div>
                  <div style={{marginTop:4,display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
                    <BlockBadge blockKey={j.blockKey}/>
                    {j.jobZip&&<span style={{fontSize:11,color:"#6b7280"}}>📍 {j.jobZip}</span>}
                  </div>
                  {j.service&&<div style={{fontSize:11,color:"#9ca3af",marginTop:2}}>{j.service}</div>}
                </div>
                <button onClick={()=>setSelectedJob(null)} style={{background:"#f1f5f9",border:"none",
                  borderRadius:6,padding:"4px 8px",cursor:"pointer",fontSize:14,color:"#374151"}}>✕</button>
              </div>

              {liveJob.assignedTo?(
                <div style={{background:liveJob.assignedTo.color.light,border:`1px solid ${liveJob.assignedTo.color.bg}40`,
                  borderRadius:8,padding:"8px 12px",marginBottom:8}}>
                  <div style={{fontSize:12,color:"#374151"}}>Assigned to:</div>
                  <div style={{fontWeight:700,fontSize:15,color:liveJob.assignedTo.color.bg}}>{liveJob.assignedTo.name}</div>
                </div>
              ):(
                <div style={{background:"#fff1f1",border:"1px solid #fca5a5",borderRadius:8,
                  padding:"8px 12px",marginBottom:8,fontSize:12,color:"#991b1b",fontWeight:600}}>
                  🔴 No regular staff available
                </div>
              )}

              {/* PRN outreach if unmatched */}
              {!liveJob.assignedTo&&(
                <PRNSection job={liveJob} prnSitters={prnSitters}
                  onContact={openTelegram}
                  onStatusChange={(id,status,name,pid)=>{
                    handleStatusChange(id,status,name,pid);
                    setSelectedJob(prev=>({...prev,prnStatus:status?{status,prnName:name,prnId:pid}:null}));
                  }}/>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SUMMARY PANEL — day picker + copy + Google Maps route
// ─────────────────────────────────────────────────────────────────────────────
function SummaryPanel({jobs,sitters}){
  const dates=useMemo(()=>
    [...new Set(jobs.filter(j=>j.assignedTo).map(j=>j.date))].sort()
  ,[jobs]);
  const[selectedDate,setSelectedDate]=useState(null);
  const activeDate=selectedDate||(dates[0]||null);

  const bySitter=useMemo(()=>{
    if(!activeDate)return[];
    const dayJobs=jobs.filter(j=>j.assignedTo&&j.date===activeDate);
    const map={};
    dayJobs.forEach(j=>{
      const id=j.assignedTo.id;
      if(!map[id])map[id]={sitter:j.assignedTo,jobs:[]};
      map[id].jobs.push(j);
    });
    Object.values(map).forEach(s=>{
      // Sort geographically within each block group
      s.jobs=sortJobsGeographically(s.jobs,s.sitter.zip);
    });
    return Object.values(map).sort((a,b)=>a.sitter.name.localeCompare(b.sitter.name));
  },[jobs,activeDate]);

  const[copied,setCopied]=useState(null);
  function copySchedule(id,text){
    navigator.clipboard.writeText(text).then(()=>{setCopied(id);setTimeout(()=>setCopied(null),2500);});
  }
  function buildCopyText(sd){
    const block=b=>BLOCKS.find(x=>x.key===b);
    return[
      `${fmtDate(activeDate)} — ${sd.sitter.name}`,
      `─────────────────`,
      ...sd.jobs.map((j,i)=>`${i+1}. ${block(j.blockKey)?.label} (${block(j.blockKey)?.sub}) — ${j.client}${j.jobZip?` · ${j.jobZip}`:""}`),
      ``,`Total: ${sd.jobs.length} job${sd.jobs.length!==1?"s":""}`,
    ].join("\n");
  }

  if(jobs.filter(j=>j.assignedTo).length===0){
    return(<div><h2 style={styles.sectionTitle}>🗓 Summary</h2>
      <div style={styles.empty}>No assignments yet — upload CSVs on the Import tab.</div></div>);
  }

  return(
    <div>
      <h2 style={styles.sectionTitle}>🗓 Summary</h2>
      <p style={styles.hint}>Day-by-day assignments in geographic order. Copy for TTP entry or tap 🗺 for turn-by-turn.</p>

      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:16,overflowX:"auto"}}>
        {dates.map(d=>(
          <button key={d} onClick={()=>setSelectedDate(d)} style={{...styles.tabPill,
            background:activeDate===d?"#0f172a":"#f1f5f9",
            color:activeDate===d?"#fff":"#374151",whiteSpace:"nowrap"}}>
            {fmtDate(d)}
          </button>
        ))}
      </div>

      {bySitter.length===0&&<div style={styles.empty}>No assignments for this day.</div>}

      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        {bySitter.map(sd=>{
          const mapsURL=buildMapsURL(sd.sitter.zip,sd.jobs);
          const copyText=buildCopyText(sd);
          const isCopied=copied===sd.sitter.id;
          return(
            <div key={sd.sitter.id} style={{...styles.card,borderLeft:`4px solid ${sd.sitter.color.bg}`}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <div style={{width:10,height:10,borderRadius:"50%",background:sd.sitter.color.bg}}/>
                  <span style={{fontWeight:800,fontSize:15}}>{sd.sitter.name}</span>
                  <span style={{fontSize:11,color:"#9ca3af"}}>{sd.jobs.length} job{sd.jobs.length!==1?"s":""}</span>
                </div>
                <div style={{display:"flex",gap:6}}>
                  <button onClick={()=>copySchedule(sd.sitter.id,copyText)} style={{
                    background:isCopied?"#22c55e":"#f1f5f9",color:isCopied?"#fff":"#374151",
                    border:"none",borderRadius:6,padding:"5px 10px",fontSize:11,fontWeight:700,cursor:"pointer"}}>
                    {isCopied?"✓ Copied":"📋 Copy"}
                  </button>
                  {mapsURL&&<button onClick={()=>window.open(mapsURL,"_blank")} style={{
                    background:"#1a73e8",color:"#fff",border:"none",borderRadius:6,
                    padding:"5px 10px",fontSize:11,fontWeight:700,cursor:"pointer"}}>🗺 Route</button>}
                </div>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:5}}>
                {sd.jobs.map((j,i)=>{
                  const block=BLOCKS.find(b=>b.key===j.blockKey);
                  return(
                    <div key={j.id} style={{display:"flex",alignItems:"center",gap:10,
                      background:"#f8fafc",borderRadius:8,padding:"8px 10px"}}>
                      <span style={{background:sd.sitter.color.bg,color:"#fff",borderRadius:"50%",
                        width:22,height:22,display:"flex",alignItems:"center",justifyContent:"center",
                        fontSize:11,fontWeight:700,flexShrink:0}}>{i+1}</span>
                      <div style={{flex:1}}>
                        <div style={{fontWeight:700,fontSize:13}}>{j.client}</div>
                        <div style={{fontSize:11,color:"#6b7280",display:"flex",gap:6,alignItems:"center",marginTop:2,flexWrap:"wrap"}}>
                          <BlockBadge blockKey={j.blockKey} small/>
                          {j.jobZip&&<span>📍 {j.jobZip}</span>}
                        </div>
                        {j.service&&<div style={{fontSize:11,color:"#9ca3af",marginTop:1}}>{j.service}</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
              {mapsURL&&<div style={{fontSize:10,color:"#9ca3af",marginTop:8,textAlign:"right"}}>
                Route: home → geographic order → back home</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MARKETING FILL
// ─────────────────────────────────────────────────────────────────────────────
function MarketingFill({jobs,sitters,timeOffMap}){
  const[taskSeed,setTaskSeed]=useState(0);
  const gaps=useMemo(()=>{
    const dates=[...new Set(jobs.map(j=>j.date))].sort();
    const result=[];
    dates.forEach(date=>{
      sitters.filter(s=>!s.prn).forEach(s=>{
        BLOCKS.forEach(b=>{
          if(isBlockOff(date,b.key,timeOffMap[s.name]||[]))return;
          const hasJob=jobs.some(j=>j.assignedTo?.id===s.id&&j.date===date&&j.blockKey===b.key);
          if(!hasJob)result.push({sitter:s,date,block:b});
        });
      });
    });
    return result;
  },[jobs,sitters,timeOffMap]);

  return(
    <div>
      <h2 style={styles.sectionTitle}>📣 Marketing Fill</h2>
      <p style={styles.hint}>Open windows where regular staff are available but have no job.</p>
      <div style={{...styles.card,background:"#0f172a",color:"#fff",marginBottom:14}}>
        <div style={{fontSize:10,letterSpacing:".1em",color:"#475569",marginBottom:4}}>TASK OF THE DAY</div>
        <div style={{fontSize:15,fontWeight:700,lineHeight:1.5,marginBottom:10}}>{MARKETING_TASKS[taskSeed%MARKETING_TASKS.length]}</div>
        <button onClick={()=>setTaskSeed(i=>i+1)} style={{background:"#FF4B4B",color:"#fff",border:"none",
          borderRadius:6,padding:"6px 14px",fontWeight:700,cursor:"pointer",fontSize:12}}>Next Task ↻</button>
      </div>
      {gaps.length===0&&<div style={styles.empty}>{jobs.length===0?"Import jobs first.":"All windows filled! 🎉"}</div>}
      <div style={{display:"flex",flexDirection:"column",gap:5}}>
        {gaps.map((g,i)=>(
          <div key={i} style={{...styles.card,borderLeft:`4px solid ${g.sitter.color.bg}`,
            padding:"9px 12px",display:"flex",gap:10,alignItems:"center"}}>
            <div style={{flex:1}}>
              <div style={{fontWeight:700,fontSize:13}}>{shortName(g.sitter.name)}</div>
              <div style={{fontSize:11,color:"#6b7280"}}>{fmtDate(g.date)}</div>
              <BlockBadge blockKey={g.block.key} small/>
            </div>
            <div style={{fontSize:11,color:"#374151",textAlign:"right",maxWidth:170,lineHeight:1.5}}>
              → {MARKETING_TASKS[(i+taskSeed)%MARKETING_TASKS.length]}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN APP
// ─────────────────────────────────────────────────────────────────────────────
const TABS=[
  {label:"Import", icon:"📂"},
  {label:"Calendar",icon:"📅"},
  {label:"Summary",icon:"🗓"},
  {label:"Fill",   icon:"📣"},
];

export default function App(){
  const[tab,setTab]=useState(0);
  const[sitters]=useState(initSitters);
  const[jobs,setJobs]=useState([]);
  const[timeOffMap,setTimeOffMap]=useState({});

  function handleImport(type,data){
    if(type==="jobs"){
      // Auto-match immediately on import
      setJobs(prev=>{
        const matched=autoMatch(data,sitters,timeOffMap);
        return matched;
      });
    }
    if(type==="timeoff"){
      setTimeOffMap(data);
      // Re-run auto-match with new time-off data if jobs exist
      if(jobs.length>0){
        setJobs(prev=>autoMatch(prev.map(j=>({...j,assignedTo:null,prnStatus:null})),sitters,data));
      }
    }
  }

  // Re-run auto-match when both are loaded
  const handleImportFinal=useCallback((type,data)=>{
    if(type==="jobs"){
      const matched=autoMatch(data,sitters,timeOffMap);
      setJobs(matched);
    }
    if(type==="timeoff"){
      setTimeOffMap(data);
      if(jobs.length>0){
        setJobs(prev=>autoMatch(
          prev.map(j=>({...j,assignedTo:null,prnStatus:null})),
          sitters,data
        ));
      }
    }
  },[sitters,timeOffMap,jobs.length]);

  const assignedCount=jobs.filter(j=>j.assignedTo).length;
  const unmatchedCount=jobs.filter(j=>!j.assignedTo).length;
  const prnPending=jobs.filter(j=>j.prnStatus?.status==="pending").length;

  return(
    <div style={styles.root}>
      <div style={styles.header}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:24}}>🐾</span>
          <div>
            <div style={styles.appTitle}>TLDOM Scheduler</div>
            <div style={styles.appSub}>This Lil Dog of Mine · Auto-Match Engine</div>
          </div>
        </div>
        <div style={{display:"flex",gap:10}}>
          <div style={styles.stat}><span style={{color:"#94a3b8",fontSize:15,fontWeight:700}}>{jobs.length}</span><span style={{color:"#475569",fontSize:10}}>jobs</span></div>
          <div style={styles.stat}><span style={{color:"#4ade80",fontSize:15,fontWeight:700}}>{assignedCount}</span><span style={{color:"#475569",fontSize:10}}>matched</span></div>
          {unmatchedCount>0&&<div style={styles.stat}><span style={{color:"#f87171",fontSize:15,fontWeight:700}}>{unmatchedCount}</span><span style={{color:"#475569",fontSize:10}}>🔴 open</span></div>}
          {prnPending>0&&<div style={styles.stat}><span style={{color:"#a78bfa",fontSize:15,fontWeight:700}}>{prnPending}</span><span style={{color:"#475569",fontSize:10}}>PRN⏳</span></div>}
        </div>
      </div>

      <div style={styles.tabBar}>
        {TABS.map((t,i)=>(
          <button key={t.label} onClick={()=>setTab(i)} style={{
            ...styles.tab,
            background:tab===i?"#FF4B4B":"transparent",
            color:tab===i?"#fff":"#64748b",
            fontWeight:tab===i?700:400,
          }}>{t.icon} {t.label}</button>
        ))}
      </div>

      <div style={styles.content}>
        {tab===0&&<ImportPanel onImport={handleImportFinal} jobCount={jobs.length} toCount={Object.keys(timeOffMap).length}/>}
        {tab===1&&<CalendarPanel jobs={jobs} sitters={sitters} setJobs={setJobs} timeOffMap={timeOffMap}/>}
        {tab===2&&<SummaryPanel jobs={jobs} sitters={sitters}/>}
        {tab===3&&<MarketingFill jobs={jobs} sitters={sitters} timeOffMap={timeOffMap}/>}
      </div>
    </div>
  );
}

const styles={
  root:{fontFamily:"'DM Sans','Helvetica Neue',sans-serif",background:"#f8f9fb",minHeight:"100vh",maxWidth:780,margin:"0 auto"},
  header:{background:"#0f172a",padding:"13px 16px",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8},
  appTitle:{fontWeight:800,fontSize:15,color:"#fff",letterSpacing:"-.02em"},
  appSub:{fontSize:10,color:"#475569",letterSpacing:".03em"},
  stat:{display:"flex",flexDirection:"column",alignItems:"center",gap:1},
  tabBar:{background:"#0f172a",display:"flex",borderTop:"1px solid #ffffff0d",padding:"0 4px",overflowX:"auto"},
  tab:{border:"none",cursor:"pointer",padding:"9px 14px",fontSize:12,borderRadius:"6px 6px 0 0",transition:"all .15s",whiteSpace:"nowrap"},
  tabPill:{border:"none",cursor:"pointer",borderRadius:20,padding:"4px 12px",fontSize:12,fontWeight:600,transition:"all .15s",whiteSpace:"nowrap"},
  content:{padding:"16px 14px"},
  sectionTitle:{fontSize:17,fontWeight:800,marginBottom:4,marginTop:0,letterSpacing:"-.02em"},
  hint:{fontSize:12,color:"#6b7280",marginTop:0,marginBottom:14,lineHeight:1.6},
  card:{background:"#fff",border:"1px solid #e5e7eb",borderRadius:10,padding:"12px 14px",marginBottom:2},
  input:{border:"1.5px solid #e5e7eb",borderRadius:7,padding:"8px 10px",fontSize:13,outline:"none",background:"#fff"},
  btn:{background:"#0f172a",color:"#fff",border:"none",borderRadius:7,padding:"8px 14px",fontWeight:700,fontSize:13,cursor:"pointer"},
  removeBtn:{background:"transparent",border:"none",color:"#9ca3af",cursor:"pointer",fontSize:14,padding:"2px 4px"},
  empty:{textAlign:"center",color:"#9ca3af",fontSize:13,padding:"28px 0"},
};
