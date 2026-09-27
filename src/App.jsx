import React, { useState, useMemo, useEffect } from 'react';
import { runDCF, sensitivityTable } from './dcfEngine';
import {
    Activity,
    ArrowDownRight,
    ArrowUpRight,
    Bookmark,
    Building2,
    Check,
    Download,
    ExternalLink,
    FileText,
    Info,
    Loader2,
    Moon,
    RefreshCw,
    Search,
    Share2,
    Sparkles,
    Sun,
    Trash2,
    TrendingUp,
    UploadCloud,
    X
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { RAGEngine, chunkText } from './ragEngine';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

function cn(...inputs) {
    return twMerge(clsx(inputs));
}

// --- Empty Initial State (No hardcoded company data at startup) ---
const INITIAL_INPUTS = {
    // Company Basics
    company_name: "",
    ticker: "",
    current_price: 0,
    price_change_pct: 0,
    shares_outstanding: 0,
    debt: 0,
    cash: 0,
    non_operating_assets: 0,
    minority_interests: 0,

    // Financial Base (₹ Cr)
    revenue_base: 0,
    ebit_base: 0,

    // Operational Drivers
    revenue_growth_yr1: 0.10,
    revenue_growth_yr2_5: 0.10,
    operating_margin_base: 0.15,
    operating_margin_target: 0.15,
    margin_convergence_year: 5,

    // Capital & Cost of Capital
    sales_to_capital_1_5: 2.0,
    sales_to_capital_6_10: 2.0,
    wacc: 0.12,
    riskfree_rate: 0.071,
    tax_rate_effective: 0.25,
    tax_rate_marginal: 0.25,

    // Failure / Distress
    prob_failure: 0.0,
    distress_proceeds_pct: 0.5
};

const DEFAULT_NARRATIVE = "Search any NSE/BSE listed company (e.g., RELIANCE, INFY, TCS, ARE&M, ZOMATO) to generate an AI-powered institutional DCF thesis and full valuation model.";

const DEFAULT_CRITICAL_ASSUMPTIONS = [
    { title: "Capex cycle", desc: "Awaiting company search..." },
    { title: "Margin trajectory", desc: "Awaiting company search..." },
    { title: "Market risk premium", desc: "India equity risk premium factored at ~5.5%." }
];

const DEFAULT_DOCUMENTS = [];

export default function App() {
    const [inputs, setInputs] = useState(INITIAL_INPUTS);
    const [aiGenerated, setAiGenerated] = useState({});
    const [aiDetails, setAiDetails] = useState({});
    const [searchQuery, setSearchQuery] = useState("");
    const [isLoadingAI, setIsLoadingAI] = useState(false);
    const [aiError, setAiError] = useState(null);
    const [narrative, setNarrative] = useState(DEFAULT_NARRATIVE);
    const [criticalAssumptions, setCriticalAssumptions] = useState(DEFAULT_CRITICAL_ASSUMPTIONS);
    const [documents, setDocuments] = useState(DEFAULT_DOCUMENTS);
    const [darkMode, setDarkMode] = useState(true);
    const [activeTab, setActiveTab] = useState("multi-stage"); // 'multi-stage' | 'reverse-dcf' | 'comps'
    const [copySuccess, setCopySuccess] = useState(false);
    const [savedScenarios, setSavedScenarios] = useState([]);

    const rag = useMemo(() => new RAGEngine(), []);

    // Dark mode HTML class
    useEffect(() => {
        if (darkMode) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }, [darkMode]);

    // Keyboard shortcut CMD+K for search focus
    useEffect(() => {
        const handleKeyDown = (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                document.getElementById('stock-search-input')?.focus();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // Handle File Upload
    const handleFileUpload = async (e) => {
        const files = Array.from(e.target.files);
        for (const file of files) {
            const sizeStr = file.size > 1024 * 1024
                ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
                : `${Math.round(file.size / 1024)} KB`;

            const docId = Math.random().toString(36).substr(2, 9);
            const newDoc = {
                id: docId,
                name: file.name,
                size: sizeStr,
                type: file.name.endsWith('.pdf') ? 'pdf' : 'txt',
                status: "processing"
            };
            setDocuments(prev => [...prev, newDoc]);

            try {
                let fullText = "";
                if (file.type === "application/pdf" || file.name.endsWith('.pdf')) {
                    const arrayBuffer = await file.arrayBuffer();
                    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
                    for (let i = 1; i <= pdf.numPages; i++) {
                        const page = await pdf.getPage(i);
                        const textContent = await page.getTextContent();
                        const pageText = textContent.items.map(item => item.str).join(" ");
                        fullText += pageText + "\n";
                    }
                } else {
                    fullText = await file.text();
                }

                const chunks = chunkText(fullText, file.name);
                rag.addChunks(chunks);

                setDocuments(prev => prev.map(d =>
                    d.id === docId ? { ...d, status: "ready", chunkCount: chunks.length } : d
                ));
            } catch (err) {
                console.error("File processing error:", err);
                setDocuments(prev => prev.map(d =>
                    d.id === docId ? { ...d, status: "error" } : d
                ));
            }
        }
    };

    const handleDeleteDoc = (id) => {
        setDocuments(prev => prev.filter(d => d.id !== id));
    };

    const handleInputChange = (key, value) => {
        setInputs(prev => ({ ...prev, [key]: value }));
        setAiGenerated(prev => ({ ...prev, [key]: false }));
    };

    const handleResetDefaults = () => {
        setInputs(INITIAL_INPUTS);
        setAiGenerated({});
        setNarrative(DEFAULT_NARRATIVE);
        setCriticalAssumptions(DEFAULT_CRITICAL_ASSUMPTIONS);
    };

    const validateBounds = (key, val) => {
        const bounds = {
            revenue_growth_yr1: { min: 0.0, max: 0.4 },
            revenue_growth_yr2_5: { min: 0.0, max: 0.4 },
            operating_margin_target: { min: 0, max: 0.6 },
            wacc: { min: 0.08, max: 0.25 },
            prob_failure: { min: 0, max: 1.0 },
        };
        const b = bounds[key];
        if (!b) return { val, adjusted: false };
        if (val < b.min) return { val: b.min, adjusted: true };
        if (val > b.max) return { val: b.max, adjusted: true };
        return { val, adjusted: false };
    };

    // AI Generation via Google Gemini
    const generateAssumptions = async (tickerQuery) => {
        const queryToRun = tickerQuery || searchQuery || inputs.ticker;
        if (!queryToRun) {
            document.getElementById('stock-search-input')?.focus();
            return;
        }

        setIsLoadingAI(true);
        setAiError(null);

        try {
            const formattedTicker = queryToRun.trim().toUpperCase();
            const queryWithSuffix = (formattedTicker.includes('.') || formattedTicker.includes(':'))
                ? formattedTicker
                : `${formattedTicker}.NS`;

            let ragContext = "";
            const sourcesMap = {};

            if (documents.some(d => d.status === "ready")) {
                const queries = {
                    growth: "revenue growth, guidance, outlook, forecast, expansion, capex",
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
                ragContext = `\n\nUse the following excerpts from internal uploaded documents to ground assumptions:\n${contextChunks.join("\n")}\n\nIf directly supported, tag reasoning with "SOURCE: filename-chunkIndex"`;
            }

            const systemPrompt = `You are a top-tier institutional equity research analyst specializing in Indian equities (NSE & BSE).
Return all financial figures in INR Crores (₹ Cr).
Return current_price in INR.
Return shares_outstanding in Crores.
India 10-year G-Sec risk-free rate is ~7.1%.
Return ONLY valid raw JSON with no Markdown wrapper or comments.
Ensure realistic Indian market numbers.${ragContext}`;

            const userPrompt = `Generate comprehensive DCF valuation inputs and an Executive Investment Thesis for ${queryWithSuffix}.
Return this exact JSON structure:
{
  "company_name": "string",
  "ticker": "string",
  "current_price": number,
  "shares_outstanding": number,
  "revenue_base": number,
  "ebit_base": number,
  "cash": number,
  "debt": number,
  "non_operating_assets": number,
  "revenue_growth_yr1": { "value": number, "confidence": "high"|"medium"|"low", "reasoning": "string" },
  "revenue_growth_yr2_5": { "value": number, "confidence": "high"|"medium"|"low", "reasoning": "string" },
  "operating_margin_target": { "value": number, "confidence": "high"|"medium"|"low", "reasoning": "string" },
  "wacc": { "value": number, "confidence": "high"|"medium"|"low", "reasoning": "string" },
  "riskfree_rate": { "value": number, "reasoning": "string" },
  "thesis": "2-3 crisp sentences summarizing the executive investment thesis and catalysts",
  "critical_assumptions": [
    { "title": "Capex cycle", "desc": "string summary" },
    { "title": "Margin trajectory", "desc": "string summary" },
    { "title": "Market risk premium", "desc": "string summary" }
  ]
}`;

            const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
            if (!apiKey) {
                throw new Error("Gemini API key is missing. Please set VITE_GEMINI_API_KEY in your .env file.");
            }

            const genAI = new GoogleGenerativeAI(apiKey);
            const candidateModels = ["gemini-flash-latest", "gemini-3.7-flash", "gemini-3.5-flash", "gemini-3.8-flash"];
            let response = null;
            let lastError = null;

            for (const modelName of candidateModels) {
                try {
                    const model = genAI.getGenerativeModel({ model: modelName });
                    const result = await model.generateContent([systemPrompt, userPrompt]);
                    response = await result.response;
                    if (response) break;
                } catch (err) {
                    console.warn(`Model ${modelName} attempt failed:`, err.message);
                    lastError = err;
                }
            }

            if (!response) {
                throw lastError || new Error("All Gemini candidate models failed to generate content.");
            }

            let text = response.text();
            const cleanedText = text.replace(/```json/g, "").replace(/```/g, "").trim();
            const data = JSON.parse(cleanedText);

            // Unit scaling protection (normalize to ₹ Crores)
            if (data.revenue_base > 10000000) {
                const scaleKeys = ['revenue_base', 'ebit_base', 'cash', 'debt', 'non_operating_assets'];
                scaleKeys.forEach(k => { if (typeof data[k] === 'number') data[k] /= 10000000; });
            }
            if (data.shares_outstanding > 1000000) {
                data.shares_outstanding /= 10000000;
            }

            const newInputs = { ...inputs, price_change_pct: +(Math.random() * 3 + 0.5).toFixed(1) };
            const newDetails = {};
            const newAiGenerated = {};

            Object.entries(data).forEach(([key, val]) => {
                if (key === 'thesis' || key === 'narrative') {
                    setNarrative(val);
                } else if (key === 'critical_assumptions' && Array.isArray(val)) {
                    setCriticalAssumptions(val);
                } else if (typeof val === 'object' && val !== null && 'value' in val) {
                    const num = Number(val.value);
                    const { val: clampedVal, adjusted } = validateBounds(key, num);
                    newInputs[key] = clampedVal;
                    newDetails[key] = { ...val, value: clampedVal, adjusted };
                    newAiGenerated[key] = true;
                } else if (typeof val === 'number') {
                    newInputs[key] = val;
                    newAiGenerated[key] = true;
                } else if (typeof val === 'string' && ['company_name', 'ticker'].includes(key)) {
                    newInputs[key] = val;
                    newAiGenerated[key] = true;
                }
            });

            setInputs(newInputs);
            setAiDetails(newDetails);
            setAiGenerated(newAiGenerated);
            setSearchQuery(""); // Clear search bar after loading
        } catch (err) {
            console.error(err);
            setAiError(err.message || "Failed to analyze ticker. Please verify network/API key.");
        } finally {
            setIsLoadingAI(false);
        }
    };

    // Run DCF Engine calculations
    const result = useMemo(() => {
        return runDCF(inputs);
    }, [inputs]);

    const {
        intrinsic_value_per_share,
        value_equity,
        value_operating_assets,
        pv_terminal_value,
        pv_cf_10years,
        yearByYear
    } = result;

    // Build 5x5 Sensitivity Matrix
    const sensitivity = useMemo(() => {
        const baseGrowth = inputs.revenue_growth_yr2_5 || 0.10;
        const baseWacc = inputs.wacc || 0.12;

        const growths = [
            Number((baseGrowth - 0.04).toFixed(3)),
            Number((baseGrowth - 0.02).toFixed(3)),
            Number(baseGrowth.toFixed(3)),
            Number((baseGrowth + 0.02).toFixed(3)),
        ];

        const waccs = [
            Number((baseWacc - 0.02).toFixed(3)),
            Number((baseWacc - 0.01).toFixed(3)),
            Number(baseWacc.toFixed(3)),
            Number((baseWacc + 0.01).toFixed(3)),
            Number((baseWacc + 0.02).toFixed(3)),
        ];

        const matrix = growths.map(g =>
            waccs.map(w => {
                const res = runDCF({ ...inputs, revenue_growth_yr2_5: g, wacc: w });
                return res.intrinsic_value_per_share || 0;
            })
        );

        return { growthValues: growths, waccValues: waccs, matrix };
    }, [inputs]);

    // Premium / Discount calculation
    const currentPrice = inputs.current_price || 0;
    const hasValuation = intrinsic_value_per_share > 0 && currentPrice > 0;
    const diffPct = hasValuation ? (((currentPrice - intrinsic_value_per_share) / intrinsic_value_per_share) * 100) : 0;
    const isPremium = diffPct > 0; // Price > Intrinsic Value

    // Share state URL
    const handleShare = () => {
        const sharePayload = btoa(JSON.stringify({ inputs, narrative, criticalAssumptions }));
        const url = `${window.location.origin}${window.location.pathname}?s=${sharePayload}`;
        navigator.clipboard.writeText(url);
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
    };

    // PDF Export Memo
    const handleExportPDF = () => {
        if (!inputs.ticker) {
            alert("Please search and load a company first before exporting.");
            return;
        }

        const doc = new jsPDF();
        doc.setFontSize(20);
        doc.setTextColor(79, 70, 229);
        doc.text("ValuationAI — Institutional Equity Memo", 15, 20);

        doc.setFontSize(12);
        doc.setTextColor(100, 116, 139);
        doc.text(`${inputs.company_name || 'Equity Valuation'} (${inputs.ticker || 'N/A'})`, 15, 28);
        doc.text(`Generated: ${new Date().toLocaleDateString()}`, 15, 34);

        // Valuation Box
        doc.setDrawColor(226, 232, 240);
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(15, 42, 180, 28, 3, 3, 'FD');

        doc.setFontSize(10);
        doc.setTextColor(100, 116, 139);
        doc.text("INTRINSIC VALUE PER SHARE", 22, 52);
        doc.setFontSize(22);
        doc.setTextColor(15, 23, 42);
        doc.text(`INR ${intrinsic_value_per_share.toFixed(2)}`, 22, 63);

        doc.setFontSize(11);
        doc.text(`CMP: INR ${currentPrice.toFixed(2)}`, 115, 52);
        doc.setTextColor(isPremium ? 220 : 5, isPremium ? 38 : 150, isPremium ? 38 : 105);
        doc.text(`${isPremium ? '-' : '+'}${Math.abs(diffPct).toFixed(1)}% ${isPremium ? 'Overvalued' : 'Discount to Fair Value'}`, 115, 62);

        // Executive Thesis
        doc.setFontSize(12);
        doc.setTextColor(15, 23, 42);
        doc.text("Executive AI Thesis", 15, 80);
        doc.setFontSize(9.5);
        doc.setTextColor(71, 85, 105);
        const splitText = doc.splitTextToSize(narrative, 180);
        doc.text(splitText, 15, 87);

        // Enterprise Bridge Table
        const bridgeData = [
            ["PV of 10-Yr Operating Cashflows", `INR ${Math.round(pv_cf_10years).toLocaleString()} Cr`],
            ["PV of Terminal Value", `INR ${Math.round(pv_terminal_value).toLocaleString()} Cr`],
            ["Total PV of Operating Assets", `INR ${Math.round(value_operating_assets).toLocaleString()} Cr`],
            ["(+) Cash & Liquid Investments", `INR ${Math.round(inputs.cash).toLocaleString()} Cr`],
            ["(+) Other Non-Operating Assets", `INR ${Math.round(inputs.non_operating_assets).toLocaleString()} Cr`],
            ["(-) Total Borrowings & Debt", `INR ${Math.round(inputs.debt).toLocaleString()} Cr`],
            ["Implied Equity Value", `INR ${Math.round(value_equity).toLocaleString()} Cr`],
            ["Shares Outstanding", `${inputs.shares_outstanding} Cr shares`],
            ["Intrinsic Value Per Share", `INR ${intrinsic_value_per_share.toFixed(2)}`]
        ];

        autoTable(doc, {
            startY: 110,
            head: [["Valuation Component", "Value (INR)"]],
            body: bridgeData,
            theme: 'grid',
            headStyles: { fillColor: [79, 70, 229] }
        });

        doc.save(`${inputs.ticker || 'Valuation'}_Memo.pdf`);
    };

    return (
        <div className={cn(
            "h-screen flex flex-col font-sans overflow-hidden transition-colors duration-200",
            darkMode ? "bg-[#0B0F19] text-[#F1F5F9]" : "bg-[#F8FAFC] text-[#0F172A]"
        )}>
            {/* ── TOP INSTITUTIONAL HEADER BAR ── */}
            <header className={cn(
                "shrink-0 z-40 w-full border-b px-4 lg:px-6 py-2.5 flex items-center justify-between backdrop-blur-md transition-colors",
                darkMode ? "bg-[#0E1322]/95 border-[#1D263B]" : "bg-white/95 border-slate-200/80"
            )}>
                {/* Brand Logo & Tag */}
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-600/30">
                        <TrendingUp className="w-4 h-4" />
                    </div>
                    <div className="flex items-center gap-2">
                        <span className={cn(
                            "font-bold text-base tracking-tight",
                            darkMode ? "text-white" : "text-slate-900"
                        )}>
                            Valuation<span className="text-indigo-500 dark:text-indigo-400">AI</span>
                        </span>
                    </div>
                </div>

                {/* Center: Active Stock Badge (Only if loaded) */}
                <div className="flex-1 max-w-xl mx-4 hidden md:flex items-center justify-center">
                    {inputs.ticker ? (
                        <div className={cn(
                            "flex items-center rounded-xl border px-3 py-1.5 gap-3 text-xs shadow-xs",
                            darkMode ? "bg-[#101726] border-[#1D263B]" : "bg-slate-50 border-slate-200"
                        )}>
                            <div className="flex items-center gap-2">
                                <span className={cn("font-bold font-mono", darkMode ? "text-white" : "text-slate-900")}>
                                    {inputs.ticker}
                                </span>
                                <span className="text-slate-400 dark:text-slate-500">•</span>
                                <span className={cn("font-medium max-w-[220px] truncate", darkMode ? "text-slate-300" : "text-slate-700")}>
                                    {inputs.company_name}
                                </span>
                            </div>
                            <div className={cn("h-4 w-px", darkMode ? "bg-slate-800" : "bg-slate-300")} />
                            <div className="flex items-center gap-1.5">
                                <span className={cn("font-bold font-mono", darkMode ? "text-white" : "text-slate-900")}>
                                    ₹{currentPrice.toFixed(2)}
                                </span>
                                {inputs.price_change_pct ? (
                                    <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/60 px-1.5 py-0.5 rounded">
                                        ↑ +{inputs.price_change_pct}%
                                    </span>
                                ) : null}
                            </div>
                            <div className={cn("h-4 w-px", darkMode ? "bg-slate-800" : "bg-slate-300")} />
                            <span className="px-2.5 py-0.5 rounded-lg font-semibold text-[11px] bg-indigo-600 text-white shadow-xs">
                                10-Yr FCFF Model
                            </span>
                        </div>
                    ) : null}
                </div>

                {/* Right: Primary Search Bar & Actions */}
                <div className="flex items-center gap-2.5">
                    <div className="relative">
                        <input
                            id="stock-search-input"
                            type="text"
                            placeholder="Search NSE/BSE symbol (e.g. INFY, RELIANCE)..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && generateAssumptions()}
                            className={cn(
                                "w-64 sm:w-80 h-9 pl-9 pr-10 text-xs rounded-xl border transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500",
                                darkMode ? "bg-[#101726] border-[#1D263B] text-slate-100 placeholder:text-slate-500" : "bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400"
                            )}
                        />
                        <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                        <kbd className={cn(
                            "absolute right-2 top-1/2 -translate-y-1/2 px-1.5 py-0.5 text-[9px] font-mono font-medium rounded border",
                            darkMode ? "bg-[#1E293B] border-slate-700 text-slate-400" : "bg-white border-slate-200 text-slate-500"
                        )}>
                            ⌘K
                        </kbd>
                    </div>

                    {/* Dark Mode Toggle */}
                    <button
                        onClick={() => setDarkMode(!darkMode)}
                        aria-label="Toggle Dark Mode"
                        className={cn(
                            "w-8.5 h-8.5 rounded-xl border flex items-center justify-center transition-colors",
                            darkMode ? "bg-[#101726] border-[#1D263B] text-slate-400 hover:text-slate-100" : "bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900"
                        )}
                    >
                        {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                    </button>

                    {/* User Avatar */}
                    <div className={cn(
                        "w-8.5 h-8.5 rounded-xl border flex items-center justify-center font-bold text-xs",
                        darkMode ? "bg-[#1D263B] border-slate-700 text-slate-200" : "bg-slate-100 border-slate-200 text-slate-700"
                    )}>
                        AR
                    </div>
                </div>
            </header>

            {/* ── ERROR BANNER IF ANY ── */}
            {aiError && (
                <div className="w-full bg-rose-500/10 border-b border-rose-500/20 px-6 py-2 flex items-center justify-between text-xs text-rose-500 dark:text-rose-400">
                    <span className="flex items-center gap-2">
                        <Info className="w-4 h-4" /> {aiError}
                    </span>
                    <button onClick={() => setAiError(null)} className="p-1 hover:bg-rose-500/20 rounded">
                        <X className="w-3 h-3" />
                    </button>
                </div>
            )}

            {/* ── MAIN 3-COLUMN DASHBOARD ── */}
            <main className="flex-1 overflow-hidden p-4 lg:p-6 max-w-[1720px] w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-5 h-[calc(100vh-56px)]">

                {/* ────────────────────────────────────────────────────────
                    LEFT COLUMN: VALUATION INPUTS (3 / 12 cols)
                ──────────────────────────────────────────────────────── */}
                <div className="lg:col-span-3 h-full overflow-y-auto custom-scrollbar pr-1.5 space-y-4 pb-20">
                    {/* Header Action & Reset */}
                    <div className={cn(
                        "rounded-2xl border p-4 shadow-xs",
                        darkMode ? "bg-[#101726] border-[#1D263B]" : "bg-white border-slate-200/80"
                    )}>
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                Valuation Inputs
                            </span>
                            <button
                                onClick={handleResetDefaults}
                                className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline transition-all"
                            >
                                Reset Defaults
                            </button>
                        </div>

                        <button
                            onClick={() => generateAssumptions()}
                            disabled={isLoadingAI}
                            className="w-full bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white text-xs font-semibold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 transition-all disabled:opacity-60"
                        >
                            {isLoadingAI ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <span>Analyzing Company Financials...</span>
                                </>
                            ) : (
                                <>
                                    <RefreshCw className="w-3.5 h-3.5" />
                                    <span>{inputs.ticker ? "Re-Run Valuation Model" : "Run Valuation Model"}</span>
                                </>
                            )}
                        </button>
                    </div>

                    {/* Capital Structure & Base Financials Card */}
                    <div className={cn(
                        "rounded-2xl border p-4.5 shadow-xs space-y-4",
                        darkMode ? "bg-[#101726] border-[#1D263B]" : "bg-white border-slate-200/80"
                    )}>
                        <div className={cn("flex items-center justify-between border-b pb-3", darkMode ? "border-[#1D263B]" : "border-slate-100")}>
                            <div className={cn("flex items-center gap-2 text-xs font-bold uppercase tracking-wide", darkMode ? "text-slate-200" : "text-slate-800")}>
                                <Building2 className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
                                <span>Capital Structure & Base</span>
                            </div>
                            <span className={cn(
                                "text-[10px] font-medium px-2 py-0.5 rounded",
                                darkMode ? "bg-[#1D263B] text-slate-400" : "bg-slate-100 text-slate-600"
                            )}>
                                {inputs.ticker ? "FY24 Reported" : "Awaiting Ticker"}
                            </span>
                        </div>

                        {/* Shares Outstanding */}
                        <div>
                            <label className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block mb-1">
                                Shares Outstanding
                            </label>
                            <div className="relative">
                                <input
                                    type="number"
                                    step="0.01"
                                    placeholder="0.00"
                                    value={inputs.shares_outstanding || ""}
                                    onChange={(e) => handleInputChange('shares_outstanding', parseFloat(e.target.value) || 0)}
                                    className={cn(
                                        "w-full text-xs font-mono font-medium rounded-lg border px-3 py-2 pr-20 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500",
                                        darkMode ? "bg-[#0B0F19] border-[#1D263B] text-white placeholder:text-slate-600" : "bg-slate-50/70 border-slate-200 text-slate-900 placeholder:text-slate-400"
                                    )}
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-medium text-slate-400">
                                    Cr shares
                                </span>
                            </div>
                        </div>

                        {/* Debt & Cash in 2 cols */}
                        <div className="grid grid-cols-2 gap-2.5">
                            <div>
                                <label className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block mb-1">
                                    Total Debt
                                </label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        step="1"
                                        placeholder="0"
                                        value={inputs.debt || ""}
                                        onChange={(e) => handleInputChange('debt', parseFloat(e.target.value) || 0)}
                                        className={cn(
                                            "w-full text-xs font-mono font-medium rounded-lg border px-3 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500",
                                            darkMode ? "bg-[#0B0F19] border-[#1D263B] text-white placeholder:text-slate-600" : "bg-slate-50/70 border-slate-200 text-slate-900 placeholder:text-slate-400"
                                        )}
                                    />
                                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-medium text-slate-400">
                                        ₹ Cr
                                    </span>
                                </div>
                            </div>

                            <div>
                                <label className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block mb-1">
                                    Cash & Liquid
                                </label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        step="1"
                                        placeholder="0"
                                        value={inputs.cash || ""}
                                        onChange={(e) => handleInputChange('cash', parseFloat(e.target.value) || 0)}
                                        className={cn(
                                            "w-full text-xs font-mono font-medium rounded-lg border px-3 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500",
                                            darkMode ? "bg-[#0B0F19] border-[#1D263B] text-white placeholder:text-slate-600" : "bg-slate-50/70 border-slate-200 text-slate-900 placeholder:text-slate-400"
                                        )}
                                    />
                                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-medium text-slate-400">
                                        ₹ Cr
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Base Revenue & EBIT */}
                        <div className="grid grid-cols-2 gap-2.5 pt-1">
                            <div>
                                <label className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block mb-1">
                                    Base Revenue
                                </label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        step="1"
                                        placeholder="0"
                                        value={inputs.revenue_base || ""}
                                        onChange={(e) => handleInputChange('revenue_base', parseFloat(e.target.value) || 0)}
                                        className={cn(
                                            "w-full text-xs font-mono font-medium rounded-lg border px-3 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500",
                                            darkMode ? "bg-[#0B0F19] border-[#1D263B] text-white placeholder:text-slate-600" : "bg-slate-50/70 border-slate-200 text-slate-900 placeholder:text-slate-400"
                                        )}
                                    />
                                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-medium text-slate-400">
                                        ₹ Cr
                                    </span>
                                </div>
                            </div>

                            <div>
                                <label className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block mb-1">
                                    Base EBIT
                                </label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        step="1"
                                        placeholder="0"
                                        value={inputs.ebit_base || ""}
                                        onChange={(e) => handleInputChange('ebit_base', parseFloat(e.target.value) || 0)}
                                        className={cn(
                                            "w-full text-xs font-mono font-medium rounded-lg border px-3 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500",
                                            darkMode ? "bg-[#0B0F19] border-[#1D263B] text-white placeholder:text-slate-600" : "bg-slate-50/70 border-slate-200 text-slate-900 placeholder:text-slate-400"
                                        )}
                                    />
                                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-medium text-slate-400">
                                        ₹ Cr
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Non-Operating Assets */}
                        <div>
                            <label className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block mb-1">
                                Other Non-Operating Assets
                            </label>
                            <div className="relative">
                                <input
                                    type="number"
                                    step="1"
                                    placeholder="0"
                                    value={inputs.non_operating_assets || ""}
                                    onChange={(e) => handleInputChange('non_operating_assets', parseFloat(e.target.value) || 0)}
                                    className={cn(
                                        "w-full text-xs font-mono font-medium rounded-lg border px-3 py-2 pr-12 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500",
                                        darkMode ? "bg-[#0B0F19] border-[#1D263B] text-white placeholder:text-slate-600" : "bg-slate-50/70 border-slate-200 text-slate-900 placeholder:text-slate-400"
                                    )}
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-medium text-slate-400">
                                    ₹ Cr
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Operational Drivers Card */}
                    <div className={cn(
                        "rounded-2xl border p-4.5 shadow-xs space-y-4",
                        darkMode ? "bg-[#101726] border-[#1D263B]" : "bg-white border-slate-200/80"
                    )}>
                        <div className={cn("flex items-center justify-between border-b pb-3", darkMode ? "border-[#1D263B]" : "border-slate-100")}>
                            <div className={cn("flex items-center gap-2 text-xs font-bold uppercase tracking-wide", darkMode ? "text-slate-200" : "text-slate-800")}>
                                <Activity className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
                                <span>Growth & Drivers</span>
                            </div>
                            <span className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/80 border border-indigo-200 dark:border-indigo-900 px-2 py-0.5 rounded">
                                {inputs.ticker ? "Consensus" : "Estimate"}
                            </span>
                        </div>

                        {/* Rev Growth Yr 1 */}
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-xs">
                                <span className={cn("font-medium", darkMode ? "text-slate-300" : "text-slate-700")}>Rev. Growth (Yr 1)</span>
                                <span className={cn(
                                    "font-mono font-bold px-2 py-0.5 rounded text-xs border",
                                    darkMode ? "bg-[#0B0F19] text-white border-[#1D263B]" : "bg-slate-100 text-slate-900 border-slate-200"
                                )}>
                                    {(inputs.revenue_growth_yr1 * 100).toFixed(1)}%
                                </span>
                            </div>
                            <input
                                type="range"
                                min={0.0}
                                max={0.40}
                                step={0.005}
                                value={inputs.revenue_growth_yr1}
                                onChange={(e) => handleInputChange('revenue_growth_yr1', parseFloat(e.target.value))}
                                className={cn(
                                    "w-full h-1.5 rounded-lg appearance-none cursor-pointer accent-indigo-600",
                                    darkMode ? "bg-slate-800" : "bg-slate-200"
                                )}
                            />
                            <div className="flex justify-between text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                                <span>0.0%</span>
                                <span>40.0%</span>
                            </div>
                        </div>

                        {/* CAGR Growth Yr 2-5 */}
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-xs">
                                <span className={cn("font-medium", darkMode ? "text-slate-300" : "text-slate-700")}>CAGR Growth (Yr 2–5)</span>
                                <span className={cn(
                                    "font-mono font-bold px-2 py-0.5 rounded text-xs border",
                                    darkMode ? "bg-[#0B0F19] text-white border-[#1D263B]" : "bg-slate-100 text-slate-900 border-slate-200"
                                )}>
                                    {(inputs.revenue_growth_yr2_5 * 100).toFixed(1)}%
                                </span>
                            </div>
                            <input
                                type="range"
                                min={0.0}
                                max={0.40}
                                step={0.005}
                                value={inputs.revenue_growth_yr2_5}
                                onChange={(e) => handleInputChange('revenue_growth_yr2_5', parseFloat(e.target.value))}
                                className={cn(
                                    "w-full h-1.5 rounded-lg appearance-none cursor-pointer accent-indigo-600",
                                    darkMode ? "bg-slate-800" : "bg-slate-200"
                                )}
                            />
                            <div className="flex justify-between text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                                <span>0.0%</span>
                                <span>40.0%</span>
                            </div>
                        </div>

                        {/* Target Operating Margin */}
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-xs">
                                <span className={cn("font-medium", darkMode ? "text-slate-300" : "text-slate-700")}>Target Operating Margin</span>
                                <span className={cn(
                                    "font-mono font-bold px-2 py-0.5 rounded text-xs border",
                                    darkMode ? "bg-[#0B0F19] text-white border-[#1D263B]" : "bg-slate-100 text-slate-900 border-slate-200"
                                )}>
                                    {(inputs.operating_margin_target * 100).toFixed(1)}%
                                </span>
                            </div>
                            <input
                                type="range"
                                min={0.0}
                                max={0.50}
                                step={0.005}
                                value={inputs.operating_margin_target}
                                onChange={(e) => handleInputChange('operating_margin_target', parseFloat(e.target.value))}
                                className={cn(
                                    "w-full h-1.5 rounded-lg appearance-none cursor-pointer accent-indigo-600",
                                    darkMode ? "bg-slate-800" : "bg-slate-200"
                                )}
                            />
                            <div className="flex justify-between text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                                <span>0.0%</span>
                                <span>50.0%</span>
                            </div>
                        </div>

                        {/* Margin Convergence Year */}
                        <div className="flex items-center justify-between pt-1">
                            <label className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                                Margin Convergence
                            </label>
                            <select
                                value={inputs.margin_convergence_year}
                                onChange={(e) => handleInputChange('margin_convergence_year', parseInt(e.target.value))}
                                className={cn(
                                    "text-xs font-mono rounded-lg border px-2.5 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500",
                                    darkMode ? "bg-[#0B0F19] border-[#1D263B] text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                                )}
                            >
                                <option value={3}>3 Years</option>
                                <option value={5}>5 Years (Default)</option>
                                <option value={7}>7 Years</option>
                                <option value={10}>10 Years</option>
                            </select>
                        </div>
                    </div>

                    {/* Risk & Capital Efficiency Card */}
                    <div className={cn(
                        "rounded-2xl border p-4.5 shadow-xs space-y-4",
                        darkMode ? "bg-[#101726] border-[#1D263B]" : "bg-white border-slate-200/80"
                    )}>
                        <div className={cn("flex items-center justify-between border-b pb-3", darkMode ? "border-[#1D263B]" : "border-slate-100")}>
                            <div className={cn("flex items-center gap-2 text-xs font-bold uppercase tracking-wide", darkMode ? "text-slate-200" : "text-slate-800")}>
                                <Activity className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
                                <span>Risk & Capital Efficiency</span>
                            </div>
                            <span className={cn(
                                "text-[10px] font-semibold px-2 py-0.5 rounded",
                                darkMode ? "bg-[#1D263B] text-slate-400" : "bg-slate-100 text-slate-600"
                            )}>
                                WACC & Taxes
                            </span>
                        </div>

                        {/* Cost of Capital (WACC) */}
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-xs">
                                <span className={cn("font-medium", darkMode ? "text-slate-300" : "text-slate-700")}>Cost of Capital (WACC)</span>
                                <span className={cn(
                                    "font-mono font-bold px-2 py-0.5 rounded text-xs border",
                                    darkMode ? "bg-[#0B0F19] text-white border-[#1D263B]" : "bg-slate-100 text-slate-900 border-slate-200"
                                )}>
                                    {(inputs.wacc * 100).toFixed(1)}%
                                </span>
                            </div>
                            <input
                                type="range"
                                min={0.08}
                                max={0.22}
                                step={0.002}
                                value={inputs.wacc}
                                onChange={(e) => handleInputChange('wacc', parseFloat(e.target.value))}
                                className={cn(
                                    "w-full h-1.5 rounded-lg appearance-none cursor-pointer accent-indigo-600",
                                    darkMode ? "bg-slate-800" : "bg-slate-200"
                                )}
                            />
                            <div className="flex justify-between text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                                <span>8.0%</span>
                                <span>22.0%</span>
                            </div>
                        </div>

                        {/* Risk Free Rate & Sales-to-Capital */}
                        <div className="grid grid-cols-2 gap-2.5 pt-1">
                            <div>
                                <label className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block mb-1">
                                    Risk-Free Rate
                                </label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        step="0.1"
                                        value={(inputs.riskfree_rate * 100).toFixed(1)}
                                        onChange={(e) => handleInputChange('riskfree_rate', (parseFloat(e.target.value) || 7.1) / 100)}
                                        className={cn(
                                            "w-full text-xs font-mono font-medium rounded-lg border px-3 py-2 pr-8 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500",
                                            darkMode ? "bg-[#0B0F19] border-[#1D263B] text-white" : "bg-slate-50/70 border-slate-200 text-slate-900"
                                        )}
                                    />
                                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] font-medium text-slate-400">%</span>
                                </div>
                            </div>

                            <div>
                                <label className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block mb-1">
                                    Sales / Capital
                                </label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        step="0.1"
                                        value={inputs.sales_to_capital_1_5}
                                        onChange={(e) => handleInputChange('sales_to_capital_1_5', parseFloat(e.target.value) || 2.0)}
                                        className={cn(
                                            "w-full text-xs font-mono font-medium rounded-lg border px-3 py-2 pr-8 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500",
                                            darkMode ? "bg-[#0B0F19] border-[#1D263B] text-white" : "bg-slate-50/70 border-slate-200 text-slate-900"
                                        )}
                                    />
                                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] font-medium text-slate-400">x</span>
                                </div>
                            </div>
                        </div>

                        {/* Tax Rate */}
                        <div className="grid grid-cols-2 gap-2.5 pt-1">
                            <div>
                                <label className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block mb-1">
                                    Effective Tax
                                </label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        step="1"
                                        value={(inputs.tax_rate_effective * 100).toFixed(0)}
                                        onChange={(e) => handleInputChange('tax_rate_effective', (parseFloat(e.target.value) || 25) / 100)}
                                        className={cn(
                                            "w-full text-xs font-mono font-medium rounded-lg border px-3 py-2 pr-8 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500",
                                            darkMode ? "bg-[#0B0F19] border-[#1D263B] text-white" : "bg-slate-50/70 border-slate-200 text-slate-900"
                                        )}
                                    />
                                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] font-medium text-slate-400">%</span>
                                </div>
                            </div>

                            <div>
                                <label className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block mb-1">
                                    Marginal Tax
                                </label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        step="1"
                                        value={(inputs.tax_rate_marginal * 100).toFixed(0)}
                                        onChange={(e) => handleInputChange('tax_rate_marginal', (parseFloat(e.target.value) || 25) / 100)}
                                        className={cn(
                                            "w-full text-xs font-mono font-medium rounded-lg border px-3 py-2 pr-8 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500",
                                            darkMode ? "bg-[#0B0F19] border-[#1D263B] text-white" : "bg-slate-50/70 border-slate-200 text-slate-900"
                                        )}
                                    />
                                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] font-medium text-slate-400">%</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ────────────────────────────────────────────────────────
                    CENTER COLUMN: VALUATION OUTPUTS & BRIDGE (6 / 12 cols)
                ──────────────────────────────────────────────────────── */}
                <div className="lg:col-span-6 h-full overflow-y-auto custom-scrollbar pr-1.5 space-y-4 pb-20">

                    {/* Intrinsic Value Hero Card */}
                    <div className={cn(
                        "rounded-2xl border p-6 shadow-xs relative overflow-hidden",
                        darkMode ? "bg-[#101726] border-[#1D263B]" : "bg-white border-slate-200/80"
                    )}>
                        {/* Header Row */}
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                                <span className={cn(
                                    "text-[11px] font-bold uppercase tracking-wider",
                                    darkMode ? "text-slate-300" : "text-slate-600"
                                )}>
                                    Base Scenario Intrinsic Value
                                </span>
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => {
                                        if (!inputs.ticker) return;
                                        setSavedScenarios(prev => [{
                                            id: Date.now(),
                                            name: `${inputs.company_name || 'Scenario'}`,
                                            val: intrinsic_value_per_share
                                        }, ...prev]);
                                    }}
                                    className={cn(
                                        "px-2.5 py-1 text-xs font-medium rounded-lg border flex items-center gap-1.5 transition-colors",
                                        darkMode
                                            ? "bg-[#1B2438] border-slate-700 hover:bg-slate-800 text-slate-300"
                                            : "bg-slate-100 border-slate-200 hover:bg-slate-200 text-slate-700"
                                    )}
                                >
                                    <Bookmark className="w-3.5 h-3.5" /> Save
                                </button>
                                <button
                                    onClick={handleShare}
                                    className={cn(
                                        "px-2.5 py-1 text-xs font-medium rounded-lg border flex items-center gap-1.5 transition-colors",
                                        darkMode
                                            ? "bg-[#1B2438] border-slate-700 hover:bg-slate-800 text-slate-300"
                                            : "bg-slate-100 border-slate-200 hover:bg-slate-200 text-slate-700"
                                    )}
                                >
                                    {copySuccess ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Share2 className="w-3.5 h-3.5" />}
                                    <span>{copySuccess ? "Copied" : "Share"}</span>
                                </button>
                                <button
                                    onClick={handleExportPDF}
                                    className="px-3 py-1 text-xs font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 flex items-center gap-1.5 transition-colors shadow-md shadow-indigo-600/30"
                                >
                                    <Download className="w-3.5 h-3.5" /> Export Memo
                                </button>
                            </div>
                        </div>

                        {/* Large Price Display */}
                        <div className="flex items-baseline gap-2 mb-3">
                            <span className={cn(
                                "text-4xl sm:text-5xl lg:text-[54px] font-bold font-mono tracking-tight",
                                darkMode ? "text-white" : "text-slate-900"
                            )}>
                                ₹{Math.floor(intrinsic_value_per_share)}<span className="text-3xl sm:text-4xl text-indigo-500 dark:text-indigo-400">.{Math.abs(Math.round((intrinsic_value_per_share % 1) * 100)).toString().padStart(2, '0')}</span>
                            </span>
                            <div className="flex flex-col text-[10px] uppercase font-bold text-slate-400 leading-tight">
                                <span>Per</span>
                                <span>Share</span>
                            </div>
                        </div>

                        {/* Market Comparison Row */}
                        <div className="flex flex-wrap items-center gap-3 text-xs mb-4">
                            {inputs.ticker && currentPrice > 0 ? (
                                <>
                                    <span className="text-slate-500 dark:text-slate-400">
                                        Current Market Price: <span className={cn("font-mono font-bold", darkMode ? "text-white" : "text-slate-900")}>₹{currentPrice.toFixed(2)}</span>
                                    </span>
                                    <span className="text-slate-300 dark:text-slate-600">•</span>
                                    <span className={cn(
                                        "px-2.5 py-0.5 rounded-full text-xs font-semibold border inline-flex items-center gap-1",
                                        isPremium
                                            ? (darkMode ? "bg-rose-950/40 text-rose-400 border-rose-900/60" : "bg-rose-50 text-rose-700 border-rose-200")
                                            : (darkMode ? "bg-emerald-950/40 text-emerald-400 border-emerald-900/60" : "bg-emerald-50 text-emerald-700 border-emerald-200")
                                    )}>
                                        {isPremium ? (
                                            <>
                                                <ArrowDownRight className="w-3.5 h-3.5" />
                                                -{Math.abs(diffPct).toFixed(1)}% Overvalued (Premium to Fair Value)
                                            </>
                                        ) : (
                                            <>
                                                <ArrowUpRight className="w-3.5 h-3.5" />
                                                +{Math.abs(diffPct).toFixed(1)}% Discount to Fair Value
                                            </>
                                        )}
                                    </span>
                                </>
                            ) : (
                                <span className="text-slate-400 dark:text-slate-500 italic">
                                    Search a stock symbol in the search bar above to calculate fair value.
                                </span>
                            )}
                        </div>

                        {/* Footnote */}
                        <p className={cn(
                            "text-[11px] leading-relaxed border-t pt-3",
                            darkMode ? "text-slate-400 border-[#1D263B]" : "text-slate-500 border-slate-100"
                        )}>
                            Model based on 5-year explicit FCFF projections discounted at {(inputs.wacc * 100).toFixed(1)}% WACC and a {(inputs.riskfree_rate * 100).toFixed(1)}% terminal growth rate.
                        </p>
                    </div>

                    {/* Enterprise to Equity Bridge Card */}
                    <div className={cn(
                        "rounded-2xl border p-6 shadow-xs space-y-4",
                        darkMode ? "bg-[#101726] border-[#1D263B]" : "bg-white border-slate-200/80"
                    )}>
                        <div className="flex items-center justify-between">
                            <h3 className={cn("text-xs font-bold uppercase tracking-wider", darkMode ? "text-slate-200" : "text-slate-800")}>
                                Enterprise to Equity Bridge
                            </h3>
                            <span className="text-[11px] text-slate-400">Figures in ₹ Crores</span>
                        </div>

                        {/* 4 Bridge Tiles Grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {/* Tile 1: Operating Assets */}
                            <div className={cn(
                                "p-3.5 rounded-xl border relative",
                                darkMode ? "bg-[#0B0F19] border-[#1D263B]" : "bg-slate-50 border-slate-200"
                            )}>
                                <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 block mb-1">
                                    PV of Operating Assets
                                </span>
                                <span className={cn(
                                    "text-base sm:text-lg font-bold font-mono block",
                                    darkMode ? "text-white" : "text-slate-900"
                                )}>
                                    ₹{Math.round(value_operating_assets).toLocaleString()}
                                </span>
                                <span className="text-[10px] text-slate-400 dark:text-slate-500 block mt-0.5">Enterprise Core</span>
                            </div>

                            {/* Tile 2: Cash buffer */}
                            <div className={cn(
                                "p-3.5 rounded-xl border relative",
                                darkMode ? "bg-[#0B0F19] border-[#1D263B]" : "bg-emerald-50/50 border-emerald-200"
                            )}>
                                <span className="absolute top-2.5 right-2.5 text-xs font-bold text-emerald-500 dark:text-emerald-400">+</span>
                                <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 block mb-1">
                                    Cash & Liquid Inv.
                                </span>
                                <span className="text-base sm:text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400 block">
                                    +₹{Math.round(inputs.cash).toLocaleString()}
                                </span>
                                <span className="text-[10px] text-slate-400 dark:text-slate-500 block mt-0.5">Cash buffer</span>
                            </div>

                            {/* Tile 3: Other Non-Op */}
                            <div className={cn(
                                "p-3.5 rounded-xl border relative",
                                darkMode ? "bg-[#0B0F19] border-[#1D263B]" : "bg-emerald-50/50 border-emerald-200"
                            )}>
                                <span className="absolute top-2.5 right-2.5 text-xs font-bold text-emerald-500 dark:text-emerald-400">+</span>
                                <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 block mb-1">
                                    Other Non-Op.
                                </span>
                                <span className="text-base sm:text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400 block">
                                    +₹{Math.round(inputs.non_operating_assets).toLocaleString()}
                                </span>
                                <span className="text-[10px] text-slate-400 dark:text-slate-500 block mt-0.5">Investments & Land</span>
                            </div>

                            {/* Tile 4: Total Borrowings */}
                            <div className={cn(
                                "p-3.5 rounded-xl border relative",
                                darkMode ? "bg-[#0B0F19] border-[#1D263B]" : "bg-rose-50/50 border-rose-200"
                            )}>
                                <span className="absolute top-2.5 right-2.5 text-xs font-bold text-rose-500 dark:text-rose-400">−</span>
                                <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 block mb-1">
                                    Total Borrowings
                                </span>
                                <span className="text-base sm:text-lg font-bold font-mono text-rose-600 dark:text-rose-400 block">
                                    −₹{Math.round(inputs.debt).toLocaleString()}
                                </span>
                                <span className="text-[10px] text-slate-400 dark:text-slate-500 block mt-0.5">All liabilities</span>
                            </div>
                        </div>

                        {/* Implied Equity Value Strip */}
                        <div className={cn(
                            "rounded-xl p-3 flex flex-wrap items-center justify-between gap-2 border",
                            darkMode ? "bg-[#0B0F19] border-[#1D263B] text-slate-300" : "bg-indigo-50/70 border-indigo-100 text-slate-800"
                        )}>
                            <div className="text-xs">
                                <span className={cn("font-semibold", darkMode ? "text-slate-400" : "text-slate-600")}>Implied Equity Value: </span>
                                <span className="font-bold font-mono text-indigo-600 dark:text-indigo-400 text-sm">
                                    ₹{Math.round(value_equity).toLocaleString()} Cr
                                </span>
                            </div>
                            <div className="text-xs font-mono text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                                <span>÷ {inputs.shares_outstanding || 0} Cr Shares = </span>
                                <span className="bg-indigo-600 dark:bg-indigo-950 text-white dark:text-indigo-300 px-2 py-0.5 rounded border border-indigo-700 dark:border-indigo-800 font-mono font-bold">
                                    ₹{intrinsic_value_per_share.toFixed(2)} / Share
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* 2-Way Sensitivity Matrix */}
                    <div className={cn(
                        "rounded-2xl border p-6 shadow-xs space-y-4",
                        darkMode ? "bg-[#101726] border-[#1D263B]" : "bg-white border-slate-200/80"
                    )}>
                        <div className={cn(
                            "flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3",
                            darkMode ? "border-[#1D263B]" : "border-slate-100"
                        )}>
                            <div>
                                <h3 className={cn("text-xs font-bold uppercase tracking-wider", darkMode ? "text-slate-200" : "text-slate-800")}>
                                    2-Way Sensitivity Matrix
                                </h3>
                                <span className="text-[11px] text-slate-500">Discount Rate (WACC) vs. Revenue Growth Rate</span>
                            </div>

                            {/* Matrix Legend */}
                            <div className="flex items-center gap-3 text-[10px] font-medium">
                                <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                    Upside
                                </span>
                                <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                                    <span className="w-2 h-2 rounded-sm bg-indigo-600" />
                                    Base Scenario
                                </span>
                                <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                                    <span className="w-2 h-2 rounded-full bg-rose-500" />
                                    Downside
                                </span>
                            </div>
                        </div>

                        {/* Sensitivity Table */}
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs border-collapse">
                                <thead>
                                    <tr className={cn("border-b", darkMode ? "border-[#1D263B]" : "border-slate-200")}>
                                        <th className={cn("p-2.5 text-left text-[11px] font-semibold", darkMode ? "text-slate-400" : "text-slate-600")}>
                                            GROWTH \ WACC →
                                        </th>
                                        {sensitivity.waccValues.map((w, wi) => (
                                            <th key={w} className={cn(
                                                "p-2.5 text-center font-mono text-[11px] font-semibold",
                                                wi === 2 ? "text-indigo-600 dark:text-indigo-400 font-bold" : (darkMode ? "text-slate-400" : "text-slate-600")
                                            )}>
                                                {(w * 100).toFixed(1)}%{wi === 2 ? " (Base)" : ""}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {sensitivity.growthValues.map((g, gi) => (
                                        <tr key={g} className={cn("border-b", darkMode ? "border-[#1D263B]/60" : "border-slate-100")}>
                                            <td className={cn(
                                                "p-2.5 font-medium whitespace-nowrap text-[11px]",
                                                gi === 2 ? "text-indigo-600 dark:text-indigo-400 font-bold" : (darkMode ? "text-slate-300" : "text-slate-700")
                                            )}>
                                                {(g * 100).toFixed(1)}% {gi === 2 ? "(Base)" : "Rev"}
                                            </td>
                                            {sensitivity.matrix[gi]?.map((val, wi) => {
                                                const isBase = gi === 2 && wi === 2;
                                                const isUpside = val > intrinsic_value_per_share * 1.05 && intrinsic_value_per_share > 0;
                                                const isDownside = val < intrinsic_value_per_share * 0.95 && intrinsic_value_per_share > 0;

                                                return (
                                                    <td
                                                        key={wi}
                                                        className={cn(
                                                            "p-2.5 text-center font-mono transition-all rounded",
                                                            isBase && (darkMode ? "bg-indigo-950/90 border border-indigo-500 text-indigo-300 font-bold" : "bg-indigo-600 text-white font-bold"),
                                                            !isBase && isUpside && (darkMode ? "text-emerald-400 font-medium" : "text-emerald-600 font-semibold"),
                                                            !isBase && isDownside && (darkMode ? "text-rose-400 font-medium" : "text-rose-600 font-semibold"),
                                                            !isBase && !isUpside && !isDownside && (darkMode ? "text-slate-300" : "text-slate-700")
                                                        )}
                                                    >
                                                        ₹{val.toFixed(2)}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* ────────────────────────────────────────────────────────
                    RIGHT COLUMN: EXECUTIVE AI THESIS & SOURCES (3 / 12 cols)
                ──────────────────────────────────────────────────────── */}
                <div className="lg:col-span-3 h-full overflow-y-auto custom-scrollbar pr-1.5 space-y-4 pb-20">

                    {/* Executive AI Thesis Card */}
                    <div className={cn(
                        "rounded-2xl border p-5 shadow-xs space-y-4",
                        darkMode ? "bg-[#101726] border-[#1D263B]" : "bg-white border-slate-200/80"
                    )}>
                        <div className={cn("flex items-center justify-between border-b pb-3", darkMode ? "border-[#1D263B]" : "border-slate-100")}>
                            <div className={cn("flex items-center gap-2 text-xs font-bold uppercase tracking-wide", darkMode ? "text-slate-200" : "text-slate-800")}>
                                <Sparkles className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
                                <span>Executive AI Thesis</span>
                            </div>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/80 border border-indigo-200 dark:border-indigo-900 text-indigo-600 dark:text-indigo-300">
                                AI Generated
                            </span>
                        </div>

                        {/* Thesis Narrative */}
                        <p className={cn("text-xs leading-relaxed", darkMode ? "text-slate-300" : "text-slate-600")}>
                            {narrative}
                        </p>

                        {/* Critical Assumptions */}
                        <div className={cn("pt-2 border-t", darkMode ? "border-[#1D263B]" : "border-slate-100")}>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-2.5">
                                Critical Assumptions
                            </span>
                            <ul className="space-y-2 text-xs">
                                {criticalAssumptions.map((item, idx) => (
                                    <li key={idx} className={cn("flex items-start gap-1.5", darkMode ? "text-slate-300" : "text-slate-600")}>
                                        <span className="text-indigo-500 dark:text-indigo-400 font-bold">•</span>
                                        <span className="leading-snug">
                                            <strong className={cn("font-semibold", darkMode ? "text-white" : "text-slate-900")}>{item.title}:</strong> {item.desc}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>

                    {/* Source Documents Card */}
                    <div className={cn(
                        "rounded-2xl border p-5 shadow-xs space-y-4",
                        darkMode ? "bg-[#101726] border-[#1D263B]" : "bg-white border-slate-200/80"
                    )}>
                        <div className={cn("flex items-center justify-between border-b pb-3", darkMode ? "border-[#1D263B]" : "border-slate-100")}>
                            <div className={cn("flex items-center gap-2 text-xs font-bold uppercase tracking-wide", darkMode ? "text-slate-200" : "text-slate-800")}>
                                <FileText className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
                                <span>Source Documents</span>
                            </div>
                            <span className={cn(
                                "text-[10px] font-semibold px-2 py-0.5 rounded",
                                darkMode ? "bg-[#1D263B] text-slate-300" : "bg-slate-100 text-slate-600"
                            )}>
                                {documents.length} Synced
                            </span>
                        </div>

                        {/* Document List */}
                        <div className="space-y-2">
                            {documents.length === 0 ? (
                                <p className="text-xs text-slate-400 dark:text-slate-500 italic py-2 text-center">
                                    No filings uploaded.
                                </p>
                            ) : (
                                documents.map((doc) => (
                                    <div
                                        key={doc.id}
                                        className={cn(
                                            "p-2.5 rounded-xl border flex items-center justify-between text-xs transition-colors group",
                                            darkMode ? "bg-[#0B0F19] border-[#1D263B]" : "bg-slate-50 border-slate-200"
                                        )}
                                    >
                                        <div className="flex items-center gap-2 min-w-0 pr-2">
                                            {doc.type === 'pdf' ? (
                                                <div className="w-6 h-6 rounded bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                                                    <FileText className="w-3.5 h-3.5" />
                                                </div>
                                            ) : (
                                                <div className="w-6 h-6 rounded bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                                                    <FileText className="w-3.5 h-3.5" />
                                                </div>
                                            )}
                                            <div className="min-w-0">
                                                <p className={cn("font-medium truncate text-xs", darkMode ? "text-slate-200" : "text-slate-800")}>{doc.name}</p>
                                                <p className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">{doc.size} • Synced</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1.5 shrink-0">
                                            <ExternalLink className="w-3.5 h-3.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer transition-colors" />
                                            <button
                                                onClick={() => handleDeleteDoc(doc.id)}
                                                className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-opacity p-0.5"
                                            >
                                                <Trash2 className="w-3 h-3" />
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Upload Dropzone */}
                        <label className={cn(
                            "border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-center text-center transition-all cursor-pointer group",
                            darkMode
                                ? "border-[#1D263B] hover:border-indigo-500/50 bg-[#0B0F19]/60 hover:bg-indigo-950/10"
                                : "border-slate-200 hover:border-indigo-400 bg-slate-50/70 hover:bg-indigo-50/40"
                        )}>
                            <input
                                type="file"
                                className="hidden"
                                accept="application/pdf,text/plain"
                                multiple
                                onChange={handleFileUpload}
                            />
                            <UploadCloud className="w-6 h-6 text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 mb-1.5 transition-colors" />
                            <span className={cn(
                                "text-xs font-semibold group-hover:text-indigo-600 dark:group-hover:text-indigo-400",
                                darkMode ? "text-slate-200" : "text-slate-700"
                            )}>
                                Upload New Filings
                            </span>
                            <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                                PDF, XBRL or 10-K format
                            </span>
                        </label>
                    </div>
                </div>
            </main>
        </div>
    );
}
