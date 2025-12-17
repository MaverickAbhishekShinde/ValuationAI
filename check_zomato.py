import yfinance as yf
import pandas as pd

def check_zomato():
    print("--- Checking ZOMATO.NS Data ---")
    stock = yf.Ticker("ZOMATO.NS")
    
    # 1. Check Info
    print(f"Info Revenue: {stock.info.get('totalRevenue')}")
    
    # 2. Check Income Statement
    try:
        inc = stock.income_stmt
        if not inc.empty:
            print("\nIncome Statement (Latest):")
            print(inc.iloc[:, 0].head(10))
            rev = inc.loc['Total Revenue'].iloc[0]
            print(f"Revenue from Sheet: {rev}")
    except Exception as e:
        print(f"Income Stmt Error: {e}")

    # 3. Check Balance Sheet
    try:
        bs = stock.balance_sheet
        if not bs.empty:
            print("\nBalance Sheet (Latest):")
            print(bs.iloc[:, 0].head(10))
            debt = bs.loc['Total Debt'].iloc[0] if 'Total Debt' in bs.index else 0
            print(f"Debt from Sheet: {debt}")
    except Exception as e:
        print(f"Balance Sheet Error: {e}")

if __name__ == "__main__":
    check_zomato()
