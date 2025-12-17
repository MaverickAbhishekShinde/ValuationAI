import yfinance as yf
import requests
from .dcf_engine import DCFInputs
from .utils import normalize_to_crores

def search_ticker_by_name(query: str) -> str:
    """
    Searches for a ticker by company name using Yahoo Finance API.
    Prioritizes Indian exchanges (NSE, BSE).
    """
    try:
        url = "https://query2.finance.yahoo.com/v1/finance/search"
        params = {
            "q": query,
            "quotesCount": 5,
            "newsCount": 0,
            "enableFuzzyQuery": "false",
            "quotesQueryId": "tss_match_phrase_query"
        }
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
        }
        
        response = requests.get(url, params=params, headers=headers)
        data = response.json()
        
        if "quotes" in data and len(data["quotes"]) > 0:
            # 1. Look for exact NSE match
            for quote in data["quotes"]:
                symbol = quote.get("symbol", "")
                if symbol.endswith(".NS"):
                    return symbol
            
            # 2. Look for BSE match
            for quote in data["quotes"]:
                symbol = quote.get("symbol", "")
                if symbol.endswith(".BO"):
                    return symbol
            
            # 3. Return the first result if no Indian match found (fallback)
            return data["quotes"][0].get("symbol")
            
    except Exception as e:
        print(f"Error searching for ticker {query}: {e}")
    
    return None

def get_ticker_suggestions(query: str) -> list:
    """
    Fetches ticker suggestions from Yahoo Finance API.
    Returns a list of dicts with symbol, name, and exchange.
    """
    try:
        url = "https://query2.finance.yahoo.com/v1/finance/search"
        params = {
            "q": query,
            "quotesCount": 10,
            "newsCount": 0,
            "enableFuzzyQuery": "true",
            "quotesQueryId": "tss_match_phrase_query",
            "region": "IN",
            "lang": "en-IN"
        }
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
        }
        
        response = requests.get(url, params=params, headers=headers)
        data = response.json()
        
        suggestions = []
        if "quotes" in data:
            for quote in data["quotes"]:
                symbol = quote.get("symbol", "")
                name = quote.get("longname") or quote.get("shortname") or symbol
                exchange = quote.get("exchange", "")
                quote_type = quote.get("quoteType", "")
                
                # Filter for Indian Stocks only
                if exchange in ['NSI', 'BSE', 'NSE', 'BOM'] and quote_type == 'EQUITY':
                    suggestions.append({
                        "symbol": symbol,
                        "name": name,
                        "exchange": exchange
                    })
                
        return suggestions
            
    except Exception as e:
        print(f"Error fetching suggestions for {query}: {e}")
        return []

def fetch_ticker_data(query: str) -> dict:
    """
    Fetches financial data for a given ticker or company name.
    """
    try:
        ticker = query.upper().strip()
        
        if not (ticker.endswith(".NS") or ticker.endswith(".BO")):
            print(f"Searching for ticker for: {query}")
            found_ticker = search_ticker_by_name(query)
            if found_ticker:
                ticker = found_ticker
                print(f"Resolved '{query}' to '{ticker}'")
            else:
                ticker = f"{query}.NS"
        
        stock = yf.Ticker(ticker)
        info = stock.info
        
        # Helper to safely get values or return 0.0
        def get_val(key, default=0.0):
            return float(info.get(key, default) or default)

        # 1. Company Basics
        current_revenue = get_val('totalRevenue')
        current_ebit = get_val('ebitda') - get_val('totalDepreciationAmortization')
        
        if current_revenue == 0:
            try:
                income_stmt = stock.income_stmt
                if not income_stmt.empty:
                    latest = income_stmt.iloc[:, 0]
                    if 'Total Revenue' in latest:
                        current_revenue = float(latest['Total Revenue'])
                    elif 'Operating Revenue' in latest:
                        current_revenue = float(latest['Operating Revenue'])
                        
                    if 'EBIT' in latest:
                        current_ebit = float(latest['EBIT'])
                    elif 'EBITDA' in latest and 'Reconciled Depreciation' in latest:
                        current_ebit = float(latest['EBITDA']) - float(latest['Reconciled Depreciation'])
            except Exception as e:
                print(f"Fallback Income Stmt failed: {e}")

        if current_ebit == 0 and current_revenue > 0:
             current_ebit = get_val('operatingMargins') * current_revenue

        shares_outstanding = get_val('sharesOutstanding')
        if shares_outstanding == 0:
             try:
                 income_stmt = stock.income_stmt
                 if not income_stmt.empty:
                     latest = income_stmt.iloc[:, 0]
                     if 'Basic Average Shares' in latest:
                         shares_outstanding = float(latest['Basic Average Shares'])
             except:
                 pass

        # 2. Balance Sheet
        cash_and_equivalents = get_val('totalCash')
        total_debt = get_val('totalDebt')
        
        if total_debt == 0 or cash_and_equivalents == 0:
            try:
                bs = stock.balance_sheet
                if not bs.empty:
                    latest_bs = bs.iloc[:, 0]
                    if total_debt == 0 and 'Total Debt' in latest_bs:
                        total_debt = float(latest_bs['Total Debt'])
                    if cash_and_equivalents == 0 and 'Cash And Cash Equivalents' in latest_bs:
                        cash_and_equivalents = float(latest_bs['Cash And Cash Equivalents'])
            except Exception as e:
                print(f"Fallback Balance Sheet failed: {e}")

        # 3. Growth Assumptions
        # Note: We do NOT prefill these as historical values don't reflect future projections
        # Users should enter their own estimates based on research
        
        # 4. Market Factors
        beta = get_val('beta', 1.0)
        
        # 5. Currency & Scaling
        currency = info.get('currency')
        financial_currency = info.get('financialCurrency')
        effective_currency = financial_currency or currency
        
        if not effective_currency and (ticker.endswith('.NS') or ticker.endswith('.BO')):
            effective_currency = 'INR'
        if not effective_currency:
             effective_currency = 'USD'
            
        initial_scale_factor = 1.0
        if effective_currency == 'INR':
            initial_scale_factor = 1 / 10000000 # Basic scaling for INR
        
        # Apply basic scaling
        current_revenue *= initial_scale_factor
        current_ebit *= initial_scale_factor
        cash_and_equivalents *= initial_scale_factor
        total_debt *= initial_scale_factor
        
        # Apply ROBUST NORMALIZATION (Fail-Safe)
        # This catches cases where correct scaling wasn't applied or data was massive
        current_revenue = normalize_to_crores(current_revenue)
        current_ebit = normalize_to_crores(current_ebit)
        cash_and_equivalents = normalize_to_crores(cash_and_equivalents)
        total_debt = normalize_to_crores(total_debt)
        
        data = {
            "current_revenue": round(current_revenue, 2),
            "current_ebit": round(current_ebit, 2),
            "shares_outstanding": shares_outstanding, # Expecting Absolute
            "cash_and_equivalents": round(cash_and_equivalents, 2),
            "total_debt": round(total_debt, 2),
            # Growth assumptions removed - users should enter their own projections
            "beta": round(beta, 2),
            "tax_rate": 25.0,
            "risk_free_rate": 7.2,
            "equity_risk_premium": 7.0,
            "terminal_growth_rate": 5.0,
            "growth_period_years": 10,
        }
        
        return data

    except Exception as e:
        print(f"Error fetching data for {query}: {e}")
        return {}
