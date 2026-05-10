
  return (
    <>
      <div className="sec-head">
        <h2>{T.paddocks}</h2>
        {role==="admin" && <button className="btn btn-primary btn-sm" onClick={()=>setAddModal(true)}>+ {T.add}</button>}
      </div>
      {paddocks.length===0 && <div className="empty"><div className="empty-icon">📍</div><p>{T.noPaddocks}</p></div>}
      {paddocks.map(p=>(
        <PaddockCard key={p.id} p={p} role={role}
          onDelete={()=>{if(confirm(`${p.name} verwyder?`))setPaddocks(prev=>prev.filter(x=>x.id!==p.id));}}
          onReset={()=>openReset(p)}
        />
      ))}

      {addModal && (
        <div className="overlay" onClick={()=>setAddModal(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div className="modal-handle"/>
            <h2>{T.newPaddock}</h2>
            <div className="form-group">
              <label className="form-label">{T.paddockName}</label>
              <input className="form-input" value={name} onChange={e=>setName(e.target.value)}
                placeholder="bv. Westelike Kamp" autoFocus/>
            </div>
            <button className="btn btn-primary btn-full" onClick={addPaddock}>+ {T.add}</button>
          </div>
        </div>
      )}

      {resetP && (
        <div className="overlay" onClick={()=>setResetP(null)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div className="modal-handle"/>
            <h2>📊 {T.stockTake}: {resetP.name}</h2>
            <CategoryGrid label={`🐑 ${T.sheep}`} values={resetSh}
              onChange={(c,v)=>setResetSh(prev=>({...prev,[c]:Number(v)||0}))}/>
            <CategoryGrid label={`🐐 ${T.goats}`} values={resetGo}
              onChange={(c,v)=>setResetGo(prev=>({...prev,[c]:Number(v)||0}))}/>
            <div style={{display:"flex",gap:8,marginTop:10}}>
              <button className="btn btn-primary" style={{flex:1}} onClick={saveReset}>{T.save}</button>
              <button className="btn btn-ghost" onClick={()=>setResetP(null)}>{T.cancel}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Transaksies ───────────────────────────────────────────────────────────────
function Transaksies({ paddocks, setPaddocks, addEvent }) {
  const [type,       setType]       = useState("bought");
  const [paddock,    setPaddock]    = useState("");
  const [moveSh,     setMoveSh]     = useState(emptyCat());
  const [moveGo,     setMoveGo]     = useState(emptyCat());
  const [sheepLambs, setSheepLambs] = useState("");
  const [goatLambs,  setGoatLambs]  = useState("");
  const [notes,      setNotes]      = useState("");
  const [saved,      setSaved]      = useState(false);

  const isNewLambs = type==="newLambs";
  const fromP = paddocks.find(p=>p.id===paddock);
  const totalAnimals = isNewLambs
    ? (Number(sheepLambs)||0)+(Number(goatLambs)||0)
    : totalCat(moveSh)+totalCat(moveGo);
  const valid = paddock && totalAnimals>0;

  const reset = () => {
    setPaddock(""); setMoveSh(emptyCat()); setMoveGo(emptyCat());
    setSheepLambs(""); setGoatLambs(""); setNotes("");
  };

  const submit = () => {
    if(!valid) return;
    const paddockName = fromP?.name;
    const ts = nowISO();

    if(isNewLambs) {
      const sl = Number(sheepLambs)||0, gl = Number(goatLambs)||0;
      setPaddocks(prev=>prev.map(p=>{
        if(p.id!==paddock) return p;
        const wasEmpty = totalCat(p.sheep)+totalCat(p.goats)===0;
        return {...p, sheep:{...p.sheep,lambs:(p.sheep.lambs||0)+sl},
          goats:{...p.goats,lambs:(p.goats.lambs||0)+gl},
          arrivedAt: wasEmpty&&(sl+gl)>0 ? ts : p.arrivedAt};
      }));
      addEvent({type:"newLambs", paddock, paddockName, sheepLambs:sl, goatLambs:gl, notes});
    } else if(type==="bought") {
      setPaddocks(prev=>prev.map(p=>{
        if(p.id!==paddock) return p;
        const wasEmpty = totalCat(p.sheep)+totalCat(p.goats)===0;
        return {...p, sheep:addCat(p.sheep,moveSh), goats:addCat(p.goats,moveGo),
          arrivedAt: wasEmpty ? ts : p.arrivedAt};
      }));
      addEvent({type:"bought", paddock, paddockName, sheep:moveSh, goats:moveGo, notes});
    } else {
      setPaddocks(prev=>prev.map(p=>{
        if(p.id!==paddock) return p;
        const newSheep=subCat(p.sheep,moveSh), newGoats=subCat(p.goats,moveGo);
        const isEmpty=totalCat(newSheep)+totalCat(newGoats)===0;
        return {...p, sheep:newSheep, goats:newGoats, arrivedAt: isEmpty?null:p.arrivedAt};
      }));
      addEvent({type:"sold", paddock, paddockName, sheep:moveSh, goats:moveGo, notes});
    }
    reset(); setSaved(true); setTimeout(()=>setSaved(false),2500);
  };

  const btnClass = type==="bought"?"btn-primary":type==="sold"?"btn-rust":"btn-teal";

  return (
    <>
      <div className="sec-head"><h2>{T.transactions}</h2></div>
      <div style={{display:"flex",gap:8,marginBottom:14}}>
        <button className={`btn btn-sm ${type==="bought"?"btn-primary":"btn-ghost"}`} onClick={()=>setType("bought")}>🛒 {T.bought}</button>
        <button className={`btn btn-sm ${type==="sold"?"btn-rust":"btn-ghost"}`} onClick={()=>setType("sold")}>💰 {T.sold}</button>
        <button className={`btn btn-sm ${type==="newLambs"?"btn-teal":"btn-ghost"}`} onClick={()=>setType("newLambs")}>🐣 {T.newLambs}</button>
      </div>
      <div className="card">
        <div className="form-group">
          <label className="form-label">{T.paddock}</label>
          <select className="form-select" value={paddock} onChange={e=>setPaddock(e.target.value)}>
            <option value="">{T.select}</option>
            {paddocks.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        {isNewLambs ? (
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">🐑 {T.sheepLambs}</label>
              <input className="form-input" type="number" min="0" value={sheepLambs}
                onChange={e=>setSheepLambs(e.target.value)} placeholder="0"/>
            </div>
            <div className="form-group">
              <label className="form-label">🐐 {T.goatLambs}</label>
              <input className="form-input" type="number" min="0" value={goatLambs}
                onChange={e=>setGoatLambs(e.target.value)} placeholder="0"/>
            </div>
          </div>
        ) : (
          <>
            <CategoryGrid label={`🐑 ${T.sheep}`} values={moveSh}
              onChange={(c,v)=>setMoveSh(prev=>({...prev,[c]:Number(v)||0}))}
              max={type==="sold"?fromP?.sheep:undefined}/>
            <CategoryGrid label={`🐐 ${T.goats}`} values={moveGo}
              onChange={(c,v)=>setMoveGo(prev=>({...prev,[c]:Number(v)||0}))}
              max={type==="sold"?fromP?.goats:undefined}/>
          </>
        )}
        <div className="form-group">
          <label className="form-label">{T.notes}</label>
          <textarea className="form-textarea" rows={2} value={notes}
            onChange={e=>setNotes(e.target.value)} placeholder="Enige notas…"/>
        </div>
        <button className={`btn btn-full ${btnClass}`} onClick={submit} disabled={!valid}>
          {saved ? T.transactionSaved : T.recordTransaction}
        </button>
      </div>
      {fromP && (totalCat(fromP.sheep)+totalCat(fromP.goats)>0) && (
        <div className="card" style={{marginTop:10,background:"var(--bg)"}}>
          <div style={{fontSize:".8rem",color:"var(--muted)",marginBottom:6}}>{T.currentStock} {fromP.name}</div>
          <div className="stats">
            {CATS.map(c=>(
              <div key={c} className="stat">
                <div style={{fontSize:".7rem",color:"var(--muted)"}}>{CATLABEL[c]}</div>
                <div className="stat-val sheep-c">{fromP.sheep[c]}</div>
                <div className="stat-val goats-c" style={{fontSize:".9rem"}}>{fromP.goats[c]}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

// ── Bewegings ─────────────────────────────────────────────────────────────────
function Bewegings({ paddocks, setPaddocks, addEvent, applyExtra }) {
  const [from,  setFrom]  = useState("");
  const [to,    setTo]    = useState("");
  const [moveSh,setMoveSh]= useState(emptyCat());
  const [moveGo,setMoveGo]= useState(emptyCat());
  const [notes, setNotes] = useState("");
  const [extra, setExtra] = useState(emptyExtra());
  const [saved, setSaved] = useState(false);

  const fromP = paddocks.find(p=>p.id===from);
  const valid = from && to && from!==to && (totalCat(moveSh)+totalCat(moveGo)>0);

  const submit = () => {
    if(!valid) return;
    const ts = nowISO();
    const fromName = paddocks.find(p=>p.id===from)?.name;
    const toName   = paddocks.find(p=>p.id===to)?.name;
    setPaddocks(prev=>prev.map(p=>{
      if(p.id===from) return {...p,sheep:subCat(p.sheep,moveSh),goats:subCat(p.goats,moveGo)};
      if(p.id===to)   return {...p,sheep:addCat(p.sheep,moveSh),goats:addCat(p.goats,moveGo),arrivedAt:ts,
        paddockCondition:extra.paddockCond!==null?extra.paddockCond:p.paddockCondition};
      return p;
    }));
    addEvent({type:"movement",from,to,fromName,toName,sheep:moveSh,goats:moveGo,notes,
      scores:extra.scores,paddockCond:extra.paddockCond,observations:extra.observations});
    applyExtra(extra, from);
    setFrom("");setTo("");setMoveSh(emptyCat());setMoveGo(emptyCat());setNotes("");setExtra(emptyExtra());
    setSaved(true); setTimeout(()=>setSaved(false),2500);
  };

  return (
    <>
      <div className="sec-head"><h2>{T.movements}</h2></div>
      <div className="card">
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">{T.fromPaddock}</label>
            <select className="form-select" value={from} onChange={e=>setFrom(e.target.value)}>
              <option value="">{T.select}</option>
              {paddocks.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">{T.toPaddock}</label>
            <select className="form-select" value={to} onChange={e=>setTo(e.target.value)}>
              <option value="">{T.select}</option>
              {paddocks.filter(p=>p.id!==from).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        </div>
        <CategoryGrid label={`🐑 ${T.sheep}`} values={moveSh}
          onChange={(c,v)=>setMoveSh(prev=>({...prev,[c]:Number(v)||0}))} max={fromP?.sheep}/>
        <CategoryGrid label={`🐐 ${T.goats}`} values={moveGo}
          onChange={(c,v)=>setMoveGo(prev=>({...prev,[c]:Number(v)||0}))} max={fromP?.goats}/>
        <div className="form-group">
          <label className="form-label">{T.notes}</label>
          <textarea className="form-textarea" rows={2} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Enige notas…"/>
        </div>
        <AdditionalRecords extra={extra} setExtra={setExtra} />
        <button className="btn btn-sky btn-full" onClick={submit} disabled={!valid}>
          {saved ? T.movementSaved : T.recordMovement}
        </button>
      </div>
      {fromP && (
        <div className="card" style={{marginTop:10,background:"var(--bg)"}}>
          <div style={{fontSize:".8rem",color:"var(--muted)",marginBottom:6}}>{T.currentStock} {fromP.name}</div>
          <div className="stats">
            {CATS.map(c=>(
              <div key={c} className="stat">
                <div style={{fontSize:".7rem",color:"var(--muted)"}}>{CATLABEL[c]}</div>
                <div className="stat-val sheep-c">{fromP.sheep[c]}</div>
                <div className="stat-val goats-c" style={{fontSize:".9rem"}}>{fromP.goats[c]}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

// ── Verliese ──────────────────────────────────────────────────────────────────
function Verliese({ paddocks, setPaddocks, addEvent }) {
  const [type,    setType]    = useState("death");
  const [paddock, setPaddock] = useState("");
  const [sheep,   setSheep]   = useState(emptyCat());
  const [goats,   setGoats]   = useState(emptyCat());
  const [cause,   setCause]   = useState("");
  const [notes,   setNotes]   = useState("");
  const [saved,   setSaved]   = useState(false);

  const valid = paddock && (totalCat(sheep)+totalCat(goats)>0);

  const submit = () => {
    if(!valid) return;
    const paddockName = paddocks.find(p=>p.id===paddock)?.name;
    setPaddocks(prev=>prev.map(p=>p.id===paddock
      ?{...p,sheep:subCat(p.sheep,sheep),goats:subCat(p.goats,goats)}:p));
    addEvent({type, paddock, paddockName, sheep, goats, cause, notes});
    setPaddock("");setSheep(emptyCat());setGoats(emptyCat());setCause("");setNotes("");
    setSaved(true); setTimeout(()=>setSaved(false),2500);
  };

  return (
    <>
      <div className="sec-head"><h2>{T.losses}</h2></div>
      <div style={{display:"flex",gap:8,marginBottom:14}}>
        <button className={`btn btn-sm ${type==="death"?"btn-rust":"btn-ghost"}`} onClick={()=>setType("death")}>☠️ {T.death}</button>
        <button className={`btn btn-sm ${type==="lost"?"btn-amber":"btn-ghost"}`} onClick={()=>setType("lost")}>🔍 {T.lost}</button>
      </div>
      <div className="card">
        <div className="form-group">
          <label className="form-label">{T.paddock}</label>
          <select className="form-select" value={paddock} onChange={e=>setPaddock(e.target.value)}>
            <option value="">{T.select}</option>
            {paddocks.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <CategoryGrid label={`🐑 ${T.sheep}`} values={sheep} onChange={(c,v)=>setSheep(prev=>({...prev,[c]:Number(v)||0}))}/>
        <CategoryGrid label={`🐐 ${T.goats}`} values={goats} onChange={(c,v)=>setGoats(prev=>({...prev,[c]:Number(v)||0}))}/>
        {type==="death" && (
          <div className="form-group">
            <label className="form-label">{T.cause}</label>
            <select className="form-select" value={cause} onChange={e=>setCause(e.target.value)}>
              <option value="">{T.unknown}</option>
              <option value={T.illness}>{T.illness}</option>
              <option value={T.injury}>{T.injury}</option>
              <option value={T.predator}>{T.predator}</option>
              <option value={T.oldAge}>{T.oldAge}</option>
              <option value={T.birthComp}>{T.birthComp}</option>
              <option value={T.other}>{T.other}</option>
            </select>
          </div>
        )}
        <div className="form-group">
          <label className="form-label">{T.notes}</label>
          <textarea className="form-textarea" rows={2} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Bykomende besonderhede…"/>
        </div>
        <button className={`btn btn-full ${type==="death"?"btn-rust":"btn-amber"}`} onClick={submit} disabled={!valid}>
          {saved ? T.lossSaved : T.lossRecord}
        </button>
      </div>
    </>
  );
}

// ── Behandelings ──────────────────────────────────────────────────────────────
function Behandelings({ paddocks, setPaddocks, treatments, setTreatments, addEvent, applyExtra }) {
  const [paddock,setP]       = useState("");
  const [species,setSpecies] = useState("sheep");
  const [cat,    setCat]     = useState("ewes");
  const [count,  setCount]   = useState("");
  const [tname,  setTname]   = useState("");
  const [dosage, setDosage]  = useState("");
  const [method, setMethod]  = useState("");
  const [adminBy,setAdminBy] = useState("");
  const [notes,  setNotes]   = useState("");
  const [extra,  setExtra]   = useState(emptyExtra());
  const [saved,  setSaved]   = useState(false);

  const valid = paddock && tname.trim() && Number(count)>0;

  const submit = () => {
    if(!valid) return;
    const paddockName = paddocks.find(p=>p.id===paddock)?.name;
    const rec = {id:uid(),ts:nowISO(),paddock,paddockName,species,category:cat,
      count:Number(count),treatment:tname,dosage,method,administeredBy:adminBy,notes,
      scores:extra.scores,paddockCond:extra.paddockCond,observations:extra.observations};
    setTreatments(prev=>[rec,...prev]);
    addEvent({type:"treatment",paddock,paddockName,species,category:cat,
      count:Number(count),treatment:tname,method,administeredBy:adminBy});
    applyExtra(extra, paddock);
    setP("");setSpecies("sheep");setCat("ewes");setCount("");
    setTname("");setDosage("");setMethod("");setAdminBy("");setNotes("");setExtra(emptyExtra());
    setSaved(true); setTimeout(()=>setSaved(false),2500);
  };

  return (
    <>
      <div className="sec-head"><h2>{T.treatments}</h2></div>
      <div className="card">
        <div className="form-group">
          <label className="form-label">{T.paddock}</label>
          <select className="form-select" value={paddock} onChange={e=>setP(e.target.value)}>
            <option value="">{T.select}</option>
            {paddocks.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">{T.animalGroup}</label>
            <select className="form-select" value={species} onChange={e=>setSpecies(e.target.value)}>
              <option value="sheep">🐑 {T.sheep}</option>
              <option value="goats">🐐 {T.goats}</option>
              <option value="both">{T.both}</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">{T.category}</label>
            <select className="form-select" value={cat} onChange={e=>setCat(e.target.value)}>
              {CATS.map(c=><option key={c} value={c}>{CATLABEL[c]}</option>)}
              <option value="all">{T.all}</option>
            </select>
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">{T.countTreated}</label>
          <input className="form-input" type="number" min="1" value={count} onChange={e=>setCount(e.target.value)} placeholder="0"/>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">{T.treatmentName}</label>
            <input className="form-input" value={tname} onChange={e=>setTname(e.target.value)} placeholder="bv. Ivermectien"/>
          </div>
          <div className="form-group">
            <label className="form-label">{T.dosage}</label>
            <input className="form-input" value={dosage} onChange={e=>setDosage(e.target.value)} placeholder="bv. 1ml/10kg"/>
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">{T.method}</label>
            <select className="form-select" value={method} onChange={e=>setMethod(e.target.value)}>
              <option value="">{T.select}</option>
              <option value={T.oral}>{T.oral}</option>
              <option value={T.injection}>{T.injection}</option>
              <option value={T.pourOn}>{T.pourOn}</option>
              <option value={T.spray}>{T.spray}</option>
              <option value={T.dip}>{T.dip}</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">{T.administeredBy}</label>
            <input className="form-input" value={adminBy} onChange={e=>setAdminBy(e.target.value)} placeholder="Naam…"/>
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">{T.notes}</label>
          <textarea className="form-textarea" rows={2} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Notas…"/>
        </div>
        <AdditionalRecords extra={extra} setExtra={setExtra} />
        <button className="btn btn-teal btn-full" onClick={submit} disabled={!valid}>
          {saved ? T.treatmentSaved : T.recordTreatment}
        </button>
      </div>

      {treatments.length>0 && (
        <>
          <div className="sec-head" style={{marginTop:18}}><h2>Rekords</h2></div>
          {treatments.map(tr=>(
            <div className="card" key={tr.id}>
              <div className="card-header">
                <div>
                  <div className="card-title">💊 {tr.treatment}</div>
                  <div style={{fontSize:".82rem",color:"var(--muted)"}}>
                    {tr.count} × {tr.species==="sheep"?`🐑 ${T.sheep}`:tr.species==="goats"?`🐐 ${T.goats}`:T.both} — {CATLABEL[tr.category]||T.all}
                  </div>
                  <div style={{fontSize:".8rem",color:"var(--muted)"}}>📍 {tr.paddockName}</div>
                </div>
              </div>
              {tr.dosage && <div style={{fontSize:".82rem",color:"var(--muted)"}}>{T.dosage}: {tr.dosage}{tr.method?` · ${tr.method}`:""}</div>}
              {tr.administeredBy && <div style={{fontSize:".82rem",color:"var(--muted)"}}>{T.administeredBy}: {tr.administeredBy}</div>}
              <div style={{fontSize:".75rem",color:"var(--muted)",marginTop:6}}>{fmtTime(tr.ts)}</div>
            </div>
          ))}
        </>
      )}
    </>
  );
}

// ── Take ──────────────────────────────────────────────────────────────────────
function Take({ tasks, setTasks, paddocks, role, addEvent }) {
  const [modal,  setModal]  = useState(false);
  const [title,  setTitle]  = useState(""); const [assign, setAssign] = useState("");
  const [paddock,setPaddock]= useState(""); const [notes,  setNotes]  = useState("");
  const [due,    setDue]    = useState(""); const [filter, setFilter] = useState("all");
  const [photo,  setPhoto]  = useState(null);
  const fileRef = useRef();

  const add = () => {
    if(!title.trim()) return;
    setTasks(prev=>[{id:uid(),title:title.trim(),assignedTo:assign,paddock,notes,dueDate:due,
      status:"pending",createdAt:nowISO(),photo},...prev]);
    addEvent({type:"task",action:"created",taskTitle:title,assignedTo:assign,
      paddockName:paddocks.find(p=>p.id===paddock)?.name});
    setTitle("");setAssign("");setPaddock("");setNotes("");setDue("");setPhoto(null);setModal(false);
  };

  const complete = (id) => {
    setTasks(prev=>prev.map(t=>t.id===id?{...t,status:"done",doneAt:nowISO()}:t));
    const t=tasks.find(x=>x.id===id);
    if(t) addEvent({type:"task",action:"completed",taskTitle:t.title});
  };

  const shown = tasks.filter(t=>
    filter==="all"?true:filter==="overdue"?(isOverdue(t.dueDate)&&t.status==="pending"):t.status===filter);
  const ovCount = tasks.filter(t=>t.status==="pending"&&isOverdue(t.dueDate)).length;

  return (
    <>
      <div className="sec-head">
        <h2>{T.tasks}</h2>
        {role==="admin"&&<button className="btn btn-primary btn-sm" onClick={()=>setModal(true)}>+ {T.add}</button>}
      </div>
      <div style={{display:"flex",gap:6,marginBottom:12,flexWrap:"wrap"}}>
        {["all","pending","overdue","done"].map(f=>(
          <button key={f} className={`btn btn-sm ${filter===f?"btn-primary":"btn-ghost"}`} onClick={()=>setFilter(f)}>
            {f==="all"?T.all:f==="pending"?T.pending:f==="overdue"?`${T.overdue}${ovCount?` (${ovCount})`:""}`:T.done}
          </button>
        ))}
      </div>
      {shown.length===0&&<div className="empty"><div className="empty-icon">✅</div><p>{T.noTasks}</p></div>}
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {shown.map(t=>{
          const od=isOverdue(t.dueDate)&&t.status==="pending";
          return (
            <div className="card" key={t.id} style={{borderColor:od?"var(--rust)":"var(--border)"}}>
              <div className="card-header">
                <div style={{flex:1}}>
                  <div className="card-title">{t.title}</div>
                  {t.assignedTo&&<div style={{fontSize:".82rem",color:"var(--muted)"}}>→ {t.assignedTo}</div>}
                  {t.paddock&&<div style={{fontSize:".82rem",color:"var(--muted)"}}>📍 {paddocks.find(p=>p.id===t.paddock)?.name}</div>}
                  {t.dueDate&&<div style={{fontSize:".8rem",marginTop:2,color:od?"var(--rust)":"var(--muted)",fontWeight:od?700:400}}>
                    {od?"⚠️ Agterstallig — was gesperd ":"Sperdatum: "}{fmtDate(t.dueDate)}</div>}
                </div>
                <span className={`pill ${t.status==="done"?"pill-done":od?"pill-overdue":"pill-pending"}`}>
                  {t.status==="done"?"✅ "+T.done:od?"⚠️ "+T.overdue:"⏳ "+T.pending}
                </span>
              </div>
              {t.notes&&<p style={{fontSize:".85rem",color:"var(--muted)",marginBottom:8}}>{t.notes}</p>}
              {t.photo&&<img src={t.photo} alt="taak" className="photo-preview"/>}
              <div style={{fontSize:".73rem",color:"var(--muted)",marginTop:6,marginBottom:t.status==="pending"?8:0}}>
                {fmtDate(t.createdAt)}{t.doneAt?` · Klaar ${fmtTime(t.doneAt)}`:""}
              </div>
              {t.status==="pending"&&(
                <div style={{display:"flex",gap:8}}>
                  <button className="btn btn-done btn-sm" onClick={()=>complete(t.id)}>{T.markDone}</button>
                  {role==="admin"&&<button className="btn btn-ghost btn-sm" style={{color:"var(--rust)"}}
                    onClick={()=>{if(confirm("Taak verwyder?"))setTasks(prev=>prev.filter(x=>x.id!==t.id));}}>❌</button>}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {modal&&(
        <div className="overlay" onClick={()=>setModal(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div className="modal-handle"/>
            <h2>{T.assignTask}</h2>
            <div className="form-group"><label className="form-label">{T.taskDesc}</label>
              <input className="form-input" value={title} onChange={e=>setTitle(e.target.value)} placeholder="bv. Kontroleer watertrôe" autoFocus/></div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">{T.assignTo}</label>
                <input className="form-input" value={assign} onChange={e=>setAssign(e.target.value)} placeholder="Werker naam"/></div>
              <div className="form-group"><label className="form-label">{T.dueDate}</label>
                <input className="form-input" type="date" value={due} min={todayStr()} onChange={e=>setDue(e.target.value)}/></div>
            </div>
            <div className="form-group"><label className="form-label">{T.paddock}</label>
              <select className="form-select" value={paddock} onChange={e=>setPaddock(e.target.value)}>
                <option value="">{T.noSpecific}</option>
                {paddocks.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
              </select></div>
            <div className="form-group"><label className="form-label">{T.notes}</label>
              <textarea className="form-textarea" rows={2} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Ekstra besonderhede…"/></div>
            <div className="form-group"><label className="form-label">Foto</label>
              <div className="photo-upload" onClick={()=>fileRef.current?.click()}>
                {photo?<img src={photo} alt="v" style={{maxHeight:90,borderRadius:6}}/>:T.addPhoto}
              </div>
              <input ref={fileRef} type="file" accept="image/*" style={{display:"none"}}
                onChange={async e=>{const f=e.target.files?.[0];if(f)setPhoto(await compressImage(f));}}/></div>
            <button className="btn btn-primary btn-full" onClick={add}>{T.assignTask}</button>
          </div>
        </div>
      )}
    </>
  );
}

// ── Probleme ──────────────────────────────────────────────────────────────────
function Probleme({ issues, setIssues, paddocks, addEvent }) {
  const [modal,   setModal]   = useState(false);
  const [title,   setTitle]   = useState(""); const [paddock,setPaddock]=useState("");
  const [type,    setType]    = useState(""); const [notes,  setNotes]  = useState("");
  const [photo,   setPhoto]   = useState(null);
  const [filter,  setFilter]  = useState("open");
  const [viewing, setViewing] = useState(null);
  const fileRef = useRef();

  const add = () => {
    if(!title.trim()) return;
    const iss={id:uid(),title:title.trim(),paddock,type,notes,photo,status:"open",createdAt:nowISO()};
    setIssues(prev=>[iss,...prev]);
    addEvent({type:"issue",action:"reported",issueTitle:title,issueType:type,
      paddockName:paddocks.find(p=>p.id===paddock)?.name});
    setTitle("");setPaddock("");setType("");setNotes("");setPhoto(null);setModal(false);
  };

  const shown=issues.filter(i=>filter==="all"?true:i.status===filter);

  return (
    <>
      <div className="sec-head"><h2>{T.issues}
        </h2><button className="btn btn-amber btn-sm" onClick={()=>setModal(true)}>+ {T.report}</button>
      </div>
      <div style={{display:"flex",gap:6,marginBottom:12}}>
        {["open","resolved","all"].map(f=>(
          <button key={f} className={`btn btn-sm ${filter===f?"btn-primary":"btn-ghost"}`} onClick={()=>setFilter(f)}>
            {f==="open"?T.open:f==="resolved"?T.resolved:T.all}
          </button>
        ))}
      </div>
      {shown.length===0&&<div className="empty"><div className="empty-icon">⚠️</div><p>{T.noIssues}</p></div>}
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {shown.map(iss=>(
          <div className="card" key={iss.id} style={{borderColor:iss.status==="open"?"var(--amber)":"var(--border)"}}>
            <div className="card-header">
              <div style={{flex:1}}>
                <div className="card-title">{iss.title}</div>
                {iss.type&&<div style={{fontSize:".82rem",color:"var(--muted)"}}>{iss.type}</div>}
                {iss.paddock&&<div style={{fontSize:".82rem",color:"var(--muted)"}}>📍 {paddocks.find(p=>p.id===iss.paddock)?.name}</div>}
              </div>
              <span className={`pill ${iss.status==="open"?"pill-open":"pill-resolved"}`}>
                {iss.status==="open"?"🔴 "+T.open:"✅ "+T.resolved}
              </span>
            </div>
            {iss.notes&&<p style={{fontSize:".85rem",color:"var(--muted)",marginBottom:8}}>{iss.notes}</p>}
            {iss.photo&&<img src={iss.photo} alt="p" className="photo-preview" style={{cursor:"pointer"}} onClick={()=>setViewing(iss.photo)}/>}
            <div style={{fontSize:".73rem",color:"var(--muted)",marginTop:6,marginBottom:iss.status==="open"?8:0}}>
              {fmtTime(iss.createdAt)}{iss.resolvedAt?` · Opgelos ${fmtTime(iss.resolvedAt)}`:""}
            </div>
            {iss.status==="open"&&(
              <div style={{display:"flex",gap:8}}>
                <button className="btn btn-done btn-sm" onClick={()=>{
                  setIssues(prev=>prev.map(i=>i.id===iss.id?{...i,status:"resolved",resolvedAt:nowISO()}:i));
                  addEvent({type:"issue",action:"resolved",issueTitle:iss.title});
                }}>{T.markResolved}</button>
                <button className="btn btn-ghost btn-sm" style={{color:"var(--rust)"}}
                  onClick={()=>{if(confirm("Verwyder?"))setIssues(prev=>prev.filter(i=>i.id!==iss.id));}}>❌</button>
              </div>
            )}
          </div>
        ))}
      </div>
      {viewing&&<div className="overlay" onClick={()=>setViewing(null)} style={{alignItems:"center",justifyContent:"center"}}>
        <img src={viewing} alt="vol" style={{maxWidth:"95vw",maxHeight:"90vh",borderRadius:12}} onClick={e=>e.stopPropagation()}/></div>}
      {modal&&(
        <div className="overlay" onClick={()=>setModal(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div className="modal-handle"/><h2>{T.reportIssue}</h2>
            <div className="form-group"><label className="form-label">Beskrywing</label>
              <input className="form-input" value={title} onChange={e=>setTitle(e.target.value)} placeholder="bv. Heining gebreek" autoFocus/></div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">{T.issueType}</label>
                <select className="form-select" value={type} onChange={e=>setType(e.target.value)}>
                  <option value="">Algemeen</option>
                  <option value={T.fenceGate}>{T.fenceGate}</option>
                  <option value={T.waterSupply}>{T.waterSupply}</option>
                  <option value={T.animalHealth}>{T.animalHealth}</option>
                  <option value={T.predator}>{T.predator}</option>
                  <option value={T.equipment}>{T.equipment}</option>
                  <option value={T.feedPasture}>{T.feedPasture}</option>
                  <option value={T.other}>{T.other}</option>
                </select></div>
              <div className="form-group"><label className="form-label">{T.paddock}</label>
                <select className="form-select" value={paddock} onChange={e=>setPaddock(e.target.value)}>
                  <option value="">{T.noSpecific}</option>
                  {paddocks.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
                </select></div>
            </div>
            <div className="form-group"><label className="form-label">{T.notes}</label>
              <textarea className="form-textarea" rows={2} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Meer besonderhede…"/></div>
            <div className="form-group"><label className="form-label">Foto</label>
              <div className="photo-upload" onClick={()=>fileRef.current?.click()}>
                {photo?<img src={photo} alt="v" style={{maxHeight:90,borderRadius:6}}/>:T.addPhoto}
              </div>
              <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{display:"none"}}
                onChange={async e=>{const f=e.target.files?.[0];if(f)setPhoto(await compressImage(f));}}/></div>
            <button className="btn btn-amber btn-full" onClick={add}>{T.reportIssue}</button>
          </div>
        </div>
      )}
    </>
  );
}

// ── Geskiedenis ───────────────────────────────────────────────────────────────
const HISTORY_FILTERS = [
  {id:"all",label:"Almal"},{id:"movement",label:"Bewegings"},
  {id:"bought",label:"Gekoop"},{id:"sold",label:"Verkoop"},
  {id:"newLambs",label:"Nuwe Lammers"},{id:"death",label:"Sterfte"},
  {id:"lost",label:"Vermis"},{id:"treatment",label:"Behandelings"},
  {id:"task",label:"Take"},{id:"issue",label:"Probleme"},
  {id:"stockTake",label:"Voorraadopname"},
];

function Geskiedenis({ events }) {
  const [filter,setFilter]=useState("all");
  const shown=events.filter(e=>filter==="all"?true:e.type===filter);
  return (
    <>
      <div className="sec-head"><h2>{T.history}</h2></div>
      <div style={{display:"flex",gap:6,marginBottom:12,flexWrap:"wrap"}}>
        {HISTORY_FILTERS.map(f=>(
          <button key={f.id} className={`btn btn-sm ${filter===f.id?"btn-primary":"btn-ghost"}`}
            onClick={()=>setFilter(f.id)}>{f.label}</button>
        ))}
      </div>
      {shown.length===0&&<div className="empty"><div className="empty-icon">📋</div><p>{T.noEvents}</p></div>}
      {shown.length>0&&<div className="card">{shown.map(ev=><EventRow key={ev.id} ev={ev}/>)}</div>}
    </>
  );
}

// ── Uitvoer ───────────────────────────────────────────────────────────────────
function Uitvoer({ paddocks, tasks, issues, events, treatments }) {
  const dl = (rows,fn) => {
    const csv=rows.map(r=>r.map(c=>`"${String(c??'').replace(/"/g,'""')}"`).join(",")).join("\n");
    const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));a.download=fn;a.click();
  };
  const totS=paddocks.reduce((s,p)=>s+totalCat(p.sheep),0);
  const totG=paddocks.reduce((s,p)=>s+totalCat(p.goats),0);
  const deaths=events.filter(e=>e.type==="death");
  const lost=events.filter(e=>e.type==="lost");
  const bought=events.filter(e=>e.type==="bought");
  const sold=events.filter(e=>e.type==="sold");
  const newL=events.filter(e=>e.type==="newLambs");

  return (
    <>
      <div className="sec-head"><h2>{T.export}</h2></div>
      <div className="card" style={{marginBottom:12}}>
        <div className="card-title" style={{marginBottom:10}}>📊 {T.farmSummary}</div>
        <table className="data-table"><tbody>
          <tr><td>Totale Skape</td><td><strong>{totS}</strong></td></tr>
          <tr><td>Totale Bokke</td><td><strong>{totG}</strong></td></tr>
          <tr><td>Totale Diere</td><td><strong>{totS+totG}</strong></td></tr>
          <tr><td>Diere Gekoop</td><td>{bought.reduce((s,e)=>s+totalCat(e.sheep??{})+totalCat(e.goats??{}),0)}</td></tr>
          <tr><td>Diere Verkoop</td><td>{sold.reduce((s,e)=>s+totalCat(e.sheep??{})+totalCat(e.goats??{}),0)}</td></tr>
          <tr><td>Nuwe Lammers</td><td>{newL.reduce((s,e)=>s+(e.sheepLambs||0)+(e.goatLambs||0),0)}</td></tr>
          <tr><td>Sterftes Rekordeer</td><td>{deaths.reduce((s,e)=>s+totalCat(e.sheep??{})+totalCat(e.goats??{}),0)}</td></tr>
          <tr><td>Vermis Rekordeer</td><td>{lost.reduce((s,e)=>s+totalCat(e.sheep??{})+totalCat(e.goats??{}),0)}</td></tr>
          <tr><td>Behandelings</td><td>{treatments.length}</td></tr>
          <tr><td>Hangende Take</td><td>{tasks.filter(t=>t.status==="pending").length}</td></tr>
          <tr><td>Oop Probleme</td><td>{issues.filter(i=>i.status==="open").length}</td></tr>
          <tr><td>Totale Gebeure</td><td>{events.length}</td></tr>
        </tbody></table>
      </div>
      <div className="card" style={{marginBottom:12}}>
        <div className="card-title" style={{marginBottom:10}}>📍 Kamp Diere</div>
        <table className="data-table">
          <thead><tr><th>Kamp</th><th>Ooie</th><th>Lam</th><th>Ram</th><th>Ham</th><th>Tot🐑</th><th>Tot🐐</th><th>Dae</th></tr></thead>
          <tbody>{paddocks.map(p=>(
            <tr key={p.id}>
              <td>{p.name}</td>
              <td>{p.sheep.ewes}</td><td>{p.sheep.lambs}</td><td>{p.sheep.rams}</td><td>{p.sheep.wethers}</td>
              <td><strong>{totalCat(p.sheep)}</strong></td>
              <td><strong>{totalCat(p.goats)}</strong></td>
              <td style={{color:(daysSince(p.arrivedAt)||0)>=14?"var(--rust)":(daysSince(p.arrivedAt)||0)>=7?"var(--amber)":"inherit"}}>
                {daysSince(p.arrivedAt)??"-"}
              </td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      <div className="card">
        <div className="card-title" style={{marginBottom:12}}>⬇️ {T.downloadCSV}</div>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          <button className="btn btn-primary" onClick={()=>dl([
            ["Kamp","Ooie🐑","Lam🐑","Ram🐑","Ham🐑","Tot🐑","Ooie🐐","Lam🐐","Ram🐐","Ham🐐","Tot🐐","Dae","Kond%"],
            ...paddocks.map(p=>[p.name,p.sheep.ewes,p.sheep.lambs,p.sheep.rams,p.sheep.wethers,totalCat(p.sheep),
              p.goats.ewes,p.goats.lambs,p.goats.rams,p.goats.wethers,totalCat(p.goats),daysSince(p.arrivedAt)??'',p.paddockCondition??''])
          ],"kampe.csv")}>📍 Kamp Verslag</button>
          <button className="btn btn-teal" onClick={()=>dl([
            ["Datum","Kamp","Diere","Kategorie","Middel","Dosis","Metode","Toegedien Deur"],
            ...treatments.map(tr=>[fmtTime(tr.ts),tr.paddockName,
              tr.species==="sheep"?T.sheep:tr.species==="goats"?T.goats:T.both,
              CATLABEL[tr.category]||T.all,tr.treatment,tr.dosage,tr.method,tr.administeredBy])
          ],"behandelings.csv")}>💊 Behandelings Verslag</button>
          <button className="btn btn-sky" onClick={()=>dl([
            ["Taak","Wys toe","Kamp","Sperdatum","Status","Geskep","Klaar"],
            ...tasks.map(t=>[t.title,t.assignedTo,
              paddocks.find(p=>p.id===t.paddock)?.name??"",
              t.dueDate?fmtDate(t.dueDate):"",t.status,fmtDate(t.createdAt),t.doneAt?fmtTime(t.doneAt):""])
          ],"take.csv")}>✅ Take Verslag</button>
          <button className="btn btn-amber" onClick={()=>dl([
            ["Datum","Tipe","Besonderhede","Kamp"],
            ...events.map(ev=>{
              let det="",loc="";
              if(ev.type==="movement"){det=`Geskuif: ${totalCat(ev.sheep??{})} skape, ${totalCat(ev.goats??{})} bokke`;loc=`${ev.fromName}→${ev.toName}`;}
              else if(ev.type==="bought"){det=`Gekoop: ${totalCat(ev.sheep??{})} skape, ${totalCat(ev.goats??{})} bokke`;loc=ev.paddockName||"";}
              else if(ev.type==="sold"){det=`Verkoop: ${totalCat(ev.sheep??{})} skape, ${totalCat(ev.goats??{})} bokke`;loc=ev.paddockName||"";}
              else if(ev.type==="newLambs"){det=`Nuwe Lammers: ${ev.sheepLambs||0} skaapl, ${ev.goatLambs||0} bokl`;loc=ev.paddockName||"";}
              else if(ev.type==="death"){det=`Dood: ${totalCat(ev.sheep??{})} skape, ${totalCat(ev.goats??{})} bokke${ev.cause?` (${ev.cause})`:""}`;loc=ev.paddockName||"";}
              else if(ev.type==="lost"){det=`Vermis: ${totalCat(ev.sheep??{})} skape, ${totalCat(ev.goats??{})} bokke`;loc=ev.paddockName||"";}
              else if(ev.type==="treatment"){det=`${ev.treatment} — ${ev.count} diere`;loc=ev.paddockName||"";}
              else if(ev.type==="stockTake"){det="Voorraadopname";loc=ev.paddockName||"";}
              else if(ev.type==="task"){det=`Taak ${ev.action}: ${ev.taskTitle}`;loc="";}
              else{det=`Probleem ${ev.action}: ${ev.issueTitle}`;loc=ev.paddockName||"";}
              return[fmtTime(ev.ts),ev.type,det,loc];
            })
          ],"geskiedenis.csv")}>📋 Volle Geskiedenis</button>
          <button className="btn btn-ghost" onClick={()=>window.print()}>🖨️ {T.printPage}</button>
        </div>
      </div>
    </>
  );
}

// ── Event Row ─────────────────────────────────────────────────────────────────
function EventRow({ ev }) {
  const configs = {
    movement:  {icon:"🔀",cls:"ev-move", title:`Geskuif: ${totalCat(ev.sheep??{})} skape, ${totalCat(ev.goats??{})} bokke`,meta:`${ev.fromName||""}→${ev.toName||""}${ev.notes?` · ${ev.notes}`:""}`},
    bought:    {icon:"🛒",cls:"ev-buy",  title:`Gekoop: ${totalCat(ev.sheep??{})} skape, ${totalCat(ev.goats??{})} bokke`, meta:ev.paddockName||""},
    sold:      {icon:"💰",cls:"ev-sell", title:`Verkoop: ${totalCat(ev.sheep??{})} skape, ${totalCat(ev.goats??{})} bokke`,meta:ev.paddockName||""},
    newLambs:  {icon:"🐣",cls:"ev-treat",title:`Nuwe Lammers: ${(ev.sheepLambs||0)+(ev.goatLambs||0)} lammers`,          meta:ev.paddockName||""},
    death:     {icon:"☠️",cls:"ev-death",title:`Sterfte: ${totalCat(ev.sheep??{})} skape, ${totalCat(ev.goats??{})} bokke`,meta:`${ev.paddockName||""}${ev.cause?` · ${ev.cause}`:""}`},
    lost:      {icon:"🔍",cls:"ev-lost", title:`Vermis: ${totalCat(ev.sheep??{})} skape, ${totalCat(ev.goats??{})} bokke`, meta:ev.paddockName||""},
    treatment: {icon:"💊",cls:"ev-treat",title:`Behandeling: ${ev.treatment||""} — ${ev.count||0} diere`,                 meta:`${ev.paddockName||""}${ev.method?` · ${ev.method}`:""}`},
    stockTake: {icon:"📊",cls:"ev-task", title:`Voorraadopname: ${ev.paddockName||""}`,                                   meta:""},
    task:      {icon:"✅",cls:"ev-task", title:`Taak ${ev.action==="completed"?"voltooi":"toegewys"}: ${ev.taskTitle||""}`,meta:ev.assignedTo?`→ ${ev.assignedTo}`:""},
    issue:     {icon:"⚠️",cls:"ev-issue",title:`Probleem ${ev.action==="resolved"?"opgelos":"gerapporteer"}: ${ev.issueTitle||""}`,meta:ev.paddockName||""},
  };
  const cfg=configs[ev.type]||{icon:"📝",cls:"ev-task",title:ev.type,meta:""};
  return (
    <div className="event-item">
      <div className={`event-icon ${cfg.cls}`}>{cfg.icon}</div>
      <div className="event-body">
        <div className="event-title">{cfg.title}</div>
        <div className="event-meta">{fmtTime(ev.ts)}{cfg.meta?` · ${cfg.meta}`:""}</div>
      </div>
    </div>
  );
}
