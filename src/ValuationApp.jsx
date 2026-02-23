import React, { useState, useMemo, useEffect } from 'react';
import { runDCF, sensitivityTable } from './dcfEngine';
import {
    Plus,
    Minus,
    Info,
    Pencil,
    Sparkles,
    FileUp,
    ChevronDown,
    ChevronUp,
    TrendingUp,
    TrendingDown,
    Activity,
    DollarSign,
    PieChart,
    Shield,
    Target,
    FileText,
    Search,
    X,
    CheckCircle2,
    Loader2,
    Share2,
    Download,
    Save,
    RotateCcw,
    Moon,
    Sun,
    ExternalLink,
    Zap,
    Copy,
    Check,
    ArrowRight,
    Building2,
    Quote
} from 'lucide-react';
import { motion, AnimatePresence, useSpring, useTransform, animate } from 'framer-motion';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
import { RAGEngine, chunkText } from './ragEngine';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;


function cn(...inputs) {
    return twMerge(clsx(inputs));
}

// --- Defaults ---
const INITIAL_INPUTS = {
    // Company Basics
    company_name: "Infosys Limited",
    ticker: "INFY",
    current_price: 1800,
    shares_outstanding: 416,
    cash: 15456,
    debt: 8527,
    minority_interests: 0,
    non_operating_assets: 0,

    // Growth
    revenue_base: 153670,
    ebit_base: 35140,
    revenue_growth_yr1: 0.08,
    revenue_growth_yr2_5: 0.10,

    // Profitability
    operating_margin_base: 0.22,
    operating_margin_target: 0.23,
    margin_convergence_year: 5,

    // Tax
    tax_rate_effective: 0.25,
    tax_rate_marginal: 0.25,

    // Capital Efficiency
    sales_to_capital_1_5: 2.0,
    sales_to_capital_6_10: 2.0,

    // Risk
    wacc: 0.12,
    riskfree_rate: 0.071,

    // Advanced
    prob_failure: 0.0,
    distress_proceeds_pct: 0.5
};

// --- Components ---

const Badge = ({ children, className }) => (
    <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider", className)}>
        {children}
    </span>
);

const ConfidenceBadge = ({ confidence }) => {
    const colors = {
        high: "bg-brand/15 text-brand border-brand/20",
        medium: "bg-amber-500/15 text-amber-500 border-amber-500/20",
        low: "bg-negative/15 text-negative border-negative/20",
    };
    return (
        <Badge className={cn("flex items-center gap-1 border", colors[confidence] || colors.medium)}>
            <Sparkles className="w-2.5 h-2.5" /> AI {confidence?.toUpperCase()}
        </Badge>
    );
};

const SourceLink = ({ source, isDarkMode, onShowSource }) => (
    <div className={cn(
        "mt-2 pt-2 border-t",
        isDarkMode ? "border-slate-700/50" : "border-slate-200"
    )}>
        <p className={cn(
            "text-[9px] font-bold uppercase tracking-widest mb-1.5 flex items-center gap-1",
            isDarkMode ? "text-slate-500" : "text-slate-400"
        )}>
            <Search className="w-2.5 h-2.5" /> Intelligence Source
        </p>
        <button
            onClick={() => onShowSource(source)}
            className={cn(
                "group/source text-left p-2 rounded-lg transition-all border w-full",
                isDarkMode ? "hover:bg-brand/5 border-slate-800 hover:border-brand/30 bg-slate-900/40" : "hover:bg-brand/5 border-slate-200 hover:border-brand/30 bg-slate-50/50"
            )}
        >
            <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5 text-brand font-bold text-[9px]">
                    <FileText className="w-3 h-3" />
                    {source.filename}
                </div>
                <span className="text-[8px] text-slate-600 font-mono">ID: {source.chunkIndex}</span>
            </div>
            <p className={cn(
                "text-[10px] line-clamp-2 leading-relaxed group-hover/source:text-brand-500",
                isDarkMode ? "text-slate-400" : "text-slate-600"
            )}>
                "{source.text}"
            </p>
        </button>
    </div>
);

