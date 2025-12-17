import yfinance as yf
import json

def debug_ticker(ticker):
    print(f"\n--- Debugging {ticker} ---")
    stock = yf.Ticker(ticker)
    info = stock.info
    
    # Print key fields we use
    keys = [
        'totalRevenue', 'ebitda', 'totalDepreciationAmortization', 'operatingMargins',
        'sharesOutstanding', 'totalCash', 'totalDebt', 'revenueGrowth', 'beta', 'currency'
    ]
    
    debug_data = {k: info.get(k) for k in keys}
    print(json.dumps(debug_data, indent=2))
    
    # Check calculated values
    revenue = info.get('totalRevenue', 0)
    currency = info.get('currency', 'USD')
    
    if currency == 'INR':
        print(f"Revenue in Crores: {revenue / 10000000:,.2f} Cr")

if __name__ == "__main__":
    debug_ticker("ZOMATO.NS")
    debug_ticker("RELIANCE.NS")
