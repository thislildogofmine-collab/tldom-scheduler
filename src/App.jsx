import { useState, useMemo, useRef, useCallback, useEffect } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// GEO
// ─────────────────────────────────────────────────────────────────────────────
const ZIP_COORDS={
  "78613":[30.5085,-97.8200],"78634":[30.4977,-97.5744],"78660":[30.3955,-97.5341],
  "78702":[30.2577,-97.7166],"78703":[30.2888,-97.7566],"78704":[30.2488,-97.7666],
  "78717":[30.4577,-97.7566],"78721":[30.2677,-97.6866],"78723":[30.3077,-97.6966],
  "78725":[30.2463,-97.6344],"78727":[30.4193,-97.7091],"78731":[30.3488,-97.7566],
  "78733":[30.3088,-97.8366],"78735":[30.2697,-97.8466],"78745":[30.2088,-97.7866],"78746":[30.2977,-97.8066],
  "78749":[30.2288,-97.8366],"78750":[30.4388,-97.7766],"78752":[30.3388,-97.7066],
  "78753":[30.3788,-97.6766],"78754":[30.3677,-97.6612],"78756":[30.3188,-97.7366],
  "78757":[30.3488,-97.7366],"78758":[30.3888,-97.7127],"78759":[30.4088,-97.7527],
};
function haversine([la1,lo1],[la2,lo2]){
  const R=3958.8,dL=(la2-la1)*Math.PI/180,dO=(lo2-lo1)*Math.PI/180;
  const a=Math.sin(dL/2)**2+Math.cos(la1*Math.PI/180)*Math.cos(la2*Math.PI/180)*Math.sin(dO/2)**2;
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}
function distMiles(z1,z2){
  const a=ZIP_COORDS[z1],b=ZIP_COORDS[z2];
  return(a&&b)?haversine(a,b):999;
}
function extractJobZip(ci){
  if(!ci)return null;
  const z=(ci.split(",").pop()||"").trim();
  return(z.length===5&&/^[0-9]{5}$/.test(z))?z:null;
}

