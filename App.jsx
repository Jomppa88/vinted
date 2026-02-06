const { useState, useCallback, useEffect } = React;

// --- KONFIGURAATIO ---
// Turvallisessa versiossa kutsumme Vercelin API-reittiä
const API_PROXY_PATH = "/api/generate";

const MAX_FILES = 5;
const MAX_SIZE_MB = 10;
const STORAGE_KEY = "myyntiapuri-pro-v2";

// Apukomponentti ikoneille, koska käytämme CDN-versiota
const Icon = ({ name, size = 24, className = "" }) => {
  const [iconSvg, setIconSvg] = useState("");
  useEffect(() => {
    if (window.lucide) {
      const icon = window.lucide.icons[name];
      if (icon) setIconSvg(icon.toSvg({ size, class: className }));
    }
  }, [name, size, className]);
  return <span className="inline-flex" dangerouslySetInnerHTML={{ __html: iconSvg }} />;
};

const App = () => {
  const [activeTab, setActiveTab] = useState("create");
  const [files, setFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState(null);
  const [extractedInfo, setExtractedInfo] = useState(null);
  const [measurements, setMeasurements] = useState("");
  const [estimatedPrice, setEstimatedPrice] = useState("");
  const [stylingTips, setStylingTips] = useState("");
  const [sellingTips, setSellingTips] = useState("");
  const [selectedCondition, setSelectedCondition] = useState("");
  const [customDetails, setCustomDetails] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(null);
  const [message, setMessage] = useState(null);
  const [history, setHistory] = useState([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [language, setLanguage] = useState("fi");
  const [closingMessage, setClosingMessage] = useState("Toimitus hyvin pakattuna samana tai seuraavana päivänä. PS. Katso myös muut kohteeni ja säästä postikuluissa tilaamalla useampi tuote kerralla😊");

  const conditions = [
    { value: "", label: language === "fi" ? "--- Valitse kunto ---" : "--- Select condition ---" },
    { value: "Uusi hintalappulla", label: language === "fi" ? "Uusi hintalappulla" : "New with tags" },
    { value: "Uusi ilman hintalappua", label: language === "fi" ? "Uusi ilman hintalappua" : "New without tags" },
    { value: "Erittäin hyvä", label: language === "fi" ? "Erittäin hyvä" : "Very good" },
    { value: "Hyvä", label: language === "fi" ? "Hyvä" : "Good" },
    { value: "Tyydyttävä", label: language === "fi" ? "Tyydyttävä" : "Satisfactory" },
  ];

  const resetAll = useCallback(() => {
    if (isLoading) return;
    setFiles([]); setPreviews([]); setTitle(""); setDescription(null); setExtractedInfo(null);
    setMeasurements(""); setEstimatedPrice(""); setStylingTips(""); setSellingTips("");
    setSelectedCondition(""); setCustomDetails("");
    setMessage({ type: "success", text: "Uusi ilmoitus aloitettu!" });
    setTimeout(() => setMessage(null), 3000);
  }, [isLoading]);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) { try { setHistory(JSON.parse(saved)); } catch (e) { } }
  }, []);

  const saveToHistory = (newItem) => {
    setHistory(prev => {
      const updated = [newItem, ...prev].slice(0, 20);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  const handleFileChange = (e) => {
    const selected = Array.from(e.target.files);
    selected.forEach(file => {
      if (file.size > MAX_SIZE_MB * 1024 * 1024) return;
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviews(prev => [...prev, reader.result]);
        setFiles(prev => [...prev, { data: reader.result.split(",")[1], mimeType: file.type }]);
      };
      reader.readAsDataURL(file);
    });
  };

  const generate = async () => {
    if (files.length === 0 || !selectedCondition || isLoading) return;
    setIsLoading(true); setMessage(null);
    try {
      setLoadingStatus("Analysoidaan...");
      const imageParts = files.map(f => ({ inlineData: { mimeType: f.mimeType, data: f.data } }));
      
      const response = await fetch(API_PROXY_PATH, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `Luo ilmoitus: ${selectedCondition}. ${customDetails}` }, ...imageParts] }],
          systemInstruction: { parts: [{ text: "Olet myyntiasiantuntija. Palauta BRAND, SIZE, MATERIAL, MEASUREMENTS --- TITLE --- DESCRIPTION. Ei tähtiä tekstissä." }] }
        })
      });

      const data = await response.json();
      const sections = data.candidates[0].content.parts[0].text.split("---").map(s => s.trim());
      
      setTitle(sections[1] || "Ilmoitus");
      setDescription(sections[2] + "\n\n" + closingMessage);

      setLoadingStatus("Viimeistellään...");
      const extraRes = await fetch(API_PROXY_PATH, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `Tuote: ${sections[1]}. Hinta-arvio, 3 lyhyttä stailausvinkkiä, 1 myyntivinkki. Erota ---.` }] }],
          useSearch: true
        })
      });

      const extraData = await extraRes.json();
      const extraSections = extraData.candidates[0].content.parts[0].text.split("---").map(s => s.trim());

      setEstimatedPrice(extraSections[0]);
      setStylingTips(extraSections[1]);
      setSellingTips(extraSections[2]);

      saveToHistory({ id: Date.now(), title: sections[1], date: new Date().toLocaleDateString() });
      setMessage({ type: "success", text: "Valmis! ✨" });
    } catch (e) {
      setMessage({ type: "error", text: "Virhe. Tarkista Vercel-asetukset." });
    } finally {
      setIsLoading(false); setLoadingStatus(null);
    }
  };

  const copy = (t) => {
    const el = document.createElement("textarea"); el.value = t; document.body.appendChild(el);
    el.select(); document.execCommand("copy"); document.body.removeChild(el);
    setMessage({ type: "success", text: "Kopioitu!" });
  };

  return (
    <div className="min-h-screen bg-neutral-100 p-4 md:p-8 flex justify-center pb-32">
      <div className="w-full max-w-xl bg-white rounded-[2.5rem] shadow-2xl border border-neutral-200 overflow-hidden flex flex-col">
        
        <div className="p-6 md:p-8 border-b border-neutral-100 bg-white sticky top-0 z-20">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-3xl font-black tracking-tighter text-indigo-600 italic uppercase">Myyntiapuri A.I.</h1>
              <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mt-1">Vercel PRO</p>
            </div>
            <div className="flex gap-2">
              <button onClick={resetAll} className="p-3 bg-red-50 text-red-500 rounded-2xl hover:bg-red-100 transition-colors">
                <Icon name="RotateCcw" size={24} />
              </button>
              <button onClick={() => setIsSettingsOpen(true)} className="p-3 bg-neutral-100 rounded-2xl hover:bg-indigo-50 hover:text-indigo-600 transition-colors">
                <Icon name="Settings" size={24} />
              </button>
            </div>
          </div>
          <div className="flex p-1.5 bg-neutral-100 rounded-3xl">
            <button onClick={() => setActiveTab("create")} className={`flex-1 py-3 rounded-[1.4rem] font-black text-sm uppercase transition-all ${activeTab === "create" ? "bg-white text-indigo-600 shadow-sm" : "text-neutral-400"}`}>Luo</button>
            <button onClick={() => setActiveTab("history")} className={`flex-1 py-3 rounded-[1.4rem] font-black text-sm uppercase transition-all ${activeTab === "history" ? "bg-white text-indigo-600 shadow-sm" : "text-neutral-400"}`}>Historia</button>
          </div>
        </div>

        {activeTab === "create" && (
          <div className="p-6 md:p-8 space-y-8 flex-1 overflow-y-auto">
            <div className="space-y-6">
              {previews.length > 0 && (
                <div className="grid grid-cols-3 gap-3">
                  {previews.map((src, i) => (
                    <div key={i} className="relative aspect-square rounded-2xl overflow-hidden border border-neutral-100">
                      <img src={src} className="w-full h-full object-cover" />
                      <button onClick={() => {
                        setPreviews(p => p.filter((_, idx) => idx !== i));
                        setFiles(f => f.filter((_, idx) => idx !== i));
                      }} className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full shadow-lg"><Icon name="X" size={14} /></button>
                    </div>
                  ))}
                </div>
              )}
              <div className="grid grid-cols-2 gap-4 h-40">
                <label className="flex flex-col items-center justify-center border-4 border-dashed border-indigo-100 rounded-[2rem] cursor-pointer bg-indigo-50/30 hover:bg-indigo-50 transition-all">
                  <Icon name="Camera" size={40} className="text-indigo-400 mb-2" />
                  <span className="text-xs font-black text-indigo-700 uppercase italic">Kamera</span>
                  <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileChange} />
                </label>
                <label className="flex flex-col items-center justify-center border-4 border-dashed border-indigo-100 rounded-[2rem] cursor-pointer bg-indigo-50/30 hover:bg-indigo-50 transition-all">
                  <Icon name="ImageIcon" size={40} className="text-indigo-400 mb-2" />
                  <span className="text-xs font-black text-indigo-700 uppercase italic">Galleria</span>
                  <input type="file" multiple accept="image/*" className="hidden" onChange={handleFileChange} />
                </label>
              </div>
            </div>

            <div className="space-y-5">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-neutral-300 uppercase tracking-widest ml-1">Tuotteen kunto</label>
                <select value={selectedCondition} onChange={(e) => setSelectedCondition(e.target.value)} className="w-full p-4 bg-neutral-100 rounded-2xl border-none font-bold text-neutral-700 outline-none cursor-pointer">
                  {conditions.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-neutral-300 uppercase tracking-widest ml-1">Lisätiedot</label>
                <textarea value={customDetails} onChange={(e) => setCustomDetails(e.target.value)} placeholder="Brändi, materiaali, mitat..." className="w-full p-4 bg-neutral-100 rounded-2xl border-none font-medium text-neutral-700 outline-none h-28 resize-none shadow-inner" />
              </div>
            </div>

            <button onClick={generate} disabled={isLoading || files.length === 0 || !selectedCondition} className="w-full py-5 bg-indigo-600 text-white rounded-3xl font-black text-xl shadow-xl hover:bg-indigo-700 transition-all disabled:opacity-50">
              {isLoading ? (
                <div className="flex items-center justify-center gap-3 mx-auto">
                    <Icon name="RefreshCw" className="animate-spin" />
                    <span className="text-sm uppercase font-black">{loadingStatus}</span>
                </div>
              ) : "Luo ilmoitus ✨"}
            </button>

            {message && <div className={`p-4 rounded-2xl text-center text-sm font-bold border-2 ${message.type === "error" ? "bg-red-50 border-red-100 text-red-600" : "bg-indigo-50 border-indigo-100 text-indigo-600"}`}>{message.text}</div>}

            {title && (
              <div className="space-y-8 pt-8 border-t border-neutral-100 animate-in slide-in-from-bottom-10">
                <div className="space-y-4">
                  <div className="flex justify-between items-end border-b-2 border-neutral-50 pb-2">
                    <span className="text-[10px] font-black text-neutral-300 uppercase tracking-widest">Otsikko</span>
                    <button onClick={() => copy(title)} className="text-indigo-500 font-bold text-xs uppercase hover:underline">Kopioi</button>
                  </div>
                  <p className="text-3xl font-black text-neutral-900 leading-tight tracking-tight">{title}</p>
                </div>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black text-neutral-300 uppercase tracking-widest">Kuvaus</span>
                    <button onClick={() => copy(description)} className="bg-indigo-600 text-white px-6 py-2.5 rounded-2xl text-[10px] font-black shadow-lg uppercase tracking-widest">Kopioi kaikki</button>
                  </div>
                  <div className="bg-neutral-50 p-7 rounded-[2rem] border border-neutral-100 text-neutral-800 font-medium whitespace-pre-wrap text-lg shadow-inner">{description}</div>
                </div>
                <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-10 rounded-[3rem] text-white shadow-2xl relative overflow-hidden border-4 border-white/20">
                    <Icon name="Tag" size={120} className="absolute -right-8 -bottom-8 opacity-10 -rotate-12" />
                    <h3 className="text-xs font-black uppercase tracking-[0.2em] opacity-80 mb-2">Hinta-arvio</h3>
                    <p className="text-6xl font-black tracking-tighter tabular-nums">{estimatedPrice}</p>
                </div>
                <div className="grid grid-cols-1 gap-5">
                    <div className="bg-indigo-50/50 p-8 rounded-[2.5rem] border-2 border-indigo-100/50 space-y-4">
                        <div className="flex justify-between items-center">
                            <h4 className="text-indigo-700 font-black text-[11px] uppercase tracking-[0.2em] flex items-center gap-2"><Icon name="Sparkles" size={16} /> Stailausehdotus</h4>
                            <button onClick={() => copy(stylingTips)} className="text-[10px] font-black text-indigo-400 hover:text-indigo-700 uppercase bg-white px-3 py-1 rounded-full shadow-sm">Kopioi</button>
                        </div>
                        <div className="text-base text-indigo-900 font-bold italic leading-relaxed whitespace-pre-wrap">{stylingTips}</div>
                    </div>
                    <div className="bg-amber-50/50 p-8 rounded-[2.5rem] border-2 border-amber-100/50 space-y-3">
                        <h4 className="text-amber-700 font-black text-[11px] uppercase tracking-[0.2em] flex items-center gap-2"><Icon name="Lightbulb" size={16} /> Myyntivinkki</h4>
                        <p className="text-base text-amber-900 font-bold leading-relaxed">{sellingTips}</p>
                    </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "history" && (
          <div className="p-8 flex-1 overflow-y-auto space-y-4 bg-neutral-50/50">
            {history.length === 0 ? <p className="text-center py-20 text-neutral-300 font-bold uppercase tracking-widest italic">Tyhjä</p> : 
            history.map(h => (
              <div key={h.id} className="bg-white rounded-3xl border border-neutral-200 p-6 flex justify-between items-center shadow-sm hover:shadow-md transition-shadow">
                <div className="truncate pr-4">
                  <h3 className="font-black text-lg truncate text-neutral-800">{h.title}</h3>
                  <p className="text-[10px] font-bold text-neutral-300 uppercase tracking-widest">{h.date}</p>
                </div>
                <button onClick={() => {
                  const updated = history.filter(item => item.id !== h.id);
                  setHistory(updated); localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
                }} className="p-3 text-red-400 hover:bg-red-50 rounded-2xl transition-colors"><Icon name="Trash2" /></button>
              </div>
            ))}
          </div>
        )}

        {isSettingsOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <div className="w-full max-w-sm bg-white rounded-[3.5rem] p-10 shadow-3xl">
              <div className="flex justify-between items-center mb-10">
                <h2 className="text-2xl font-black text-indigo-600 uppercase italic tracking-tighter">Asetukset</h2>
                <button onClick={() => setIsSettingsOpen(false)} className="p-3 bg-neutral-50 rounded-full hover:bg-red-50 hover:text-red-500 transition-colors"><Icon name="X" size={24} /></button>
              </div>
              <div className="space-y-8">
                <div className="space-y-4">
                  <label className="text-[10px] font-black text-neutral-300 uppercase ml-1 tracking-widest">Lopputeksti</label>
                  <textarea value={closingMessage} onChange={(e) => setClosingMessage(e.target.value)} className="w-full p-6 bg-neutral-50 rounded-[2.5rem] border-none font-medium text-sm text-neutral-700 h-40 outline-none shadow-inner resize-none leading-relaxed" />
                </div>
                <button onClick={() => setIsSettingsOpen(false)} className="w-full py-6 bg-neutral-900 text-white rounded-[2rem] font-black uppercase tracking-[0.2em] shadow-2xl hover:bg-black transition-all">Tallenna ✨</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);

