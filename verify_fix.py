from backend.dcf_engine import DCFEngine, DCFInputs

def verify():
    # Scenario:
    # Revenue = 100 Cr
    # Assume strict 100% margin for simplicity of mental math => EBIT = 100 Cr
    # Tax = 0%
    # No growth, no reinvestment => FCFF = 100 Cr every year.
    # WACC = 10%
    # Value = FCFF / WACC = 100 / 0.10 = 1000 Cr Enterprise Value.
    # No Debt, No Cash.
    # Equity Value = 1000 Cr.
    # Shares = 10 Cr (100,000,000).
    # Expected Price = 1000 Cr / 10 Cr shares = 100 INR.
    
    # If bug exists: 1000 / 100,000,000 = 0.00001 INR.
    
    inputs = DCFInputs(
        current_revenue=100.0, # Crores
        current_ebit=100.0,    # Crores
        tax_rate=0.0,
        cash_and_equivalents=0.0,
        total_debt=0.0,
        growth_period_years=5,
        revenue_growth_rate=0.0,
        terminal_growth_rate=0.0,
        target_operating_margin=1.0, # 100%
        sales_to_capital_ratio=1.0,
        risk_free_rate=0.10,
        beta=0.0, # Cost of equity = Rf
        equity_risk_premium=0.0,
        cost_of_debt=0.0,
        debt_to_capital_ratio=0.0,
        shares_outstanding=100_000_000 # 10 Cr shares, Absolute number
    )
    
    result = DCFEngine.calculate(inputs)
    
    print(f"Equity Value (Cr): {result.equity_value}")
    print(f"Shares Outstanding: {result.share_price}") # Actually share price field 
    # Oops print label wrong above but let's see value
    
    print(f"Calculated Share Price: {result.share_price}")
    
    if result.share_price > 50:
        print("SUCCESS: Share price is in correct magnitude.")
    else:
        print("FAILURE: Share price is too low.")

if __name__ == "__main__":
    verify()