// ─────────────────────────────────────────────────────────────────────────────
// ZONE SYSTEM
// ─────────────────────────────────────────────────────────────────────────────
const ZONES={
  "Zone 1":{label:"Zone 1",color:"#0891b2",light:"#ecfeff",zips:["78759","78758","78727","78717"]},
  "Zone 2":{label:"Zone 2",color:"#7c3aed",light:"#faf5ff",zips:["78660","78753","78754","78634"]},
  "Zone 3":{label:"Zone 3",color:"#059669",light:"#ecfdf5",zips:["78757","78756","78752","78751","78705","78712","78723","78731","78750"]},
  "Zone 4":{label:"Zone 4",color:"#dc2626",light:"#fff1f1",zips:["78703","78701","78721","78722","78702","78704","78745","78725","78735","78749"]},
};
const ZONE_ADJACENT={
  "Zone 1":["Zone 2","Zone 3"],
  "Zone 2":["Zone 1","Zone 3"],
  "Zone 3":["Zone 1","Zone 2","Zone 4"],
  "Zone 4":["Zone 3"],
};
const ZIP_TO_ZONE={};
Object.entries(ZONES).forEach(([k,v])=>v.zips.forEach(z=>ZIP_TO_ZONE[z]=k));
function getJobZone(zip){return ZIP_TO_ZONE[zip]||null;}
function canCoverZone(sitter,jobZone){
  if(!jobZone)return true;
  return sitter.primaryZone===jobZone||(sitter.adjacentZones||[]).includes(jobZone);
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
const PALETTE=[
  "#E53935","#1E88E5","#43A047","#FB8C00","#8E24AA",
  "#00897B","#F4511E","#3949AB","#D81B60","#546E7A",
  "#C0CA33","#00ACC1",
];
const MAX_JOBS_PER_BLOCK=5;

// ─────────────────────────────────────────────────────────────────────────────
// ROSTER  — names must match TTP exactly
// ─────────────────────────────────────────────────────────────────────────────
const REGULAR_ROSTER=[
  {name:"Nicholas Romano",  zip:"78725",address:"4627 Senda Ln, Austin, TX 78725",            primaryZone:"Zone 4",adjacentZones:["Zone 3"]},
  {name:"Jonathan Tarbay",  zip:"78634",address:"1001 McCormick Cv, Hutto, TX 78634",         primaryZone:"Zone 2",adjacentZones:["Zone 1","Zone 3"]},
  {name:"Stefan Gill",      zip:"78660",address:"13614 Letti Ln, Pflugerville, TX 78660",     primaryZone:"Zone 2",adjacentZones:["Zone 1","Zone 3"]},
  {name:"Mark Carter",      zip:"78702",address:"3114 E 12th St, Austin, TX 78702",           primaryZone:"Zone 4",adjacentZones:["Zone 3"]},
  {name:"Brianna Voorhies", zip:"78725",address:"4627 Senda Ln, Austin, TX 78725",            primaryZone:"Zone 4",adjacentZones:["Zone 3"]},
  {name:"Holly Slagle",     zip:"78735",address:"Austin, TX 78735",                           primaryZone:"Zone 4",adjacentZones:["Zone 3"]},
  {name:"Adrienne Paterson",zip:"78613",address:"Cedar Park, TX 78613",                       primaryZone:"Zone 1",adjacentZones:["Zone 2","Zone 3"]},
  {name:"Kaitlan Warmbrod", zip:"78634",address:"Hutto, TX 78634",                            primaryZone:"Zone 2",adjacentZones:["Zone 1","Zone 3"]},
  {name:"Abagail Docimo-Ziccardi",zip:"78733",address:"Austin, TX 78733",                 primaryZone:"Zone 4",adjacentZones:["Zone 3"]},
  {name:"Anna Harris",             zip:"78704",address:"Austin, TX 78704",                 primaryZone:"Zone 4",adjacentZones:["Zone 3"]},
];
const PRN_ROSTER=[
  {name:"Latrise Ruffin",   zip:"78727",address:"5824 Shreveport Dr, Austin, TX 78727",       primaryZone:"Zone 1",adjacentZones:["Zone 2","Zone 3"],telegram:"@latrisepage"},
  {name:"Yejide Myers",     zip:"78754",address:"3613 Long Day Dr, Austin, TX 78754",          primaryZone:"Zone 2",adjacentZones:["Zone 1","Zone 3"],telegram:"@yejideMyers"},
  {name:"Brianna Voorhies", zip:"78725",address:"4627 Senda Ln, Austin, TX 78725",             primaryZone:"Zone 4",adjacentZones:["Zone 3"],          telegram:"@BriannaVoorhies"},
  {name:"Alicia Kae Miller",zip:"78735",address:"7701 Rialto Blvd, Austin, TX 78735",          primaryZone:"Zone 4",adjacentZones:["Zone 3"],            telegram:null},
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
];

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function makeColor(i){const bg=PALETTE[i%PALETTE.length];return{bg,light:bg+"22"};}
function shortName(f){return(f||"").trim().split(" ")[0];}
function fmtDate(d){
  return new Date(d+"T12:00:00").toLocaleDateString("en-US",
    {weekday:"short",month:"short",day:"numeric"});
}
function fmtDateShort(d){
  return new Date(d+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric"});
}

// ─────────────────────────────────────────────────────────────────────────────
// AVAILABILITY CHECK — Time Off CSV = when sitters CAN work
// Start/End times are wall-clock local times (ignore the -0500 offset).
// A sitter is available if their window covers the job's start time.
// If no entry for that date → not available.
// ─────────────────────────────────────────────────────────────────────────────
function parseWallClock(iso){
  if(!iso)return null;
  // Strip timezone offset — read as local wall-clock time
  // "2026-08-12T11:00:00-0500" → parse "2026-08-12T11:00:00"
  const clean=iso.replace(/[+-]\d{4}$/, "").replace(/[+-]\d{2}:\d{2}$/, "");
  const d=new Date(clean);
  return isNaN(d)?null:d;
}

function isSitterAvailable(dateStr, startMins, timeOffs){
  if(!timeOffs||timeOffs.length===0)return false;
  if(startMins===null||startMins===undefined)return false;
  // Find entries whose date matches
  const dayEntries=timeOffs.filter(to=>{
    if(!to.startISO)return false;
    // Compare date portion only (wall-clock date)
    const entryDate=to.startISO.substring(0,10);
    return entryDate===dateStr;
  });
  if(dayEntries.length===0)return false;
  return dayEntries.some(to=>{
    const s=parseWallClock(to.startISO);
    const e=parseWallClock(to.endISO);
    if(!s||!e)return false;
    const base=new Date(dateStr+"T00:00:00");
    const sMin=(s-base)/60000;
    const eMin=(e-base)/60000;
    // Job start time falls within the availability window
    return startMins>=sMin&&startMins<eMin;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// ROUTING — nearest-neighbor TSP from home zip
// ─────────────────────────────────────────────────────────────────────────────
function sortJobsGeographically(jobs,homeZip){
  if(jobs.length<=1)return jobs;
  const remaining=[...jobs];
  const sorted=[];
  let cur=homeZip;
  while(remaining.length>0){
    let best=0,bestD=Infinity;
    remaining.forEach((j,i)=>{
      const d=distMiles(cur,j.jobZip||cur);
      if(d<bestD){bestD=d;best=i;}
    });
    sorted.push(remaining[best]);
    cur=remaining[best].jobZip||cur;
    remaining.splice(best,1);
  }
  return sorted;
}

function buildMapsURL(sitter,jobs){
  if(!sitter||jobs.length===0)return null;
  const geo=sortJobsGeographically(jobs,sitter.zip);
  const home=encodeURIComponent(sitter.address||`${sitter.zip}, Austin, TX`);
  const stops=geo.map(j=>encodeURIComponent(j.jobZip?`${j.jobZip}, Austin, TX`:"Austin, TX")).join("/");
  return`https://www.google.com/maps/dir/${home}/${stops}/${home}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// CSV PARSERS
// ─────────────────────────────────────────────────────────────────────────────
function parseCSV(text){
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
    headers.forEach((h,idx)=>row[h]=(cols[idx]||"").replace(/^"|"$/g,""));
    rows.push(row);
  }
  return rows;
}

// ─────────────────────────────────────────────────────────────────────────────
// Parse start time from "Aug 10, 2026 8:30 AM" → block key + minutes
// Block ranges: Morning 7–10:30am, Mid-day 11am–3pm, Evening 5–8pm, Overnight 6pm–8am
// ─────────────────────────────────────────────────────────────────────────────
function parseStartToBlock(startStr){
  if(!startStr)return{blockKey:null,startMins:null};
  const m=startStr.match(/(\d{1,2}):(\d{2})\s+([AP]M)/);
  if(!m)return{blockKey:null,startMins:null};
  let h=parseInt(m[1]),mn=parseInt(m[2]);
  if(m[3]==="PM"&&h!==12)h+=12;
  if(m[3]==="AM"&&h===12)h=0;
  const mins=h*60+mn;
  let blockKey=null;
  if(mins>=7*60&&mins<10*60+30)  blockKey="morning";   // 7:00am–10:29am
  else if(mins>=11*60&&mins<15*60) blockKey="midday";  // 11:00am–2:59pm
  else if(mins>=17*60&&mins<20*60) blockKey="evening"; // 5:00pm–7:59pm
  else if(mins>=18*60||mins<7*60)  blockKey="overnight";
  return{blockKey,startMins:mins};
}

function parseStartDate(startStr){
  // "Aug 10, 2026 8:30 AM" → "2026-08-10"
  if(!startStr)return"";
  const m=startStr.match(/^([A-Za-z]+ \d{1,2}, \d{4})/);
  if(!m)return"";
  const d=new Date(m[1]+" 12:00:00");
  return isNaN(d)?"":d.toISOString().split("T")[0];
}

function scheduleRowsToJobs(rows){
  return rows.map((r,i)=>{
    const{blockKey,startMins}=parseStartToBlock(r["Start"]||"");
    const isoDate=parseStartDate(r["Start"]||"");
    // Client field: "Ben Taylor (Ivan, Catie)" → "Ben Taylor"
    const clientRaw=(r["Client"]||"").trim();
    const client=clientRaw.replace(/\s*\(.*\)$/,"").trim()||clientRaw;
    const staffFull=(r["Staff"]||"").trim();
    return{
      id:i+1,
      staffFull,
      client,
      clientRaw,
      date:isoDate,
      blockKey,
      startMins,
      jobZip:null, // new format doesn't include zip — zone badges hidden
      service:(r["Service"]||"").trim(),
      status:(r["Status"]||"").trim(),
      assignedTo:null,alternative:null,overCap:false,prnStatus:null,
    };
  }).filter(j=>j.date&&j.blockKey);
}

// Availability map: staffName → [{startISO, endISO, type}]
// These are when sitters CAN work (TTP "time off" = submitted availability)
function timeOffRowsToMap(rows){
  const map={};
  rows.forEach(r=>{
    const staff=r["Staff"]||"";
    const startISO=r["Start (Sortable)"]||"";
    const endISO=r["End (Sortable)"]||"";
    if(!staff||!startISO)return;
    if(!map[staff])map[staff]=[];
    map[staff].push({startISO,endISO,type:r["Type"]||""});
  });
  return map;
}

// ─────────────────────────────────────────────────────────────────────────────
// AUTO-MATCH ENGINE
// Jobs already assigned to a real sitter in TTP pass straight through.
// Only unassigned jobs (Staff = "TLDOM Admin" or not in roster) get matched.
// ─────────────────────────────────────────────────────────────────────────────
function autoMatch(jobs,sitters,timeOffMap){
  const regular=sitters.filter(s=>!s.prn);
  const blockCounts={};
  const gc=(sid,date,bk)=>blockCounts[`${sid}-${date}-${bk}`]||0;
  const ic=(sid,date,bk)=>{
    const k=`${sid}-${date}-${bk}`;
    blockCounts[k]=(blockCounts[k]||0)+1;
  };

  // Helper: match sitter by full name OR first name
  function findSitter(staffFull){
    if(!staffFull||staffFull.toLowerCase()==="tldom admin")return null;
    const sf=staffFull.toLowerCase().trim();
    return regular.find(s=>{
      const sn=s.name.toLowerCase().trim();
      return sn===sf||                          // exact match
        sf.startsWith(sn)||                     // TTP has more (e.g. "Abigail Smith" vs "Abigail")
        sn.startsWith(sf)||                     // roster has more
        sf.split(" ")[0]===sn.split(" ")[0];   // first name match
    })||null;
  }

  // Pre-count already-assigned jobs so even distribution stays accurate
  jobs.forEach(job=>{
    const existing=findSitter(job.staffFull);
    if(existing)ic(existing.id,job.date,job.blockKey);
  });

  return jobs.map(job=>{
    // ── Already assigned to a real sitter in TTP ──────────────────────────
    const existing=findSitter(job.staffFull);
    if(existing){
      return{...job,assignedTo:existing,alternative:null,overCap:false,prnStatus:null,fromTTP:true};
    }

    // ── Unassigned (TLDOM Admin or unknown staff) — run match engine ──────
    const timeOffs=name=>timeOffMap[name]||[];

    // 1. Filter: sitter has availability covering this job's start time
    const available=regular.filter(s=>
      isSitterAvailable(job.date,job.startMins,timeOffs(s.name))
    );
    if(available.length===0)
      return{...job,assignedTo:null,alternative:null,overCap:false,prnStatus:null};

    // 2. Score by block count — even distribution, no zone restrictions
    const scored=available.map(s=>({
      s,count:gc(s.id,job.date,job.blockKey),
      atCap:gc(s.id,job.date,job.blockKey)>=MAX_JOBS_PER_BLOCK,
    }));
    const underCap=scored.filter(x=>!x.atCap);
    const pool=underCap.length>0?underCap:scored;
    pool.sort((a,b)=>a.count!==b.count?a.count-b.count:a.s.id-b.s.id);

    const winner=pool[0].s;
    const overCap=gc(winner.id,job.date,job.blockKey)>=MAX_JOBS_PER_BLOCK;
    ic(winner.id,job.date,job.blockKey);

    // 4. Best alternative
    const altPool=scored.filter(x=>x.s.id!==winner.id);
    altPool.sort((a,b)=>a.count!==b.count?a.count-b.count:a.s.id-b.s.id);
    const alternative=altPool.length>0?altPool[0].s:null;

    return{...job,assignedTo:winner,alternative,overCap,prnStatus:null};
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// INIT SITTERS
// ─────────────────────────────────────────────────────────────────────────────
function initSitters(){
  const reg=REGULAR_ROSTER.map((r,i)=>({
    id:i+1,name:r.name,zip:r.zip,address:r.address,
    primaryZone:r.primaryZone,adjacentZones:r.adjacentZones,
    prn:false,color:makeColor(i),
  }));
  const prn=PRN_ROSTER.map((r,i)=>({
    id:100+i,name:r.name,zip:r.zip,address:r.address,
    primaryZone:r.primaryZone,adjacentZones:r.adjacentZones,
    prn:true,telegram:r.telegram,
    color:{bg:"#7c3aed",light:"#faf5ff"},
  }));
  return[...reg,...prn];
}

// ─────────────────────────────────────────────────────────────────────────────
// PRN helpers
// ─────────────────────────────────────────────────────────────────────────────
function buildPRNMsg(name,job){
  const b=BLOCKS.find(x=>x.key===job.blockKey);
  return`Hi ${name}! 🐾 TLDOM needs PRN coverage:\n📅 ${fmtDate(job.date)}\n⏰ ${b?.label} (${b?.sub})\n📍 Zip: ${job.jobZip||"TBD"}\n👤 ${job.client}\nAre you available? Please confirm ASAP 🙏`;
}
function openTelegram(prn,job){
  const msg=buildPRNMsg(prn.name,job);
  if(prn.telegram){
    window.open(`https://t.me/${prn.telegram.replace("@","")}?text=${encodeURIComponent(msg)}`,"_blank");
  }else{
    navigator.clipboard.writeText(msg).then(()=>alert(`Copied! Send to ${prn.name} on Telegram 📋`));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SMALL UI COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────
function BlockBadge({blockKey,small}){
  const b=BLOCKS.find(x=>x.key===blockKey);
  if(!b)return null;
  return<span style={{background:b.color,color:"#fff",borderRadius:4,
    padding:small?"1px 4px":"2px 7px",fontSize:small?9:11,fontWeight:700,whiteSpace:"nowrap"}}>
    {b.label}</span>;
}
function ZoneBadge({zone,small}){
  const z=ZONES[zone];if(!z)return null;
  return<span style={{background:z.color,color:"#fff",borderRadius:4,
    padding:small?"1px 4px":"2px 7px",fontSize:small?9:10,fontWeight:700,whiteSpace:"nowrap"}}>
    {z.label}</span>;
}

// ─────────────────────────────────────────────────────────────────────────────
// PRN SECTION
// ─────────────────────────────────────────────────────────────────────────────
function PRNSection({job,prnSitters,onContact,onStatusChange}){
  const ps=job.prnStatus;
  return(
    <div style={{marginTop:8,borderTop:"1px dashed #e5e7eb",paddingTop:8}}>
      <div style={{fontSize:11,fontWeight:700,color:"#7c3aed",marginBottom:6}}>🔄 PRN BACKUP</div>
      {ps&&(
        <div style={{
          background:ps.status==="confirmed"?"#f0fdf4":ps.status==="denied"?"#fff1f1":"#faf5ff",
          border:`1px solid ${ps.status==="confirmed"?"#86efac":ps.status==="denied"?"#fca5a5":"#c4b5fd"}`,
          borderRadius:8,padding:"6px 10px",marginBottom:8,
          display:"flex",justifyContent:"space-between",alignItems:"center"}}>
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
            <div key={p.id} style={{border:"2px dashed #c4b5fd",borderRadius:10,
              padding:"6px 10px",background:"#faf5ff",
              display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
              <span style={{fontWeight:700,fontSize:12,color:"#6d28d9"}}>{p.name}</span>
              <button onClick={()=>onContact(p,job)}
                style={{background:"#7c3aed",color:"#fff",border:"none",borderRadius:6,
                  padding:"3px 10px",fontSize:11,fontWeight:700,cursor:"pointer"}}>
                ✈️ Contact
              </button>
              <button onClick={()=>onStatusChange(job.id,"pending",p.name,p.id)}
                style={{background:"transparent",color:"#7c3aed",border:"1px solid #c4b5fd",
                  borderRadius:6,padding:"2px 8px",fontSize:10,fontWeight:600,cursor:"pointer"}}>
                Mark Pending
              </button>
            </div>
          ))}
        </div>
      )}
      {ps?.status==="denied"&&(
        <div style={{marginTop:6,background:"#fff1f1",border:"1px solid #fca5a5",
          borderRadius:6,padding:"6px 10px",fontSize:11,color:"#991b1b",fontWeight:600}}>
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
function ImportPanel({onImport}){
  const schedRef=useRef(),toRef=useRef();
  const[schedOK,setSchedOK]=useState(false);
  const[toOK,setToOK]=useState(false);
  const[msg,setMsg]=useState("");

  function readFile(file,cb){
    const r=new FileReader();r.onload=e=>cb(e.target.result);r.readAsText(file,"latin1");
  }
  function handleSched(e){
    const f=e.target.files[0];if(!f)return;
    readFile(f,text=>{
      const jobs=scheduleRowsToJobs(parseCSV(text));
      onImport("jobs",jobs);setSchedOK(true);
      setMsg(m=>`✅ ${jobs.length} jobs loaded`+(m.includes("time-off")?" · "+m.split(" · ")[1]:""));
    });
  }
  function handleTO(e){
    const f=e.target.files[0];if(!f)return;
    readFile(f,text=>{
      const map=timeOffRowsToMap(parseCSV(text));
      onImport("timeoff",map);setToOK(true);
      setMsg(m=>(m.includes("jobs")?m.split(" · ")[0]+" · ":"")+
        `✅ Time-off loaded for ${Object.keys(map).length} staff`);
    });
  }

  return(
    <div>
      <h2 style={styles.sectionTitle}>📂 Import from TTP</h2>
      <p style={styles.hint}>
        Upload your Schedule CSV and Time Off CSV from TTP Reporting.
        The Time Off CSV is your team's submitted availability — the engine uses it to know who can work each block.
      </p>
      <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:14}}>
        <div style={{...styles.card,borderLeft:schedOK?"4px solid #22c55e":"4px solid #e5e7eb"}}>
          <div style={{fontWeight:700,fontSize:13,marginBottom:4}}>
            {schedOK?"✅":"1."} Schedule CSV
            <span style={{fontWeight:400,color:"#6b7280",fontSize:11}}> (Reporting → Visits — new format)</span>
          </div>
          <input type="file" accept=".csv" ref={schedRef} onChange={handleSched} style={{fontSize:13}}/>
        </div>
        <div style={{...styles.card,borderLeft:toOK?"4px solid #22c55e":"4px solid #e5e7eb"}}>
          <div style={{fontWeight:700,fontSize:13,marginBottom:4}}>
            {toOK?"✅":"2."} Availability CSV
            <span style={{fontWeight:400,color:"#6b7280",fontSize:11}}> (Reporting → Time → Time Off — when sitters CAN work)</span>
          </div>
          <input type="file" accept=".csv" ref={toRef} onChange={handleTO} style={{fontSize:13}}/>
        </div>
      </div>
      {msg&&(
        <div style={{background:"#f0fdf4",border:"1px solid #86efac",
          borderRadius:8,padding:"10px 14px",fontSize:13,color:"#166534",marginBottom:14}}>
          {msg}
        </div>
      )}
      <div style={{...styles.card,background:"#faf5ff",borderLeft:"4px solid #7c3aed"}}>
        <div style={{fontSize:11,fontWeight:700,color:"#6d28d9",marginBottom:6,letterSpacing:".05em"}}>
          HOW IT WORKS
        </div>
        <div style={{fontSize:12,color:"#4c1d95",lineHeight:1.8}}>
          ✅ Availability CSV = when sitters CAN work (submitted via TTP)<br/>
          📋 Jobs already assigned in TTP pass straight through<br/>
          🗺 Jobs auto-assigned by zone → even distribution → 5-job cap<br/>
          🔴 Unmatched jobs surface PRN backup team<br/>
          📍 Dispatch map shows all routes for any day
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DISPATCH MAP  (Leaflet + OpenStreetMap, no API key)
// ─────────────────────────────────────────────────────────────────────────────
function DispatchMap({jobs,sitters,timeOffMap}){
  const mapRef=useRef(null);
  const leafletRef=useRef(null);
  const[selectedDate,setSelectedDate]=useState(null);
  const[hiddenSitters,setHiddenSitters]=useState(new Set());
  const[selectedJob,setSelectedJob]=useState(null);
  const prnSitters=sitters.filter(s=>s.prn);

  const dates=useMemo(()=>
    [...new Set(jobs.filter(j=>j.assignedTo).map(j=>j.date))].sort()
  ,[jobs]);
  const activeDate=selectedDate||(dates[0]||null);

  // Jobs for active date
  const dayJobs=useMemo(()=>
    jobs.filter(j=>j.date===activeDate)
  ,[jobs,activeDate]);

  // Per-sitter routes for active date
  const routes=useMemo(()=>{
    const map={};
    dayJobs.filter(j=>j.assignedTo).forEach(j=>{
      const id=j.assignedTo.id;
      if(!map[id])map[id]={sitter:j.assignedTo,jobs:[]};
      map[id].jobs.push(j);
    });
    return Object.values(map).map(r=>({
      ...r,
      jobs:sortJobsGeographically(r.jobs,r.sitter.zip),
    }));
  },[dayJobs]);

  // Load Leaflet dynamically
  useEffect(()=>{
    if(leafletRef.current)return;
    const link=document.createElement("link");
    link.rel="stylesheet";
    link.href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css";
    document.head.appendChild(link);
    const script=document.createElement("script");
    script.src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js";
    script.onload=()=>{leafletRef.current=window.L;initMap();};
    document.head.appendChild(script);
  },[]);

  function initMap(){
    if(!mapRef.current||!window.L)return;
    if(mapRef.current._leaflet_id)return;
    const map=window.L.map(mapRef.current).setView([30.31,-97.74],11);
    window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{
      attribution:"© OpenStreetMap contributors",maxZoom:18,
    }).addTo(map);
    mapRef.current._map=map;
  }

  // Redraw map when date or routes change
  useEffect(()=>{
    const L=window.L;
    const map=mapRef.current?._map;
    if(!L||!map)return;

    // Clear existing layers except tile layer
    map.eachLayer(l=>{
      if(l instanceof L.Polyline||l instanceof L.Marker||
         l instanceof L.CircleMarker||l instanceof L.Polygon)
        map.removeLayer(l);
    });

    // ── Zone boundary polygons ──────────────────────────────────────────────
    const ZONE_POLYS={
      "Zone 1":[[30.3874,-97.7115],[30.4082,-97.7531],[30.4394,-97.778],[30.4591,-97.7572],[30.4192,-97.7078],[30.3874,-97.7115]],
      "Zone 2":[[30.366,-97.6632],[30.3776,-97.6792],[30.5012,-97.5729],[30.3949,-97.531],[30.366,-97.6632]],
      "Zone 3":[[30.2655,-97.6853],[30.3187,-97.7373],[30.3499,-97.7581],[30.3499,-97.7373],[30.3395,-97.7061],[30.3071,-97.6957],[30.2655,-97.6853]],
      "Zone 4":[[30.2069,-97.7869],[30.2277,-97.8389],[30.2702,-97.8493],[30.2993,-97.8077],[30.2901,-97.7557],[30.2459,-97.6287],[30.2069,-97.7869]],
    };
    const ZONE_COLORS={
      "Zone 1":"#0891b2","Zone 2":"#7c3aed",
      "Zone 3":"#059669","Zone 4":"#dc2626",
    };
    Object.entries(ZONE_POLYS).forEach(([name,coords])=>{
      const color=ZONE_COLORS[name]||"#666";
      L.polygon(coords,{
        color,weight:2,opacity:0.7,
        fillColor:color,fillOpacity:0.06,
        dashArray:"5,5",
      }).addTo(map)
        .bindTooltip(`<strong>${name}</strong>`,{permanent:false,direction:"center"});
    });

    // ── Job location pins (all jobs for this day) ───────────────────────────
    // Group jobs by zip so we can offset pins that stack on the same location
    const jobsByZip={};
    dayJobs.forEach(j=>{
      const zip=j.jobZip;
      const coords=zip?ZIP_COORDS[zip]:null;
      if(!coords)return;
      if(!jobsByZip[zip])jobsByZip[zip]=[];
      jobsByZip[zip].push(j);
    });

    Object.entries(jobsByZip).forEach(([zip,zjobs])=>{
      const base=ZIP_COORDS[zip];
      zjobs.forEach((j,idx)=>{
        // Slight offset so stacked jobs don't hide each other
        const angle=(idx/zjobs.length)*2*Math.PI;
        const offset=zjobs.length>1?0.002:0;
        const lat=base[0]+offset*Math.sin(angle);
        const lng=base[1]+offset*Math.cos(angle);
        const block=BLOCKS.find(b=>b.key===j.blockKey);
        const isAssigned=!!j.assignedTo;
        const pinColor=isAssigned?j.assignedTo.color.bg:"#ef4444";
        const icon=L.divIcon({
          html:`<div style="
            background:${pinColor};color:#fff;
            border-radius:50% 50% 50% 0;
            width:20px;height:20px;
            transform:rotate(-45deg);
            border:2px solid #fff;
            box-shadow:0 1px 4px rgba(0,0,0,.35);
          "></div>`,
          iconSize:[20,20],iconAnchor:[10,20],className:"",
        });
        L.marker([lat,lng],{icon})
          .addTo(map)
          .bindPopup(`
            <strong style="font-size:13px">${j.client}</strong><br/>
            <span style="color:${pinColor};font-weight:700">
              ${isAssigned?j.assignedTo.name:"🔴 Unmatched"}
            </span><br/>
            <span style="color:#666">${block?.label||""} · ${j.service||""}</span>
            ${zip?`<br/><span style="color:#999">📍 ${zip}</span>`:""}
          `);
      });
    });

    // ── Sitter routes ───────────────────────────────────────────────────────
    routes.forEach(r=>{
      if(hiddenSitters.has(r.sitter.id))return;
      const color=r.sitter.color.bg;
      const homeCoords=ZIP_COORDS[r.sitter.zip];

      // Home marker
      if(homeCoords){
        const homeIcon=L.divIcon({
          html:`<div style="background:${color};color:#fff;border-radius:50%;width:24px;height:24px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)">🏠</div>`,
          iconSize:[24,24],iconAnchor:[12,12],className:"",
        });
        L.marker(homeCoords,{icon:homeIcon})
          .addTo(map)
          .bindPopup(`<strong>${r.sitter.name}</strong><br/>Home base`);
      }

      // Build route coords: home → stops → home
      const allCoords=[];
      if(homeCoords)allCoords.push(homeCoords);

      r.jobs.forEach((j,i)=>{
        const c=ZIP_COORDS[j.jobZip];
        if(!c)return;
        allCoords.push(c);
        // Numbered route stop marker
        const icon=L.divIcon({
          html:`<div style="background:${color};color:#fff;border-radius:50%;width:26px;height:26px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)">${i+1}</div>`,
          iconSize:[26,26],iconAnchor:[13,13],className:"",
        });
        L.marker(c,{icon})
          .addTo(map)
          .bindPopup(`
            <strong>${j.client}</strong><br/>
            <span style="color:${color};font-weight:700">${r.sitter.name}</span><br/>
            ${BLOCKS.find(b=>b.key===j.blockKey)?.label||""}<br/>
            Stop ${i+1} of ${r.jobs.length}
          `);
      });

      if(homeCoords)allCoords.push(homeCoords);

      // Route line
      if(allCoords.length>1){
        L.polyline(allCoords,{color,weight:3,opacity:0.8,dashArray:"6,4"}).addTo(map);
      }
    });

  },[routes,hiddenSitters,activeDate,dayJobs]);

  function toggleSitter(id){
    setHiddenSitters(prev=>{
      const n=new Set(prev);
      n.has(id)?n.delete(id):n.add(id);
      return n;
    });
  }

  const unmatched=dayJobs.filter(j=>!j.assignedTo).length;

  return(
    <div>
      <h2 style={styles.sectionTitle}>🗺 Dispatch Map</h2>
      <p style={styles.hint}>All sitter routes for the selected day. Tap a marker for details. Toggle sitters on/off.</p>

      {/* Date picker */}
      {dates.length===0?(
        <div style={styles.empty}>Import your CSVs on the Import tab first.</div>
      ):(
        <>
          <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:10,overflowX:"auto"}}>
            {dates.map(d=>(
              <button key={d} onClick={()=>setSelectedDate(d)} style={{
                ...styles.tabPill,
                background:activeDate===d?"#0f172a":"#f1f5f9",
                color:activeDate===d?"#fff":"#374151",
                whiteSpace:"nowrap",fontSize:11,
              }}>{fmtDate(d)}</button>
            ))}
          </div>

          {/* Stats bar */}
          <div style={{display:"flex",gap:8,marginBottom:10,flexWrap:"wrap"}}>
            <div style={statBox("#22c55e")}>
              <strong>{dayJobs.filter(j=>j.assignedTo).length}</strong>
              <span>assigned</span>
            </div>
            {unmatched>0&&(
              <div style={statBox("#ef4444")}>
                <strong>{unmatched}</strong><span>🔴 open</span>
              </div>
            )}
            <div style={statBox("#3B82F6")}>
              <strong>{routes.length}</strong><span>sitters</span>
            </div>
          </div>

          {/* Sitter toggles */}
          <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:10}}>
            {routes.map(r=>(
              <button key={r.sitter.id} onClick={()=>toggleSitter(r.sitter.id)} style={{
                background:hiddenSitters.has(r.sitter.id)?"#f1f5f9":r.sitter.color.bg,
                color:hiddenSitters.has(r.sitter.id)?"#9ca3af":"#fff",
                border:`2px solid ${r.sitter.color.bg}`,
                borderRadius:20,padding:"3px 10px",fontSize:11,fontWeight:700,
                cursor:"pointer",transition:"all .15s",
              }}>
                {shortName(r.sitter.name)} ({r.jobs.length})
              </button>
            ))}
          </div>

          {/* Map container */}
          <div ref={mapRef} style={{
            height:420,borderRadius:12,border:"1px solid #e5e7eb",
            marginBottom:12,background:"#f1f5f9",overflow:"hidden",
          }}/>

          {/* Route summary cards */}
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {routes.filter(r=>!hiddenSitters.has(r.sitter.id)).map(r=>{
              const mapsURL=buildMapsURL(r.sitter,r.jobs);
              return(
                <div key={r.sitter.id} style={{
                  ...styles.card,
                  borderLeft:`4px solid ${r.sitter.color.bg}`,
                }}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <div style={{width:10,height:10,borderRadius:"50%",background:r.sitter.color.bg}}/>
                      <span style={{fontWeight:800,fontSize:14}}>{r.sitter.name}</span>
                      <ZoneBadge zone={r.sitter.primaryZone} small/>
                      <span style={{fontSize:11,color:"#9ca3af"}}>{r.jobs.length} stop{r.jobs.length!==1?"s":""}</span>
                    </div>
                    {mapsURL&&(
                      <button onClick={()=>window.open(mapsURL,"_blank")} style={{
                        background:"#1a73e8",color:"#fff",border:"none",
                        borderRadius:6,padding:"4px 10px",fontSize:11,fontWeight:700,cursor:"pointer",
                      }}>🗺 Open Route</button>
                    )}
                  </div>
                  <div style={{display:"flex",flexDirection:"column",gap:3}}>
                    {r.jobs.map((j,i)=>(
                      <div key={j.id} style={{
                        display:"flex",alignItems:"center",gap:8,
                        background:"#f8fafc",borderRadius:6,padding:"5px 8px",
                      }}>
                        <span style={{
                          background:r.sitter.color.bg,color:"#fff",
                          borderRadius:"50%",width:20,height:20,
                          display:"flex",alignItems:"center",justifyContent:"center",
                          fontSize:10,fontWeight:800,flexShrink:0,
                        }}>{i+1}</span>
                        <div style={{flex:1}}>
                          <span style={{fontWeight:700,fontSize:12}}>{j.client}</span>
                          <span style={{fontSize:11,color:"#9ca3af",marginLeft:6}}>{j.jobZip}</span>
                        </div>
                        <BlockBadge blockKey={j.blockKey} small/>
                        {j.overCap&&(
                          <span style={{fontSize:9,background:"#fef3c7",color:"#92400e",
                            borderRadius:3,padding:"1px 4px",fontWeight:700}}>⚠️ Cap</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            {/* Unmatched jobs */}
            {unmatched>0&&(
              <div style={{...styles.card,borderLeft:"4px solid #ef4444",background:"#fff1f1"}}>
                <div style={{fontWeight:700,fontSize:13,color:"#991b1b",marginBottom:8}}>
                  🔴 Unmatched Jobs ({unmatched}) — PRN Needed
                </div>
                {dayJobs.filter(j=>!j.assignedTo).map(j=>(
                  <div key={j.id} style={{
                    background:"#fff",borderRadius:6,padding:"6px 10px",
                    marginBottom:5,fontSize:12,
                  }}>
                    <div style={{fontWeight:700}}>{j.client}</div>
                    <div style={{fontSize:11,color:"#6b7280",display:"flex",gap:6,marginTop:2,flexWrap:"wrap"}}>
                      <BlockBadge blockKey={j.blockKey} small/>
                      {j.jobZip&&<ZoneBadge zone={getJobZone(j.jobZip)} small/>}
                      {j.jobZip&&<span>📍 {j.jobZip}</span>}
                    </div>
                    <PRNSection job={j} prnSitters={prnSitters}
                      onContact={openTelegram}
                      onStatusChange={()=>{}}/>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SUMMARY PANEL — block-first view + routes
// ─────────────────────────────────────────────────────────────────────────────
function SummaryPanel({jobs,sitters}){
  const dates=useMemo(()=>
    [...new Set(jobs.filter(j=>j.assignedTo).map(j=>j.date))].sort()
  ,[jobs]);
  const[selectedDate,setSelectedDate]=useState(null);
  const activeDate=selectedDate||(dates[0]||null);

  const byBlock=useMemo(()=>{
    if(!activeDate)return[];
    const dayJobs=jobs.filter(j=>j.assignedTo&&j.date===activeDate);
    return BLOCKS.map(b=>({
      block:b,
      jobs:dayJobs.filter(j=>j.blockKey===b.key)
        .sort((a,b2)=>a.client.localeCompare(b2.client)),
    })).filter(g=>g.jobs.length>0);
  },[jobs,activeDate]);

  const routes=useMemo(()=>{
    if(!activeDate)return[];
    const dayJobs=jobs.filter(j=>j.assignedTo&&j.date===activeDate);
    const map={};
    dayJobs.forEach(j=>{
      const key=`${j.assignedTo.id}-${j.blockKey}`;
      if(!map[key])map[key]={sitter:j.assignedTo,block:BLOCKS.find(b=>b.key===j.blockKey),jobs:[]};
      map[key].jobs.push(j);
    });
    return Object.values(map)
      .filter(r=>r.jobs.length>=2)
      .map(r=>({...r,jobs:sortJobsGeographically(r.jobs,r.sitter.zip)}))
      .sort((a,b)=>(BLOCK_ORDER[a.block.key]||9)-(BLOCK_ORDER[b.block.key]||9));
  },[jobs,activeDate]);

  const[copied,setCopied]=useState(null);
  function copyText(id,text){
    navigator.clipboard.writeText(text).then(()=>{
      setCopied(id);setTimeout(()=>setCopied(null),2500);
    });
  }

  if(jobs.filter(j=>j.assignedTo).length===0){
    return(<div><h2 style={styles.sectionTitle}>🗓 Summary</h2>
      <div style={styles.empty}>No assignments yet — upload CSVs on the Import tab.</div></div>);
  }

  return(
    <div>
      <h2 style={styles.sectionTitle}>🗓 Summary</h2>
      <p style={styles.hint}>Who's working what, by time block. Routes for sitters with 2+ stops.</p>

      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:16,overflowX:"auto"}}>
        {dates.map(d=>(
          <button key={d} onClick={()=>setSelectedDate(d)} style={{
            ...styles.tabPill,
            background:activeDate===d?"#0f172a":"#f1f5f9",
            color:activeDate===d?"#fff":"#374151",whiteSpace:"nowrap",
          }}>{fmtDate(d)}</button>
        ))}
      </div>

      {/* Block sections */}
      <div style={{display:"flex",flexDirection:"column",gap:14,marginBottom:routes.length>0?20:0}}>
        {byBlock.map(group=>{
          const copyId=`block-${group.block.key}`;
          const blockText=[
            `${fmtDate(activeDate)} — ${group.block.label} (${group.block.sub})`,
            `─────────────────`,
            ...group.jobs.map(j=>
              `${j.assignedTo?shortName(j.assignedTo.name):"🔴 OPEN"} — ${j.client}${j.jobZip?` · ${j.jobZip}`:""}`
            ),
          ].join("\n");
          return(
            <div key={group.block.key} style={{...styles.card,borderLeft:`4px solid ${group.block.color}`}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                <div>
                  <span style={{fontWeight:800,fontSize:14}}>{group.block.label}</span>
                  <span style={{fontSize:11,color:"#9ca3af",marginLeft:6}}>
                    {group.block.sub} · {group.jobs.length} job{group.jobs.length!==1?"s":""}
                  </span>
                </div>
                <button onClick={()=>copyText(copyId,blockText)} style={{
                  background:copied===copyId?"#22c55e":"#f1f5f9",
                  color:copied===copyId?"#fff":"#374151",
                  border:"none",borderRadius:6,padding:"4px 10px",fontSize:11,fontWeight:700,cursor:"pointer",
                }}>{copied===copyId?"✓ Copied":"📋 Copy"}</button>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:5}}>
                {group.jobs.map(j=>{
                  const jobZone=getJobZone(j.jobZip);
                  return(
                    <div key={j.id} style={{
                      background:j.overCap?"#fffbeb":j.assignedTo?j.assignedTo.color.light:"#fff1f1",
                      borderRadius:8,padding:"8px 10px",
                      border:j.overCap?"1px solid #fbbf24":"1px solid transparent",
                    }}>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <span style={{
                          background:j.assignedTo?j.assignedTo.color.bg:"#ef4444",
                          color:"#fff",borderRadius:6,padding:"2px 8px",
                          fontSize:11,fontWeight:700,flexShrink:0,minWidth:56,textAlign:"center",
                        }}>{j.assignedTo?shortName(j.assignedTo.name):"🔴 OPEN"}</span>
                        <div style={{flex:1}}>
                          <div style={{fontWeight:700,fontSize:13}}>{j.client}</div>
                          <div style={{fontSize:11,color:"#6b7280",display:"flex",gap:5,
                            alignItems:"center",marginTop:1,flexWrap:"wrap"}}>
                            {j.jobZip&&<span>📍 {j.jobZip}</span>}
                            {jobZone&&<ZoneBadge zone={jobZone} small/>}
                          </div>
                        </div>
                        {j.overCap&&(
                          <span style={{fontSize:10,background:"#fef3c7",color:"#92400e",
                            borderRadius:4,padding:"1px 5px",fontWeight:700}}>⚠️ At cap</span>
                        )}
                        {j.fromTTP&&(
                          <span style={{fontSize:10,background:"#dbeafe",color:"#1e40af",
                            borderRadius:4,padding:"1px 5px",fontWeight:700}}>TTP ✓</span>
                        )}
                      </div>
                      {j.overCap&&j.alternative&&(
                        <div style={{marginTop:5,fontSize:11,color:"#92400e",
                          background:"#fef9c3",borderRadius:5,padding:"3px 8px"}}>
                          💡 Alt: <strong>{j.alternative.name}</strong> ({j.alternative.primaryZone})
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Routes */}
      {routes.length>0&&(
        <>
          <h3 style={{fontSize:14,fontWeight:800,marginBottom:6,color:"#1a1a2e"}}>🗺 Suggested Routes</h3>
          <p style={{fontSize:11,color:"#9ca3af",marginTop:0,marginBottom:10}}>
            Sitters with 2+ stops — nearest-neighbor order from home.
          </p>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {routes.map((r,ri)=>{
              const mapsURL=buildMapsURL(r.sitter,r.jobs);
              const rid=`route-${r.sitter.id}-${r.block.key}`;
              const isCopied=copied===rid;
              const routeText=(()=>{
                const lines=[
                  `${r.sitter.name} — ${r.block.label} (${fmtDate(activeDate)})`,
                  `─────────────────`,
                  ...r.jobs.map((j,i)=>`${i+1}. ${j.client}${j.jobZip?` · ${j.jobZip}`:""}`),
                  ``,`Route order (home → stops → home):`,
                ];
                let prevZip=r.sitter.zip,prevLabel="Home",total=0;
                r.jobs.forEach((j,i)=>{
                  const d=distMiles(prevZip,j.jobZip||prevZip);
                  total+=isFinite(d)?d:0;
                  lines.push(`  ${prevLabel} → ${i+1}. ${j.client}: ${isFinite(d)?d.toFixed(1):"—"} mi`);
                  prevZip=j.jobZip||prevZip;prevLabel=`${i+1}. ${j.client}`;
                });
                const dHome=distMiles(prevZip,r.sitter.zip);
                total+=isFinite(dHome)?dHome:0;
                lines.push(`  ${prevLabel} → Home: ${isFinite(dHome)?dHome.toFixed(1):"—"} mi`);
                lines.push(`Total: ${total.toFixed(1)} mi`);
                return lines.join("\n");
              })();
              return(
                <div key={ri} style={{...styles.card,borderLeft:`4px solid ${r.sitter.color.bg}`}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <div style={{width:10,height:10,borderRadius:"50%",background:r.sitter.color.bg}}/>
                      <span style={{fontWeight:800,fontSize:14}}>{r.sitter.name}</span>
                      <BlockBadge blockKey={r.block.key} small/>
                      <span style={{fontSize:11,color:"#9ca3af"}}>{r.jobs.length} stops</span>
                    </div>
                    <div style={{display:"flex",gap:6}}>
                      <button onClick={()=>copyText(rid,routeText)} style={{
                        background:isCopied?"#22c55e":"#f1f5f9",
                        color:isCopied?"#fff":"#374151",
                        border:"none",borderRadius:6,padding:"4px 10px",
                        fontSize:11,fontWeight:700,cursor:"pointer",
                      }}>{isCopied?"✓ Copied":"📋 Copy"}</button>
                      {mapsURL&&(
                        <button onClick={()=>window.open(mapsURL,"_blank")} style={{
                          background:"#1a73e8",color:"#fff",border:"none",
                          borderRadius:6,padding:"4px 10px",fontSize:11,fontWeight:700,cursor:"pointer",
                        }}>🗺 Route</button>
                      )}
                    </div>
                  </div>
                  <div style={{display:"flex",flexDirection:"column",gap:3}}>
                    {r.jobs.map((j,i)=>(
                      <div key={j.id} style={{display:"flex",alignItems:"center",gap:8,
                        background:"#f8fafc",borderRadius:6,padding:"5px 8px"}}>
                        <span style={{background:r.sitter.color.bg,color:"#fff",
                          borderRadius:"50%",width:18,height:18,
                          display:"flex",alignItems:"center",justifyContent:"center",
                          fontSize:10,fontWeight:700,flexShrink:0}}>{i+1}</span>
                        <span style={{fontSize:12,fontWeight:600,flex:1}}>{j.client}</span>
                        {j.jobZip&&<span style={{fontSize:11,color:"#9ca3af"}}>📍 {j.jobZip}</span>}
                      </div>
                    ))}
                  </div>
                  {/* Leg distances */}
                  <div style={{marginTop:8,paddingTop:8,borderTop:"1px dashed #e5e7eb"}}>
                    <div style={{fontSize:10,fontWeight:700,color:"#9ca3af",
                      letterSpacing:".05em",marginBottom:4}}>ROUTE (est. straight-line)</div>
                    {(()=>{
                      const legs=[];
                      let prevZip=r.sitter.zip,prevLabel="🏠 Home",total=0;
                      r.jobs.forEach((j,i)=>{
                        const d=distMiles(prevZip,j.jobZip||prevZip);
                        total+=isFinite(d)?d:0;
                        legs.push({from:prevLabel,to:`${i+1}. ${j.client}`,d});
                        prevZip=j.jobZip||prevZip;
                        prevLabel=`${i+1}. ${j.client}`;
                      });
                      const dHome=distMiles(prevZip,r.sitter.zip);
                      total+=isFinite(dHome)?dHome:0;
                      legs.push({from:prevLabel,to:"🏠 Home",d:dHome});
                      return(<>
                        {legs.map((leg,i)=>(
                          <div key={i} style={{display:"flex",justifyContent:"space-between",
                            fontSize:11,color:"#4b5563",padding:"1px 0"}}>
                            <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:"80%"}}>
                              {leg.from} → {leg.to}
                            </span>
                            <span style={{color:"#9ca3af",fontWeight:600,marginLeft:8,whiteSpace:"nowrap"}}>
                              {isFinite(leg.d)?`${leg.d.toFixed(1)} mi`:"—"}
                            </span>
                          </div>
                        ))}
                        <div style={{display:"flex",justifyContent:"space-between",fontSize:11,
                          fontWeight:700,color:"#374151",borderTop:"1px solid #e5e7eb",
                          marginTop:4,paddingTop:4}}>
                          <span>Total estimated</span>
                          <span>{total.toFixed(1)} mi</span>
                        </div>
                      </>);
                    })()}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
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
          // For marketing fill, check if sitter has any time-off on this date
          // covering this block — if not, they're free
          const toEntries=timeOffMap[s.name]||[];
          const blockMidMins={morning:8*60,midday:12*60,evening:18*60,overnight:21*60};
          const midMins=blockMidMins[b.key]||0;
          if(!isSitterAvailable(date,midMins,toEntries))return;
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
      <p style={styles.hint}>Sitters who are available but have no job assigned — fill with marketing tasks.</p>
      <div style={{...styles.card,background:"#0f172a",color:"#fff",marginBottom:14}}>
        <div style={{fontSize:10,letterSpacing:".1em",color:"#475569",marginBottom:4}}>TASK OF THE DAY</div>
        <div style={{fontSize:15,fontWeight:700,lineHeight:1.5,marginBottom:10}}>
          {MARKETING_TASKS[taskSeed%MARKETING_TASKS.length]}
        </div>
        <button onClick={()=>setTaskSeed(i=>i+1)}
          style={{background:"#FF4B4B",color:"#fff",border:"none",
            borderRadius:6,padding:"6px 14px",fontWeight:700,cursor:"pointer",fontSize:12}}>
          Next Task ↻
        </button>
      </div>
      {gaps.length===0&&(
        <div style={styles.empty}>
          {jobs.length===0?"Import jobs first.":"All available windows are filled 🎉"}
        </div>
      )}
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
function statBox(color){
  return{background:color+"18",border:`1px solid ${color}40`,borderRadius:8,
    padding:"6px 12px",display:"flex",flexDirection:"column",alignItems:"center",
    fontSize:13,fontWeight:700,color,minWidth:60,gap:1};
}

const TABS=[
  {label:"Import",  icon:"📂"},
  {label:"Dispatch",icon:"🗺"},
  {label:"Summary", icon:"🗓"},
  {label:"Fill",    icon:"📣"},
];

export default function App(){
  const[tab,setTab]=useState(0);
  const[sitters]=useState(initSitters);
  const[jobs,setJobs]=useState([]);
  const[timeOffMap,setTimeOffMap]=useState({});

  const handleImport=useCallback((type,data)=>{
    if(type==="jobs"){
      setJobs(prev=>{
        const matched=autoMatch(data,sitters,timeOffMap);
        return matched;
      });
    }
    if(type==="timeoff"){
      setTimeOffMap(data);
      setJobs(prev=>{
        if(prev.length===0)return prev;
        return autoMatch(
          prev.map(j=>({...j,assignedTo:null,alternative:null,overCap:false,prnStatus:null})),
          sitters,data
        );
      });
    }
  },[sitters,timeOffMap]);

  const assignedCount=jobs.filter(j=>j.assignedTo).length;
  const openCount=jobs.filter(j=>!j.assignedTo).length;
  const prnPending=jobs.filter(j=>j.prnStatus?.status==="pending").length;

  return(
    <div style={styles.root}>
      <div style={styles.header}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:24}}>🐾</span>
          <div>
            <div style={styles.appTitle}>TLDOM Scheduler</div>
            <div style={styles.appSub}>This Lil Dog of Mine · Dispatch Engine</div>
          </div>
        </div>
        <div style={{display:"flex",gap:10}}>
          <div style={styles.stat}>
            <span style={{color:"#94a3b8",fontSize:15,fontWeight:700}}>{jobs.length}</span>
            <span style={{color:"#475569",fontSize:10}}>jobs</span>
          </div>
          <div style={styles.stat}>
            <span style={{color:"#4ade80",fontSize:15,fontWeight:700}}>{assignedCount}</span>
            <span style={{color:"#475569",fontSize:10}}>assigned</span>
          </div>
          {openCount>0&&(
            <div style={styles.stat}>
              <span style={{color:"#f87171",fontSize:15,fontWeight:700}}>{openCount}</span>
              <span style={{color:"#475569",fontSize:10}}>🔴 open</span>
            </div>
          )}
          {prnPending>0&&(
            <div style={styles.stat}>
              <span style={{color:"#a78bfa",fontSize:15,fontWeight:700}}>{prnPending}</span>
              <span style={{color:"#475569",fontSize:10}}>PRN⏳</span>
            </div>
          )}
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
        {tab===0&&<ImportPanel onImport={handleImport}/>}
        {tab===1&&<DispatchMap jobs={jobs} sitters={sitters} timeOffMap={timeOffMap}/>}
        {tab===2&&<SummaryPanel jobs={jobs} sitters={sitters}/>}
        {tab===3&&<MarketingFill jobs={jobs} sitters={sitters} timeOffMap={timeOffMap}/>}
      </div>
    </div>
  );
}

const styles={
  root:{fontFamily:"'DM Sans','Helvetica Neue',sans-serif",background:"#f8f9fb",
    minHeight:"100vh",maxWidth:820,margin:"0 auto"},
  header:{background:"#0f172a",padding:"13px 16px",display:"flex",
    justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8},
  appTitle:{fontWeight:800,fontSize:15,color:"#fff",letterSpacing:"-.02em"},
  appSub:{fontSize:10,color:"#475569",letterSpacing:".03em"},
  stat:{display:"flex",flexDirection:"column",alignItems:"center",gap:1},
  tabBar:{background:"#0f172a",display:"flex",borderTop:"1px solid #ffffff0d",
    padding:"0 4px",overflowX:"auto"},
  tab:{border:"none",cursor:"pointer",padding:"9px 14px",fontSize:12,
    borderRadius:"6px 6px 0 0",transition:"all .15s",whiteSpace:"nowrap"},
  tabPill:{border:"none",cursor:"pointer",borderRadius:20,padding:"4px 12px",
    fontSize:12,fontWeight:600,transition:"all .15s",whiteSpace:"nowrap"},
  content:{padding:"16px 14px"},
  sectionTitle:{fontSize:17,fontWeight:800,marginBottom:4,marginTop:0,letterSpacing:"-.02em"},
  hint:{fontSize:12,color:"#6b7280",marginTop:0,marginBottom:14,lineHeight:1.6},
  card:{background:"#fff",border:"1px solid #e5e7eb",borderRadius:10,
    padding:"12px 14px",marginBottom:2},
  input:{border:"1.5px solid #e5e7eb",borderRadius:7,padding:"8px 10px",
    fontSize:13,outline:"none",background:"#fff"},
  btn:{background:"#0f172a",color:"#fff",border:"none",borderRadius:7,
    padding:"8px 14px",fontWeight:700,fontSize:13,cursor:"pointer"},
  removeBtn:{background:"transparent",border:"none",color:"#9ca3af",
    cursor:"pointer",fontSize:14,padding:"2px 4px"},
  empty:{textAlign:"center",color:"#9ca3af",fontSize:13,padding:"28px 0"},
};
