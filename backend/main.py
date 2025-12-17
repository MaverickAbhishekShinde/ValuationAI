from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .dcf_engine import DCFEngine, DCFInputs, ValuationResult

app = FastAPI(title="ValuationAI - Indian Market DCF")

# Allow CORS for React Frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, replace with specific origin
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"message": "ValuationAI Backend is Running"}

@app.post("/calculate", response_model=ValuationResult)
def calculate_valuation(inputs: DCFInputs):
    from .utils import normalize_to_crores
    
    # Normalize inputs in case frontend sends massive absolute values
    # This ensures consistency regardless of input source
    normalized_data = {
        'current_revenue': normalize_to_crores(inputs.current_revenue),
        'current_ebit': normalize_to_crores(inputs.current_ebit),
        'cash_and_equivalents': normalize_to_crores(inputs.cash_and_equivalents),
        'total_debt': normalize_to_crores(inputs.total_debt),
        'shares_outstanding': inputs.shares_outstanding,  # Keep as absolute
        'tax_rate': inputs.tax_rate,
        'growth_period_years': inputs.growth_period_years,
        'revenue_growth_rate': inputs.revenue_growth_rate,
        'terminal_growth_rate': inputs.terminal_growth_rate,
        'target_operating_margin': inputs.target_operating_margin,
        'sales_to_capital_ratio': inputs.sales_to_capital_ratio,
        'risk_free_rate': inputs.risk_free_rate,
        'beta': inputs.beta,
        'equity_risk_premium': inputs.equity_risk_premium,
        'cost_of_debt': inputs.cost_of_debt,
        'debt_to_capital_ratio': inputs.debt_to_capital_ratio,
    }
    
    normalized_inputs = DCFInputs(**normalized_data)
    result = DCFEngine.calculate(normalized_inputs)
    return result

from .ticker_service import fetch_ticker_data

@app.get("/api/search/{ticker}")
def search_ticker(ticker: str):
    data = fetch_ticker_data(ticker)
    if not data:
        return {"error": "Ticker not found or data unavailable"}
    return data

from .ticker_service import get_ticker_suggestions

@app.get("/api/suggest/{query}")
def suggest_tickers(query: str):
    suggestions = get_ticker_suggestions(query)
    return suggestions