const InputField = ({ label, value, onChange, type = "number", step = "0.01", min, max, isAi = true, aiData = null, onOverride, tooltip, isPercentage = false, isLive = false, isFetching = false, helperText, onShowSource, isDarkMode = true, placeholder }) => {
    const displayValue = isFetching ? "" : (isPercentage ? (value * 100).toFixed(1) : value);
    const finalTooltip = (aiData?.reasoning || tooltip || "No reasoning provided") + (aiData?.adjusted ? " (adjusted)" : "");

    return (
        <div className="mb-4 group">
            <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] font-medium text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    {label}
                    {isLive && (
                        <span className="flex items-center gap-1 text-[9px] text-emerald-400 font-bold bg-emerald-500/10 px-1 rounded border border-emerald-500/20">
                            <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse"></span>
                            LIVE
                        </span>
                    )}
                    {(aiData || tooltip || aiData?.source) && (
                        <div className="relative group/tooltip">
                            <Info className="w-3 h-3 cursor-help text-slate-600 hover:text-slate-400 transition-colors" />
                            <div className={cn(
                                "absolute bottom-full left-0 mb-2 w-64 p-4 text-[10px] rounded-[20px] opacity-0 group-hover/tooltip:opacity-100 pointer-events-none transition-all z-50 shadow-[0_20px_50px_rgba(0,0,0,0.5)] border translate-y-2 group-hover/tooltip:translate-y-0",
                                isDarkMode ? "bg-slate-900 text-slate-200 border-slate-800" : "bg-white text-slate-700 border-slate-200"
                            )}>
                                <div className="flex items-center justify-between mb-2">
                                    <span className="font-bold uppercase tracking-[0.1em] text-slate-500 text-[9px]">{label}</span>
                                    {aiData?.confidence && <ConfidenceBadge confidence={aiData.confidence} />}
                                </div>
                                <p className="leading-relaxed text-slate-300 mb-4 pr-2">
                                    {aiData?.reasoning || tooltip || "AI estimated based on industry data for this sector."}
                                    {aiData?.adjusted && <span className="text-brand ml-1 font-bold">(adjusted)</span>}
                                </p>
                                <div className="pt-3 border-t border-slate-800/60 flex flex-col gap-2">
                                    <p className="text-[9px] text-slate-500 font-medium italic">Click pencil icon to override this assumption</p>
                                    {aiData?.source && <SourceLink source={aiData.source} isDarkMode={isDarkMode} onShowSource={onShowSource} />}
                                </div>
                            </div>
                        </div>
                    )}
                </label>
                <div className="flex items-center gap-2">
                    {isAi && aiData ? (
                        <ConfidenceBadge confidence={aiData.confidence} />
                    ) : isAi ? (
                        <Badge className="bg-brand/15 text-brand flex items-center gap-1 border border-brand/20">
                            <Sparkles className="w-2.5 h-2.5" /> AI
                        </Badge>
                    ) : null}
                    {onOverride && (
                        <button
                            onClick={onOverride}
                            className={cn(
                                "p-1 rounded-md transition-colors",
                                isAi ? "text-slate-600 hover:text-slate-400 hover:bg-slate-800" : "text-brand-400 bg-brand-400/10"
                            )}
                        >
                            <Pencil className="w-3 h-3" />
                        </button>
                    )}
                </div>
            </div>

            <div className="flex items-center gap-3">
                {type === "range" ? (
                    <>
                        <input
                            type="range"
                            min={min}
                            max={max}
                            step={step}
                            value={value}
                            onChange={(e) => onChange(parseFloat(e.target.value))}
                            className="flex-1"
                        />
                        <div className="relative flex items-center">
                            <input
                                type="number"
                                value={displayValue}
                                placeholder={placeholder || (isFetching ? "Fetching..." : "")}
                                onChange={(e) => {
                                    const val = parseFloat(e.target.value);
                                    onChange(isPercentage ? val / 100 : val);
                                }}
                                className={cn(
                                    "w-20 glass-input text-right pr-6 h-10",
                                    isDarkMode ? "" : "bg-white border-[#CBD5E1] text-[#0F172A] placeholder:text-slate-300 shadow-sm"
                                )}
                                step={isPercentage ? "0.1" : step}
                            />
                            {isPercentage && <span className="absolute right-2 text-[10px] text-slate-500">%</span>}
                        </div>
                    </>
                ) : (
                    <div className="relative flex items-center w-full">
                        <input
                            type={type}
                            value={displayValue}
                            placeholder={placeholder || (isFetching ? "Fetching..." : "Enter current price")}
                            onChange={(e) => {
                                const val = e.target.value;
                                if (type === "number") {
                                    const parsed = parseFloat(val);
                                    onChange(isNaN(parsed) ? "" : (isPercentage ? parsed / 100 : parsed));
                                } else {
                                    onChange(val);
                                }
                            }}
                            className={cn(
                                "w-full glass-input pr-6 h-10",
                                isDarkMode ? "" : "bg-white border-[#CBD5E1] text-[#0F172A] placeholder:text-slate-300 shadow-sm"
                            )}
                            step={isPercentage ? "0.1" : step}
                        />
                        {isPercentage && <span className="absolute right-2 text-[10px] text-slate-500">%</span>}
                    </div>
                )}
            </div>
            {helperText && <p className="mt-1 text-[9px] text-slate-500 italic">{helperText}</p>}
        </div>
    );
};

