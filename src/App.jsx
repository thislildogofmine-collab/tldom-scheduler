import { useState, useMemo, useRef } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// GEO
// ─────────────────────────────────────────────────────────────────────────────
const ZIP_COORDS = {
  "78634":[30.4977,-97.5744],"78660":[30.3955,-97.5341],"78702":[30.2577,-97.7166],
  "78703":[30.2888,-97.7566],"78704":[30.2488,-97.7666],"78717":[30.4577,-97.7566],
  "78721":[30.2677,-97.6866],"78723":[30.3077,-97.6966],"78725":[30.2463,-97.6344],
  "78727":[30.4193,-97.7091],"78735":[30.2697,-97.8466],"78745":[30.2088,-97.7866],
  "78746":[30.2977,-97.8066],"78749":[30.2288,-97.8366],"78750":[30.4388,-97.7766],
  "78752":[30.3388,-97.7066],"78753":[30.3788,-97.6766],"78754":[30.3677,-97.6612],
  "78756":[30.3188,-97.7366],"78757":[30.3488,-97.7366],"78758":[30.3888,-97.7127],
};

function haversine([lat1,lon1],[lat2,lon2]){
  const R=3958.8,dLat=(lat2-lat1)*Math.PI/180,dLon=(lon2-lon1)*Math.PI/180;
  const a=Math.sin(dLat/2)**2+Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}
