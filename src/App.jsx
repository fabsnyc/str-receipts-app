import React, { useState, useEffect } from "react";

const BACKEND_URL = "https://str-qb-backend-production.up.railway.app";

const C = { bg:"#f5f4f0",surface:"#ffffff",card:"#ffffff",border:"#e4e2db",blue:"#2a4de0",blueSoft:"#eef1fd",text:"#0f0f0f",muted:"#7a7670",subtle:"#f0ede8",green:"#16a34a",greenSoft:"#f0fdf4",red:"#dc2626",redSoft:"#fef2f2",yellow:"#d97706" };
const CATEGORIES = ["Fuel","Maintenance","Insurance","Tolls","Cleaning","Parts","Registration","Office","Marketing","Other"];
const TEAM = ["Ahmed","Suhaib","Fabs","Other"];

function useStorage(key, initial) {
  const [val, setVal] = useState(() => {
    try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : initial; } catch { return initial; }
  });
  const save = (v) => { setVal(v); try { localStorage.setItem(key, JSON.stringify(v)); } catch {} };
  return [val, save];
}

const Badge = ({ children, color }) => {
  const c = color || "#2a4de0";
  return <span style={{ background:c+"18",color:c,border:"1px solid "+c+"30",borderRadius:5,padding:"2px 8px",fontSize:11,fontWeight:700,whiteSpace:"nowrap" }}>{children}</span>;
};

const Pill = ({ active, onClick, children }) => (
  <button onClick={onClick} style={{ background:active?"#2a4de0":"#fff",color:active?"#fff":"#7a7670",border:"1px solid "+(active?"#2a4de0":"#e4e2db"),borderRadius:20,padding:"5px 14px",fontSize:12,fontWeight:600,cursor:"pointer" }}>{children}</button>
);

const Stat = ({ label, value, sub, accent, icon }) => (
  <div style={{ background:"#fff",border:"1px solid #e4e2db",borderRadius:14,padding:"20px 22px",flex:1,minWidth:140,boxShadow:"0 1px 3px rgba(0,0,0,.05)" }}>
    <div style={{ fontSize:11,fontWeight:700,color:"#7a7670",letterSpacing:0.8,textTransform:"uppercase",marginBottom:8 }}>{icon} {label}</div>
    <div style={{ fontSize:26,fontWeight:900,color:accent||"#0f0f0f",letterSpacing:-1,lineHeight:1 }}>{value}</div>
    {sub && <div style={{ fontSize:11,color:"#7a7670",marginTop:6 }}>{sub}</div>}
  </div>
);

const inp = { background:"#f5f4f0",border:"1px solid #e4e2db",borderRadius:8,color:"#0f0f0f",padding:"10px 13px",fontSize:14,width:"100%",outline:"none",boxSizing:"border-box" };
const lbl = { fontSize:11,fontWeight:700,color:"#7a7670",letterSpacing:0.8,textTransform:"uppercase",marginBottom:5,display:"block" };

const Modal = ({ title, subtitle, onClose, children }) => (
  <div style={{ position:"fixed",inset:0,background:"rgba(15,15,15,0.55)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:600,padding:16 }}>
    <div style={{ background:"#fff",border:"1px solid #e4e2db",borderRadius:18,padding:28,width:"100%",maxWidth:460,maxHeight:"92vh",overflowY:"auto" }}>
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20 }}>
        <div>
          <div style={{ fontWeight:900,fontSize:17 }}>{title}</div>
          {subtitle && <div style={{ fontSize:12,color:"#7a7670",marginTop:3 }}>{subtitle}</div>}
        </div>
        <button onClick={onClose} style={{ background:"#f0ede8",border:"none",borderRadius:8,width:30,height:30,cursor:"pointer",fontSize:16 }}>X</button>
      </div>
      {children}
    </div>
  </div>
);

const Btn = ({ onClick, children, variant, style: s }) => (
  <button onClick={onClick} style={{ background:variant==="ghost"?"transparent":"#2a4de0",color:variant==="ghost"?"#7a7670":"#fff",border:variant==="ghost"?"1px solid #e4e2db":"none",borderRadius:9,padding:"10px 20px",fontSize:13,fontWeight:700,cursor:"pointer",...(s||{}) }}>{children}</button>
);

