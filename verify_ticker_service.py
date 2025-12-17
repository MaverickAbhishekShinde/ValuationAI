from backend.ticker_service import fetch_ticker_data
import json

def test_ticker(ticker):
    print(f"Fetching data for {ticker}...")
    data = fetch_ticker_data(ticker)
    print(json.dumps(data, indent=2))

if __name__ == "__main__":
    # Test with a known Indian ticker
    test_ticker("RELIANCE.NS")
    # Test with a US ticker
    test_ticker("AAPL")
