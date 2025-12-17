import React from 'react';
import { TrendingUp, Banknote, PieChart } from 'lucide-react';

const formatCurrency = (value) => {
    // Convert to Crores (1 Crore = 10,000,000)
    const inCrores = value / 10000000;

    // If value is small (like share price), keep it absolute
    // But user asked for Equity Value in Crores.
    // Let's make a smart formatter.

    // Actually, user said "keep equity value in crore".
    // Share price should probably be absolute Rupees.

    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 2,
        minimumFractionDigits: 2,
    }).format(value).replace('₹', '₹ ');
};

const formatCrores = (value) => {
    // Value is already in Crores from backend
    return `₹ ${value.toFixed(2)} Cr`;
};

const ResultCard = ({ title, value, subtext, icon: Icon, color = "text-primary" }) => (
    <div className="bg-card border border-slate-700 rounded-xl p-6 flex items-start justify-between hover:border-slate-600 transition-colors">
        <div>
            <p className="text-slate-400 text-sm font-medium mb-1">{title}</p>
            <h3 className="text-2xl font-bold text-white">{value}</h3>
            {subtext && <p className="text-xs text-slate-500 mt-1">{subtext}</p>}
        </div>
        <div className={`p-3 rounded-lg bg-slate-800 ${color}`}>
            <Icon size={24} />
        </div>
    </div>
);

const ValuationCard = ({ result }) => {
    if (!result) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-slate-500">
                <PieChart size={64} className="mb-4 opacity-20" />
                <p>Enter parameters and hit calculate to see the valuation.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <ResultCard
                    title="Share Price"
                    value={result.share_price < 0 ? "₹ 0.00" : formatCurrency(result.share_price)}
                    subtext={result.share_price < 0 ? "⚠️ Insolvency Risk (Debt > Assets)" : "Intrinsic Value per Share"}
                    icon={Banknote}
                    color={result.share_price < 0 ? "text-red-400" : "text-emerald-400"}
                />
                <ResultCard
                    title="Equity Value"
                    value={formatCrores(result.equity_value)}
                    subtext="Total Market Cap Implied"
                    icon={TrendingUp}
                    color={result.equity_value < 0 ? "text-red-400" : "text-blue-400"}
                />
            </div>

            <div className="bg-card border border-slate-700 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Valuation Breakdown</h3>
                <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                        <span className="text-slate-400">Enterprise Value</span>
                        <span className="text-white font-medium">{formatCrores(result.enterprise_value)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-slate-400">PV of Explicit Period</span>
                        <span className="text-white font-medium">{formatCrores(result.sum_pv_fcff)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-slate-400">PV of Terminal Value</span>
                        <span className="text-white font-medium">{formatCrores(result.present_value_terminal_value)}</span>
                    </div>
                    <div className="h-px bg-slate-700 my-2"></div>
                    <div className="flex justify-between text-sm">
                        <span className="text-slate-400">WACC</span>
                        <span className="text-emerald-400 font-medium">{(result.wacc * 100).toFixed(2)}%</span>
                    </div>
                </div>
            </div>

            <div className="bg-card border border-slate-700 rounded-xl p-6 overflow-x-auto">
                <h3 className="text-lg font-semibold text-white mb-4">Projected Cash Flows</h3>
                <table className="w-full text-sm text-left">
                    <thead>
                        <tr className="text-slate-400 border-b border-slate-700">
                            <th className="py-2">Year</th>
                            <th className="py-2">Revenue</th>
                            <th className="py-2">FCFF</th>
                            <th className="py-2">PV FCFF</th>
                        </tr>
                    </thead>
                    <tbody className="text-slate-300">
                        {result.projections.map((p) => (
                            <tr key={p.year} className="border-b border-slate-800/50">
                                <td className="py-2">{p.year}</td>
                                <td className="py-2">{formatCrores(p.revenue)}</td>
                                <td className="py-2">{formatCrores(p.fcff)}</td>
                                <td className="py-2 text-emerald-400">{formatCrores(p.present_value_fcff)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default ValuationCard;
