import openpyxl

def dump_sheet():
    try:
        wb = openpyxl.load_workbook('fcffsimpleginzu.xlsx', data_only=False)
        sheet = wb['Valuation output']
        
        print("--- Dumping 'Valuation output' content ---")
        for row in sheet.iter_rows(max_row=50, max_col=5):
            values = [c.value for c in row if c.value is not None]
            if values:
                print(f"Row {row[0].row}: {values}")

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    dump_sheet()
