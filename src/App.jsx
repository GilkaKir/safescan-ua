import { useState, useRef, useCallback, useEffect } from "react";

/* ── palette ── */
const C = {
  bg:"#08090c", surf:"#0f1117", card:"#13161e", border:"#1e2330",
  blue:"#3b82f6", text:"#e2e8f0", muted:"#64748b",
  green:"#22c55e", amber:"#f59e0b", red:"#ef4444", purple:"#a78bfa",
};

/* ── criteria catalogue ── */
const CRITERIA = [
  {key:"naturalness",  icon:"🌿", label:"Натуральність складу",    desc:"Штучні інгредієнти",       group:"safety"},
  {key:"preservatives",icon:"🧪", label:"Консерванти та Е-добавки", desc:"E-коди, небезпека",         group:"safety"},
  {key:"allergens",    icon:"⚠️", label:"Алергени",                desc:"Глютен, лактоза, горіхи",   group:"safety"},
  {key:"sugar",        icon:"🍬", label:"Цукор та замінники",       desc:"Прихований цукор",          group:"safety"},
  {key:"palmOil",      icon:"🌴", label:"Пальмова олія",            desc:"Наявність та тип",          group:"safety"},
  {key:"transFats",    icon:"💧", label:"Трансжири",                desc:"Гідрогенізовані олії",      group:"safety"},
  {key:"salt",         icon:"🧂", label:"Сіль та натрій",           desc:"% від денної норми",        group:"safety"},
  {key:"microplastic", icon:"🔬", label:"Ризик мікропластику",      desc:"Матеріал упаковки",         group:"safety"},
  {key:"reputation",   icon:"🏭", label:"Репутація виробника",      desc:"Відомі факти",              group:"producer"},
  {key:"gmo",          icon:"🧬", label:"ГМО-статус",               desc:"Маркування, сировина",      group:"producer"},
  {key:"dstu",         icon:"📋", label:"Відповідність ДСТУ",       desc:"Держстандарти",             group:"producer"},
  {key:"origin",       icon:"🌍", label:"Походження сировини",      desc:"Локальна чи імпортна",      group:"producer"},
  {key:"nova",         icon:"🔄", label:"Ступінь переробки NOVA",   desc:"Клас 1–4",                  group:"extra"},
  {key:"ecology",      icon:"♻️", label:"Екологічний слід",         desc:"Упаковка, переробка",       group:"extra"},
  {key:"russianLinks", icon:"🚫", label:"Зв'язки з РФ",             desc:"Санкційні списки",          group:"extra"},
  {key:"priceQuality", icon:"💰", label:"Ціна vs Якість",           desc:"Чи виправдана ціна",        group:"extra"},
];
const GROUPS = {
  safety:   {label:"Безпека складу",       color:C.red},
  producer: {label:"Виробник і стандарти", color:C.amber},
  extra:    {label:"Додаткові критерії",   color:C.purple},
};
const DEFAULT_ON = new Set(["naturalness","preservatives","allergens","transFats","salt","russianLinks"]);
const VERDICTS = {
  buy:     {label:"КУПУЙТЕ",    icon:"✓", col:C.green,  bg:"#052e16", br:"#166534"},
  consider:{label:"ОБМІРКУЙТЕ",icon:"~", col:C.amber,  bg:"#1c1500", br:"#854d0e"},
  avoid:   {label:"УНИКАЙТЕ",  icon:"✕", col:C.red,    bg:"#1c0202", br:"#991b1b"},
};

/* ── build prompt from active criteria ── */
function makePrompt(keys) {
  const keyList = CRITERIA.filter(c => keys.has(c.key)).map(c => `${c.key}(${c.label})`).join(", ");
  return `Ти експерт з харчової безпеки. Уважно розглянь фото товару.
Використай web_search щоб знайти 2-3 реальні кращі альтернативи цього товару доступні в українських магазинах (Сільпо, АТБ, Фора, Rozetka). Для кожної альтернативи вкажи бренд, назву і чому вона краща.
Поверни ТІЛЬКИ JSON без зайвого тексту:
{"name":"","brand":"","maker":"","category":"","verdict":"buy|consider|avoid","verdictText":"","score":0-100,"allergenRisk":true/false,"impact":{"short":"","long":"","groups":[]},"criteria":{"КЛЮЧ":{"score":0-100,"level":"good|medium|bad","title":"","summary":"","details":[""],"impact":""}},"tip":"","alts":[{"brand":"","name":"","reason":"","available":"магазин"}]}
Заповни criteria для: ${keyList}.
Якщо не їжа або не видно етикетку: {"error":true,"msg":""}`;
}

/* ── helpers ── */
const lvlCol = l => l==="good"?C.green:l==="medium"?C.amber:l==="bad"?C.red:C.muted;
const lvlBg  = l => l==="good"?"#052e16":l==="medium"?"#1c1500":"#1c0202";
const lvlTxt = l => l==="good"?"ДОБРЕ":l==="medium"?"СЕРЕДНЄ":"ПОГАНО";
const sByCol = s => s>=70?C.green:s>=40?C.amber:C.red;

