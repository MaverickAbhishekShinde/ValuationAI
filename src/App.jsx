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

// --- New Components ---

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






// --- Main App ---


export default function App() {
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
    const [showLanding, setShowLanding] = useState(true);
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

    // Resize handlers
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

    // Load from Share Link
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const sharedData = params.get('s');
        if (sharedData) {
            try {
                const decoded = JSON.parse(atob(sharedData));
                setInputs(decoded.inputs);
                setAiDetails(decoded.details || {});
                setNarrative(decoded.narrative || "");
                setShowLanding(false);
            } catch (e) {
                console.error("Failed to decode share link", e);
            }
        }
    }, []);

    // Scenarios are now session-only as requested
    useEffect(() => {
        // Removed localStorage persistence
    }, [savedScenarios]);

    // Handle Dark/Light Class
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
        // Clear previous price immediately
        setInputs(prev => ({ ...prev, current_price: "" }));
        setAiOriginalValues(null);
        try {

            const formattedTicker = searchQuery.trim().toUpperCase();
            const queryWithSuffix = (formattedTicker.includes('.') || formattedTicker.includes(':')) ? formattedTicker : `${formattedTicker}.NS`;
            setSearchQuery(queryWithSuffix);

            // RAG Context Retrieval
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
            All values must be realistic: revenue growth 0–40% for Indian growth companies, 
            wacc between 0.09 and 0.20, margins between 0 and 0.50.
            Base your reasoning on publicly known information about the company.${ragContext}`;

            const userPrompt = `Generate DCF valuation assumptions for ${queryWithSuffix}.
            Return this exact JSON structure:
            {
              "company_name": "string",
              "ticker": "string", 
              "shares_outstanding": number,
              "revenue_base": number,
              "ebit_base": number,
              "cash": number,
              "debt": number,
              "minority_interests": number,
              "non_operating_assets": number,
              "revenue_growth_yr1": { "value": number, "confidence": "high"|"medium"|"low", "reasoning": "string max 100 chars" },
              "revenue_growth_yr2_5": { "value": number, "confidence": "high"|"medium"|"low", "reasoning": "string max 100 chars" },
              "operating_margin_base": { "value": number, "reasoning": "string" },
              "operating_margin_target": { "value": number, "confidence": "high"|"medium"|"low", "reasoning": "string max 100 chars" },
              "margin_convergence_year": { "value": number, "reasoning": "string" },
              "sales_to_capital_1_5": { "value": number, "confidence": "high"|"medium"|"low", "reasoning": "string max 100 chars" },
              "wacc": { "value": number, "confidence": "high"|"medium"|"low", "reasoning": "string max 100 chars" },
              "riskfree_rate": { "value": number, "reasoning": "string" },
              "tax_rate_effective": { "value": number, "reasoning": "string" },
              "tax_rate_marginal": { "value": number, "reasoning": "string" },
              "prob_failure": { "value": number, "reasoning": "string" },
              "narrative": "2-3 sentence bull case story for this company"
            }`;

            const result = await model.generateContent([systemPrompt, userPrompt]);
            const response = await result.response;
            let text = response.text();

            let data;
            try {
                // Strip markdown code fences and trim whitespace
                const cleanedText = text.replace(/```json/g, "").replace(/```/g, "").trim();
                console.log("AI RAW DATA:", cleanedText); // Verification log
                data = JSON.parse(cleanedText);
                console.log("PARSED AI DATA:", data);
            } catch (e) {
                console.error("JSON Parse Error:", e);
                setAiError("Could not parse AI response — try again");
                setIsLoadingAI(false);
                return;
            }

            // Safety: Map common variations back to our expected keys
            if (data.revenue && !data.revenue_base) data.revenue_base = data.revenue;
            if (data.ebit && !data.ebit_base) data.ebit_base = data.ebit;
            if (data.shares && !data.shares_outstanding) data.shares_outstanding = data.shares;

            // Unit Validation: Normalize financials (₹ Cr)
            if (data.revenue_base > 10000000) {
                console.warn("Detected absolute INR revenue. Normalizing to ₹ Crores.");
                const scaleKeys = ['revenue_base', 'ebit_base', 'cash', 'debt', 'minority_interests', 'non_operating_assets'];
                scaleKeys.forEach(k => {
                    if (typeof data[k] === 'number') data[k] /= 10000000;
                });
            }

            // Specific guard for shares outstanding (Crores)
            if (data.shares_outstanding > 1000000) {
                console.warn("Detected absolute share count. Normalizing to Crores.");
                data.shares_outstanding /= 10000000;
            }

            const newInputs = { ...inputs, current_price: "" }; // Ensure price stays clear
            const newDetails = {};
            const newAiGenerated = {};

            Object.entries(data).forEach(([key, val]) => {
                if (key === 'narrative') {
                    setNarrative(val);
                } else if (typeof val === 'object' && val !== null) {
                    const numericVal = Number(val.value);
                    const { val: clampedVal, adjusted } = validateBounds(key, numericVal);
                    newInputs[key] = clampedVal;

                    // Parse RAG Source
                    let source = null;
                    let reasoning = val.reasoning || "";
                    if (reasoning.includes("SOURCE: ")) {
                        const parts = reasoning.split("SOURCE: ");
                        reasoning = parts[0].trim();
                        const sourceKey = parts[1].trim();
                        source = sourcesMap[sourceKey];
                    }

                    newDetails[key] = { ...val, value: numericVal, reasoning, adjusted, source };
                    newAiGenerated[key] = true;
                } else {
                    const isNumeric = !['company_name', 'ticker'].includes(key);
                    newInputs[key] = isNumeric ? Number(val) : val;
                    newAiGenerated[key] = true;
                }
            });

            console.log("FINAL INPUTS BEFORE SETTING STATE:", newInputs);
            setInputs(newInputs);
            setAiDetails(newDetails);
            setAiGenerated(newAiGenerated);
            setAiOriginalValues(newInputs); // Save for reset
        } catch (err) {
            console.error(err);
            if (err.message?.includes("429")) {
                setAiError("API Quota exceeded. Please wait 60 seconds and try again.");
            } else {
                setAiError(err.message || "Failed to generate assumptions. Please check your API key and network.");
            }
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
            date: new Date().toLocaleDateString(),
            inputs: { ...inputs },
            outputs: {
                intrinsic_value: result.intrinsic_value_per_share,
                upside: result.upside_pct
            }
        };

        setSavedScenarios(prev => [newScenario, ...prev].slice(0, 3));
    };

    const handleShare = () => {
        const shareData = btoa(JSON.stringify({
            inputs,
            details: aiDetails,
            narrative
        }));
        const url = `${window.location.origin}${window.location.pathname}?s=${shareData}`;
        navigator.clipboard.writeText(url);
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
    };

    const handleExportPDF = () => {
        const doc = new jsPDF();
        const res = runDCF(inputs);

        // Header
        doc.setFontSize(22);
        doc.setTextColor(14, 165, 233); // Brand color
        doc.text("ValuationAI Report", 20, 20);

        doc.setFontSize(14);
        doc.setTextColor(100, 116, 139);
        doc.text(`${inputs.company_name} (${inputs.ticker})`, 20, 30);

        doc.setFontSize(10);
        doc.text(`Generated on ${new Date().toLocaleDateString()}`, 20, 35);

        // Intrinsic Value Box
        doc.setDrawColor(14, 165, 233);
        doc.setLineWidth(0.5);
        doc.rect(20, 45, 170, 25);
        doc.setFontSize(12);
        doc.setTextColor(51, 65, 85);
        doc.text("Intrinsic Value Per Share", 30, 55);
        doc.setFontSize(24);
        doc.text(`₹${res.intrinsic_value_per_share.toFixed(2)}`, 30, 65);

        const currentPrice = typeof inputs.current_price === 'number' ? inputs.current_price : 0;
        doc.setFontSize(12);
        doc.text(`Current Price: $${currentPrice.toFixed(2)}`, 110, 55);
        const upside = res.upside_pct * 100;
        doc.setTextColor(upside > 0 ? 16 : 244, upside > 0 ? 185 : 63, upside > 0 ? 129 : 94);
        doc.text(`${upside > 0 ? '+' : ''}${upside.toFixed(1)}% ${upside > 0 ? 'Upside' : 'Overvalued'}`, 110, 65);

        // Narrative
        doc.setTextColor(51, 65, 85);
        doc.setFontSize(14);
        doc.text("Investment Narrative", 20, 85);
        doc.setFontSize(10);
        const splitNarrative = doc.splitTextToSize(narrative || "No narrative generated.", 170);
        doc.text(splitNarrative, 20, 95);

        // Assumptions Table
        doc.setFontSize(14);
        doc.text("Key Assumptions", 20, 115);

        const assumptionData = [
            ["Revenue Growth (Yr 1)", `${(inputs.revenue_growth_yr1 * 100).toFixed(1)}%`, aiDetails.revenue_growth_yr1?.reasoning || "Manual Input"],
            ["Revenue Growth (Yr 2-5)", `${(inputs.revenue_growth_yr2_5 * 100).toFixed(1)}%`, aiDetails.revenue_growth_yr2_5?.reasoning || "Manual Input"],
            ["Target Operating Margin", `${(inputs.operating_margin_target * 100).toFixed(1)}%`, aiDetails.operating_margin_target?.reasoning || "Manual Input"],
            ["WACC", `${(inputs.wacc * 100).toFixed(2)}%`, aiDetails.wacc?.reasoning || "Manual Input"],
            ["Risk-Free Rate", `${(inputs.riskfree_rate * 100).toFixed(2)}%`, aiDetails.riskfree_rate?.reasoning || "Manual Input"],
            ["Sales to Capital", `${inputs.sales_to_capital_1_5.toFixed(2)}`, aiDetails.sales_to_capital_1_5?.reasoning || "Manual Input"]
        ];

        autoTable(doc, {
            startY: 120,
            head: [['Assumption', 'Value', 'Reasoning/Source']],
            body: assumptionData,
            theme: 'striped',
            headStyles: { fillColor: [14, 165, 233] }
        });

        // 10-Year Projection Summary
        doc.addPage();
        doc.setFontSize(14);
        doc.text("10-Year Financial Projections (₹ Cr)", 20, 20);

        const yearByYearData = res.yearByYear.map(y => [
            `Year ${y.year}`,
            `₹${y.revenue.toFixed(0)}`,
            `${(y.margin * 100).toFixed(1)}%`,
            `₹${y.ebit.toFixed(0)}`,
            `₹${y.fcff.toFixed(0)}`,
            `₹${y.pv_fcff.toFixed(0)}`
        ]);

        autoTable(doc, {
            startY: 25,
            head: [['Year', 'Revenue', 'Margin', 'EBIT', 'FCFF', 'PV(FCFF)']],
            body: yearByYearData,
            theme: 'grid',
            headStyles: { fillColor: [14, 165, 233] }
        });

        try {
            doc.setFontSize(8);
            doc.setTextColor(148, 163, 184);
            const pageHeight = doc.internal.pageSize.height || doc.internal.pageSize.getHeight();
            doc.text("Disclaimer: Not financial advice. For educational purposes only.", 20, pageHeight - 10);

            const fileName = `${(inputs.ticker || 'Valuation').replace(/[^a-z0-9]/gi, '_')}_Report.pdf`;
            doc.save(fileName);
        } catch (e) {
            console.error("PDF Save Error:", e);
            alert("Failed to save PDF. Please check console for details.");
        }
    };

    const result = useMemo(() => {
        console.log("RUNNING DCF WITH INPUTS:", inputs);
        return runDCF(inputs);
    }, [inputs]);
    const sensitivity = useMemo(() => sensitivityTable(inputs), [inputs]);

    const { intrinsic_value_per_share, upside_pct, value_equity, value_operating_assets, pv_terminal_value, pv_cf_10years, yearByYear } = result;

    const isUndervalued = inputs.current_price && intrinsic_value_per_share > inputs.current_price;

    if (showLanding) {
        return (
            <div className="min-h-screen w-full flex flex-col font-sans overflow-x-hidden">
                {/* TOP SECTION (60% Height) - DARK */}
                <section className="h-[65vh] bg-[#0A0A0F] relative flex items-center px-6 lg:px-20 overflow-hidden">
                    <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
                        style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '40px 40px' }} />

                    <div className="max-w-7xl w-full mx-auto grid lg:grid-cols-2 gap-12 items-center relative z-10">
                        <motion.div
                            initial={{ opacity: 0, x: -30 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.8 }}
                            className="flex flex-col items-start text-left lg:pl-20"
                        >
                            <span className="text-[#6366F1] font-bold text-[11px] uppercase tracking-[3px] mb-6 block">Built for NSE & BSE</span>
                            <h1 className="text-5xl lg:text-[64px] font-bold text-white leading-[1.1] tracking-tight mb-8">
                                Value any <span className="text-[#6366F1]">Indian</span> stock <br />
                                in under 10 seconds.
                            </h1>
                            <p className="text-slate-400 text-lg lg:text-xl mb-10 max-w-xl leading-relaxed">
                                AI generates assumptions. Damodaran's math does the valuation. You stay in control.
                            </p>

                            <div className="flex flex-wrap items-center gap-6 mb-12">
                                <button
                                    onClick={() => setShowLanding(false)}
                                    className="bg-[#6366F1] text-white px-8 py-4 rounded-xl font-bold flex items-center gap-2 hover:bg-[#4F46E5] transition-all hover:scale-105 active:scale-95 shadow-xl shadow-indigo-500/20"
                                >
                                    Start Valuing Free <ArrowRight className="w-5 h-5" />
                                </button>
                                <button
                                    onClick={() => document.getElementById('features-section')?.scrollIntoView({ behavior: 'smooth' })}
                                    className="text-slate-400 border border-slate-800 px-8 py-4 rounded-xl font-bold hover:bg-white/5 transition-all"
                                >
                                    See how it works
                                </button>
                            </div>

                            <p className="text-slate-500 text-[11px] font-medium flex items-center gap-2">
                                <span className="text-amber-500 text-sm"></span>
                            </p>
                        </motion.div>

                        {/* Miniature App Preview */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            transition={{ duration: 1, delay: 0.2 }}
                            className="hidden lg:block relative"
                        >
                            <div className="absolute inset-0 bg-brand/20 blur-[100px] rounded-full" />
                            <div className="glass-card border-[#6366F1]/30 shadow-2xl p-6 relative z-10 scale-90 origin-right">
                                <div className="flex items-center justify-between mb-8">
                                    <div>
                                        <h3 className="text-white font-bold text-lg">Reliance Industries</h3>
                                        <p className="text-slate-500 text-xs font-mono">RELIANCE.NS</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">Intrinsic Value</p>
                                        <p className="text-2xl font-bold text-brand font-mono">₹1,847.00</p>
                                    </div>
                                </div>

                                <div className="space-y-4 mb-8">
                                    <div className="h-2 bg-slate-800/50 rounded-full w-full overflow-hidden">
                                        <div className="h-full bg-brand w-3/4" />
                                    </div>
                                    <div className="h-2 bg-slate-800/50 rounded-full w-2/3 overflow-hidden">
                                        <div className="h-full bg-emerald-500 w-1/2" />
                                    </div>
                                </div>

                                <div className="grid grid-cols-3 gap-2">
                                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => (
                                        <div key={i} className={cn("h-8 rounded", i % 2 === 0 ? "bg-emerald-500/10 border border-emerald-500/20" : "bg-brand/10 border border-brand/20")} />
                                    ))}
                                </div>
                            </div>
                        </motion.div>
                    </div>
                </section>

                {/* BOTTOM SECTION (40% Height) - LIGHT */}
                <section id="features-section" className="flex-1 bg-[#F8FAFC] py-20 px-6 lg:px-20 border-t border-slate-200">
                    <div className="max-w-7xl w-full mx-auto grid md:grid-cols-3 gap-16 lg:gap-32">
                        {[
                            { number: '01', title: 'AI Explains Everything', desc: 'Every assumption comes with reasoning. Know why the model picked 12% growth, not just that it did.' },
                            { number: '02', title: 'Override Anything', desc: 'Disagree with the AI? Change any number. The valuation recalculates instantly.' },
                            { number: '03', title: "Damodaran's Math", desc: 'Built on the FCFF model used by NYU Stern professors. Not a black box.' }
                        ].map((f, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.1 }}
                            >
                                <span className="text-[#6366F1] font-mono font-bold text-2xl lg:text-4xl mb-4 block">{f.number}</span>
                                <h4 className="text-[#0F172A] text-xl lg:text-2xl font-bold mb-4">{f.title}</h4>
                                <p className="text-slate-500 leading-relaxed text-sm lg:text-base">{f.desc}</p>
                            </motion.div>
                        ))}
                    </div>
                </section>

                <footer className="bg-[#F8FAFC] py-8 px-6 lg:px-20 border-t border-slate-100 text-center">
                    <p className="text-slate-400 text-xs font-medium tracking-tight">
                        Not SEBI registered. For educational purposes only.
                    </p>
                </footer>
            </div>
        );
    }

    return (
        <div className={cn(
            "flex flex-col min-h-screen w-full transition-colors duration-500 font-sans",
            darkMode ? "bg-slate-950 text-slate-200" : "bg-[#F8FAFC] text-slate-900"
        )}>
            <Header darkMode={darkMode} setDarkMode={setDarkMode} />

            <main className="flex-1 flex flex-col lg:flex-row overflow-hidden h-[calc(100vh-68px)]">
                {/* LEFT PANEL - INPUTS (25% default) */}
                <div className={cn(
                    "panel-container overflow-y-auto custom-scrollbar border-r relative",
                    darkMode ? "bg-slate-900/50 border-slate-800" : "bg-[#FFFFFF] border-[#E2E8F0]"
                )} style={{ width: `${leftPanelWidth}%` }}>
                    <div className="p-4 lg:p-6 pb-20">
                        <div className="flex items-center justify-between mb-8">
                            <h2 className={cn(
                                "text-[10px] font-bold uppercase tracking-[0.2em]",
                                darkMode ? "text-slate-500" : "text-slate-400"
                            )}>Risk Assumptions</h2>
                            {aiOriginalValues && (
                                <button
                                    onClick={handleResetToAi}
                                    className="flex items-center gap-1.5 text-[10px] font-bold text-brand-400 hover:text-brand-300 transition-colors bg-brand-500/10 px-2 py-1 rounded-lg border border-brand-500/20"
                                >
                                    <RotateCcw className="w-3 h-3" /> Reset to AI
                                </button>
                            )}
                        </div>
                        <div className="relative mb-6">
                            <input
                                type="text"
                                placeholder="Enter NSE ticker (e.g. RELIANCE, INFY, ZOMATO)..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className={cn("w-full glass-input pl-10 h-10", darkMode ? "" : "bg-white border-[#CBD5E1] text-[#0F172A] placeholder:text-slate-300 shadow-sm")}
                                onKeyDown={(e) => e.key === 'Enter' && generateAssumptions()}
                            />
                            <div className={cn("absolute left-3 top-1/2 -translate-y-1/2", darkMode ? "text-slate-500" : "text-slate-400")}>
                                <Search className="w-4 h-4" />
                            </div>
                        </div>
                        <button
                            onClick={generateAssumptions}
                            disabled={isLoadingAI || !searchQuery}
                            className="w-full bg-brand-500 hover:bg-brand-600 disabled:bg-slate-800 disabled:text-slate-500 text-white text-xs font-bold uppercase tracking-widest py-3 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg active:scale-[0.98]"
                        >
                            {isLoadingAI ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                            {isLoadingAI ? "Analyzing..." : "Generate Assumptions"}
                        </button>
                        {aiError && (
                            <div className="mt-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg">
                                <p className="text-[10px] text-rose-400 mb-2">{aiError}</p>
                                <button onClick={generateAssumptions} className="text-[10px] text-rose-400 font-bold uppercase hover:underline">Retry</button>
                            </div>
                        )}

                        <div className="mt-8 space-y-4">
                            <Section title="Company Basics" icon={Building2} isDarkMode={darkMode}>
                                <InputField label="Name" type="text" value={inputs.company_name} onChange={(v) => handleInputChange('company_name', v)} isAi={aiGenerated['company_name']} aiData={aiDetails['company_name']} onOverride={() => clearAiBadge('company_name')} onShowSource={setPreviewSource} isDarkMode={darkMode} />
                                <div className="grid grid-cols-2 gap-4">
                                    <InputField label="Ticker" type="text" value={inputs.ticker} onChange={(v) => handleInputChange('ticker', v)} isAi={aiGenerated['ticker']} aiData={aiDetails['ticker']} onOverride={() => clearAiBadge('ticker')} onShowSource={setPreviewSource} isDarkMode={darkMode} />
                                    <InputField label="Price (₹)" value={inputs.current_price} onChange={(v) => handleInputChange('current_price', v)} isAi={false} helperText="Enter manually" onShowSource={setPreviewSource} isDarkMode={darkMode} />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <InputField label="Shares (Cr)" value={inputs.shares_outstanding} onChange={(v) => handleInputChange('shares_outstanding', v)} isAi={aiGenerated['shares_outstanding']} aiData={aiDetails['shares_outstanding']} onOverride={() => clearAiBadge('shares_outstanding')} onShowSource={setPreviewSource} isDarkMode={darkMode} />
                                    <InputField label="Cash (₹ Cr)" value={inputs.cash} onChange={(v) => handleInputChange('cash', v)} isAi={aiGenerated['cash']} aiData={aiDetails['cash']} onOverride={() => clearAiBadge('cash')} onShowSource={setPreviewSource} isDarkMode={darkMode} />
                                </div>
                                <InputField label="Debt (₹ Cr)" value={inputs.debt} onChange={(v) => handleInputChange('debt', v)} isAi={aiGenerated['debt']} aiData={aiDetails['debt']} onOverride={() => clearAiBadge('debt')} onShowSource={setPreviewSource} isDarkMode={darkMode} />
                            </Section>

                            <Section title="Growth" icon={Activity} isDarkMode={darkMode}>
                                <InputField label="Rev Growth Yr 1" type="range" min={0} max={0.4} step={0.01} value={inputs.revenue_growth_yr1} onChange={(v) => handleInputChange('revenue_growth_yr1', v)} isAi={aiGenerated['revenue_growth_yr1']} aiData={aiDetails['revenue_growth_yr1']} onOverride={() => clearAiBadge('revenue_growth_yr1')} isPercentage={true} onShowSource={setPreviewSource} isDarkMode={darkMode} />
                                <InputField label="Rev Growth Yr 2-5" type="range" min={0} max={0.4} step={0.01} value={inputs.revenue_growth_yr2_5} onChange={(v) => handleInputChange('revenue_growth_yr2_5', v)} isAi={aiGenerated['revenue_growth_yr2_5']} aiData={aiDetails['revenue_growth_yr2_5']} onOverride={() => clearAiBadge('revenue_growth_yr2_5')} isPercentage={true} onShowSource={setPreviewSource} isDarkMode={darkMode} />
                            </Section>

                            <Section title="Profitability" icon={Target} isDarkMode={darkMode}>
                                <InputField label="Target Margin" type="range" min={0} max={0.6} step={0.01} value={inputs.operating_margin_target} onChange={(v) => handleInputChange('operating_margin_target', v)} isAi={aiGenerated['operating_margin_target']} aiData={aiDetails['operating_margin_target']} onOverride={() => clearAiBadge('operating_margin_target')} isPercentage={true} onShowSource={setPreviewSource} isDarkMode={darkMode} />
                                <div className="mb-4">
                                    <label className={cn("text-[11px] font-medium uppercase tracking-wider block mb-1.5", darkMode ? "text-slate-400" : "text-slate-600")}>Margin Convergence</label>
                                    <select className={cn("w-full glass-input", darkMode ? "" : "bg-white border-[#CBD5E1] text-[#0F172A] placeholder:text-slate-300 shadow-sm")} value={inputs.margin_convergence_year} onChange={(e) => handleInputChange('margin_convergence_year', parseInt(e.target.value))}>
                                        {[3, 5, 7, 10].map(y => <option key={y} value={y}>{y} Years</option>)}
                                    </select>
                                </div>
                            </Section>

                            <Section title="Risk" icon={Shield} isDarkMode={darkMode}>
                                <InputField label="WACC" type="range" min={0.09} max={0.20} step={0.001} value={inputs.wacc} onChange={(v) => handleInputChange('wacc', v)} isAi={aiGenerated['wacc']} aiData={aiDetails['wacc']} onOverride={() => clearAiBadge('wacc')} isPercentage={true} onShowSource={setPreviewSource} isDarkMode={darkMode} />
                                <InputField label="Risk-Free Rate" type="range" min={0.01} max={0.10} step={0.001} value={inputs.riskfree_rate} onChange={(v) => handleInputChange('riskfree_rate', v)} isAi={aiGenerated['riskfree_rate']} aiData={aiDetails['riskfree_rate']} onOverride={() => clearAiBadge('riskfree_rate')} isPercentage={true} onShowSource={setPreviewSource} isDarkMode={darkMode} />
                            </Section>
                        </div>
                    </div>
                </div>

                {/* DRAG HANDLE LEFT */}
                <div className="hidden lg:block resizer-h" onMouseDown={startResizingLeft} />

                {/* CENTER PANEL - VALUATION OUTPUT (55% default) */}
                <div className={cn(
                    "flex-1 panel-container relative overflow-y-auto custom-scrollbar transition-all",
                    darkMode ? "bg-slate-950" : "bg-[#F1F5F9]"
                )}>
                    <div className="p-4 lg:p-10">
                        <div className="flex flex-col lg:flex-row items-center justify-between mb-12 gap-10">
                            <div className="flex flex-col items-center lg:items-start text-center lg:text-left">
                                <h2 className="text-slate-500 font-bold tracking-[0.2em] uppercase text-[11px] mb-4">Intrinsic Value Per Share</h2>
                                <div className={cn(
                                    "text-8xl lg:text-[72px] font-bold font-mono tracking-tighter mb-4 drop-shadow-2xl",
                                    !inputs.current_price ? (darkMode ? "text-white" : "text-[#0F172A]") :
                                        (isUndervalued ? "text-positive" : "text-negative")
                                )}>
                                    <CountUp value={intrinsic_value_per_share} prefix="₹" />
                                </div>
                                <div className="flex items-center gap-4 mb-4">
                                    <span className="text-slate-500 text-sm font-medium">Market: <span className={cn("font-mono", darkMode ? "text-slate-400" : "text-slate-600")}>{inputs.current_price ? `₹${Number(inputs.current_price).toFixed(2)}` : <span className={cn("italic", darkMode ? "text-slate-600" : "text-slate-400")}>Enter price to see upside/downside</span>}</span></span>
                                    {inputs.current_price && (
                                        <span className={cn(
                                            "px-3 py-1 rounded-full text-xs font-bold ring-1",
                                            isUndervalued ? "bg-positive/10 text-positive ring-positive/30" : "bg-negative/10 text-negative ring-negative/30"
                                        )}>
                                            {(typeof upside_pct === 'number' && isFinite(upside_pct)) ? `${upside_pct > 0 ? '+' : ''}${(upside_pct * 100).toFixed(1)}% ${upside_pct > 0 ? 'Upside' : 'Overvalued'}` : '-%'}
                                        </span>
                                    )}
                                </div>
                                <p className={cn("text-[11px] font-medium italic max-w-sm", darkMode ? "text-slate-500" : "text-slate-400")}>Valuation models are highly sensitive to inputs. Use for educational purposes only.</p>
                            </div>

                            <div className="flex flex-wrap items-center justify-center gap-3">
                                <button
                                    onClick={handleSaveScenario}
                                    className={cn(
                                        "p-3 rounded-2xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all",
                                        darkMode ? "bg-slate-900 border border-slate-800 text-slate-400 hover:text-brand-400 hover:border-brand-500/30" : "bg-white border border-slate-200 text-slate-600 hover:text-brand-500 hover:border-brand-500/30 shadow-sm"
                                    )}
                                >
                                    <Save className="w-4 h-4" /> Save
                                </button>
                                <button
                                    onClick={handleShare}
                                    className={cn(
                                        "p-3 rounded-2xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all relative",
                                        darkMode ? "bg-slate-900 border border-slate-800 text-slate-400 hover:text-brand-400 hover:border-brand-500/30" : "bg-white border border-slate-200 text-slate-600 hover:text-brand-500 hover:border-brand-500/30 shadow-sm"
                                    )}
                                >
                                    <AnimatePresence>
                                        {copySuccess ? (
                                            <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} className="flex items-center gap-2 text-emerald-400">
                                                <Check className="w-4 h-4" /> Copied!
                                            </motion.span>
                                        ) : (
                                            <><Share2 className="w-4 h-4" /> Share</>
                                        )}
                                    </AnimatePresence>
                                </button>
                                <button
                                    onClick={handleExportPDF}
                                    className="p-3 bg-brand-500 text-white rounded-2xl hover:bg-brand-600 transition-all flex items-center gap-2 text-xs font-bold uppercase tracking-wider shadow-lg shadow-brand-500/20"
                                >
                                    <Download className="w-4 h-4" /> Export PDF
                                </button>
                            </div>
                        </div>

                        {/* Scenario Comparison Grid */}
                        {savedScenarios.length > 0 && (
                            <div className="mb-12">
                                <h3 className={cn("text-[11px] font-bold uppercase tracking-widest mb-4 flex items-center gap-2", darkMode ? "text-slate-500" : "text-slate-400")}>
                                    <Zap className="w-3.5 h-3.5" /> Scenario Comparison
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    {savedScenarios.map(s => (
                                        <ScenarioCard
                                            key={s.id}
                                            scenario={s}
                                            active={JSON.stringify(s.inputs) === JSON.stringify(inputs)}
                                            onSelect={(scen) => setInputs(scen.inputs)}
                                            isDarkMode={darkMode}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Equity Valuation Bridge Waterfall */}
                        <div className="mb-12 glass-card p-8 relative overflow-hidden group" style={{ borderColor: darkMode ? "rgb(30 41 59 / 0.4)" : "rgb(226 232 240)" }}>
                            <h3 className={cn("text-[11px] font-bold uppercase tracking-widest mb-8 flex items-center gap-2", darkMode ? "text-slate-500" : "text-slate-400")}>
                                <Target className="w-3.5 h-3.5" /> Equity Valuation Bridge
                            </h3>

                            <div className="flex flex-wrap items-center justify-center lg:justify-between gap-4">
                                <div className={cn(
                                    "min-w-[140px] flex-1 p-4 rounded-xl border-t-4 text-center shadow-sm",
                                    darkMode ? "bg-positive/5 border-positive/20" : "bg-white border-positive"
                                )}>
                                    <span className={cn("text-[10px] font-bold uppercase block mb-1", darkMode ? "text-slate-500" : "text-slate-400")}>Operating Assets</span>
                                    <span className="text-xl font-mono font-bold text-positive">₹{(Math.round(value_operating_assets)).toLocaleString()} Cr</span>
                                </div>

                                <Plus className={cn("w-3 h-3", darkMode ? "text-slate-700" : "text-slate-400")} />

                                <div className={cn(
                                    "min-w-[140px] flex-1 p-4 rounded-xl border-t-4 text-center shadow-sm",
                                    darkMode ? "bg-positive/5 border-positive/20" : "bg-white border-positive"
                                )}>
                                    <span className={cn("text-[10px] font-bold uppercase block mb-1", darkMode ? "text-slate-500" : "text-slate-400")}>Cash</span>
                                    <span className="text-xl font-mono font-bold text-positive">₹{(Math.round(inputs.cash)).toLocaleString()} Cr</span>
                                </div>

                                <Plus className={cn("w-3 h-3", darkMode ? "text-slate-700" : "text-slate-400")} />

                                <div className={cn(
                                    "min-w-[140px] flex-1 p-4 rounded-xl border-t-4 text-center shadow-sm",
                                    darkMode ? "bg-positive/5 border-positive/20" : "bg-white border-positive"
                                )}>
                                    <span className={cn("text-[10px] font-bold uppercase block mb-1", darkMode ? "text-slate-500" : "text-slate-400")}>Other Assets</span>
                                    <span className="text-xl font-mono font-bold text-positive">₹{(Math.round(inputs.non_operating_assets)).toLocaleString()} Cr</span>
                                </div>

                                <Minus className={cn("w-3 h-3", darkMode ? "text-slate-700" : "text-slate-400")} />

                                <div className={cn(
                                    "min-w-[140px] flex-1 p-4 rounded-xl border-t-4 text-center shadow-sm",
                                    darkMode ? "bg-negative/5 border-negative/20" : "bg-white border-negative"
                                )}>
                                    <span className={cn("text-[10px] font-bold uppercase block mb-1", darkMode ? "text-slate-500" : "text-slate-400")}>Debt</span>
                                    <span className="text-xl font-mono font-bold text-negative">₹{(Math.round(inputs.debt)).toLocaleString()} Cr</span>
                                </div>

                                <ArrowRight className={cn("w-3 h-3 hidden lg:block", darkMode ? "text-slate-700" : "text-slate-400")} />

                                <div className={cn(
                                    "min-w-[160px] flex-1 p-4 rounded-xl border-t-4 text-center ring-1 shadow-lg",
                                    darkMode ? "bg-brand/5 border-brand/40 ring-brand/10" : "bg-white border-brand shadow-brand/10 ring-brand/10"
                                )}>
                                    <span className={cn("text-[10px] font-bold uppercase block mb-1", darkMode ? "text-slate-500" : "text-slate-400")}>Equity Value</span>
                                    <span className="text-xl font-mono font-bold text-brand">₹{(Math.round(value_equity)).toLocaleString()} Cr</span>
                                </div>
                            </div>
                            <p className={cn("mt-8 text-center text-xs font-medium tracking-tight", darkMode ? "text-slate-500" : "text-slate-400")}>
                                Divide by <span className={cn("font-mono", darkMode ? "text-slate-300" : "text-slate-600")}>{(inputs.shares_outstanding).toFixed(1)} Cr</span> shares = <span className="text-brand font-mono font-bold">₹{intrinsic_value_per_share.toFixed(2)}</span> per share
                            </p>
                        </div>

                        {/* Sensitivity Matrix */}
                        <div className="mb-12">
                            <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-6 flex items-center gap-2">
                                <Activity className="w-3.5 h-3.5" /> Sensitivity Matrix: Intrinsic Value (₹)
                            </h3>
                            <div className={cn(
                                "glass-card overflow-hidden shadow-xl overflow-x-auto transition-colors",
                                darkMode ? "border-slate-800/40" : "border-slate-200 bg-white"
                            )}>
                                <table className="w-full text-[11px] border-collapse min-w-[500px]">
                                    <thead>
                                        <tr>
                                            <th className={cn(
                                                "p-3 border font-medium text-left transition-colors",
                                                darkMode ? "bg-slate-900/80 border-slate-800/60 text-slate-500" : "bg-[#F1F5F9] border-slate-200 text-[#1E293B]"
                                            )}>WACC →<br />Growth ↓</th>
                                            {sensitivity.waccValues.map(w => (
                                                <th key={w} className={cn(
                                                    "p-3 border font-mono text-center transition-colors",
                                                    darkMode ? "bg-slate-900/80 border-slate-800/60 text-slate-300" : "bg-[#F1F5F9] border-slate-200 text-[#1E293B]"
                                                )}>{(w * 100).toFixed(1)}%</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {sensitivity.growthValues.map((g, gi) => (
                                            <tr key={g}>
                                                <td className={cn(
                                                    "p-3 border font-medium whitespace-nowrap transition-colors",
                                                    darkMode ? "bg-slate-900/80 border-slate-800/60 text-slate-300" : "bg-[#F1F5F9] border-slate-200 text-[#1E293B]"
                                                )}>{(g * 100).toFixed(1)}% Rev</td>
                                                {sensitivity.matrix.map((row, wi) => {
                                                    const val = row[gi];
                                                    const isBase = gi === 2 && wi === 2;
                                                    const baseVal = sensitivity.matrix[2][2];
                                                    const diff = (val / baseVal) - 1;

                                                    return (
                                                        <td
                                                            key={wi}
                                                            className={cn(
                                                                "p-3 border text-center font-mono transition-all group/cell relative cursor-help",
                                                                darkMode ? "border-slate-800/40" : "border-slate-100 bg-white",
                                                                isBase && (darkMode ? "bg-brand/10 font-bold" : "bg-brand/5 font-bold"),
                                                                diff > 0.1 ? "text-positive" : diff < -0.1 ? "text-negative" : (darkMode ? "text-slate-400" : "text-slate-600")
                                                            )}
                                                        >
                                                            ₹{val.toFixed(2)}
                                                            <div className={cn(
                                                                "absolute bottom-full left-1/2 -translate-x-1/2 mb-2 p-2 rounded-lg opacity-0 group-hover/cell:opacity-100 transition-opacity z-50 pointer-events-none whitespace-nowrap shadow-2xl scale-90 origin-bottom group-hover/cell:scale-100 border",
                                                                darkMode ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200 shadow-slate-200"
                                                            )}>
                                                                <p className={cn("text-[9px] font-bold mb-1", darkMode ? "text-slate-300" : "text-slate-700")}>Assumption Set</p>
                                                                <p className="text-[10px] text-slate-500">WACC: {(sensitivity.waccValues[wi] * 100).toFixed(1)}%</p>
                                                                <p className="text-[10px] text-slate-500">Growth: {(g * 100).toFixed(1)}%</p>
                                                            </div>
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Year-by-Year Table */}
                        <Section title="10-Year DCF Projection Table" icon={PieChart} defaultOpen={false} isDarkMode={darkMode}>
                            <div className="overflow-x-auto custom-scrollbar">
                                <table className="w-full text-[10px] text-left border-collapse min-w-[800px]">
                                    <thead>
                                        <tr className="border-b border-slate-800">
                                            <th className="py-2 text-slate-500 uppercase font-bold">Year</th>
                                            <th className="py-2 text-slate-500 uppercase font-bold">Revenue (₹ Cr)</th>
                                            <th className="py-2 text-slate-500 uppercase font-bold">Margin</th>
                                            <th className="py-2 text-slate-500 uppercase font-bold">EBIT (₹ Cr)</th>
                                            <th className="py-2 text-slate-500 uppercase font-bold">FCFF (₹ Cr)</th>
                                            <th className="py-2 text-slate-500 uppercase font-bold text-right">PV(FCFF)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800/50 font-mono">
                                        {yearByYear.map(y => (
                                            <tr key={y.year} className="group/row hover:bg-slate-800/30 transition-colors">
                                                <td className="py-3 text-slate-500">Yr {y.year}</td>
                                                <td className="py-3 text-slate-100">₹{y.revenue.toFixed(0)}</td>
                                                <td className="py-3 text-slate-400">{(y.margin * 100).toFixed(1)}%</td>
                                                <td className="py-3 text-slate-300">₹{y.ebit.toFixed(0)}</td>
                                                <td className="py-3 text-brand">₹{y.fcff.toFixed(1)}</td>
                                                <td className="py-3 text-positive text-right">₹{y.pv_fcff.toFixed(1)}</td>
                                            </tr>
                                        ))}
                                        <tr className="bg-brand/5 font-bold border-t border-brand/20">
                                            <td className="py-4 text-brand" colSpan={4}>Sum of PV(FCFF) + Terminal Value</td>
                                            <td colSpan={2} className="py-4 text-positive text-right font-mono text-xs">₹{(value_operating_assets).toFixed(1)} Cr</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </Section>

                        <Footer isDarkMode={darkMode} />
                    </div>
                </div>

                {/* DRAG HANDLE RIGHT */}
                <div className="hidden lg:block resizer-h" onMouseDown={startResizingRight} />

                {/* RIGHT PANEL - NARRATIVE & INTELLIGENCE (20% default) */}
                <aside
                    className={cn(
                        "panel-container overflow-y-auto custom-scrollbar border-l relative transition-colors",
                        darkMode ? "bg-slate-900/50 border-slate-800" : "bg-[#FFFFFF] border-[#E2E8F0]"
                    )}
                    style={{ width: `${rightPanelWidth}%` }}
                >
                    <div className="p-6">
                        <div className="mb-8">
                            <h3 className={cn("text-[10px] font-bold uppercase tracking-widest mb-6 flex items-center gap-2", darkMode ? "text-slate-500" : "text-slate-400")}>
                                <Sparkles className="w-3.5 h-3.5 text-brand" /> AI Narrative
                            </h3>
                            <div className={cn(
                                "p-6 rounded-[24px] border-l-4 relative transition-all",
                                darkMode ? "bg-slate-900/40 border-brand shadow-2xl" : "bg-white border-brand shadow-md"
                            )}>
                                <Quote className="absolute top-4 right-4 w-8 h-8 text-brand/10" />
                                <p className={cn(
                                    "text-sm leading-relaxed italic relative z-10",
                                    darkMode ? "text-slate-300" : "text-[#0F172A]"
                                )}>
                                    {narrative || "Run valuation to generate AI analysis..."}
                                </p>
                            </div>
                        </div>

                        <div className="mb-8">
                            <h3 className={cn("text-[10px] font-bold uppercase tracking-widest mb-4 flex items-center gap-2", darkMode ? "text-slate-500" : "text-slate-400")}>
                                <FileUp className="w-3.5 h-3.5" /> Intelligence Center
                            </h3>
                            <label className={cn(
                                "border-2 border-dashed rounded-[24px] p-6 flex flex-col items-center justify-center text-center group transition-all cursor-pointer",
                                darkMode ? "border-slate-800 bg-slate-900/20 hover:border-brand/50 hover:bg-brand/5" : "border-slate-200 bg-slate-50 hover:border-brand/30 hover:bg-brand/5"
                            )}>
                                <input type="file" className="hidden" accept="application/pdf" multiple onChange={handleFileUpload} />
                                <FileUp className="w-6 h-6 text-slate-500 group-hover:text-brand mb-2" />
                                <h4 className="text-[10px] font-bold text-slate-400 uppercase">Upload Filings</h4>
                            </label>
                        </div>

                        <div>
                            <h4 className={cn("text-[8px] font-bold uppercase tracking-[0.2em] mb-4 border-b pb-2", darkMode ? "text-slate-600 border-slate-800" : "text-slate-400 border-slate-200")}>Active Documents</h4>
                            <div className="space-y-3">
                                {documents.length === 0 ? (
                                    <p className="text-[10px] text-slate-500 italic text-center py-4">No filings loaded.</p>
                                ) : (
                                    documents.map(doc => (
                                        <div key={doc.id} className={cn(
                                            "p-3 rounded-xl border flex items-center gap-3",
                                            darkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
                                        )}>
                                            <div className={cn(
                                                "w-6 h-6 rounded flex items-center justify-center",
                                                doc.status === 'ready' ? "bg-positive/10 text-positive" : "bg-brand/10 text-brand"
                                            )}>
                                                {doc.status === 'ready' ? <CheckCircle2 className="w-3 h-3" /> : <Loader2 className="w-3 h-3 animate-spin" />}
                                            </div>
                                            <p className={cn("text-[10px] font-bold truncate", darkMode ? "text-slate-400" : "text-slate-600")}>{doc.name}</p>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </aside>
            </main>

            {/* SOURCE PREVIEW MODAL */}
            <AnimatePresence>
                {previewSource && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] flex items-center justify-center p-6 lg:p-20 bg-black/90 backdrop-blur-md"
                        onClick={() => setPreviewSource(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            className="bg-slate-900 border border-slate-800 w-full max-w-4xl rounded-[40px] overflow-hidden shadow-2xl flex flex-col max-h-full"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="p-8 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-brand-500/10 flex items-center justify-center text-brand-400 border border-brand-500/20">
                                        <FileText className="w-7 h-7" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm lg:text-base font-bold text-slate-100">{previewSource.filename}</h3>
                                        <p className="text-[10px] text-slate-500 font-mono uppercase tracking-[0.2em]">Context Segment {previewSource.chunkIndex}</p>
                                    </div>
                                </div>
                                <button onClick={() => setPreviewSource(null)} className="p-3 hover:bg-slate-800 rounded-2xl transition-colors text-slate-500 hover:text-white">
                                    <X className="w-6 h-6" />
                                </button>
                            </div>
                            <div className="flex-1 overflow-y-auto p-12 bg-slate-950/20">
                                <div className="max-w-3xl mx-auto">
                                    <p className="text-xl lg:text-2xl text-slate-200 leading-relaxed font-serif relative">
                                        <span className="absolute -left-6 top-0 text-brand-500/30 text-6xl rotate-180">"</span>
                                        {previewSource.text}
                                        <span className="text-brand-500/30 text-6xl">"</span>
                                    </p>
                                    <div className="mt-12 pt-8 border-t border-slate-800 flex items-center gap-4">
                                        <Badge className="bg-emerald-500/10 text-emerald-400">Primary Source</Badge>
                                        <Badge className="bg-slate-800 text-slate-500">TF-IDF Vectorized</Badge>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