export default function App() {
  const [tab, setTab] = useState("dashboard");
  const [transactions, setTransactions] = useStorage("str_tx_v4", []);
  const [receipts, setReceipts] = useStorage("str_rx_v4", []);
  const [qbAuth, setQbAuth] = useStorage("str_qb_v4", null);
  const [lastSync, setLastSync] = useStorage("str_sync_v4", null);
  const [toast, setToast] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [filter, setFilter] = useState("all");
  const [showAddTx, setShowAddTx] = useState(false);
  const [showRx, setShowRx] = useState(false);
  const [txForm, setTxForm] = useState({ vendor:"",amount:"",date:"",category:"Fuel",notes:"" });
  const [rxForm, setRxForm] = useState({ vendor:"",amount:"",date:"",category:"Fuel",notes:"",submitter:"",fileName:"",fileData:null });

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const code = p.get("code"), realmId = p.get("realmId");
    if (code && realmId) { exchangeCode(code, realmId); window.history.replaceState({}, "", window.location.pathname); }
  }, []);

  const notify = (msg, type) => { setToast({msg, type:type||"success"}); setTimeout(()=>setToast(null), 3500); };
  const connectQB = () => { window.location.href = BACKEND_URL+"/auth/quickbooks"; };
  const disconnectQB = () => { setQbAuth(null); notify("Disconnected from QuickBooks"); };

  const exchangeCode = async (code, realmId) => {
    try {
      const res = await fetch(BACKEND_URL+"/auth/callback-data?code="+code+"&realmId="+realmId);
      const data = await res.json();
      if (data.access_token) { const auth = {...data, realmId}; setQbAuth(auth); notify("QuickBooks connected!"); fetchQBTransactions(auth); }
    } catch { notify("QB connect failed","error"); }
  };

  const fetchQBTransactions = async (auth) => {
    const a = auth || qbAuth;
    if (!a) return;
    setSyncing(true);
    try {
      const res = await fetch(BACKEND_URL+"/api/transactions", { headers: { Authorization:"Bearer "+a.access_token, "X-Realm-Id":a.realmId } });
      const data = await res.json();
      if (data.transactions) {
        setTransactions(prev => {
          const ids = new Set(prev.map(t=>t.qbId).filter(Boolean));
          const newOnes = data.transactions.filter(t=>!ids.has(t.qbId)).map(t=>({...t,hasReceipt:false,receiptId:null,source:"quickbooks"}));
          return [...newOnes,...prev];
        });
        setLastSync(new Date().toLocaleString("en-US",{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"}));
        notify("Synced "+data.transactions.length+" transactions from QB");
      }
    } catch { notify("Sync failed","error"); }
    setSyncing(false);
  };

  const addTransaction = () => {
    if (!txForm.vendor||!txForm.amount||!txForm.date) { notify("Fill required fields","error"); return; }
    setTransactions(prev=>[{id:Date.now(),...txForm,amount:parseFloat(txForm.amount),hasReceipt:false,receiptId:null,source:"manual",createdAt:new Date().toISOString()},...prev]);
    setTxForm({vendor:"",amount:"",date:"",category:"Fuel",notes:""}); setShowAddTx(false); notify("Transaction added");
  };

  const submitReceipt = () => {
    if (!rxForm.vendor||!rxForm.amount||!rxForm.date||!rxForm.submitter) { notify("Fill required fields","error"); return; }
    const receipt = {id:Date.now(),...rxForm,amount:parseFloat(rxForm.amount),matched:false,matchedTxId:null,createdAt:new Date().toISOString()};
    let matchedId = null;
    const updatedTx = transactions.map(tx => {
      if (!tx.hasReceipt && tx.vendor.toLowerCase().trim()===rxForm.vendor.toLowerCase().trim() && Math.abs(tx.amount-parseFloat(rxForm.amount))<1.5) {
        matchedId = tx.id; return {...tx,hasReceipt:true,receiptId:receipt.id};
      }
      return tx;
    });
    if (matchedId) { receipt.matched=true; receipt.matchedTxId=matchedId; notify("Receipt submitted and auto-matched!"); }
    else notify("Submitted - will match when transaction is logged");
    setTransactions(updatedTx); setReceipts(prev=>[receipt,...prev]);
    setRxForm({vendor:"",amount:"",date:"",category:"Fuel",notes:"",submitter:"",fileName:"",fileData:null}); setShowRx(false);
  };

  const markReceived = (id) => { setTransactions(prev=>prev.map(tx=>tx.id===id?{...tx,hasReceipt:true}:tx)); notify("Marked as documented"); };
  const deleteTx = (id) => { setTransactions(prev=>prev.filter(tx=>tx.id!==id)); notify("Removed"); };

  const missing = transactions.filter(t=>!t.hasReceipt);
  const covered = transactions.filter(t=>t.hasReceipt);
  const totalSpend = transactions.reduce((s,t)=>s+t.amount,0);
  const missingSpend = missing.reduce((s,t)=>s+t.amount,0);
  const pct = transactions.length>0?Math.round((covered.length/transactions.length)*100):100;
  const filteredTx = filter==="missing"?missing:filter==="covered"?covered:transactions;

  return (
    <div style={{ background:"#f5f4f0",minHeight:"100vh",fontFamily:"Helvetica Neue,Helvetica,sans-serif",color:"#0f0f0f" }}>
      {toast && <div style={{ position:"fixed",top:18,right:18,zIndex:900,background:toast.type==="error"?"#dc2626":"#16a34a",color:"#fff",padding:"11px 18px",borderRadius:10,fontSize:13,fontWeight:600,boxShadow:"0 8px 28px rgba(0,0,0,.18)",maxWidth:300 }}>{toast.msg}</div>}
      <div style={{ background:"#fff",borderBottom:"1px solid #e4e2db",position:"sticky",top:0,zIndex:400 }}>
        <div style={{ maxWidth:1080,margin:"0 auto",padding:"0 24px",height:56,display:"flex",alignItems:"center",justifyContent:"space-between" }}>
          <div style={{ display:"flex",alignItems:"center",gap:10 }}>
            <div style={{ background:"#2a4de0",color:"#fff",borderRadius:7,padding:"3px 9px",fontWeight:900,fontSize:15 }}>str</div>
            <span style={{ color:"#7a7670",fontSize:13 }}>Receipt Manager</span>
          </div>
          <nav style={{ display:"flex",gap:2 }}>
            {[["dashboard","Dashboard"],["transactions","Transactions"],["receipts","Receipts"]].map(([t,label])=>(
              <button key={t} onClick={()=>setTab(t)} style={{ background:tab===t?"#eef1fd":"transparent",color:tab===t?"#2a4de0":"#7a7670",border:"none",borderRadius:8,padding:"6px 14px",fontSize:12,fontWeight:tab===t?700:500,cursor:"pointer" }}>{label}</button>
            ))}
          </nav>
        </div>
      </div>

      <div style={{ maxWidth:1080,margin:"0 auto",padding:"28px 24px" }}>
        <div style={{ background:qbAuth?"#f0fdf4":"#eef1fd",border:"1px solid "+(qbAuth?"#16a34a40":"#2a4de030"),borderRadius:12,padding:"14px 18px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap",marginBottom:24 }}>
          <div style={{ display:"flex",alignItems:"center",gap:10 }}>
            <div style={{ width:36,height:36,borderRadius:9,background:qbAuth?"#16a34a":"#2a4de0",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0,color:"#fff" }}>{qbAuth?"✓":"⚡"}</div>
            <div>
              <div style={{ fontWeight:800,fontSize:13 }}>{qbAuth?"Connected to "+(qbAuth.company_name||"QuickBooks"):"Connect QuickBooks Online"}</div>
              <div style={{ fontSize:11,color:"#7a7670",marginTop:2 }}>{qbAuth?"Last synced: "+(lastSync||"never"):"Authorize once - transactions appear automatically"}</div>
            </div>
          </div>
          <div style={{ display:"flex",gap:8 }}>
            {qbAuth ? (
              <React.Fragment>
                <button onClick={()=>fetchQBTransactions()} disabled={syncing} style={{ background:"#16a34a",color:"#fff",border:"none",borderRadius:8,padding:"7px 14px",fontSize:12,fontWeight:700,cursor:"pointer",opacity:syncing?0.7:1 }}>{syncing?"Syncing...":"↻ Sync Now"}</button>
                <button onClick={disconnectQB} style={{ background:"transparent",color:"#7a7670",border:"1px solid #e4e2db",borderRadius:8,padding:"7px 14px",fontSize:12,cursor:"pointer" }}>Disconnect</button>
              </React.Fragment>
            ) : (
              <button onClick={connectQB} style={{ background:"#2a4de0",color:"#fff",border:"none",borderRadius:8,padding:"9px 18px",fontSize:13,fontWeight:700,cursor:"pointer" }}>Connect QB →</button>
            )}
          </div>
        </div>

        {tab==="dashboard" && (
          <div>
            <h1 style={{ fontSize:22,fontWeight:900,margin:"0 0 4px",letterSpacing:-0.5 }}>Coverage Dashboard</h1>
            <p style={{ color:"#7a7670",fontSize:13,margin:"0 0 20px" }}>S-Tier Rentals - Expense documentation status</p>
            <div style={{ display:"flex",gap:10,marginBottom:20,flexWrap:"wrap" }}>
              <Stat icon="📋" label="Total Expenses" value={transactions.length} sub={"$"+totalSpend.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})+" logged"} />
              <Stat icon="⚠️" label="Missing Receipts" value={missing.length} accent={missing.length>0?"#dc2626":"#16a34a"} sub={missing.length>0?"$"+missingSpend.toFixed(2)+" undocumented":"All clear!"} />
              <Stat icon="✅" label="Coverage Rate" value={pct+"%"} accent={pct>=90?"#16a34a":pct>=70?"#d97706":"#dc2626"} sub={covered.length+" of "+transactions.length+" documented"} />
              <Stat icon="📸" label="Receipts Filed" value={receipts.length} sub={receipts.filter(r=>r.matched).length+" auto-matched"} />
            </div>
            {missing.length>0 && <div style={{ background:"#fef2f2",border:"1px solid #dc262630",borderRadius:12,padding:"14px 18px",marginBottom:20 }}><div style={{ fontWeight:800,fontSize:14,color:"#dc2626",marginBottom:4 }}>⚠️ {missing.length} transaction{missing.length!==1?"s":""} need receipts — {"$"+missingSpend.toFixed(2)} undocumented</div><div style={{ fontSize:12,color:"#7a7670" }}>Have your team submit receipts via the Receipts tab.</div></div>}
            {missing.length===0 && transactions.length>0 && <div style={{ background:"#f0fdf4",border:"1px solid #16a34a30",borderRadius:12,padding:"14px 18px",marginBottom:20 }}><div style={{ fontWeight:800,fontSize:14,color:"#16a34a" }}>✅ 100% documented!</div></div>}
            {missing.length>0 && (
              <div>
                <div style={{ fontSize:11,fontWeight:700,color:"#7a7670",letterSpacing:0.8,textTransform:"uppercase",marginBottom:10 }}>Needs Receipt</div>
                <div style={{ display:"flex",flexDirection:"column",gap:7 }}>
                  {missing.map(tx=>(
                    <div key={tx.id} style={{ background:"#fff",border:"1px solid #dc262630",borderRadius:10,padding:"13px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap" }}>
                      <div style={{ display:"flex",alignItems:"center",gap:10 }}>
                        <div style={{ width:8,height:8,borderRadius:"50%",background:"#dc2626",flexShrink:0 }} />
                        <div>
                          <div style={{ fontWeight:700,fontSize:14 }}>{tx.vendor} {tx.source==="quickbooks" && <Badge color="#2a4de0">QB</Badge>}</div>
                          <div style={{ fontSize:11,color:"#7a7670",marginTop:2 }}>{tx.date} · {tx.category}</div>
                        </div>
                      </div>
                      <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                        <span style={{ fontWeight:800,fontSize:15 }}>{"$"+tx.amount.toFixed(2)}</span>
                        <button onClick={()=>{setRxForm(f=>({...f,vendor:tx.vendor,amount:String(tx.amount),date:tx.date,category:tx.category}));setShowRx(true);}} style={{ background:"#2a4de0",color:"#fff",border:"none",borderRadius:7,padding:"6px 12px",fontSize:11,fontWeight:700,cursor:"pointer" }}>+ Receipt</button>
                        <button onClick={()=>markReceived(tx.id)} style={{ background:"#f0ede8",color:"#7a7670",border:"1px solid #e4e2db",borderRadius:7,padding:"6px 10px",fontSize:11,cursor:"pointer" }}>Mark Done</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {transactions.length===0 && <div style={{ textAlign:"center",padding:"60px 0",color:"#7a7670" }}><div style={{ fontSize:40,marginBottom:10 }}>📋</div><div style={{ fontSize:15,fontWeight:700,color:"#0f0f0f",marginBottom:6 }}>No transactions yet</div><div style={{ fontSize:13 }}>Connect QuickBooks above or add manually in Transactions</div></div>}
          </div>
        )}

        {tab==="transactions" && (
          <div>
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20,flexWrap:"wrap",gap:10 }}>
              <div><h1 style={{ fontSize:22,fontWeight:900,margin:"0 0 4px",letterSpacing:-0.5 }}>Transactions</h1><p style={{ color:"#7a7670",fontSize:13,margin:0 }}>QuickBooks expenses + receipt coverage</p></div>
              <Btn onClick={()=>setShowAddTx(true)}>+ Add Manually</Btn>
            </div>
            <div style={{ display:"flex",gap:6,marginBottom:18,flexWrap:"wrap" }}>
              <Pill active={filter==="all"} onClick={()=>setFilter("all")}>All ({transactions.length})</Pill>
              <Pill active={filter==="missing"} onClick={()=>setFilter("missing")}>⚠️ Missing ({missing.length})</Pill>
              <Pill active={filter==="covered"} onClick={()=>setFilter("covered")}>✅ Covered ({covered.length})</Pill>
            </div>
            {filteredTx.length===0 && <div style={{ textAlign:"center",padding:"48px 0",color:"#7a7670",fontSize:13 }}>Nothing here</div>}
            <div style={{ display:"flex",flexDirection:"column",gap:7 }}>
              {filteredTx.map(tx=>(
                <div key={tx.id} style={{ background:"#fff",border:"1px solid "+(tx.hasReceipt?"#e4e2db":"#dc262635"),borderRadius:10,padding:"13px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap" }}>
                  <div style={{ display:"flex",alignItems:"center",gap:10 }}>
                    <div style={{ width:8,height:8,borderRadius:"50%",background:tx.hasReceipt?"#16a34a":"#dc2626",flexShrink:0 }} />
                    <div>
                      <div style={{ fontWeight:700,fontSize:14 }}>{tx.vendor} {tx.source==="quickbooks" && <Badge color="#2a4de0">QB</Badge>}</div>
                      <div style={{ fontSize:11,color:"#7a7670",marginTop:2 }}>{tx.date} · <Badge>{tx.category}</Badge></div>
                    </div>
                  </div>
                  <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                    <Badge color={tx.hasReceipt?"#16a34a":"#dc2626"}>{tx.hasReceipt?"✓ Covered":"Missing"}</Badge>
                    <span style={{ fontWeight:800,fontSize:15 }}>{"$"+tx.amount.toFixed(2)}</span>
                    {!tx.hasReceipt && <button onClick={()=>markReceived(tx.id)} style={{ background:"#f0ede8",color:"#0f0f0f",border:"1px solid #e4e2db",borderRadius:7,padding:"5px 9px",fontSize:11,cursor:"pointer" }}>✓ Done</button>}
                    <button onClick={()=>deleteTx(tx.id)} style={{ background:"transparent",color:"#7a7670",border:"1px solid #e4e2db",borderRadius:7,padding:"5px 9px",fontSize:11,cursor:"pointer" }}>✕</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab==="receipts" && (
          <div>
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20,flexWrap:"wrap",gap:10 }}>
              <div><h1 style={{ fontSize:22,fontWeight:900,margin:"0 0 4px",letterSpacing:-0.5 }}>Submit Receipt</h1><p style={{ color:"#7a7670",fontSize:13,margin:0 }}>Team portal - replaces WhatsApp photos</p></div>
              <Btn onClick={()=>setShowRx(true)}>📷 New Receipt</Btn>
            </div>
            <div style={{ background:"#eef1fd",border:"1px solid #2a4de020",borderRadius:12,padding:"14px 18px",marginBottom:20,display:"flex",gap:24,flexWrap:"wrap" }}>
              {[["1","Snap receipt","Use phone camera"],["2","Fill details","Vendor, amount, date"],["3","Submit","Auto-matches to QB"]].map(([n,h,s])=>(
                <div key={n} style={{ display:"flex",alignItems:"center",gap:8 }}>
                  <div style={{ width:24,height:24,borderRadius:"50%",background:"#2a4de0",color:"#fff",fontSize:12,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>{n}</div>
                  <div><div style={{ fontWeight:700,fontSize:12 }}>{h}</div><div style={{ fontSize:11,color:"#7a7670" }}>{s}</div></div>
                </div>
              ))}
            </div>
            {receipts.length===0 && <div style={{ textAlign:"center",padding:"60px 0",color:"#7a7670" }}><div style={{ fontSize:40,marginBottom:10 }}>📸</div><div style={{ fontSize:15,fontWeight:700,color:"#0f0f0f",marginBottom:5 }}>No receipts yet</div><div style={{ fontSize:13 }}>Share this page with Ahmed and Suhaib</div></div>}
            <div style={{ display:"flex",flexDirection:"column",gap:7 }}>
              {receipts.map(rx=>(
                <div key={rx.id} style={{ background:"#fff",border:"1px solid "+(rx.matched?"#16a34a30":"#d9770640"),borderRadius:10,padding:"13px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap" }}>
                  <div style={{ display:"flex",alignItems:"center",gap:10 }}>
                    <span style={{ fontSize:22 }}>🧾</span>
                    <div>
                      <div style={{ fontWeight:700,fontSize:14 }}>{rx.vendor}</div>
                      <div style={{ fontSize:11,color:"#7a7670",marginTop:2 }}>{rx.date} · {rx.category} · {rx.submitter}</div>
                      {rx.fileName && <div style={{ fontSize:11,color:"#2a4de0",marginTop:3 }}>📎 {rx.fileName}</div>}
                    </div>
                  </div>
                  <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                    <Badge color={rx.matched?"#16a34a":"#d97706"}>{rx.matched?"✓ Matched to QB":"Pending match"}</Badge>
                    <span style={{ fontWeight:800,fontSize:15 }}>{"$"+rx.amount.toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {showAddTx && (
        <Modal title="Add Transaction" subtitle="Manual entry - or use QB sync above" onClose={()=>setShowAddTx(false)}>
          <div style={{ display:"flex",flexDirection:"column",gap:14 }}>
            <div><label style={lbl}>Vendor *</label><input style={inp} placeholder="Shell, AutoZone..." value={txForm.vendor} onChange={e=>setTxForm({...txForm,vendor:e.target.value})} /></div>
            <div style={{ display:"flex",gap:10 }}>
              <div style={{ flex:1 }}><label style={lbl}>Amount *</label><input style={inp} type="number" placeholder="0.00" value={txForm.amount} onChange={e=>setTxForm({...txForm,amount:e.target.value})} /></div>
              <div style={{ flex:1 }}><label style={lbl}>Date *</label><input style={inp} type="date" value={txForm.date} onChange={e=>setTxForm({...txForm,date:e.target.value})} /></div>
            </div>
            <div><label style={lbl}>Category</label><select style={inp} value={txForm.category} onChange={e=>setTxForm({...txForm,category:e.target.value})}>{CATEGORIES.map(c=><option key={c}>{c}</option>)}</select></div>
            <div><label style={lbl}>Notes</label><input style={inp} placeholder="Optional" value={txForm.notes} onChange={e=>setTxForm({...txForm,notes:e.target.value})} /></div>
          </div>
          <div style={{ display:"flex",gap:8,marginTop:20 }}>
            <Btn variant="ghost" onClick={()=>setShowAddTx(false)} style={{ flex:1 }}>Cancel</Btn>
            <Btn onClick={addTransaction} style={{ flex:2 }}>Add Transaction</Btn>
          </div>
        </Modal>
      )}

      {showRx && (
        <Modal title="Submit Receipt" subtitle="Fill this out instead of sending to WhatsApp" onClose={()=>setShowRx(false)}>
          <div style={{ display:"flex",flexDirection:"column",gap:14 }}>
            <div><label style={lbl}>Your Name *</label>
              <select style={inp} value={rxForm.submitter} onChange={e=>setRxForm({...rxForm,submitter:e.target.value})}>
                <option value="">Select...</option>
                {TEAM.map(t=><option key={t}>{t}</option>)}
              </select>
            </div>
            <div><label style={lbl}>Vendor *</label><input style={inp} placeholder="Where was the expense?" value={rxForm.vendor} onChange={e=>setRxForm({...rxForm,vendor:e.target.value})} /></div>
            <div style={{ display:"flex",gap:10 }}>
              <div style={{ flex:1 }}><label style={lbl}>Amount *</label><input style={inp} type="number" placeholder="0.00" value={rxForm.amount} onChange={e=>setRxForm({...rxForm,amount:e.target.value})} /></div>
              <div style={{ flex:1 }}><label style={lbl}>Date *</label><input style={inp} type="date" value={rxForm.date} onChange={e=>setRxForm({...rxForm,date:e.target.value})} /></div>
            </div>
            <div><label style={lbl}>Category</label><select style={inp} value={rxForm.category} onChange={e=>setRxForm({...rxForm,category:e.target.value})}>{CATEGORIES.map(c=><option key={c}>{c}</option>)}</select></div>
            <div>
              <label style={lbl}>Receipt Photo 📷</label>
              <label style={{ ...inp,cursor:"pointer",display:"flex",alignItems:"center",gap:10,color:rxForm.fileName?"#0f0f0f":"#7a7670",background:"#f0ede8" }}>
                <span style={{ fontSize:20 }}>📎</span>
                <span style={{ fontSize:13 }}>{rxForm.fileName||"Tap to take photo or attach file"}</span>
                <input type="file" accept="image/*,application/pdf" capture="environment" style={{ display:"none" }} onChange={e=>{ const f=e.target.files[0]; if(f){ const r=new FileReader(); r.onload=ev=>setRxForm(prev=>({...prev,fileName:f.name,fileData:ev.target.result})); r.readAsDataURL(f); }}} />
              </label>
              {rxForm.fileData && rxForm.fileData.startsWith("data:image") && <img src={rxForm.fileData} alt="preview" style={{ width:"100%",borderRadius:8,marginTop:8,maxHeight:160,objectFit:"cover",border:"1px solid #e4e2db" }} />}
            </div>
            <div><label style={lbl}>Notes</label><input style={inp} placeholder="What was this for?" value={rxForm.notes} onChange={e=>setRxForm({...rxForm,notes:e.target.value})} /></div>
          </div>
          <div style={{ display:"flex",gap:8,marginTop:20 }}>
            <Btn variant="ghost" onClick={()=>setShowRx(false)} style={{ flex:1 }}>Cancel</Btn>
            <Btn onClick={submitReceipt} style={{ flex:2 }}>Submit Receipt</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
                                                                                                                                                      }
