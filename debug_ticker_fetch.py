import yfinance as yf
import json

def debug_ticker(ticker):
    print(f"Fetching data for {ticker}...")
    stock = yf.Ticker(ticker)
    info = stock.info
    
    currency = info.get('currency')
    financial_currency = info.get('financialCurrency')
    
    print(f"Currency: {currency}")
    print(f"Financial Currency: {financial_currency}")
    
    current_revenue = info.get('totalRevenue')
    print(f"Total Revenue (Raw): {current_revenue}")
    
    if current_revenue:
        print(f"Total Revenue (Formatted): {current_revenue:,.2f}")

    # Check scale factor logic
    scale_factor = 1.0
    if currency == 'INR':
        scale_factor = 1 / 10000000
    
    print(f"Scale Factor: {scale_factor}")
    print(f"Scaled Revenue: {current_revenue * scale_factor if current_revenue else 'N/A'}")

if __name__ == "__main__":
    # Test dictionary behavior
    d = {'a': None}
    print(f"Test dict key 'a' is None. get('a', 'default') -> {d.get('a', 'default')}")
    d2 = {}
    print(f"Test dict key 'a' missing. get('a', 'default') -> {d2.get('a', 'default')}")
    
    debug_ticker("RELIANCE.NS")
    debug_ticker("INFY.NS")
