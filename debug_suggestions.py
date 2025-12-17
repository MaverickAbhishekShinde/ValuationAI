import requests
import json

def test_assist(query):
    url = f"https://finance.yahoo.com/_finance_doubledown/api/resource/searchassist;searchTerm={query}"
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    }
    
    try:
        response = requests.get(url, headers=headers)
        data = response.json()
        
        print(f"\n--- Assist Query: '{query}' ---")
        # Structure is usually data['items']
        if "items" in data:
            for item in data["items"]:
                print(f"Sym: {item.get('symbol')} | Name: {item.get('name')} | Exch: {item.get('exch')}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_assist("Rel")
    test_assist("Zom")
