from backend.ticker_service import fetch_ticker_data
from backend.dcf_engine import DCFEngine, DCFInputs
import json

def verify_full_flow(ticker):
    print(f"--- Verifying Flow for {ticker} ---")
    
    # 1. Fetch Data
    print("1. Fetching Data...")
    data = fetch_ticker_data(ticker)
    if not data:
        print("Failed to fetch data.")
        return

    print("Fetched Data (Subset):")
    print(f"  Revenue: {data.get('current_revenue')} (Should be in Crores)")
    print(f"  EBIT: {data.get('current_ebit')} (Should be in Crores)")
    print(f"  Shares: {data.get('shares_outstanding')} (Should be Absolute)")
    
    # 2. Validate Inputs
    try:
        inputs = DCFInputs(**data)
        print("Inputs are valid.")
    except Exception as e:
        print(f"Input Validation Failed: {e}")
        return

    # 3. Calculate
    print("2. Running Calculation...")
    result = DCFEngine.calculate(inputs)
    
    # 4. Inspect Results
    print("Calculation Results:")
    print(f"  Equity Value: {result.equity_value:,.2f} Cr (Expected ~Market Cap in Cr)")
    print(f"  Share Price: ₹ {result.share_price:,.2f} (Expected ~Market Price)")
    
    # Heuristic Check
    if result.share_price > 100000:
        print("❌ CRITICAL: Share Price is improbably high! Scaling issue persists.")
    else:
        print("✅ Share Price seems reasonable.")

if __name__ == "__main__":
    # Test with a known large company
    verify_full_flow("TCS.NS")
