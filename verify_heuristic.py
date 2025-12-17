from backend.ticker_service import fetch_ticker_data
# We will mock the internal behavior by creating a mock class, 
# or simpler: we can just copy the logic effectively or rely on the fact that TCS.NS naturally works.
# But we strongly suspect TCS.NS works for me. 
# So let's write a script that imports 'ticker_service' and modifies the 'fetch_ticker_data' behavior 
# or just creates a dummy function with the same logic to test the logic snippet.

# Actually, we can test the modified file directly if we can mock yfinance.
# Let's write a script that imports the current 'fetch_ticker_data' 
# and monkey-patches yfinance to return "bad" metadata.

import yfinance as yf
from unittest.mock import MagicMock
import backend.ticker_service as ts

def test_heuristic():
    print("Testing Heuristic Fail-Safe...")
    
    # Mock yfinance Ticker info
    mock_ticker = MagicMock()
    # Scenario: User gets 'USD' default or missing currency, but values are Absolute INR (e.g. 2.4 Lakh Cr)
    mock_ticker.info = {
        'currency': 'USD', # Wrongly identified as USD
        'financialCurrency': 'USD', 
        'totalRevenue': 2400000000000, # 2.4 Lakh Cr * 10^7 = 2.4e12
        'sharesOutstanding': 3650000000,
        'beta': 1.0,
        'ebitda': 600000000000,
        'totalDepreciationAmortization': 0
    }
    
    # Monkey patch
    original_Ticker = yf.Ticker
    yf.Ticker = MagicMock(return_value=mock_ticker)
    
    try:
        # Fetch data for TCS.NS
        data = ts.fetch_ticker_data("TCS.NS")
        
        print(f"Fetched Revenue: {data.get('current_revenue')}")
        
        # We expect 240000 Crores (2.4e5), NOT 2.4e12
        if data.get('current_revenue') == 240000.0:
            print("✅ Heuristic successfully scaled massive revenue!")
        else:
            print(f"❌ Heuristic failed. Got {data.get('current_revenue')}")
            
    except Exception as e:
        print(f"Test failed with error: {e}")
    finally:
        yf.Ticker = original_Ticker

if __name__ == "__main__":
    test_heuristic()
