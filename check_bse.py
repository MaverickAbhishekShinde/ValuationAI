import yfinance as yf

def check_bse():
    print("--- Checking ZOMATO.BO ---")
    stock = yf.Ticker("ZOMATO.BO")
    print(f"Info Revenue: {stock.info.get('totalRevenue')}")
    
    try:
        print(f"Fast Info Last Price: {stock.fast_info.get('last_price')}")
    except:
        pass

if __name__ == "__main__":
    check_bse()
