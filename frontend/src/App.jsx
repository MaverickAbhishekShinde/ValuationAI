import React, { useState } from 'react';
import axios from 'axios';
import InputForm from './components/InputForm';
import ValuationCard from './components/ValuationCard';

function App() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [inputs, setInputs] = useState({
    current_revenue: 10, // Crores
    current_ebit: 2, // Crores
    cash_and_equivalents: 0.5, // Crores
    total_debt: 1, // Crores
    tax_rate: 25, // %
    growth_period_years: 10,
    revenue_growth_rate: 15, // %
    terminal_growth_rate: 5, // %
    target_operating_margin: 25, // %
    sales_to_capital_ratio: 1.5,
    risk_free_rate: 7.2, // %
    beta: 1.0,
    equity_risk_premium: 7, // %
    cost_of_debt: 9, // %
    debt_to_capital_ratio: 20, // %
    shares_outstanding: 100000 // Absolute number
  });

  const handleCalculate = async () => {
    setLoading(true);
    try {
      // Convert inputs for Backend (Crores -> Absolute, % -> Decimal)
      const payload = {
        ...inputs,
        current_revenue: inputs.current_revenue * 10000000,
        current_ebit: inputs.current_ebit * 10000000,
        cash_and_equivalents: inputs.cash_and_equivalents * 10000000,
        total_debt: inputs.total_debt * 10000000,

        revenue_growth_rate: inputs.revenue_growth_rate / 100,
        terminal_growth_rate: inputs.terminal_growth_rate / 100,
        target_operating_margin: inputs.target_operating_margin / 100,
        tax_rate: inputs.tax_rate / 100,
        risk_free_rate: inputs.risk_free_rate / 100,
        equity_risk_premium: inputs.equity_risk_premium / 100,
        cost_of_debt: inputs.cost_of_debt / 100,
        debt_to_capital_ratio: inputs.debt_to_capital_ratio / 100,
      };

      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      const response = await axios.post(`${apiUrl}/calculate`, payload);
      setResult(response.data);
    } catch (error) {
      console.error("Error calculating valuation:", error);
      alert("Failed to calculate. Ensure backend is running.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-darker text-slate-200 font-sans selection:bg-primary/30">
      <div className="max-w-7xl mx-auto px-4 py-8 h-screen flex flex-col">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-blue-500">
              ValuationAI
            </h1>
            <p className="text-slate-500 text-sm">Indian Market DCF Model</p>
          </div>
          <div className="text-xs text-slate-600 border border-slate-800 px-3 py-1 rounded-full">
            v1.0.0
          </div>
        </header>

        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8 overflow-hidden">
          {/* Left Panel: Inputs */}
          <div className="lg:col-span-4 h-full overflow-hidden">
            <InputForm
              inputs={inputs}
              setInputs={setInputs}
              onCalculate={handleCalculate}
              loading={loading}
            />
          </div>

          {/* Right Panel: Results */}
          <div className="lg:col-span-8 h-full overflow-y-auto custom-scrollbar bg-slate-900/50 rounded-2xl border border-slate-800 p-8">
            <ValuationCard result={result} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
