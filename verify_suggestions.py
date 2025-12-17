from backend.ticker_service import get_ticker_suggestions
import json

def test_suggest(query):
    print(f"\n--- Testing Suggestion: '{query}' ---")
    suggestions = get_ticker_suggestions(query)
    print(json.dumps(suggestions, indent=2))

if __name__ == "__main__":
    test_suggest("Zom")
    test_suggest("Reli")
