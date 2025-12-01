import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Info } from 'lucide-react';

const InputGroup = ({ title, children, defaultOpen = true }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    return (
        <div className="mb-6 bg-card rounded-xl border border-slate-700 overflow-hidden">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full px-6 py-4 flex justify-between items-center bg-slate-800/50 hover:bg-slate-800 transition-colors"
            >
                <h3 className="text-lg font-semibold text-slate-200">{title}</h3>
                {isOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </button>
            {isOpen && <div className="p-6 space-y-4">{children}</div>}
        </div>
    );
};

const InputField = ({ label, name, value, onChange, type = "number", step = "any", tooltip }) => {
    const [showTooltip, setShowTooltip] = useState(false);

    return (
        <div className="space-y-1">
            <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-slate-400">{label}</label>
                {tooltip && (
                    <div className="relative inline-block">
                        <Info
                            size={14}
                            className="text-slate-600 cursor-help"
                            onMouseEnter={() => setShowTooltip(true)}
                            onMouseLeave={() => setShowTooltip(false)}
                        />
                        {showTooltip && (
                            <div className="absolute left-1/2 -translate-x-1/2 top-6 z-[100] w-72 p-3 bg-slate-900 border border-slate-600 rounded-lg shadow-xl text-xs text-slate-200 leading-relaxed whitespace-normal">
                                {tooltip}
                            </div>
                        )}
                    </div>
                )}
            </div>
            <input
                type={type}
                name={name}
                value={value}
                onChange={onChange}
                step={step}
                className="w-full bg-darker border border-slate-700 rounded-lg px-4 py-2 text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
            />
        </div>
    );
};

const InputForm = ({ inputs, setInputs, onCalculate, loading }) => {
    const handleChange = (e) => {
        const { name, value } = e.target;
        setInputs(prev => ({
            ...prev,
            [name]: parseFloat(value) || 0
        }));
    };

    return (
        <div className="h-full overflow-y-auto pr-4 custom-scrollbar">
            <div className="mb-8">
                <h2 className="text-2xl font-bold text-white mb-2">Valuation Parameters</h2>
                <p className="text-slate-400">Enter the company details below.</p>
            </div>

            <InputGroup title="Company Basics">
                <InputField
                    label="Current Revenue (₹ Crores)"
                    name="current_revenue"
                    value={inputs.current_revenue}
                    onChange={handleChange}
                />
                <InputField
                    label="Current EBIT (₹ Crores)"
                    name="current_ebit"
                    value={inputs.current_ebit}
                    onChange={handleChange}
                />
                <InputField
                    label="Shares Outstanding"
                    name="shares_outstanding"
                    value={inputs.shares_outstanding}
                    onChange={handleChange}
                />
            </InputGroup>

            <InputGroup title="Balance Sheet">
                <InputField
                    label="Cash & Equivalents (₹ Crores)"
                    name="cash_and_equivalents"
                    value={inputs.cash_and_equivalents}
                    onChange={handleChange}
                />
                <InputField
                    label="Total Debt (₹ Crores)"
                    name="total_debt"
                    value={inputs.total_debt}
                    onChange={handleChange}
                />
            </InputGroup>

            <InputGroup title="Growth Assumptions">
                <InputField
                    label="Revenue Growth Rate (%)"
                    name="revenue_growth_rate"
                    value={inputs.revenue_growth_rate}
                    onChange={handleChange}
                    step="0.1"
                />
                <InputField
                    label="Target Operating Margin (%)"
                    name="target_operating_margin"
                    value={inputs.target_operating_margin}
                    onChange={handleChange}
                    step="0.1"
                    tooltip="Profit margin (EBIT ÷ Revenue) the company will reach. Higher = more profitable. Check similar companies in the industry for benchmarks."
                />
                <InputField
                    label="Growth Period (Years)"
                    name="growth_period_years"
                    value={inputs.growth_period_years}
                    onChange={handleChange}
                    step="1"
                />
            </InputGroup>

            <InputGroup title="Market Factors (Indian Defaults)" defaultOpen={false}>
                <InputField
                    label="Risk Free Rate (%)"
                    name="risk_free_rate"
                    value={inputs.risk_free_rate}
                    onChange={handleChange}
                    step="0.1"
                />
                <InputField
                    label="Equity Risk Premium (%)"
                    name="equity_risk_premium"
                    value={inputs.equity_risk_premium}
                    onChange={handleChange}
                    step="0.1"
                    tooltip="Extra return investors expect for taking stock market risk vs safe bonds. India default: 7%"
                />
                <InputField
                    label="Terminal Growth Rate (%)"
                    name="terminal_growth_rate"
                    value={inputs.terminal_growth_rate}
                    onChange={handleChange}
                    step="0.1"
                    tooltip="Long-term growth rate after the high-growth period ends. Typically 3-6% for mature companies. India default: 5%"
                />
                <InputField
                    label="Beta"
                    name="beta"
                    value={inputs.beta}
                    onChange={handleChange}
                    step="0.01"
                    tooltip="Beta measures stock volatility vs market. • = 1.0: Average volatility • < 1.0: Low volatility (defensive) • > 1.0: High volatility (growth stocks). Default: 1.0"
                />
                <InputField
                    label="Tax Rate (%)"
                    name="tax_rate"
                    value={inputs.tax_rate}
                    onChange={handleChange}
                    step="0.1"
                />
            </InputGroup>

            <button
                onClick={onCalculate}
                disabled={loading}
                className="w-full bg-primary hover:bg-emerald-600 text-white font-bold py-4 rounded-xl shadow-lg shadow-primary/20 transition-all transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {loading ? "Calculating..." : "Calculate Valuation"}
            </button>
        </div>
    );
};

export default InputForm;
