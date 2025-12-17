from backend.ticker_service import fetch_ticker_data
import json

def test_search(query):
    print(f"\n--- Testing query: '{query}' ---")
    data = fetch_ticker_data(query)
    if data:
        print(f"Success! Revenue: {data.get('current_revenue')}")
    else:
        print("Failed to fetch data.")

if __name__ == "__main__":
    # Test 1: Exact Ticker
    test_search("RELIANCE.NS")
    
    # Test 2: Name (Zomato)
    test_search("Zomato")
    
    # Test 3: Name (TCS)
    test_search("Tata Consultancy Services")