const Section = ({ title, icon: Icon, children, defaultOpen = true, isDarkMode = true }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    return (
        <div className={cn(
            "mb-4 rounded-xl border transition-all overflow-hidden",
            isDarkMode ? "bg-slate-900/40 border-slate-800/60" : "bg-white border-slate-200 shadow-sm"
        )}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    "w-full px-4 py-3 flex items-center justify-between transition-colors",
                    isDarkMode ? "hover:bg-slate-800/40" : "hover:bg-slate-50"
                )}
            >
                <div className="flex items-center gap-3">
                    <div className={cn(
                        "p-1.5 rounded-lg",
                        isDarkMode ? "bg-slate-800 text-brand-400" : "bg-brand-50 text-brand-500"
                    )}>
                        <Icon className="w-4 h-4" />
                    </div>
                    <h3 className={cn(
                        "text-xs font-semibold uppercase tracking-widest",
                        isDarkMode ? "text-slate-300" : "text-slate-700"
                    )}>{title}</h3>
                </div>
                {isOpen ? <ChevronUp className={cn("w-4 h-4", isDarkMode ? "text-slate-500" : "text-slate-400")} /> : <ChevronDown className={cn("w-4 h-4", isDarkMode ? "text-slate-500" : "text-slate-400")} />}
            </button>
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="px-4 pb-4"
                    >
                        {children}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

const Logo = ({ darkMode }) => (
    <div className="flex items-center gap-3 group">
        <div className="relative">
            <div className="absolute inset-0 bg-brand blur-md opacity-20 group-hover:opacity-40 transition-opacity" />
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="relative z-10">
                <path d="M6 22L12 16L18 20L26 10" stroke="#6366F1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="26" cy="10" r="2.5" fill="#6366F1" />
            </svg>
        </div>
        <div>
            <h1 className={cn(
                "text-lg font-bold font-sans tracking-tight leading-none",
                darkMode ? "text-white" : "text-slate-900"
            )}>ValuationAI</h1>
            <p className={cn(
                "text-[11px] font-medium tracking-tight mt-0.5",
                darkMode ? "text-slate-400" : "text-slate-500"
            )}>AI-Powered Valuation for Indian Equities</p>
        </div>
    </div>
);