function distanceMiles(z1,z2){
  const a=ZIP_COORDS[z1],b=ZIP_COORDS[z2];
  return a&&b?haversine(a,b):null;
}
function distLabel(m){ return m===null?"?":m<10?`${m.toFixed(1)} mi`:`${Math.round(m)} mi`; }
function extractJobZip(ci){
  if(!ci)return null;
  const z=(ci.split(",").pop()||"").trim();
  return z.length===5&&/^\d{5}$/.test(z)?z:null;
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
const PALETTE=["#E53935","#1E88E5","#43A047","#FB8C00","#8E24AA","#00897B","#F4511E","#3949AB","#D81B60","#546E7A"];
const RADIUS_MILES=15;

// ── STAFF ────────────────────────────────────────────────────────────────────
// Regular staff — confirmed pool
const REGULAR_ROSTER=[
  {name:"Alicia Kae Miller", zip:"78702"},
  {name:"Nicholas Romano",   zip:"78735"},
  {name:"Jonathan Tarbay",   zip:"78754"},
  {name:"Jasmine Heyliger",  zip:"78634"},
  {name:"Monroe Page",       zip:"78758"},
  {name:"Stefan Gill",       zip:"78717"},
  {name:"Reagan Norman",     zip:"78660"},
  {name:"Mark Carter",       zip:"78750"},
];
// PRN — backup pool, no time-off restrictions
// Update telegram field with @handles when you receive them
const PRN_ROSTER=[
  {name:"Latrise",  zip:"78727", telegram:"@latrisepage"},
  {name:"Yejide",   zip:"78725", telegram:"@yejideMyers"},
  {name:"Brianna",  zip:"78727", telegram:"@BriannaVoorhies"},
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

// Job PRN status: null | { prnId, status: 'pending'|'confirmed'|'denied' }
// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function makeColor(idx){const bg=PALETTE[idx%PALETTE.length];return{bg,light:bg+"18"};}
function parseISO(s){return s?new Date(s.trim()):null;}
function shortName(f){return f.trim().split(" ")[0];}
function formatDate(d){
  return new Date(d+"T12:00:00").toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"});
}
function isBlockOff(dateStr,blockKey,timeOffs){
  const ranges={morning:[7,10],midday:[11,15],evening:[17,20],overnight:[18,32]};
  const[bS,bE]=ranges[blockKey];
  const base=new Date(dateStr+"T00:00:00");
  const bs=new Date(base);bs.setHours(bS,0,0,0);
  const be=new Date(base);be.setHours(bE>24?bE-24:bE,0,0,0);
  if(bE>24)be.setDate(be.getDate()+1);
  return timeOffs.some(to=>{
    const s=parseISO(to.startISO),e=parseISO(to.endISO);
    return s&&e&&bs<e&&be>s;
  });
}

// Build Telegram message for PRN outreach
function buildPRNMessage(prnName, job){
  const block=BLOCKS.find(b=>b.key===job.blockKey);
  return `Hi ${prnName}! 🐾 TLDOM needs PRN coverage:\n\n📅 ${formatDate(job.date)}\n⏰ ${block?.label} (${block?.sub})\n📍 Zip: ${job.jobZip||"TBD"}\n👤 Client: ${job.client}\n\nAre you available? Please confirm or let us know ASAP. Thank you! 🙏`;
}

function openTelegram(prn, job){
  const msg=buildPRNMessage(prn.name,job);
  if(prn.telegram){
    // Direct Telegram deep link if we have their @handle
    const encoded=encodeURIComponent(msg);
    window.open(`https://t.me/${prn.telegram.replace("@","")}?text=${encoded}`,"_blank");
  } else {
    // Clipboard fallback — copy message, open Telegram
    navigator.clipboard.writeText(msg).then(()=>{
      alert(`Message copied to clipboard!\n\nOpen Telegram and paste to ${prn.name} 📋`);
      window.open("https://t.me","_blank");
    }).catch(()=>{
      // If clipboard fails, show message to copy manually
      alert(`Copy this message to ${prn.name} on Telegram:\n\n${msg}`);
    });
  }
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
      if(ch==='"'){inQ=!inQ;}
      else if(ch===','&&!inQ){cols.push(cur.trim());cur="";}
      else cur+=ch;
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
    const row={};
    headers.forEach((h,idx)=>row[h]=cols[idx]||"");
    rows.push(row);
  }
  return rows;
}
function scheduleRowsToJobs(rows){
  return rows.map((r,i)=>{
    const staffFull=r["Staff"]||"";
    const blockKey=BLOCK_MAP[(r["Client Time Display"]||"").trim()]||null;
    const clientInfo=r["Client Info"]||"";
    const clientName=clientInfo.split(",")[0].trim();
    const jobZip=extractJobZip(clientInfo);
    const serviceTime=r["Service Time"]||"";
    const datePart=serviceTime.split(" ").slice(1,4).join(" ");
    const dateObj=new Date(datePart+" 12:00:00");
    const isoDate=isNaN(dateObj)?"":dateObj.toISOString().split("T")[0];
    return{id:i+1,staffFull,client:clientName,date:isoDate,blockKey,jobZip,
           service:r["Service"]||"",assignedTo:null,prnStatus:null};
  }).filter(j=>j.date&&j.blockKey);
}
function timeOffRowsToMap(rows){
  const map={};
  rows.forEach(r=>{
    const staff=r["Staff"]||"";
    const startISO=r["Start (Sortable)"]||"";
    const endISO=r["End (Sortable)"]||"";
    const type=r["Type"]||"";
    if(!staff||!startISO)return;
    if(!map[staff])map[staff]=[];
    map[staff].push({startISO,endISO,type});
  });
  return map;
}

// ─────────────────────────────────────────────────────────────────────────────
// UI COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────
function BlockBadge({blockKey,small}){
  const b=BLOCKS.find(x=>x.key===blockKey);
  if(!b)return null;
  return<span style={{background:b.color,color:"#fff",borderRadius:4,
    padding:small?"1px 5px":"2px 8px",fontSize:small?10:11,fontWeight:700}}>
    {b.label} {b.sub}</span>;
}

function SitterChip({sitter,selected,onClick,warn,miles}){
  const isOut=miles!==null&&miles>RADIUS_MILES;
  const distColor=miles===null?"#6b7280":miles<=5?"#16a34a":miles<=RADIUS_MILES?"#d97706":"#dc2626";
  return(
    <button onClick={onClick} style={{
      background:selected?sitter.color.bg:"#fff",
      color:selected?"#fff":sitter.color.bg,
      border:`2px solid ${sitter.color.bg}`,borderRadius:8,
      padding:"4px 10px",fontWeight:700,fontSize:12,cursor:"pointer",
      transition:"all .15s",display:"flex",flexDirection:"column",alignItems:"center",gap:1,
      opacity:isOut&&!selected?0.7:1,
    }}>
      <span>{shortName(sitter.name)}{warn?" ⚠️":""}</span>
      <span style={{fontSize:10,fontWeight:600,color:selected?"rgba(255,255,255,0.85)":distColor}}>
        {distLabel(miles)}{isOut?" 📍":""}
      </span>
    </button>
  );
}

// PRN contact card shown when no regular staff available
function PRNSection({job, prnSitters, onContact, onStatusChange}){
  const ps=job.prnStatus;
  return(
    <div style={{marginTop:8,borderTop:"1px dashed #e5e7eb",paddingTop:8}}>
      <div style={{fontSize:11,fontWeight:700,color:"#7c3aed",marginBottom:6,letterSpacing:".04em"}}>
        🔄 PRN BACKUP TEAM
      </div>

      {/* Status banner if PRN already contacted */}
      {ps&&(
        <div style={{
          background:ps.status==="confirmed"?"#f0fdf4":ps.status==="denied"?"#fff1f1":"#faf5ff",
          border:`1px solid ${ps.status==="confirmed"?"#86efac":ps.status==="denied"?"#fca5a5":"#c4b5fd"}`,
          borderRadius:8,padding:"6px 10px",marginBottom:8,
          display:"flex",justifyContent:"space-between",alignItems:"center",
        }}>
          <span style={{fontSize:12,fontWeight:700,
            color:ps.status==="confirmed"?"#166534":ps.status==="denied"?"#991b1b":"#6d28d9"}}>
            {ps.status==="pending"&&`⏳ Waiting on ${ps.prnName}…`}
            {ps.status==="confirmed"&&`✅ ${ps.prnName} confirmed!`}
            {ps.status==="denied"&&`❌ ${ps.prnName} unavailable`}
          </span>
          <div style={{display:"flex",gap:5}}>
            {ps.status==="pending"&&<>
              <button onClick={()=>onStatusChange(job.id,"confirmed",ps.prnName,ps.prnId)}
                style={{...miniBtn,"#166534":0,background:"#22c55e",color:"#fff"}}>✓ Confirmed</button>
              <button onClick={()=>onStatusChange(job.id,"denied",ps.prnName,ps.prnId)}
                style={{...miniBtn,background:"#ef4444",color:"#fff"}}>✗ Denied</button>
            </>}
            {(ps.status==="confirmed"||ps.status==="denied")&&
              <button onClick={()=>onStatusChange(job.id,null,null,null)}
                style={{...miniBtn,background:"#f1f5f9",color:"#374151"}}>Reset</button>}
          </div>
        </div>
      )}

      {/* PRN sitter chips with Contact buttons */}
      {(!ps||ps.status==="denied")&&(
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          {prnSitters.map(p=>{
            const miles=distanceMiles(p.zip,job.jobZip);
            const isOut=miles!==null&&miles>RADIUS_MILES;
            const distColor=miles===null?"#6b7280":miles<=5?"#16a34a":miles<=RADIUS_MILES?"#d97706":"#dc2626";
            return(
              <div key={p.id} style={{
                border:"2px dashed #c4b5fd",borderRadius:10,padding:"6px 10px",
                background:"#faf5ff",display:"flex",flexDirection:"column",alignItems:"center",gap:4,
              }}>
                <span style={{fontWeight:700,fontSize:12,color:"#6d28d9"}}>{p.name}</span>
                <span style={{fontSize:10,color:distColor,fontWeight:600}}>
                  {distLabel(miles)}{isOut?" 📍":""}
                </span>
                <button onClick={()=>onContact(p,job)} style={{
                  background:"#7c3aed",color:"#fff",border:"none",borderRadius:6,
                  padding:"3px 10px",fontSize:11,fontWeight:700,cursor:"pointer",
                  display:"flex",alignItems:"center",gap:4,
                }}>
                  <span>✈️</span> Contact
                </button>
                <button onClick={()=>onStatusChange(job.id,"pending",p.name,p.id)} style={{
                  background:"transparent",color:"#7c3aed",border:"1px solid #c4b5fd",
                  borderRadius:6,padding:"2px 8px",fontSize:10,fontWeight:600,cursor:"pointer",
                }}>Mark Pending</button>
              </div>
            );
          })}
        </div>
      )}

      {/* All denied — escalate */}
      {ps?.status==="denied"&&(
        <div style={{marginTop:6,background:"#fff1f1",border:"1px solid #fca5a5",borderRadius:6,
          padding:"6px 10px",fontSize:11,color:"#991b1b",fontWeight:600}}>
          🚨 All PRN unavailable — manual escalation needed
        </div>
      )}
    </div>
  );
}

const miniBtn={border:"none",borderRadius:5,padding:"3px 8px",fontSize:11,fontWeight:700,cursor:"pointer"};

// ─────────────────────────────────────────────────────────────────────────────
// IMPORT PANEL
// ─────────────────────────────────────────────────────────────────────────────
function ImportPanel({onImport}){
  const schedRef=useRef(),toRef=useRef();
  const[msg,setMsg]=useState("");
  const[schedLoaded,setSchedLoaded]=useState(false);
  const[toLoaded,setToLoaded]=useState(false);

  function readFile(file,cb){
    const r=new FileReader();r.onload=e=>cb(e.target.result);r.readAsText(file,"latin1");
  }
  function handleSched(e){
    const file=e.target.files[0];if(!file)return;
    readFile(file,text=>{
      const jobs=scheduleRowsToJobs(parseScheduleCSV(text));
      onImport("jobs",jobs);setSchedLoaded(true);
      setMsg(m=>`✅ ${jobs.length} jobs loaded`+(m.includes("Time-off")?" · "+m.split(" · ")[1]:""));
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
      <p style={styles.hint}>Export from TTP → Reporting → Schedule (Visits CSV) and Reporting → Time → Time Off CSV.</p>
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
      {msg&&<div style={{background:"#f0fdf4",border:"1px solid #86efac",borderRadius:8,padding:"10px 14px",fontSize:13,color:"#166534",marginBottom:14}}>{msg}</div>}

      <div style={{...styles.card,background:"#faf5ff",borderLeft:"4px solid #7c3aed"}}>
        <div style={{fontSize:11,fontWeight:700,color:"#6d28d9",marginBottom:6,letterSpacing:".05em"}}>PRN TEAM — BACKUP COVERAGE</div>
        <div style={{fontSize:12,color:"#4c1d95",lineHeight:1.8}}>
          {PRN_ROSTER.map(p=>(
            <div key={p.name} style={{display:"flex",justifyContent:"space-between"}}>
              <span>🔄 <strong>{p.name}</strong></span>
              <span style={{color:p.telegram?"#6d28d9":"#9ca3af"}}>{p.telegram||"@handle pending"}</span>
            </div>
          ))}
        </div>
        <div style={{fontSize:11,color:"#7c3aed",marginTop:8}}>
          When no regular staff is available, the Match tab surfaces PRN with a one-tap Telegram contact button.
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STAFF PANEL
// ─────────────────────────────────────────────────────────────────────────────
function StaffPanel({sitters,setSitters,timeOffMap}){
  const[expandedId,setExpandedId]=useState(null);
  function toggleBlock(id,key){
    setSitters(prev=>prev.map(s=>s.id===id?{...s,blocks:{...s.blocks,[key]:!s.blocks[key]}}:s));
  }
  return(
    <div>
      <h2 style={styles.sectionTitle}>👤 Staff Roster</h2>
      <p style={styles.hint}>Toggle available time blocks per sitter. Time off pulled from TTP import.</p>

      {/* Regular staff */}
      <div style={{fontSize:11,fontWeight:700,color:"#374151",marginBottom:8,letterSpacing:".06em"}}>REGULAR STAFF ({sitters.filter(s=>!s.prn).length})</div>
      <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:16}}>
        {sitters.filter(s=>!s.prn).map(s=>{
          const expanded=expandedId===s.id;
          const toEntries=timeOffMap[s.name]||[];
          return(
            <div key={s.id} style={{...styles.card,borderLeft:`4px solid ${s.color.bg}`,background:expanded?s.color.light:"#fff"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <div style={{width:9,height:9,borderRadius:"50%",background:s.color.bg}}/>
                  <span style={{fontWeight:700,fontSize:14}}>{s.name}</span>
                  {toEntries.length>0&&<span style={{fontSize:10,background:"#fef3c7",color:"#92400e",borderRadius:4,padding:"1px 5px"}}>🚫 {toEntries.length} off</span>}
                </div>
                <button onClick={()=>setExpandedId(expanded?null:s.id)} style={{...styles.removeBtn,color:"#6b7280",fontSize:13}}>{expanded?"▲":"▼"}</button>
              </div>
              <div style={{display:"flex",gap:4,flexWrap:"wrap",marginTop:7}}>
                {BLOCKS.map(b=>(
                  <button key={b.key} onClick={()=>toggleBlock(s.id,b.key)} style={{
                    background:s.blocks[b.key]?b.color:"#f1f5f9",
                    color:s.blocks[b.key]?"#fff":"#94a3b8",
                    border:"none",borderRadius:20,padding:"2px 10px",
                    fontSize:11,fontWeight:600,cursor:"pointer",transition:"all .15s",
                  }}>{b.label}</button>
                ))}
              </div>
              {expanded&&toEntries.length>0&&(
                <div style={{marginTop:10}}>
                  <div style={{fontSize:11,color:"#6b7280",marginBottom:5,fontWeight:600}}>TIME OFF FROM TTP:</div>
                  <div style={{display:"flex",flexDirection:"column",gap:4,maxHeight:160,overflowY:"auto"}}>
                    {toEntries.slice(0,12).map((to,i)=>(
                      <div key={i} style={{fontSize:11,background:"#fef3c7",borderRadius:5,padding:"3px 8px",display:"flex",justifyContent:"space-between"}}>
                        <span>{new Date(to.startISO).toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric",hour:"numeric",minute:"2-digit"})}</span>
                        <span style={{color:"#92400e"}}>{to.type}</span>
                      </div>
                    ))}
                    {toEntries.length>12&&<div style={{fontSize:11,color:"#9ca3af",textAlign:"center"}}>+{toEntries.length-12} more</div>}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* PRN staff */}
      <div style={{fontSize:11,fontWeight:700,color:"#6d28d9",marginBottom:8,letterSpacing:".06em"}}>PRN / BACKUP ({sitters.filter(s=>s.prn).length})</div>
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {sitters.filter(s=>s.prn).map(s=>(
          <div key={s.id} style={{...styles.card,borderLeft:"4px solid #7c3aed",background:"#faf5ff"}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <div style={{width:9,height:9,borderRadius:"50%",background:"#7c3aed"}}/>
              <span style={{fontWeight:700,fontSize:14}}>{s.name}</span>
              <span style={{fontSize:10,background:"#ede9fe",color:"#6d28d9",borderRadius:4,padding:"1px 6px"}}>PRN</span>
              <span style={{fontSize:10,color:"#9ca3af",marginLeft:"auto"}}>{s.telegram||"@handle pending"}</span>
            </div>
            <div style={{fontSize:11,color:"#7c3aed",marginTop:6}}>
              No time-off restrictions · Reached out fresh each time via Telegram
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// JOBS PANEL
// ─────────────────────────────────────────────────────────────────────────────
function JobsPanel({jobs}){
  const[filter,setFilter]=useState("all");
  const[search,setSearch]=useState("");
  const grouped=useMemo(()=>{
    let f=jobs;
    if(filter!=="all")f=f.filter(j=>j.blockKey===filter);
    if(search)f=f.filter(j=>j.client.toLowerCase().includes(search.toLowerCase())||j.staffFull.toLowerCase().includes(search.toLowerCase()));
    const g={};f.forEach(j=>{if(!g[j.date])g[j.date]=[];g[j.date].push(j);});
    return Object.entries(g).sort(([a],[b])=>a.localeCompare(b));
  },[jobs,filter,search]);

  return(
    <div>
      <h2 style={styles.sectionTitle}>📋 Imported Jobs</h2>
      <p style={styles.hint}>{jobs.length} jobs from TTP. Upload your Schedule CSV on the Import tab first.</p>
      <input placeholder="Search client or staff…" value={search} onChange={e=>setSearch(e.target.value)}
        style={{...styles.input,width:"100%",boxSizing:"border-box",marginBottom:10}}/>
      <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:14}}>
        <button onClick={()=>setFilter("all")} style={{...styles.tabPill,background:filter==="all"?"#1a1a2e":"#f1f5f9",color:filter==="all"?"#fff":"#374151"}}>All ({jobs.length})</button>
        {BLOCKS.map(b=>{
          const cnt=jobs.filter(j=>j.blockKey===b.key).length;
          return<button key={b.key} onClick={()=>setFilter(b.key)} style={{...styles.tabPill,background:filter===b.key?b.color:"#f1f5f9",color:filter===b.key?"#fff":"#374151"}}>{b.label} ({cnt})</button>;
        })}
      </div>
      {jobs.length===0&&<div style={styles.empty}>No jobs yet — upload your Schedule CSV on the Import tab.</div>}
      {grouped.map(([date,dayJobs])=>(
        <div key={date} style={{marginBottom:14}}>
          <div style={{fontSize:12,fontWeight:700,color:"#374151",marginBottom:6}}>
            {formatDate(date)} <span style={{color:"#9ca3af",fontWeight:400}}>({dayJobs.length} visits)</span>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:4}}>
            {dayJobs.map(j=>(
              <div key={j.id} style={{...styles.card,padding:"8px 12px",display:"flex",gap:10,alignItems:"center"}}>
                <BlockBadge blockKey={j.blockKey} small/>
                <div style={{flex:1}}>
                  <span style={{fontWeight:700,fontSize:13}}>{j.client}</span>
                  <span style={{fontSize:11,color:"#9ca3af",marginLeft:6}}>{j.service}</span>
                </div>
                {j.jobZip&&<span style={{fontSize:10,color:"#9ca3af"}}>📍{j.jobZip}</span>}
                {j.prnStatus&&(
                  <span style={{fontSize:10,background:j.prnStatus.status==="confirmed"?"#dcfce7":j.prnStatus.status==="denied"?"#fee2e2":"#ede9fe",
                    color:j.prnStatus.status==="confirmed"?"#166534":j.prnStatus.status==="denied"?"#991b1b":"#6d28d9",
                    borderRadius:4,padding:"1px 5px",fontWeight:700}}>
                    {j.prnStatus.status==="pending"?"⏳ PRN":j.prnStatus.status==="confirmed"?"✅ PRN":"❌ PRN"}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MATCH ENGINE
// ─────────────────────────────────────────────────────────────────────────────
function MatchEngine({jobs,sitters,setJobs,timeOffMap}){
  const[filterBlock,setFilterBlock]=useState("all");
  const[filterStatus,setFilterStatus]=useState("unassigned");

  const regularSitters=useMemo(()=>sitters.filter(s=>!s.prn),[sitters]);
  const prnSitters=useMemo(()=>sitters.filter(s=>s.prn),[sitters]);

  const matchedJobs=useMemo(()=>{
    return jobs.map(job=>{
      const available=regularSitters.filter(s=>
        s.blocks[job.blockKey]&&!isBlockOff(job.date,job.blockKey,timeOffMap[s.name]||[])
      );
      const withDist=available.map(s=>({sitter:s,miles:distanceMiles(s.zip,job.jobZip)}));
      withDist.sort((a,b)=>{
        const aIn=a.miles!==null&&a.miles<=RADIUS_MILES;
        const bIn=b.miles!==null&&b.miles<=RADIUS_MILES;
        if(aIn&&!bIn)return -1;if(!aIn&&bIn)return 1;
        if(a.miles===null)return 1;if(b.miles===null)return -1;
        return a.miles-b.miles;
      });
      const doubleUpIds=new Set(available.filter(s=>
        jobs.some(j2=>j2.id!==job.id&&j2.assignedTo?.id===s.id&&j2.date===job.date)
      ).map(s=>s.id));
      const needsPRN=!job.assignedTo&&available.length===0;
      const prnWithDist=prnSitters.map(p=>({...p,miles:distanceMiles(p.zip,job.jobZip)}))
        .sort((a,b)=>(a.miles||999)-(b.miles||999));
      return{job,withDist,doubleUpIds,needsPRN,prnWithDist};
    });
  },[jobs,regularSitters,prnSitters,timeOffMap]);

  function assign(jobId,sitter){
    setJobs(prev=>prev.map(j=>j.id===jobId?{...j,assignedTo:j.assignedTo?.id===sitter.id?null:sitter,prnStatus:null}:j));
  }
  function handleContact(prn,job){
    openTelegram(prn,job);
  }
  function handleStatusChange(jobId,status,prnName,prnId){
    setJobs(prev=>prev.map(j=>j.id===jobId
      ?{...j,prnStatus:status?{status,prnName,prnId}:null}
      :j
    ));
  }

  const assignedCount=jobs.filter(j=>j.assignedTo).length;
  const unassignedCount=jobs.filter(j=>!j.assignedTo).length;
  const prnPendingCount=jobs.filter(j=>j.prnStatus?.status==="pending").length;
  const noMatchCount=matchedJobs.filter(m=>!m.job.assignedTo&&m.withDist.length===0&&!m.job.prnStatus).length;

  let visible=matchedJobs;
  if(filterBlock!=="all")visible=visible.filter(m=>m.job.blockKey===filterBlock);
  if(filterStatus==="unassigned")visible=visible.filter(m=>!m.job.assignedTo);
  if(filterStatus==="assigned")visible=visible.filter(m=>m.job.assignedTo);
  if(filterStatus==="prn")visible=visible.filter(m=>m.job.prnStatus);

  const sorted=[...visible].sort((a,b)=>{
    if(a.job.date!==b.job.date)return a.job.date.localeCompare(b.job.date);
    const o={overnight:0,morning:1,midday:2,evening:3};
    return(o[a.job.blockKey]||9)-(o[b.job.blockKey]||9);
  });

  return(
    <div>
      <h2 style={styles.sectionTitle}>⚡ Match Engine</h2>
      <p style={styles.hint}>Regular staff ranked by distance. If none available, PRN backup surfaces automatically.</p>

      {/* Stats */}
      <div style={{display:"flex",gap:8,marginBottom:10,flexWrap:"wrap"}}>
        <div style={statBox("#22c55e")}><strong>{assignedCount}</strong><span>confirmed</span></div>
        <div style={statBox("#f59e0b")}><strong>{unassignedCount}</strong><span>open</span></div>
        {prnPendingCount>0&&<div style={statBox("#7c3aed")}><strong>{prnPendingCount}</strong><span>PRN pending</span></div>}
        {noMatchCount>0&&<div style={statBox("#ef4444")}><strong>{noMatchCount}</strong><span>needs PRN</span></div>}
      </div>

      {/* Filters */}
      <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:6}}>
        {[
          {v:"unassigned",l:"Unassigned"},
          {v:"assigned",l:"Confirmed"},
          {v:"prn",l:"PRN"},
          {v:"all",l:"All"},
        ].map(f=>(
          <button key={f.v} onClick={()=>setFilterStatus(f.v)} style={{...styles.tabPill,
            background:filterStatus===f.v?"#1a1a2e":"#f1f5f9",
            color:filterStatus===f.v?"#fff":"#374151"}}>
            {f.l}
          </button>
        ))}
      </div>
      <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:14}}>
        <button onClick={()=>setFilterBlock("all")} style={{...styles.tabPill,background:filterBlock==="all"?"#64748b":"#f1f5f9",color:filterBlock==="all"?"#fff":"#374151"}}>All blocks</button>
        {BLOCKS.map(b=>(
          <button key={b.key} onClick={()=>setFilterBlock(b.key)} style={{...styles.tabPill,background:filterBlock===b.key?b.color:"#f1f5f9",color:filterBlock===b.key?"#fff":"#374151"}}>{b.label}</button>
        ))}
      </div>

      {jobs.length===0&&<div style={styles.empty}>Import your Schedule CSV first.</div>}

      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {sorted.map(({job,withDist,doubleUpIds,needsPRN,prnWithDist})=>{
          const block=BLOCKS.find(b=>b.key===job.blockKey);
          const isAssigned=!!job.assignedTo;
          const outsideOnly=withDist.length>0&&!withDist.some(d=>d.miles!==null&&d.miles<=RADIUS_MILES);
          const prnConfirmed=job.prnStatus?.status==="confirmed";

          return(
            <div key={job.id} style={{
              ...styles.card,
              borderLeft:isAssigned?`4px solid ${job.assignedTo.color.bg}`:
                prnConfirmed?"4px solid #7c3aed":
                needsPRN?"4px solid #7c3aed":
                `4px solid ${block?.color||"#e5e7eb"}`,
              background:isAssigned?job.assignedTo.color.light:
                prnConfirmed?"#faf5ff":"#fff",
            }}>
              {/* Header */}
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:7}}>
                <div>
                  <div style={{fontWeight:700,fontSize:14}}>{job.client}</div>
                  <div style={{fontSize:11,color:"#6b7280",marginTop:2,display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
                    {formatDate(job.date)}
                    <BlockBadge blockKey={job.blockKey} small/>
                    {job.jobZip&&<span style={{color:"#9ca3af"}}>📍 {job.jobZip}</span>}
                  </div>
                  <div style={{fontSize:11,color:"#9ca3af",marginTop:1}}>{job.service}</div>
                </div>
                <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4}}>
                  {isAssigned&&<button onClick={()=>assign(job.id,job.assignedTo)} style={{fontSize:11,color:"#9ca3af",background:"transparent",border:"none",cursor:"pointer"}}>Unassign</button>}
                  {job.prnStatus?.status==="confirmed"&&<span style={{fontSize:10,background:"#7c3aed",color:"#fff",borderRadius:4,padding:"2px 6px",fontWeight:700}}>PRN ✅</span>}
                  {job.prnStatus?.status==="pending"&&<span style={{fontSize:10,background:"#ede9fe",color:"#6d28d9",borderRadius:4,padding:"2px 6px",fontWeight:700}}>⏳ Pending</span>}
                </div>
              </div>

              {/* Outside radius notice */}
              {outsideOnly&&!isAssigned&&(
                <div style={{fontSize:11,color:"#92400e",background:"#fef3c7",borderRadius:5,padding:"3px 8px",marginBottom:6}}>
                  📍 No sitters within {RADIUS_MILES} mi — showing closest available
                </div>
              )}

              {/* Regular sitter chips */}
              {!isAssigned&&withDist.length===0?(
                <div style={{fontSize:11,color:"#6d28d9",background:"#ede9fe",borderRadius:5,padding:"4px 8px",marginBottom:4}}>
                  No regular staff available — PRN backup below
                </div>
              ):(
                !isAssigned&&(
                  <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:needsPRN?0:0}}>
                    {withDist.map(({sitter:s,miles})=>(
                      <SitterChip key={s.id} sitter={s}
                        selected={job.assignedTo?.id===s.id}
                        warn={doubleUpIds.has(s.id)}
                        miles={miles}
                        onClick={()=>assign(job.id,s)}
                      />
                    ))}
                  </div>
                )
              )}

              {/* Assigned chip */}
              {isAssigned&&(
                <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                  <SitterChip sitter={job.assignedTo} selected miles={distanceMiles(job.assignedTo.zip,job.jobZip)} onClick={()=>assign(job.id,job.assignedTo)}/>
                </div>
              )}

              {/* PRN section — shows when no regular staff OR when manually needed */}
              {(needsPRN||job.prnStatus)&&(
                <PRNSection job={job} prnSitters={prnWithDist}
                  onContact={handleContact}
                  onStatusChange={handleStatusChange}/>
              )}
            </div>
          );
        })}
        {sorted.length===0&&jobs.length>0&&<div style={styles.empty}>No jobs match this filter.</div>}
      </div>
    </div>
  );
}

function statBox(color){
  return{background:color+"18",border:`1px solid ${color}40`,borderRadius:8,padding:"6px 12px",
    display:"flex",flexDirection:"column",alignItems:"center",fontSize:13,fontWeight:700,color,minWidth:60,gap:1};
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
          if(!s.blocks[b.key])return;
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
      <p style={styles.hint}>Open windows where regular staff are available but have no job assigned.</p>
      <div style={{...styles.card,background:"#0f172a",color:"#fff",marginBottom:14}}>
        <div style={{fontSize:10,letterSpacing:".1em",color:"#475569",marginBottom:4}}>TASK OF THE DAY</div>
        <div style={{fontSize:15,fontWeight:700,lineHeight:1.5,marginBottom:10}}>{MARKETING_TASKS[taskSeed%MARKETING_TASKS.length]}</div>
        <button onClick={()=>setTaskSeed(i=>i+1)} style={{background:"#FF4B4B",color:"#fff",border:"none",borderRadius:6,padding:"6px 14px",fontWeight:700,cursor:"pointer",fontSize:12}}>
          Next Task ↻
        </button>
      </div>
      {gaps.length===0&&<div style={styles.empty}>{jobs.length===0?"Import jobs first.":"All windows filled — great week! 🎉"}</div>}
      <div style={{display:"flex",flexDirection:"column",gap:5}}>
        {gaps.map((g,i)=>(
          <div key={i} style={{...styles.card,borderLeft:`4px solid ${g.sitter.color.bg}`,padding:"9px 12px",display:"flex",gap:10,alignItems:"center"}}>
            <div style={{flex:1}}>
              <div style={{fontWeight:700,fontSize:13}}>{shortName(g.sitter.name)}</div>
              <div style={{fontSize:11,color:"#6b7280"}}>{formatDate(g.date)}</div>
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
  {label:"Import",icon:"📂"},{label:"Staff",icon:"👤"},
  {label:"Jobs",icon:"📋"},{label:"Match",icon:"⚡"},{label:"Fill",icon:"📣"},
];

function initSitters(){
  const regular=REGULAR_ROSTER.map((r,i)=>({
    id:i+1,name:r.name,zip:r.zip,prn:false,
    color:makeColor(i),
    blocks:{morning:true,midday:true,evening:false,overnight:false},
  }));
  const prn=PRN_ROSTER.map((r,i)=>({
    id:100+i,name:r.name,zip:r.zip,prn:true,
    telegram:r.telegram,
    color:{bg:"#7c3aed",light:"#faf5ff"},
    blocks:{morning:true,midday:true,evening:true,overnight:true},
  }));
  return[...regular,...prn];
}

export default function App(){
  const[tab,setTab]=useState(0);
  const[sitters,setSitters]=useState(initSitters);
  const[jobs,setJobs]=useState([]);
  const[timeOffMap,setTimeOffMap]=useState({});

  function handleImport(type,data){
    if(type==="jobs")setJobs(data);
    if(type==="timeoff")setTimeOffMap(data);
  }

  const assignedCount=jobs.filter(j=>j.assignedTo).length;
  const prnPending=jobs.filter(j=>j.prnStatus?.status==="pending").length;
  const unassignedCount=jobs.filter(j=>!j.assignedTo).length;

  return(
    <div style={styles.root}>
      <div style={styles.header}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:24}}>🐾</span>
          <div>
            <div style={styles.appTitle}>TLDOM Scheduler</div>
            <div style={styles.appSub}>This Lil Dog of Mine · Geo + PRN Matching</div>
          </div>
        </div>
        <div style={{display:"flex",gap:10}}>
          <div style={styles.stat}><span style={{color:"#94a3b8",fontSize:15,fontWeight:700}}>{jobs.length}</span><span style={{color:"#475569",fontSize:10}}>jobs</span></div>
          <div style={styles.stat}><span style={{color:"#f87171",fontSize:15,fontWeight:700}}>{unassignedCount}</span><span style={{color:"#475569",fontSize:10}}>open</span></div>
          <div style={styles.stat}><span style={{color:"#4ade80",fontSize:15,fontWeight:700}}>{assignedCount}</span><span style={{color:"#475569",fontSize:10}}>confirmed</span></div>
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
        {tab===0&&<ImportPanel onImport={handleImport}/>}
        {tab===1&&<StaffPanel sitters={sitters} setSitters={setSitters} timeOffMap={timeOffMap}/>}
        {tab===2&&<JobsPanel jobs={jobs}/>}
        {tab===3&&<MatchEngine jobs={jobs} sitters={sitters} setJobs={setJobs} timeOffMap={timeOffMap}/>}
        {tab===4&&<MarketingFill jobs={jobs} sitters={sitters} timeOffMap={timeOffMap}/>}
      </div>
    </div>
  );
}

const styles={
  root:{fontFamily:"'DM Sans','Helvetica Neue',sans-serif",background:"#f8f9fb",minHeight:"100vh",maxWidth:680,margin:"0 auto"},
  header:{background:"#0f172a",padding:"13px 16px",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8},
  appTitle:{fontWeight:800,fontSize:15,color:"#fff",letterSpacing:"-.02em"},
  appSub:{fontSize:10,color:"#475569",letterSpacing:".03em"},
  stat:{display:"flex",flexDirection:"column",alignItems:"center",gap:1},
  tabBar:{background:"#0f172a",display:"flex",borderTop:"1px solid #ffffff0d",padding:"0 4px",overflowX:"auto"},
  tab:{border:"none",cursor:"pointer",padding:"9px 12px",fontSize:12,borderRadius:"6px 6px 0 0",transition:"all .15s",whiteSpace:"nowrap"},
  tabPill:{border:"none",cursor:"pointer",borderRadius:20,padding:"4px 11px",fontSize:12,fontWeight:600,transition:"all .15s",whiteSpace:"nowrap"},
  content:{padding:"16px 14px"},
  sectionTitle:{fontSize:17,fontWeight:800,marginBottom:4,marginTop:0,letterSpacing:"-.02em"},
  hint:{fontSize:12,color:"#6b7280",marginTop:0,marginBottom:14,lineHeight:1.6},
  card:{background:"#fff",border:"1px solid #e5e7eb",borderRadius:10,padding:"12px 14px",marginBottom:2},
  input:{border:"1.5px solid #e5e7eb",borderRadius:7,padding:"8px 10px",fontSize:13,outline:"none",background:"#fff"},
  btn:{background:"#0f172a",color:"#fff",border:"none",borderRadius:7,padding:"8px 14px",fontWeight:700,fontSize:13,cursor:"pointer"},
  removeBtn:{background:"transparent",border:"none",color:"#9ca3af",cursor:"pointer",fontSize:14,padding:"2px 4px"},
  empty:{textAlign:"center",color:"#9ca3af",fontSize:13,padding:"28px 0"},
};