function Ring({score, size=64}) {
  const r=size/2-5, c=2*Math.PI*r, off=c-(score/100)*c, col=sByCol(score);
  return (
    <svg width={size} height={size} style={{flexShrink:0}}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={C.border} strokeWidth={4}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={col} strokeWidth={4}
        strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`}/>
      <text x={size/2} y={size/2+5} textAnchor="middle" fontSize={14}
        fontWeight="700" fill={col} fontFamily="monospace">{score}</text>
    </svg>
  );
}

function Bar({score}) {
  return (
    <div style={{flex:1, height:4, borderRadius:2, background:C.border}}>
      <div style={{width:`${score}%`, height:"100%", borderRadius:2, background:sByCol(score)}}/>
    </div>
  );
}

function CriterionCard({data, icon}) {
  const [open, setOpen] = useState(false);
  if (!data) return null;
  const col = lvlCol(data.level), bg = lvlBg(data.level);
  return (
    <div style={{borderRadius:10, border:`1px solid ${C.border}`, overflow:"hidden", background:C.card, marginBottom:8}}>
      <div onClick={() => setOpen(!open)}
        style={{display:"flex", alignItems:"center", gap:10, padding:"12px 14px", cursor:"pointer"}}>
        <span style={{fontSize:18, flexShrink:0}}>{icon}</span>
        <div style={{flex:1, minWidth:0}}>
          <div style={{fontSize:12, fontWeight:700, color:C.text, marginBottom:4}}>{data.title}</div>
          <div style={{display:"flex", alignItems:"center", gap:8}}>
            <Bar score={data.score}/>
            <span style={{fontSize:10, color:col, fontFamily:"monospace", fontWeight:700}}>{data.score}</span>
          </div>
        </div>
        <div style={{padding:"2px 7px", borderRadius:5, fontSize:9, fontWeight:800, letterSpacing:1,
          color:col, background:bg, border:`1px solid ${col}30`, flexShrink:0}}>{lvlTxt(data.level)}</div>
        <span style={{color:C.muted, fontSize:12}}>{open ? "▲" : "▼"}</span>
      </div>
      {open && (
        <div style={{borderTop:`1px solid ${C.border}`, padding:"12px 14px", background:C.surf}}>
          <p style={{margin:"0 0 10px", fontSize:12, color:C.text, lineHeight:1.6}}>{data.summary}</p>
          {(data.details||[]).map((d,i) => (
            <div key={i} style={{display:"flex", gap:8, fontSize:11, color:C.muted, marginBottom:5, lineHeight:1.5}}>
              <span style={{color:col, flexShrink:0}}>›</span><span>{d}</span>
            </div>
          ))}
          {data.impact && (
            <div style={{marginTop:10, padding:10, borderRadius:8,
              background:`${C.purple}10`, border:`1px solid ${C.purple}25`}}>
              <div style={{fontSize:10, color:C.purple, fontWeight:700, marginBottom:4}}>🫀 Вплив на організм</div>
              <p style={{margin:0, fontSize:11, color:C.text, lineHeight:1.6}}>{data.impact}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Loading animation ── */
function Loader({step, total, label}) {
  const pct = Math.round(((step+1)/total)*100);
  return (
    <div style={{flex:1, display:"flex", flexDirection:"column", alignItems:"center",
      justifyContent:"center", padding:"32px 24px", gap:24}}>
      <style>{`
        @keyframes swing{0%,100%{transform:rotate(-15deg)}50%{transform:rotate(15deg)}}
        @keyframes bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
        @keyframes blink{0%,85%,100%{scaleY:1}92%{transform:scaleY(0.1)}}
        @keyframes scan{0%{top:5%}100%{top:90%}}
        @keyframes glow{0%,100%{opacity:0.6}50%{opacity:1}}
      `}</style>

      {/* character */}
      <div style={{position:"relative", width:140, height:170, animation:"bob 2s ease-in-out infinite"}}>
        {/* legs */}
        <div style={{position:"absolute", bottom:0, left:"50%", transform:"translateX(-50%)",
          display:"flex", gap:10}}>
          <div style={{width:8, height:24, background:"#1e3a5f", borderRadius:"0 0 4px 4px",
            transform:"rotate(-6deg)", transformOrigin:"top"}}/>
          <div style={{width:8, height:24, background:"#1e3a5f", borderRadius:"0 0 4px 4px",
            transform:"rotate(6deg)", transformOrigin:"top"}}/>
        </div>
        {/* torso */}
        <div style={{position:"absolute", bottom:22, left:"50%", transform:"translateX(-50%)",
          width:44, height:42, background:"linear-gradient(135deg,#1e40af,#1e3a5f)",
          borderRadius:"12px 12px 8px 8px"}}>
          <div style={{position:"absolute", top:9, left:"50%", transform:"translateX(-50%)",
            width:20, height:13, borderRadius:3, background:"#22c55e",
            display:"flex", alignItems:"center", justifyContent:"center",
            fontSize:8, color:"#fff", fontWeight:900}}>UA</div>
        </div>
        {/* head */}
        <div style={{position:"absolute", bottom:60, left:"50%", transform:"translateX(-50%)",
          width:38, height:36, background:"#fde68a",
          borderRadius:"50% 50% 40% 40%"}}>
          <div style={{position:"absolute", top:10, left:6, display:"flex", gap:8}}>
            <div style={{width:8, height:8, borderRadius:"50%", background:"#1e3a5f"}}/>
            <div style={{width:8, height:8, borderRadius:"50%", background:"#1e3a5f"}}/>
          </div>
          <div style={{position:"absolute", bottom:7, left:"50%", transform:"translateX(-50%)",
            width: pct>66 ? 14 : 8, height: pct>66 ? 6 : 4,
            borderBottom:"2px solid #92400e", borderRadius:"0 0 50% 50%",
            transition:"all 0.5s"}}/>
        </div>
        {/* arm + magnifier */}
        <div style={{position:"absolute", bottom:58, right:-30,
          animation:"swing 2s ease-in-out infinite"}}>
          <div style={{width:28, height:5, background:"#1e3a5f", borderRadius:3,
            transform:"rotate(-15deg)", transformOrigin:"left"}}/>
          <div style={{position:"absolute", right:-2, top:-4,
            width:5, height:26, background:"#92400e", borderRadius:3,
            transform:"rotate(30deg)", transformOrigin:"top"}}/>
          <div style={{position:"absolute", right:-4, top:-30,
            width:34, height:34, borderRadius:"50%",
            border:"4px solid #60a5fa",
            background:"rgba(96,165,250,0.06)",
            overflow:"hidden"}}>
            <div style={{position:"absolute", left:0, right:0, height:2,
              background:"linear-gradient(90deg,transparent,#22c55e,transparent)",
              animation:"scan 1.2s ease-in-out infinite"}}/>
          </div>
        </div>
        {/* glow */}
        <div style={{position:"absolute", bottom:-6, left:"50%", transform:"translateX(-50%)",
          width:70, height:14, borderRadius:"50%",
          background:"radial-gradient(ellipse,#3b82f630,transparent 70%)",
          animation:"glow 2s ease-in-out infinite"}}/>
      </div>

      {/* label */}
      <div style={{textAlign:"center"}}>
        <div style={{fontSize:15, fontWeight:700, color:C.text, marginBottom:4}}>{label}</div>
        <div style={{fontSize:12, color:C.muted}}>зачекайте кілька секунд</div>
      </div>

      {/* progress bar */}
      <div style={{width:"100%", maxWidth:280}}>
        <div style={{display:"flex", justifyContent:"space-between", marginBottom:6}}>
          <span style={{fontSize:11, color:C.muted}}>Прогрес</span>
          <span style={{fontSize:12, fontWeight:700, color:C.blue, fontFamily:"monospace"}}>{pct}%</span>
        </div>
        <div style={{height:8, borderRadius:4, background:C.border, overflow:"hidden"}}>
          <div style={{height:"100%", borderRadius:4, width:`${pct}%`,
            background:"linear-gradient(90deg,#3b82f6,#22c55e)",
            transition:"width 0.8s cubic-bezier(0.4,0,0.2,1)"}}/>
        </div>
      </div>
    </div>
  );
}

/* ── Photo slot ── */
function PhotoSlot({src, label, onChange, onRemove}) {
  const [drag, setDrag] = useState(false);
  const galleryId = label.replace(/\s/g,"_") + "_gallery";
  const cameraId  = label.replace(/\s/g,"_") + "_camera";

  const handleDrop = e => {
    e.preventDefault(); setDrag(false);
    const file = e.dataTransfer?.files?.[0];
    if (file?.type.startsWith("image/")) onChange(file);
  };
  const handleChange = e => {
    const f = e.target.files?.[0];
    if (f) { onChange(f); e.target.value=""; }
  };

  return (
    <div style={{flex:1}}>
      <div style={{fontSize:10, color:C.muted, letterSpacing:1,
        textTransform:"uppercase", marginBottom:6, fontWeight:700}}>{label}</div>

      {src ? (
        <div style={{position:"relative", borderRadius:10, overflow:"hidden",
          border:`1px solid ${C.green}50`}}>
          <img src={src} alt={label}
            style={{width:"100%", aspectRatio:"1", objectFit:"cover", display:"block"}}/>
          <button onClick={onRemove}
            style={{position:"absolute", top:6, right:6, width:28, height:28,
              borderRadius:"50%", background:"rgba(0,0,0,0.75)", border:"none",
              color:"#fff", fontSize:15, cursor:"pointer", display:"flex",
              alignItems:"center", justifyContent:"center"}}>✕</button>
          <div style={{position:"absolute", bottom:0, left:0, right:0, padding:"6px 8px",
            background:"linear-gradient(transparent,rgba(0,0,0,0.65))",
            fontSize:9, color:"rgba(255,255,255,0.8)"}}>✓ Завантажено</div>
        </div>
      ) : (
        <div
          onDragOver={e=>{e.preventDefault(); setDrag(true);}}
          onDragLeave={()=>setDrag(false)}
          onDrop={handleDrop}
          style={{borderRadius:10, border:`2px dashed ${drag?C.blue:C.border}`,
            background:drag?`${C.blue}10`:C.card, padding:"12px 8px",
            display:"flex", flexDirection:"column", alignItems:"center", gap:8}}>

          <div style={{fontSize:22, opacity:0.35}}>📷</div>

          {/* Камера — використовуємо htmlFor для надійності */}
          <label htmlFor={cameraId} style={{width:"100%", cursor:"pointer", display:"block"}}>
            <div style={{padding:"9px 0", borderRadius:8, textAlign:"center",
              background:C.blue, color:"#fff", fontSize:12, fontWeight:700,
              userSelect:"none"}}>
              📷 Камера
            </div>
          </label>
          <input
            id={cameraId}
            type="file"
            accept="image/*"
            capture="environment"
            style={{position:"fixed", top:"-100px", opacity:0, width:"1px", height:"1px"}}
            onChange={handleChange}
          />

          {/* Галерея */}
          <label htmlFor={galleryId} style={{width:"100%", cursor:"pointer", display:"block"}}>
            <div style={{padding:"9px 0", borderRadius:8, textAlign:"center",
              border:`1px solid ${C.border}`, background:C.surf,
              color:C.text, fontSize:12, fontWeight:700, userSelect:"none"}}>
              🖼 Галерея
            </div>
          </label>
          <input
            id={galleryId}
            type="file"
            accept="image/*"
            style={{position:"fixed", top:"-100px", opacity:0, width:"1px", height:"1px"}}
            onChange={handleChange}
          />

          <div style={{fontSize:9, color:C.muted}}>або перетягніть фото</div>
        </div>
      )}
    </div>
  );
}

/* ── Profile screen ── */
function ProfileScreen({enabled, onSave, onBack}) {
  const [local, setLocal] = useState(new Set(enabled));
  const toggle = k => {
    const n = new Set(local);
    n.has(k) ? n.delete(k) : n.add(k);
    setLocal(n);
  };
  const cnt = local.size;
  const speed = cnt<=3?"⚡ Дуже швидко":cnt<=6?"🚀 Швидко":cnt<=10?"⏱ Середньо":"🐢 Повільно";

  return (
    <Shell>
      <TopBar
        title="Профіль аналізу"
        sub="Обери критерії що важливі тобі"
        onBack={onBack}
        right={
          <button onClick={() => onSave(local)} style={{padding:"7px 14px", borderRadius:8,
            border:"none", background:C.blue, color:"#fff", fontSize:13, fontWeight:700,
            cursor:"pointer"}}>Зберегти</button>
        }
      />
      <div style={{flex:1, overflowY:"auto", padding:"14px 14px 32px"}}>
        {/* speed indicator */}
        <div style={{padding:"12px 14px", borderRadius:10, background:C.card,
          border:`1px solid ${C.border}`, marginBottom:16, display:"flex", alignItems:"center", gap:12}}>
          <div style={{flex:1}}>
            <div style={{fontSize:12, fontWeight:700, color:C.text, marginBottom:4}}>
              Обрано: <span style={{color:C.blue}}>{cnt}</span> з {CRITERIA.length}
            </div>
            <div style={{height:5, borderRadius:3, background:C.border, overflow:"hidden"}}>
              <div style={{width:`${cnt/CRITERIA.length*100}%`, height:"100%",
                background:cnt<=4?C.green:cnt<=8?C.amber:C.red, transition:"width 0.3s",
                borderRadius:3}}/>
            </div>
          </div>
          <span style={{fontSize:11, color:C.muted, flexShrink:0}}>{speed}</span>
        </div>

        {/* presets */}
        <div style={{marginBottom:16}}>
          <div style={{fontSize:10, color:C.muted, letterSpacing:2, textTransform:"uppercase",
            marginBottom:8}}>Пресети</div>
          <div style={{display:"flex", gap:8, flexWrap:"wrap"}}>
            {[
              {l:"⚡ Мінімум", k:["naturalness","preservatives","allergens"]},
              {l:"🎯 Базовий",  k:["naturalness","preservatives","allergens","transFats","salt","russianLinks"]},
              {l:"🔬 Повний",   k:CRITERIA.map(c=>c.key)},
            ].map(p => (
              <button key={p.l} onClick={() => setLocal(new Set(p.k))}
                style={{padding:"7px 14px", borderRadius:8, border:`1px solid ${C.border}`,
                  background:C.card, color:C.text, fontSize:12, cursor:"pointer",
                  fontWeight:600}}>{p.l}</button>
            ))}
          </div>
        </div>

        {/* criteria list by group */}
        {["safety","producer","extra"].map(gid => (
          <div key={gid} style={{marginBottom:18}}>
            <div style={{display:"flex", alignItems:"center", gap:8, marginBottom:10}}>
              <div style={{fontSize:10, fontWeight:800, color:GROUPS[gid].color,
                letterSpacing:1.5, textTransform:"uppercase"}}>{GROUPS[gid].label}</div>
              <div style={{flex:1, height:1, background:C.border}}/>
            </div>
            {CRITERIA.filter(c => c.group===gid).map(c => {
              const on = local.has(c.key);
              const gc = GROUPS[c.group].color;
              return (
                <div key={c.key} onClick={() => toggle(c.key)}
                  style={{display:"flex", alignItems:"center", gap:12, padding:"12px 14px",
                    borderRadius:10, marginBottom:8, cursor:"pointer",
                    background:on?`${gc}0d`:C.card,
                    border:`1px solid ${on?gc+"40":C.border}`,
                    transition:"all 0.15s"}}>
                  <span style={{fontSize:20, flexShrink:0}}>{c.icon}</span>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13, fontWeight:700,
                      color:on?C.text:C.muted, marginBottom:2}}>{c.label}</div>
                    <div style={{fontSize:11, color:C.muted}}>{c.desc}</div>
                  </div>
                  <div style={{width:40, height:22, borderRadius:11,
                    background:on?C.blue:"#1e2330",
                    border:`1px solid ${on?C.blue:C.border}`,
                    position:"relative", transition:"background 0.2s", flexShrink:0}}>
                    <div style={{position:"absolute", top:3,
                      left:on?20:3, width:16, height:16, borderRadius:"50%",
                      background:on?"#fff":C.muted, transition:"left 0.2s"}}/>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </Shell>
  );
}


/* ══════════════════════════════════════════
   AUTH FLOW
══════════════════════════════════════════ */

const SCAN_PREFS = [
  {key:"food",      icon:"🥗", label:"Продукти харчування"},
  {key:"chemistry", icon:"🧴", label:"Побутова хімія"},
  {key:"calories",  icon:"🔥", label:"Калорії та БЖВ"},
  {key:"cosmetics", icon:"💄", label:"Косметика"},
  {key:"baby",      icon:"👶", label:"Дитячі товари"},
  {key:"sport",     icon:"💪", label:"Спортивне харчування"},
  {key:"eco",       icon:"🌿", label:"Еко-товари"},
  {key:"alcohol",   icon:"🍷", label:"Алкоголь"},
];

/* ── Welcome screen ── */
function WelcomeScreen({onLogin, onRegister}) {
  return (
    <Shell>
      <div style={{flex:1, display:"flex", flexDirection:"column",
        alignItems:"center", justifyContent:"space-between",
        padding:"48px 24px 40px"}}>

        {/* Logo */}
        <div style={{flex:1, display:"flex", flexDirection:"column",
          alignItems:"center", justifyContent:"center", gap:20}}>
          <div style={{width:90, height:90, borderRadius:24,
            background:`linear-gradient(135deg,#1e40af,#1e3a5f)`,
            border:`2px solid ${C.blue}40`,
            display:"flex", alignItems:"center", justifyContent:"center",
            fontSize:42, boxShadow:`0 0 40px ${C.blue}20`}}>🛡</div>
          <div style={{textAlign:"center"}}>
            <div style={{fontSize:28, fontWeight:900, color:C.text,
              letterSpacing:"-0.5px"}}>SafeScan<span style={{color:C.blue}}>UA</span></div>
            <div style={{fontSize:13, color:C.muted, marginTop:6, lineHeight:1.6}}>
              Скануй. Аналізуй. Купуй свідомо.
            </div>
          </div>

          {/* Features */}
          <div style={{display:"flex", flexDirection:"column", gap:10,
            width:"100%", maxWidth:300, marginTop:12}}>
            {[
              ["🔍","Аналіз складу та Е-добавок"],
              ["⚠️","Перевірка алергенів"],
              ["🚫","Зв'язки виробника з РФ"],
              ["✓","Реальні альтернативи в магазинах UA"],
            ].map(([ic,tx]) => (
              <div key={tx} style={{display:"flex", alignItems:"center", gap:10,
                padding:"10px 14px", borderRadius:10,
                background:C.card, border:`1px solid ${C.border}`}}>
                <span style={{fontSize:16}}>{ic}</span>
                <span style={{fontSize:12, color:C.text}}>{tx}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Buttons */}
        <div style={{width:"100%", display:"flex", flexDirection:"column", gap:10}}>
          <BtnPrimary onClick={onRegister}>Створити акаунт</BtnPrimary>
          <BtnSecondary onClick={onLogin}>Вже є акаунт — Увійти</BtnSecondary>
          <div style={{fontSize:10, color:C.muted, textAlign:"center", marginTop:4}}>
            Реєструючись ви погоджуєтесь з умовами використання
          </div>
        </div>
      </div>
    </Shell>
  );
}

/* ── Email step ── */
function EmailStep({onNext, onBack, title}) {
  const [email, setEmail] = useState("");
  const [err, setErr] = useState("");
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const next = () => {
    if (!valid) { setErr("Введіть коректний email"); return; }
    onNext(email);
  };

  return (
    <Shell>
      <TopBar title={title} sub="Крок 1 з 3" onBack={onBack}/>
      <div style={{flex:1, display:"flex", flexDirection:"column",
        padding:"32px 24px", gap:20}}>
        <div>
          <div style={{fontSize:20, fontWeight:800, color:C.text, marginBottom:6}}>{title}</div>
          <div style={{fontSize:13, color:C.muted, lineHeight:1.6}}>
            Введіть email — надішлемо код підтвердження
          </div>
        </div>
        <div>
          <div style={{fontSize:11, color:C.muted, letterSpacing:1,
            textTransform:"uppercase", marginBottom:8}}>Email *</div>
          <input
            type="email"
            value={email}
            placeholder="your@email.com"
            onChange={e => { setEmail(e.target.value); setErr(""); }}
            onKeyDown={e => e.key==="Enter" && next()}
            style={{width:"100%", padding:"13px 14px", borderRadius:10, fontSize:14,
              border:`1px solid ${err?C.red:email?C.blue:C.border}`,
              background:C.card, color:C.text, outline:"none",
              boxSizing:"border-box", transition:"border 0.2s"}}
          />
          {err && <div style={{fontSize:11, color:C.red, marginTop:5}}>{err}</div>}
        </div>
        <div style={{marginTop:"auto"}}>
          <BtnPrimary onClick={next}>Отримати код →</BtnPrimary>
        </div>
      </div>
    </Shell>
  );
}

/* ── OTP step ── */
function OtpStep({email, onNext, onBack}) {
  const [otp, setOtp] = useState(["","","","","",""]);
  const [err, setErr] = useState("");
  const [resent, setResent] = useState(false);
  const refs = Array(6).fill(0).map(() => useRef(null));
  // В продакшні тут буде реальний OTP. Для демо: 123456
  const DEMO_OTP = "123456";

  const handleKey = (i, val) => {
    if (!/^\d?$/.test(val)) return;
    const next = [...otp];
    next[i] = val;
    setOtp(next);
    setErr("");
    if (val && i < 5) refs[i+1].current?.focus();
    if (!val && i > 0) refs[i-1].current?.focus();
  };

  const verify = () => {
    const code = otp.join("");
    if (code.length < 6) { setErr("Введіть всі 6 цифр"); return; }
    if (code !== DEMO_OTP) { setErr("Невірний код. Демо-код: 123456"); return; }
    onNext();
  };

  return (
    <Shell>
      <TopBar title="Підтвердження" sub="Крок 2 з 3" onBack={onBack}/>
      <div style={{flex:1, display:"flex", flexDirection:"column", padding:"32px 24px", gap:24}}>
        <div>
          <div style={{fontSize:20, fontWeight:800, color:C.text, marginBottom:6}}>
            Введіть код
          </div>
          <div style={{fontSize:13, color:C.muted, lineHeight:1.6}}>
            Надіслали 6-значний код на <strong style={{color:C.text}}>{email}</strong>
          </div>
          <div style={{fontSize:11, color:C.blue, marginTop:4}}>
            (Демо-режим: використайте код <strong>123456</strong>)
          </div>
        </div>

        {/* OTP inputs */}
        <div style={{display:"flex", gap:8, justifyContent:"center"}}>
          {otp.map((d,i) => (
            <input key={i} ref={refs[i]}
              type="tel" maxLength={1} value={d}
              onChange={e => handleKey(i, e.target.value)}
              onKeyDown={e => e.key==="Backspace" && !d && i>0 && refs[i-1].current?.focus()}
              style={{width:44, height:52, textAlign:"center", fontSize:20, fontWeight:700,
                borderRadius:10, border:`1px solid ${err?C.red:d?C.blue:C.border}`,
                background:C.card, color:C.text, outline:"none",
                transition:"border 0.2s"}}
            />
          ))}
        </div>
        {err && <div style={{fontSize:11, color:C.red, textAlign:"center"}}>{err}</div>}

        {/* Resend */}
        <div style={{textAlign:"center"}}>
          {resent
            ? <span style={{fontSize:11, color:C.green}}>✓ Код надіслано повторно</span>
            : <span onClick={() => setResent(true)}
                style={{fontSize:11, color:C.blue, cursor:"pointer", textDecoration:"underline"}}>
                Надіслати повторно
              </span>
          }
        </div>

        <div style={{marginTop:"auto"}}>
          <BtnPrimary onClick={verify}>Підтвердити →</BtnPrimary>
        </div>
      </div>
    </Shell>
  );
}

/* ── ProfileField — визначено ПОЗА ProfileStep щоб не перестворювалось ── */
function ProfileField({label, required, error, children}) {
  return (
    <div style={{marginBottom:14}}>
      <div style={{fontSize:11, color:error?C.red:C.muted, letterSpacing:1,
        textTransform:"uppercase", marginBottom:6, fontWeight:700}}>
        {label}{required && <span style={{color:C.red}}> *</span>}
      </div>
      {children}
      {error && <div style={{fontSize:11, color:C.red, marginTop:4}}>{error}</div>}
    </div>
  );
}

const profileInputStyle = (hasErr) => ({
  width:"100%", padding:"11px 14px", borderRadius:10, fontSize:13,
  border:`1px solid ${hasErr?C.red:C.border}`, background:C.card,
  color:C.text, outline:"none", boxSizing:"border-box",
});

/* ── Profile step ── */
function ProfileStep({onNext, onBack}) {
  // використовуємо refs для текстових полів — уникаємо проблем з фокусом
  const nameRef     = useRef(null);
  const surnameRef  = useRef(null);
  const birthRef    = useRef(null);
  const phoneRef    = useRef(null);
  const cityRef     = useRef(null);

  const [gender, setGender]       = useState("");
  const [prefs, setPrefs]         = useState(new Set(["food"]));
  const [locationOk, setLocationOk] = useState(false);
  const [err, setErr]             = useState({});

  const togglePref = k => {
    setPrefs(p => { const n=new Set(p); n.has(k)?n.delete(k):n.add(k); return n; });
  };

  const next = () => {
    const name      = nameRef.current?.value?.trim() || "";
    const birthYear = parseInt(birthRef.current?.value || "0");
    const e = {};
    if (!name)                               e.name      = "Обов'язкове поле";
    if (!gender)                             e.gender    = "Оберіть стать";
    if (!birthYear||birthYear<1920||birthYear>2015) e.birthYear = "Введіть рік (1920–2015)";
    setErr(e);
    if (Object.keys(e).length) return;
    onNext({
      name, surname:surnameRef.current?.value||"",
      gender, birthYear,
      phone:phoneRef.current?.value||"",
      city:cityRef.current?.value||"",
      prefs:[...prefs], locationOk,
    });
  };

  const requestLocation = () => {
    navigator.geolocation?.getCurrentPosition(
      ()=>setLocationOk(true), ()=>setLocationOk(false)
    );
  };

  return (
    <Shell>
      <TopBar title="Профіль" sub="Крок 3 з 3" onBack={onBack}/>
      <div style={{flex:1, overflowY:"auto", padding:"20px 20px 40px"}}>

        <div style={{fontSize:11, color:C.blue, letterSpacing:2,
          textTransform:"uppercase", marginBottom:14, fontWeight:700}}>
          Обов'язкові поля
        </div>

        <ProfileField label="Ім'я" required error={err.name}>
          <input ref={nameRef} defaultValue="" placeholder="Ваше ім'я"
            style={profileInputStyle(err.name)}/>
        </ProfileField>

        <ProfileField label="Прізвище">
          <input ref={surnameRef} defaultValue="" placeholder="Необов'язково"
            style={profileInputStyle(false)}/>
        </ProfileField>

        <ProfileField label="Стать" required error={err.gender}>
          <div style={{display:"flex", gap:8}}>
            {[["male","👨 Чоловіча"],["female","👩 Жіноча"],["other","— Інше"]].map(([v,l])=>(
              <div key={v} onClick={()=>setGender(v)}
                style={{flex:1, padding:"10px 6px", borderRadius:10, textAlign:"center",
                  cursor:"pointer", fontSize:11, fontWeight:700, transition:"all 0.15s",
                  border:`1px solid ${gender===v?C.blue:C.border}`,
                  background:gender===v?`${C.blue}15`:C.card,
                  color:gender===v?C.blue:C.muted}}>{l}</div>
            ))}
          </div>
        </ProfileField>

        <ProfileField label="Рік народження" required error={err.birthYear}>
          <input ref={birthRef} defaultValue="" placeholder="напр. 1990"
            type="number" style={profileInputStyle(err.birthYear)}/>
        </ProfileField>

        <div style={{fontSize:11, color:C.muted, letterSpacing:2,
          textTransform:"uppercase", margin:"20px 0 14px", fontWeight:700}}>
          Додатково (необов'язково)
        </div>

        <ProfileField label="Номер телефону">
          <input ref={phoneRef} defaultValue="" placeholder="+380XXXXXXXXX"
            type="tel" style={profileInputStyle(false)}/>
          <div style={{fontSize:10, color:C.muted, marginTop:4}}>
            Для входу через SMS у майбутньому
          </div>
        </ProfileField>

        <ProfileField label="Місто">
          <input ref={cityRef} defaultValue="" placeholder="напр. Київ"
            style={profileInputStyle(false)}/>
        </ProfileField>

        <div style={{padding:"12px 14px", borderRadius:10, marginBottom:14,
          background:locationOk?`${C.green}10`:C.card,
          border:`1px solid ${locationOk?C.green:C.border}`}}>
          <div style={{display:"flex", alignItems:"center", gap:10}}>
            <span style={{fontSize:20}}>📍</span>
            <div style={{flex:1}}>
              <div style={{fontSize:12, fontWeight:700, color:C.text, marginBottom:2}}>
                Локація при скануванні
              </div>
              <div style={{fontSize:10, color:C.muted, lineHeight:1.5}}>
                Альтернативи у вашому місті
              </div>
            </div>
            {locationOk
              ? <span style={{fontSize:12, color:C.green, fontWeight:700}}>✓ Дозволено</span>
              : <button onClick={requestLocation}
                  style={{padding:"6px 12px", borderRadius:7, border:`1px solid ${C.blue}`,
                    background:`${C.blue}15`, color:C.blue, fontSize:11, cursor:"pointer",
                    fontWeight:700}}>Дозволити</button>
            }
          </div>
        </div>

        <div style={{fontSize:11, color:C.muted, letterSpacing:2,
          textTransform:"uppercase", marginBottom:10, fontWeight:700}}>
          🎯 Що хочете перевіряти
        </div>
        <div style={{display:"flex", flexWrap:"wrap", gap:8, marginBottom:24}}>
          {SCAN_PREFS.map(p => {
            const on = prefs.has(p.key);
            return (
              <div key={p.key} onClick={()=>togglePref(p.key)}
                style={{padding:"8px 12px", borderRadius:20, cursor:"pointer",
                  fontSize:12, fontWeight:600, transition:"all 0.15s",
                  border:`1px solid ${on?C.blue:C.border}`,
                  background:on?`${C.blue}15`:C.card,
                  color:on?C.blue:C.muted,
                  display:"flex", alignItems:"center", gap:6}}>
                <span>{p.icon}</span><span>{p.label}</span>
              </div>
            );
          })}
        </div>

        <BtnPrimary onClick={next}>🚀 Почати використання</BtnPrimary>
      </div>
    </Shell>
  );
}

/* ── Disclaimer ── */
function Disclaimer({onAccept}) {
  const [ok, setOk] = useState(false);
  const items = [
    {icon:"🤖", t:"Аналіз штучним інтелектом",
      d:"Результати формуються автоматично і можуть містити помилки. Це не офіційна експертиза."},
    {icon:"⚕️", t:"Не є медичною порадою",
      d:"Інформація надається в освітніх цілях. При алергіях та захворюваннях зверніться до лікаря."},
    {icon:"⚠️", t:"Увага алергікам",
      d:"Аналіз алергенів орієнтовний. Завжди перевіряйте актуальну етикетку самостійно."},
    {icon:"🏭", t:"Оцінки виробників",
      d:"Оцінки репутації та зв'язків з РФ — редакційна думка на основі публічних даних."},
    {icon:"📸", t:"Ваші фотографії",
      d:"Фото передаються Anthropic для аналізу і не зберігаються на наших серверах."},
    {icon:"⚖️", t:"Відповідальність",
      d:"Сервіс не несе відповідальності за рішення на основі аналізу ШІ."},
  ];
  return (
    <Shell>
      <TopBar title="SafeScan UA" sub="Умови використання"/>
      <div style={{flex:1, display:"flex", flexDirection:"column", overflow:"hidden"}}>
        <div style={{flex:1, overflowY:"auto", padding:"12px 16px",
          display:"flex", flexDirection:"column", gap:8}}>
          {items.map((it,i) => (
            <div key={i} style={{padding:12, borderRadius:10,
              background:C.card, border:`1px solid ${C.border}`}}>
              <div style={{display:"flex", alignItems:"center", gap:8, marginBottom:5}}>
                <span style={{fontSize:16}}>{it.icon}</span>
                <span style={{fontSize:12, fontWeight:700, color:C.text}}>{it.t}</span>
              </div>
              <p style={{margin:0, fontSize:11, color:C.muted, lineHeight:1.7}}>{it.d}</p>
            </div>
          ))}
        </div>
        <div style={{padding:"14px 16px 28px", borderTop:`1px solid ${C.border}`,
          background:C.surf, display:"flex", flexDirection:"column", gap:12}}>
          <label onClick={() => setOk(!ok)}
            style={{display:"flex", alignItems:"flex-start", gap:10, cursor:"pointer"}}>
            <div style={{width:20, height:20, borderRadius:5, flexShrink:0, marginTop:1,
              border:`2px solid ${ok?C.blue:C.border}`,
              background:ok?C.blue:"transparent",
              display:"flex", alignItems:"center", justifyContent:"center",
              transition:"all 0.2s"}}>
              {ok && <span style={{color:"#fff", fontSize:13, fontWeight:900}}>✓</span>}
            </div>
            <span style={{fontSize:12, color:C.text, lineHeight:1.6}}>
              Я прочитав(ла) та погоджуюсь з умовами. Розумію, що аналіз є інформаційним.
            </span>
          </label>
          <button onClick={() => ok && onAccept()}
            style={{width:"100%", padding:14, borderRadius:10, border:"none",
              background:ok?C.blue:"#1e2330", color:ok?"#fff":C.muted,
              fontSize:14, fontWeight:700, cursor:ok?"pointer":"not-allowed",
              transition:"all 0.2s"}}>
            {ok ? "✓ Погоджуюсь і починаю" : "Підтвердіть згоду вище"}
          </button>
        </div>
      </div>
    </Shell>
  );
}

/* ── Main App ── */
export default function App() {
  // auth: welcome | email | otp | register | app
  const [authPhase, setAuthPhase] = useState("welcome");
  const [authEmail, setAuthEmail] = useState("");
  const [authMode, setAuthMode]   = useState("register"); // register | login
  const [user, setUser]           = useState(null);

  const [phase, setPhase]         = useState("disclaimer");
  const [showProfile, setProfile] = useState(false);
  const [enabled, setEnabled]     = useState(DEFAULT_ON);
  const [img1, setImg1]           = useState({src:null, b64:null, mime:"image/jpeg"});
  const [img2, setImg2]           = useState({src:null, b64:null, mime:"image/jpeg"});
  const [loadStep, setLoadStep]   = useState(0);
  // Global paste listener — Ctrl+V / Cmd+V
  useEffect(() => {
    const onPaste = e => {
      const item = [...(e.clipboardData?.items||[])].find(i=>i.type.startsWith("image/"));
      if (!item) return;
      const file = item.getAsFile();
      if (!file) return;
      if (!img1.b64) readImg(file, setImg1); else readImg(file, setImg2);
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [img1.b64, img2.b64]);
  const [result, setResult]       = useState(null);
  const [errMsg, setErrMsg]       = useState("");
  const [errDetail, setErrDetail] = useState("");

  const STEPS = ["Зчитую фото…","Аналізую склад…","Перевіряю критерії…","Готую результат…"];

const readImg = useCallback((file, setter) => {
    if (!file || !file.type.startsWith("image/")) return;
    
    // Створюємо URL для показу прев'ю в інтерфейсі
    const src = URL.createObjectURL(file);
    
    // Створюємо об'єкт зображення для стиснення
    const img = new Image();
    img.onload = () => {
      // Створюємо невидиме полотно (canvas)
      const canvas = document.createElement("canvas");
      let width = img.width;
      let height = img.height;

      // Максимальний розмір сторони (1200px вистачає для ШІ з головою)
      const MAX_SIZE = 1200;
      
      if (width > height && width > MAX_SIZE) {
        height *= MAX_SIZE / width;
        width = MAX_SIZE;
      } else if (height > MAX_SIZE) {
        width *= MAX_SIZE / height;
        height = MAX_SIZE;
      }

      canvas.width = width;
      canvas.height = height;
      
      // Малюємо зменшене зображення на canvas
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);

      // Конвертуємо canvas назад у Base64 (формат JPEG, якість 70%)
      const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
      const b64 = dataUrl.split(",")[1];

      // Зберігаємо стиснене фото
      setter({src, b64, mime: "image/jpeg"});
    };
    img.src = src;
  }, []);
  const analyze = async () => {
    if (!img1.b64) return;
    setPhase("loading");
    setLoadStep(0);
    const timer = setInterval(() => setLoadStep(s => Math.min(s+1, STEPS.length-1)), 3000);

    try {
      const content = [];
      content.push({type:"image", source:{type:"base64", media_type:img1.mime, data:img1.b64}});
      if (img2.b64) {
        content.push({type:"image", source:{type:"base64", media_type:img2.mime, data:img2.b64}});
      }
      content.push({type:"text", text:`Перше фото — товар/бренд.${img2.b64?" Друге — склад/інгредієнти.":""} Проаналізуй.`});

const reqBody = {
  // Змінюємо модель на доступну (наприклад, Haiku, як порадив Клод)
  model: "claude-haiku-4-5-20251001", // Або "claude-3-5-haiku-20241022", якщо перша не спрацює
  max_tokens: 4096,
  system: makePrompt(enabled),
  messages: [{role:"user", content}] // Без tools
};

      const bodyStr = JSON.stringify(reqBody);
      const kb = Math.round(bodyStr.length / 1024);
      console.log(`Request size: ~${kb}KB, max_tokens: ${reqBody.max_tokens}`);

      // На Vercel — запит до нашого serverless проксі (api/analyze.js)
      // API ключ зберігається безпечно у Vercel Environment Variables
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: bodyStr
      });

      clearInterval(timer);

 if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(`HTTP ${res.status}: ${e?.message || res.statusText}`);
      }

      const data = await res.json();
      console.log("API response:", JSON.stringify(data).slice(0, 500));

      if (data.stop_reason === "max_tokens") {
        throw new Error("Відповідь обрізана (max_tokens). Зменшіть кількість критеріїв.");
      }
      if (data.error) {
        throw new Error(`API error: ${data.error.type} — ${data.error.message}`);
      }

      // збираємо тільки text блоки (web_search повертає tool_use + tool_result + text)
      const raw = (data.content || [])
        .filter(b => b.type === "text")
        .map(b => b.text || "")
        .join("");
      console.log("Raw response:", raw.slice(0, 300));

      if (!raw) throw new Error("Порожня відповідь від API. data=" + JSON.stringify(data).slice(0,200));

      const cleaned = raw.replace(/^```json\s*/,"").replace(/\s*```$/,"").trim();
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("JSON не знайдено.\nВідповідь: " + raw.slice(0, 300));

      let parsed;
      try {
        parsed = JSON.parse(match[0]);
      } catch(je) {
        throw new Error("JSON parse error: " + je.message + "\nJSON: " + match[0].slice(0,200));
      }
      if (parsed.error) {
        setErrMsg("Не вдалося розпізнати товар");
        setErrDetail(parsed.msg || "Переконайтесь що етикетка чітко видна");
        setPhase("error");
        return;
      }
      setResult(parsed);
      setPhase("result");
    } catch (e) {
      clearInterval(timer);
      setErrMsg("Помилка аналізу");
      setErrDetail(String(e.message || e));
      setPhase("error");
    }
  };

  const reset = () => {
    setPhase("upload");
    setImg1({src:null, b64:null, mime:"image/jpeg"});
    setImg2({src:null, b64:null, mime:"image/jpeg"});
    setResult(null);
  };

  /* AUTH FLOW */
  if (authPhase === "welcome") return (
    <WelcomeScreen
      onRegister={() => { setAuthMode("register"); setAuthPhase("email"); }}
      onLogin={() => { setAuthMode("login"); setAuthPhase("email"); }}
    />
  );
  if (authPhase === "email") return (
    <EmailStep
      title={authMode==="register" ? "Реєстрація" : "Вхід"}
      onNext={email => { setAuthEmail(email); setAuthPhase("otp"); }}
      onBack={() => setAuthPhase("welcome")}
    />
  );
  if (authPhase === "otp" && authMode === "login") return (
    <OtpStep
      email={authEmail}
      onNext={() => { setUser({email:authEmail}); setAuthPhase("app"); }}
      onBack={() => setAuthPhase("email")}
    />
  );
  if (authPhase === "otp" && authMode === "register") return (
    <OtpStep
      email={authEmail}
      onNext={() => setAuthPhase("register")}
      onBack={() => setAuthPhase("email")}
    />
  );
  if (authPhase === "register") return (
    <ProfileStep
      onNext={profile => { setUser({email:authEmail, ...profile}); setAuthPhase("app"); }}
      onBack={() => setAuthPhase("otp")}
    />
  );

  /* DISCLAIMER */
  if (phase === "disclaimer") return <Disclaimer onAccept={() => setPhase("upload")}/>;

  /* PROFILE */
  if (showProfile) return (
    <ProfileScreen
      enabled={enabled}
      onSave={n => { setEnabled(n); setProfile(false); }}
      onBack={() => setProfile(false)}
    />
  );

  /* UPLOAD */
  if (phase === "upload") return (
    <Shell>
      <TopBar title="SafeScan UA" sub="Аналіз продуктів"
        right={
          <div style={{display:"flex", alignItems:"center", gap:8}}>
            {user && (
              <div style={{width:28, height:28, borderRadius:"50%",
                background:`${C.blue}20`, border:`1px solid ${C.blue}40`,
                display:"flex", alignItems:"center", justifyContent:"center",
                fontSize:12, color:C.blue, fontWeight:700}}>
                {(user.name||user.email||"?")[0].toUpperCase()}
              </div>
            )}
            <GearBtn onClick={() => setProfile(true)}/>
          </div>
        }/>
      <div style={{flex:1, overflowY:"auto", padding:"20px 16px 40px",
        display:"flex", flexDirection:"column", gap:18}}>

        {/* active criteria chips */}
        <div style={{padding:"12px 14px", borderRadius:10, background:C.card,
          border:`1px solid ${C.border}`}}>
          <div style={{display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8}}>
            <span style={{fontSize:11, fontWeight:700, color:C.text}}>
              Активних критеріїв: <span style={{color:C.blue}}>{enabled.size}</span>
            </span>
            <button onClick={() => setProfile(true)}
              style={{fontSize:11, color:C.blue, background:"none", border:"none",
                cursor:"pointer", textDecoration:"underline"}}>Змінити</button>
          </div>
          <div style={{display:"flex", flexWrap:"wrap", gap:5}}>
            {CRITERIA.filter(c => enabled.has(c.key)).map(c => (
              <div key={c.key} style={{padding:"3px 8px", borderRadius:12, fontSize:10,
                color:GROUPS[c.group].color,
                background:`${GROUPS[c.group].color}10`,
                border:`1px solid ${GROUPS[c.group].color}30`}}>
                {c.icon} {c.label}
              </div>
            ))}
          </div>
        </div>

        {/* photos */}
        <div>
          <div style={{display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12}}>
            <div style={{fontSize:12, fontWeight:700, color:C.text}}>Фото товару</div>
            <div style={{fontSize:10, color:C.muted}}>або Ctrl+V щоб вставити</div>
          </div>
          <div style={{display:"flex", gap:12}}>
            <PhotoSlot id="photo1" src={img1.src} label="Титульне" hint={"Передня сторона\nбренд / назва"}
              onChange={f => readImg(f, setImg1)}
              onRemove={() => setImg1({src:null, b64:null, mime:"image/jpeg"})}/>
            <PhotoSlot id="photo2" src={img2.src} label="Склад / інгредієнти" hint={"Задня сторона\nE-коди / склад"}
              onChange={f => readImg(f, setImg2)}
              onRemove={() => setImg2({src:null, b64:null, mime:"image/jpeg"})}/>
          </div>
          {img2.src && (
            <div style={{marginTop:8, padding:"7px 10px", borderRadius:7,
              background:`${C.green}10`, border:`1px solid ${C.green}25`,
              fontSize:11, color:C.green}}>
              ✓ 2 фото — точніший аналіз складу
            </div>
          )}
        </div>

        {!img1.src && (
          <div style={{padding:"8px 12px", borderRadius:8, background:`${C.amber}15`,
            border:`1px solid ${C.amber}30`, fontSize:11, color:C.amber, textAlign:"center"}}>
            ⬆ Спочатку завантажте фото товару вище
          </div>
        )}
        <button onClick={img1.src ? analyze : undefined}
          style={{width:"100%", padding:14, borderRadius:10, border:"none",
            background:img1.src ? C.blue : "#1e2a3a",
            color:img1.src ? "#fff" : "#4a6080",
            fontSize:14, fontWeight:700,
            cursor:img1.src ? "pointer" : "default",
            display:"flex", alignItems:"center", justifyContent:"center", gap:8,
            transition:"all 0.2s"}}>
          {img1.src ? `🔍 Аналізувати (${enabled.size} критеріїв)` : "🚀 Розпочати"}
        </button>

        <div style={{textAlign:"center"}}>
          <span onClick={() => setPhase("disclaimer")}
            style={{fontSize:10, color:C.muted, cursor:"pointer", textDecoration:"underline"}}>
            Умови використання
          </span>
        </div>
      </div>
    </Shell>
  );

  /* LOADING */
  if (phase === "loading") return (
    <Shell>
      <TopBar title="SafeScan UA" sub="Аналіз продуктів"/>
      <Loader step={loadStep} total={STEPS.length} label={STEPS[loadStep]}/>
    </Shell>
  );

  /* ERROR */
  if (phase === "error") return (
    <Shell>
      <TopBar title="SafeScan UA" sub="Помилка" onBack={() => setPhase("upload")}/>
      <div style={{flex:1, display:"flex", flexDirection:"column",
        alignItems:"center", justifyContent:"center", gap:16, padding:24}}>
        <div style={{fontSize:48}}>😕</div>
        <div style={{fontSize:17, fontWeight:700, color:C.text}}>{errMsg}</div>
        <div style={{width:"100%", padding:12, borderRadius:10,
          background:`${C.red}10`, border:`1px solid ${C.red}30`}}>
          <div style={{fontSize:10, color:C.red, letterSpacing:1, marginBottom:5}}>ДЕТАЛІ</div>
          <div style={{fontSize:11, color:"#fca5a5", lineHeight:1.6,
            wordBreak:"break-word", fontFamily:"monospace"}}>{errDetail}</div>
        </div>
        <BtnPrimary onClick={() => setPhase("upload")}>🔄 Спробувати ще раз</BtnPrimary>
        <BtnSecondary onClick={() => setProfile(true)}>⚙️ Зменшити критерії</BtnSecondary>
      </div>
    </Shell>
  );

  /* RESULT */
  if (phase === "result" && result) {
    const v = VERDICTS[result.verdict] || VERDICTS.consider;
    const activeCriteria = CRITERIA.filter(c => enabled.has(c.key));

    return (
      <Shell>
        <TopBar title="SafeScan UA" sub="Результат аналізу" onBack={reset}
          right={<GearBtn onClick={() => setProfile(true)}/>}/>
        <div style={{flex:1, overflowY:"auto", paddingBottom:48}}>

          {/* photo strip */}
          <div style={{display:"flex", height:140, background:"#000", overflow:"hidden", position:"relative"}}>
            <div style={{flex:1}}>
              <img src={img1.src} alt="" style={{width:"100%", height:"100%", objectFit:"cover", opacity:0.3}}/>
            </div>
            {img2.src && <>
              <div style={{width:1, background:"rgba(255,255,255,0.1)"}}/>
              <div style={{flex:1}}>
                <img src={img2.src} alt="" style={{width:"100%", height:"100%", objectFit:"cover", opacity:0.3}}/>
              </div>
            </>}
            <div style={{position:"absolute", inset:0,
              background:"linear-gradient(to bottom,transparent 20%,#08090c 100%)"}}/>
            <div style={{position:"absolute", bottom:12, left:14, right:14}}>
              <div style={{fontSize:9, color:C.muted, letterSpacing:2, textTransform:"uppercase", marginBottom:2}}>
                {result.category}
              </div>
              <div style={{fontSize:18, fontWeight:800, color:C.text, lineHeight:1.2}}>{result.name}</div>
              <div style={{fontSize:11, color:C.muted, marginTop:2}}>{result.maker}</div>
            </div>
          </div>

          <div style={{padding:"0 14px"}}>
            {/* ai badge */}
            <div style={{display:"inline-flex", alignItems:"center", gap:6, margin:"10px 0",
              padding:"4px 10px", borderRadius:6, background:C.card, border:`1px solid ${C.border}`}}>
              <div style={{width:4, height:4, borderRadius:"50%", background:C.blue}}/>
              <span style={{fontSize:9, color:C.muted, letterSpacing:1}}>
                АНАЛІЗ ШІ · {enabled.size} КРИТЕРІЇВ · {img2.src?"2 ФОТО":"1 ФОТО"}
              </span>
            </div>

            {/* allergen warning */}
            {result.allergenRisk && (
              <div style={{padding:"10px 12px", borderRadius:8, marginBottom:10,
                background:`${C.red}10`, border:`1px solid ${C.red}30`,
                display:"flex", gap:8}}>
                <span style={{fontSize:14, flexShrink:0}}>🚨</span>
                <p style={{margin:0, fontSize:10, color:"#fca5a5", lineHeight:1.6}}>
                  <strong>Для алергіків:</strong> Завжди перевіряйте актуальну етикетку.
                </p>
              </div>
            )}

            {/* verdict */}
            <div style={{marginBottom:10, padding:"14px 16px", borderRadius:12,
              background:v.bg, border:`1px solid ${v.br}`,
              display:"flex", alignItems:"center", gap:14}}>
              <div style={{width:40, height:40, borderRadius:10,
                background:`${v.col}20`, border:`2px solid ${v.col}`,
                display:"flex", alignItems:"center", justifyContent:"center",
                fontSize:18, fontWeight:900, color:v.col, flexShrink:0}}>{v.icon}</div>
              <div>
                <div style={{fontSize:10, color:v.col, letterSpacing:3,
                  fontWeight:800, marginBottom:2}}>{v.label}</div>
                <div style={{fontSize:13, color:C.text, lineHeight:1.5}}>{result.verdictText}</div>
              </div>
            </div>

            {/* score */}
            <div style={{display:"flex", alignItems:"center", gap:14, padding:"12px 14px",
              borderRadius:10, background:C.card, border:`1px solid ${C.border}`, marginBottom:10}}>
              <Ring score={result.score}/>
              <div>
                <div style={{fontSize:11, color:C.muted, marginBottom:3}}>Загальна оцінка</div>
                <div style={{fontSize:15, fontWeight:800, color:C.text}}>
                  {result.score>=70?"Хороша":result.score>=40?"Середня":"Низька"} якість
                </div>
              </div>
            </div>

            {/* human impact */}
            {result.impact && (
              <div style={{padding:12, borderRadius:10, marginBottom:14,
                background:`${C.purple}10`, border:`1px solid ${C.purple}25`}}>
                <div style={{fontSize:10, color:C.purple, letterSpacing:2,
                  textTransform:"uppercase", marginBottom:10, fontWeight:700}}>
                  🫀 Вплив на організм
                </div>
                <div style={{fontSize:10, color:C.muted, marginBottom:2}}>ОДНОРАЗОВО</div>
                <div style={{fontSize:12, color:C.text, lineHeight:1.6, marginBottom:8}}>
                  {result.impact.short}
                </div>
                <div style={{fontSize:10, color:C.muted, marginBottom:2}}>РЕГУЛЯРНО</div>
                <div style={{fontSize:12, color:C.text, lineHeight:1.6, marginBottom:8}}>
                  {result.impact.long}
                </div>
                {result.impact.groups?.length > 0 && (
                  <div style={{display:"flex", flexWrap:"wrap", gap:5}}>
                    {result.impact.groups.map((g,i) => (
                      <span key={i} style={{padding:"2px 8px", borderRadius:10,
                        background:`${C.amber}15`, border:`1px solid ${C.amber}30`,
                        fontSize:10, color:C.amber}}>{g}</span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* criteria by group */}
            {["safety","producer","extra"].map(gid => {
              const items = activeCriteria.filter(c => c.group===gid);
              if (!items.length) return null;
              return (
                <div key={gid} style={{marginBottom:16}}>
                  <div style={{display:"flex", alignItems:"center", gap:8, marginBottom:10}}>
                    <div style={{fontSize:10, fontWeight:800, color:GROUPS[gid].color,
                      letterSpacing:1.5, textTransform:"uppercase"}}>{GROUPS[gid].label}</div>
                    <div style={{flex:1, height:1, background:C.border}}/>
                  </div>
                  {items.map(c => (
                    <CriterionCard key={c.key} data={result.criteria?.[c.key]} icon={c.icon}/>
                  ))}
                </div>
              );
            })}

            {/* tip */}
            {result.tip && (
              <div style={{padding:"12px 14px", borderRadius:10, marginBottom:10,
                background:`${C.blue}08`, border:`1px solid ${C.blue}20`,
                display:"flex", gap:10}}>
                <span>💡</span>
                <p style={{margin:0, fontSize:12, color:C.text, lineHeight:1.6}}>{result.tip}</p>
              </div>
            )}

            {/* alternatives */}
            {result.alts?.length > 0 && (
              <div style={{marginBottom:14}}>
                <div style={{display:"flex", alignItems:"center", gap:8, marginBottom:10}}>
                  <div style={{fontSize:10, fontWeight:800, color:C.green,
                    letterSpacing:1.5, textTransform:"uppercase"}}>
                    ✓ Кращі альтернативи
                  </div>
                  <div style={{flex:1, height:1, background:C.border}}/>
                  <div style={{fontSize:9, color:C.muted}}>знайдено в мережах UA</div>
                </div>
                {result.alts.map((a,i) => {
                  // підтримуємо як старий формат (рядок) так і новий (об'єкт)
                  const isObj = typeof a === "object";
                  return (
                    <div key={i} style={{padding:"12px 14px", borderRadius:10,
                      background:C.card, border:`1px solid ${C.green}25`,
                      marginBottom:8, display:"flex", gap:12, alignItems:"flex-start"}}>
                      <div style={{width:32, height:32, borderRadius:8, flexShrink:0,
                        background:`${C.green}15`, border:`1px solid ${C.green}30`,
                        display:"flex", alignItems:"center", justifyContent:"center",
                        fontSize:14}}>✓</div>
                      <div style={{flex:1, minWidth:0}}>
                        {isObj ? (
                          <>
                            <div style={{fontSize:13, fontWeight:700, color:C.text, marginBottom:3}}>
                              {a.brand} {a.name}
                            </div>
                            {a.reason && (
                              <div style={{fontSize:11, color:C.muted, lineHeight:1.5, marginBottom:4}}>
                                {a.reason}
                              </div>
                            )}
                            {a.available && (
                              <div style={{display:"inline-flex", alignItems:"center", gap:4,
                                padding:"2px 8px", borderRadius:10, fontSize:10,
                                background:`${C.blue}15`, border:`1px solid ${C.blue}30`,
                                color:C.blue}}>
                                🏪 {a.available}
                              </div>
                            )}
                          </>
                        ) : (
                          <div style={{fontSize:12, color:C.text, lineHeight:1.5}}>{a}</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* legal */}
            <div style={{padding:"10px 12px", borderRadius:8,
              background:C.surf, border:`1px solid ${C.border}`, marginBottom:12}}>
              <p style={{margin:0, fontSize:10, color:C.muted, lineHeight:1.6}}>
                ⚖️ Аналіз сформовано ШІ. Це інформаційна оцінка, не офіційна експертиза.
              </p>
            </div>

            <BtnPrimary onClick={reset}>📷 Сканувати інший товар</BtnPrimary>
            <BtnSecondary onClick={() => setProfile(true)}>⚙️ Налаштування профілю</BtnSecondary>
          </div>
        </div>
      </Shell>
    );
  }

  return null;
}

/* ── Shell / TopBar / Buttons ── */
function Shell({children}) {
  return (
    <div style={{display:"flex", flexDirection:"column", minHeight:"100vh",
      maxWidth:430, margin:"0 auto", background:C.bg, color:C.text,
      fontFamily:"'Manrope','Segoe UI',sans-serif"}}>
      {children}
    </div>
  );
}

function TopBar({title, sub, onBack, right}) {
  return (
    <div style={{display:"flex", alignItems:"center", gap:10, padding:"13px 14px 11px",
      borderBottom:`1px solid ${C.border}`, background:C.surf,
      position:"sticky", top:0, zIndex:10}}>
      {onBack && (
        <button onClick={onBack} style={{background:"none", border:"none",
          cursor:"pointer", color:C.muted, fontSize:22, padding:"0 4px", lineHeight:1}}>‹</button>
      )}
      <div style={{display:"flex", alignItems:"center", gap:8, flex:1}}>
        <div style={{width:28, height:28, borderRadius:7, background:`${C.blue}15`,
          border:`1px solid ${C.blue}40`, display:"flex", alignItems:"center",
          justifyContent:"center", fontSize:14}}>🛡</div>
        <div>
          <div style={{fontSize:13, fontWeight:800, color:C.text, lineHeight:1}}>{title}</div>
          <div style={{fontSize:9, color:C.muted, letterSpacing:1}}>{sub}</div>
        </div>
      </div>
      {right || (
        <div style={{display:"flex", alignItems:"center", gap:4}}>
          <div style={{width:5, height:5, borderRadius:"50%", background:C.green}}/>
          <span style={{fontSize:9, color:C.muted}}>AI</span>
        </div>
      )}
    </div>
  );
}

function GearBtn({onClick}) {
  return (
    <button onClick={onClick} style={{background:"none", border:`1px solid ${C.border}`,
      borderRadius:7, cursor:"pointer", color:C.muted, fontSize:15, width:28, height:28,
      display:"flex", alignItems:"center", justifyContent:"center"}}>⚙️</button>
  );
}

function BtnPrimary({children, onClick}) {
  return (
    <button onClick={onClick} style={{width:"100%", padding:"13px 18px", borderRadius:10,
      border:"none", background:C.blue, color:"#fff", fontSize:14, fontWeight:700,
      cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center",
      gap:8, marginBottom:8}}>{children}</button>
  );
}

function BtnSecondary({children, onClick}) {
  return (
    <button onClick={onClick} style={{width:"100%", padding:"13px 18px", borderRadius:10,
      border:`1px solid ${C.border}`, background:C.card, color:C.text, fontSize:14,
      fontWeight:700, cursor:"pointer", display:"flex", alignItems:"center",
      justifyContent:"center", gap:8, marginBottom:8}}>{children}</button>
  );
}