const Header = ({ darkMode, setDarkMode }) => (
    <header className={cn(
        "w-full flex items-center justify-between px-6 py-4 border-b sticky top-0 z-50 transition-all backdrop-blur-md",
        darkMode ? "border-slate-800 bg-slate-950/80" : "border-slate-200 bg-white/80"
    )}>
        <Logo darkMode={darkMode} />
        <div className="flex items-center gap-4">
            <button
                onClick={() => setDarkMode(!darkMode)}
                className={cn(
                    "p-2.5 rounded-xl border transition-all",
                    darkMode ? "bg-slate-900 border-slate-800 text-slate-400 hover:text-white" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50 shadow-sm"
                )}
            >
                {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
        </div>
    </header>
);

const Footer = ({ isDarkMode = true }) => (
    <footer className={cn(
        "w-full py-8 border-t mt-12 text-center transition-all",
        isDarkMode ? "border-slate-800/60 text-slate-600" : "border-slate-200 text-slate-400"
    )}>
        <div className="max-w-4xl mx-auto px-4">
            <p className="text-xs uppercase tracking-[0.2em] mb-2 font-semibold">Disclaimer</p>
            <p className="text-[10px] leading-relaxed max-w-2xl mx-auto italic">
                BSE/NSE listed companies only. Not SEBI registered. Not investment advice. This tool is for educational purposes. Valuation models are highly sensitive to inputs; small changes in assumptions can lead to wildly different results. Always do your own due diligence.
            </p>
            <div className="mt-8 flex items-center justify-center gap-6 grayscale opacity-50">
                <div className={cn("h-4 w-px", isDarkMode ? "bg-slate-800" : "bg-slate-300")} />
                <span className="text-[10px] font-bold">© 2026 ValuationAI</span>
                <div className={cn("h-4 w-px", isDarkMode ? "bg-slate-800" : "bg-slate-300")} />
            </div>
        </div>
    </footer>
);

const CountUp = ({ value, prefix = "", suffix = "", decimals = 2 }) => {
    const count = useSpring(0, { stiffness: 100, damping: 30 });
    const display = useTransform(count, (v) => `${prefix}${v.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}${suffix}`);

    useEffect(() => {
        count.set(value);
    }, [value, count]);

    return <motion.span className="font-mono">{display}</motion.span>;
};

const ScenarioCard = ({ scenario, active, onSelect, isDarkMode = true }) => (
    <motion.button
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        onClick={() => onSelect(scenario)}
        className={cn(
            "p-5 rounded-xl border text-left transition-all relative overflow-hidden",
            active
                ? (isDarkMode ? "bg-brand/10 border-brand shadow-lg shadow-brand/10" : "bg-brand/5 border-brand shadow-md")
                : (isDarkMode ? "bg-slate-900 border-slate-800 hover:border-slate-700 shadow-xl" : "bg-white border-slate-200 hover:border-slate-300 shadow-sm")
        )}
    >
        <div className="flex items-center justify-between mb-3">
            <span className={cn(
                "text-[10px] font-bold uppercase tracking-widest",
                isDarkMode ? "text-slate-500" : "text-slate-400"
            )}>{scenario.name}</span>
            {active && <CheckCircle2 className="w-3.5 h-3.5 text-brand" />}
        </div>
        <div className={cn(
            "text-xl font-bold font-mono",
            isDarkMode ? "text-white" : "text-slate-900"
        )}>
            ₹{(scenario.outputs?.intrinsic_value || 0).toFixed(2)}
        </div>
        <div className="flex items-center gap-2 mt-2">
            <span className={cn(
                "text-[10px] font-bold uppercase",
                (scenario.outputs?.upside || 0) >= 0 ? "text-positive" : "text-negative"
            )}>
                {((scenario.outputs?.upside || 0) * 100).toFixed(1)}% {(scenario.outputs?.upside || 0) >= 0 ? "Upside" : "Overvalued"}
            </span>
        </div>
    </motion.button>
);

// --- Main App Component ---

export default function ValuationApp() {
    const [inputs, setInputs] = useState(INITIAL_INPUTS);
    const [aiGenerated, setAiGenerated] = useState(Object.keys(INITIAL_INPUTS).reduce((acc, key) => ({ ...acc, [key]: true }), {}));
    const [aiDetails, setAiDetails] = useState({});
    const [aiOriginalValues, setAiOriginalValues] = useState(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [isLoadingAI, setIsLoadingAI] = useState(false);
    const [aiError, setAiError] = useState(null);
    const [narrative, setNarrative] = useState("");
    const [documents, setDocuments] = useState([]);
    const [previewSource, setPreviewSource] = useState(null);
    const [darkMode, setDarkMode] = useState(true);
    const [savedScenarios, setSavedScenarios] = useState([]);
    const [copySuccess, setCopySuccess] = useState(false);
    const [leftPanelWidth, setLeftPanelWidth] = useState(25);
    const [rightPanelWidth, setRightPanelWidth] = useState(20);
    const [isResizingLeft, setIsResizingLeft] = useState(false);
    const [isResizingRight, setIsResizingRight] = useState(false);
    const [isDesktop, setIsDesktop] = useState(window.innerWidth > 1024);
    const rag = useMemo(() => new RAGEngine(), []);

    useEffect(() => {
        const handleResize = () => setIsDesktop(window.innerWidth > 1024);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const startResizingLeft = () => setIsResizingLeft(true);
    const startResizingRight = () => setIsResizingRight(true);
    const stopResizing = () => {
        setIsResizingLeft(false);
        setIsResizingRight(false);
    };

    useEffect(() => {
        const resize = (e) => {
            if (isResizingLeft) {
                const newWidth = (e.clientX / window.innerWidth) * 100;
                setLeftPanelWidth(Math.max(15, Math.min(40, newWidth)));
            } else if (isResizingRight) {
                const newWidth = ((window.innerWidth - e.clientX) / window.innerWidth) * 100;
                setRightPanelWidth(Math.max(15, Math.min(40, newWidth)));
            }
        };

        if (isResizingLeft || isResizingRight) {
            window.addEventListener('mousemove', resize);
            window.addEventListener('mouseup', stopResizing);
            document.body.style.cursor = 'col-resize';
        } else {
            window.removeEventListener('mousemove', resize);
            window.removeEventListener('mouseup', stopResizing);
            document.body.style.cursor = 'default';
        }
        return () => {
            window.removeEventListener('mousemove', resize);
            window.removeEventListener('mouseup', stopResizing);
            document.body.style.cursor = 'default';
        };
    }, [isResizingLeft, isResizingRight]);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const sharedData = params.get('s');
        if (sharedData) {
            try {
                const decoded = JSON.parse(atob(sharedData));
                setInputs(decoded.inputs);
                setAiDetails(decoded.details || {});
                setNarrative(decoded.narrative || "");
            } catch (e) {
                console.error("Failed to decode share link", e);
            }
        }
    }, []);

    useEffect(() => {
        if (darkMode) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }, [darkMode]);

    const handleFileUpload = async (e) => {
        const files = Array.from(e.target.files);
        for (const file of files) {
            if (file.type !== "application/pdf") continue;

            const docId = Math.random().toString(36).substr(2, 9);
            setDocuments(prev => [...prev, { id: docId, name: file.name, status: "processing" }]);

            try {
                const arrayBuffer = await file.arrayBuffer();
                const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
                let fullText = "";
                for (let i = 1; i <= pdf.numPages; i++) {
                    const page = await pdf.getPage(i);
                    const textContent = await page.getTextContent();
                    const pageText = textContent.items.map(item => item.str).join(" ");
                    fullText += pageText + "\n";
                }

                const chunks = chunkText(fullText, file.name);
                rag.addChunks(chunks);

                setDocuments(prev => prev.map(doc =>
                    doc.id === docId ? { ...doc, status: "ready", chunkCount: chunks.length } : doc
                ));
            } catch (err) {
                console.error("PDF Process Error:", err);
                setDocuments(prev => prev.map(doc =>
                    doc.id === docId ? { ...doc, status: "error" } : doc
                ));
            }
        }
    };

    const handleInputChange = (key, value) => {
        setInputs(prev => ({ ...prev, [key]: value }));
        setAiGenerated(prev => ({ ...prev, [key]: false }));
    };

    const clearAiBadge = (key) => {
        setAiGenerated(prev => ({ ...prev, [key]: false }));
    };

    const validateBounds = (key, val) => {
        const bounds = {
            revenue_growth_yr1: { min: 0.0, max: 0.4 },
            revenue_growth_yr2_5: { min: 0.0, max: 0.4 },
            operating_margin_target: { min: 0, max: 0.6 },
            wacc: { min: 0.09, max: 0.2 },
            prob_failure: { min: 0, max: 1.0 },
        };
        const b = bounds[key];
        if (!b) return { val, adjusted: false };
        if (val < b.min) return { val: b.min, adjusted: true };
        if (val > b.max) return { val: b.max, adjusted: true };
        return { val, adjusted: false };
    };

    const generateAssumptions = async () => {
        if (!searchQuery) return;
        setIsLoadingAI(true);
        setAiError(null);
        setInputs(prev => ({ ...prev, current_price: "" }));
        setAiOriginalValues(null);
        try {


            const formattedTicker = searchQuery.trim().toUpperCase();
            const queryWithSuffix = (formattedTicker.includes('.') || formattedTicker.includes(':')) ? formattedTicker : `${formattedTicker}.NS`;
            setSearchQuery(queryWithSuffix);

            let ragContext = "";
            const sourcesMap = {};

            if (documents.some(d => d.status === "ready")) {
                const queries = {
                    growth: "revenue growth, guidance, outlook, forecast, expansion",
                    margin: "operating margin, cost structure, profitability, efficiency",
                    risk: "risk factors, debt, cost of capital, beta, interest rates"
                };

                const contextChunks = [];
                Object.entries(queries).forEach(([key, q]) => {
                    const results = rag.search(q, 2);
                    results.forEach(res => {
                        contextChunks.push(`[Source: ${res.filename}, Chunk: ${res.chunkIndex}] ${res.text}`);
                        sourcesMap[`${res.filename}-${res.chunkIndex}`] = res;
                    });
                });
                ragContext = `\n\nUse the following excerpts from the company's internal documents to inform your assumptions:\n${contextChunks.join("\n")}\n\nWhen using RAG context, if an assumption is directly supported by a source, include "SOURCE: filename-chunkIndex" at the VERY END of the reasoning string for that assumption.`;
            }

            const systemPrompt = `You are a financial analyst specializing in Indian equity markets. 
            Return all financial figures in INR Crores (1 Crore = 10 million INR). 
            Return current_price in INR per share. 
            Return shares_outstanding in Crores. Use BSE/NSE data. 
            Risk-free rate should reflect India 10-year G-Sec yield (~7.1%). 
            Country risk premium for India is approximately 2%. 
            WACC for Indian companies typically ranges from 10-18%.
            Return current_price: DO NOT return this value. The user will enter it manually.
            Return ONLY valid JSON. No markdown, no explanation outside the JSON.
            All values must be realistic.`;

            const userPrompt = `Generate DCF valuation assumptions for ${queryWithSuffix}.`;

            const result = await model.generateContent([systemPrompt, userPrompt]);
            const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${import.meta.env.VITE_GROQ_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'llama-3.1-8b-instant',
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userPrompt }
                    ],
                    temperature: 0.3,
                    max_tokens: 1000
                })
            });
            const groqData = await groqResponse.json();
            let text = groqData.choices[0].message.content;

            let data;
            try {
                const cleanedText = text.replace(/```json/g, "").replace(/```/g, "").trim();
                data = JSON.parse(cleanedText);
            } catch (e) {
                setAiError("Could not parse AI response — try again");
                setIsLoadingAI(false);
                return;
            }

            if (data.revenue && !data.revenue_base) data.revenue_base = data.revenue;
            if (data.ebit && !data.ebit_base) data.ebit_base = data.ebit;
            if (data.shares && !data.shares_outstanding) data.shares_outstanding = data.shares;

            if (data.revenue_base > 1000000) {
                const scaleKeys = ['revenue_base', 'ebit_base', 'cash', 'debt', 'minority_interests', 'non_operating_assets'];
                scaleKeys.forEach(k => { if (typeof data[k] === 'number') data[k] /= 10000000; });
            }
            if (data.shares_outstanding > 1000000) data.shares_outstanding /= 10000000;

            const newInputs = { ...inputs, current_price: "" };
            const newDetails = {};
            const newAiGenerated = {};

            Object.entries(data).forEach(([key, val]) => {
                if (key === 'narrative') {
                    setNarrative(val);
                } else if (typeof val === 'object' && val !== null) {
                    const numericVal = Number(val.value);
                    const { val: clampedVal, adjusted } = validateBounds(key, numericVal);
                    newInputs[key] = clampedVal;
                    let source = null;
                    let reasoning = val.reasoning || "";
                    if (reasoning.includes("SOURCE: ")) {
                        const parts = reasoning.split("SOURCE: ");
                        reasoning = parts[0].trim();
                        source = sourcesMap[parts[1].trim()];
                    }
                    newDetails[key] = { ...val, value: numericVal, reasoning, adjusted, source };
                    newAiGenerated[key] = true;
                } else {
                    const isNumeric = !['company_name', 'ticker'].includes(key);
                    newInputs[key] = isNumeric ? Number(val) : val;
                    newAiGenerated[key] = true;
                }
            });

            setInputs(newInputs);
            setAiDetails(newDetails);
            setAiGenerated(newAiGenerated);
            setAiOriginalValues(newInputs);
        } catch (err) {
            setAiError(err.message || "Failed to generate assumptions.");
        } finally {
            setIsLoadingAI(false);
        }
    };

    const handleResetToAi = () => {
        if (aiOriginalValues) {
            setInputs(aiOriginalValues);
            setAiGenerated(Object.keys(aiOriginalValues).reduce((acc, key) => ({ ...acc, [key]: true }), {}));
        }
    };

    const handleSaveScenario = () => {
        const name = prompt("Enter a name for this scenario:", `${inputs.company_name} - ${new Date().toLocaleDateString()}`);
        if (!name) return;
        const result = runDCF(inputs);
        const newScenario = {
            id: Math.random().toString(36).substr(2, 9),
            name,
            inputs: { ...inputs },
            outputs: { intrinsic_value: result.intrinsic_value_per_share, upside: result.upside_pct }
        };
        setSavedScenarios(prev => [newScenario, ...prev].slice(0, 3));
    };

    const handleShare = () => {
        const shareData = btoa(JSON.stringify({ inputs, details: aiDetails, narrative }));
        const url = `${window.location.origin}/app?s=${shareData}`;
        navigator.clipboard.writeText(url);
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
    };

    const handleExportPDF = () => {
        const doc = new jsPDF();
        const res = runDCF(inputs);
        doc.setFontSize(22);
        doc.setTextColor(14, 165, 233);
        doc.text("ValuationAI Report", 20, 20);
        doc.save(`${(inputs.ticker || 'Valuation')}_Report.pdf`);
    };

    const result = useMemo(() => runDCF(inputs), [inputs]);
    const sensitivity = useMemo(() => sensitivityTable(inputs), [inputs]);
    const { intrinsic_value_per_share, upside_pct, value_equity, value_operating_assets, yearByYear } = result;
    const isUndervalued = inputs.current_price && intrinsic_value_per_share > inputs.current_price;

    return (
        <div className={cn(
            "flex flex-col min-h-screen w-full transition-colors duration-500 font-sans",
            darkMode ? "bg-slate-950 text-slate-200" : "bg-[#F8FAFC] text-slate-900"
        )}>
            <Header darkMode={darkMode} setDarkMode={setDarkMode} />

            <main className="flex-1 flex flex-col lg:flex-row overflow-hidden h-[calc(100vh-68px)]">
                {/* LEFT PANEL */}
                <div className={cn(
                    "panel-container overflow-y-auto custom-scrollbar border-r relative",
                    darkMode ? "bg-slate-900/50 border-slate-800" : "bg-[#FFFFFF] border-[#E2E8F0]"
                )} style={{ width: `${leftPanelWidth}%` }}>
                    <div className="p-4 lg:p-6 pb-20">
                        <div className="relative mb-6">
                            <input
                                type="text"
                                placeholder="Enter NSE ticker..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className={cn("w-full glass-input pl-10 h-10", darkMode ? "" : "bg-white border-[#CBD5E1] text-[#0F172A] shadow-sm")}
                                onKeyDown={(e) => e.key === 'Enter' && generateAssumptions()}
                            />
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
                        </div>
                        <button onClick={generateAssumptions} disabled={isLoadingAI || !searchQuery} className="w-full bg-brand-500 hover:bg-brand-600 text-white text-xs font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg active:scale-[0.98]">
                            {isLoadingAI ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} {isLoadingAI ? "Analyzing..." : "Generate Assumptions"}
                        </button>
                        <div className="mt-8 space-y-4">
                            <Section title="Company Basics" icon={Building2} isDarkMode={darkMode}>
                                <InputField label="Name" type="text" value={inputs.company_name} onChange={(v) => handleInputChange('company_name', v)} isAi={aiGenerated['company_name']} aiData={aiDetails['company_name']} onOverride={() => clearAiBadge('company_name')} onShowSource={setPreviewSource} isDarkMode={darkMode} />
                                <InputField label="Price (₹)" value={inputs.current_price} onChange={(v) => handleInputChange('current_price', v)} isAi={false} onShowSource={setPreviewSource} isDarkMode={darkMode} />
                                <InputField label="Shares (Cr)" value={inputs.shares_outstanding} onChange={(v) => handleInputChange('shares_outstanding', v)} isAi={aiGenerated['shares_outstanding']} aiData={aiDetails['shares_outstanding']} onOverride={() => clearAiBadge('shares_outstanding')} onShowSource={setPreviewSource} isDarkMode={darkMode} />
                            </Section>
                            <Section title="Growth" icon={Activity} isDarkMode={darkMode}>
                                <InputField label="Rev Growth Yr 1" type="range" min={0} max={0.4} value={inputs.revenue_growth_yr1} onChange={(v) => handleInputChange('revenue_growth_yr1', v)} isAi={aiGenerated['revenue_growth_yr1']} aiData={aiDetails['revenue_growth_yr1']} isPercentage={true} onShowSource={setPreviewSource} isDarkMode={darkMode} />
                            </Section>
                        </div>
                    </div>
                </div>

                <div className="hidden lg:block resizer-h" onMouseDown={startResizingLeft} />

                {/* CENTER PANEL */}
                <div className={cn("flex-1 panel-container relative overflow-y-auto custom-scrollbar transition-all", darkMode ? "bg-slate-950" : "bg-[#F1F5F9]")}>
                    <div className="p-4 lg:p-10 text-center lg:text-left">
                        <div className="mb-12">
                            <h2 className="text-slate-500 font-bold uppercase text-[11px] mb-4 tracking-widest">Intrinsic Value</h2>
                            <div className={cn("text-8xl font-bold font-mono tracking-tighter mb-4", !inputs.current_price ? (darkMode ? "text-white" : "text-[#0F172A]") : (isUndervalued ? "text-positive" : "text-negative"))}>
                                <CountUp value={intrinsic_value_per_share} prefix="₹" />
                            </div>
                        </div>

                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                            <div className={cn("p-6 rounded-2xl border-t-4", darkMode ? "bg-slate-900 border-brand" : "bg-white border-brand shadow-md")}>
                                <span className="text-[10px] font-bold text-slate-500 uppercase block mb-2">Equity Value</span>
                                <span className="text-2xl font-bold font-mono">₹{(Math.round(value_equity)).toLocaleString()} Cr</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="hidden lg:block resizer-h" onMouseDown={startResizingRight} />

                {/* RIGHT PANEL */}
                <aside className={cn("panel-container overflow-y-auto border-l", darkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200")} style={{ width: `${rightPanelWidth}%` }}>
                    <div className="p-6">
                        <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-6 flex items-center gap-2"><Sparkles className="w-3.5 h-3.5 text-brand" /> AI Narrative</h3>
                        <div className={cn("p-6 rounded-2xl border-l-4", darkMode ? "bg-slate-900/40 border-brand" : "bg-white border-brand shadow-sm")}>
                            <p className="text-sm italic leading-relaxed">{narrative || "Run valuation to generate AI analysis..."}</p>
                        </div>
                    </div>
                </aside>
            </main>
        </div>
    );
}
