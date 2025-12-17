import openpyxl

def dump_full():
    try:
        wb = openpyxl.load_workbook('fcffsimpleginzu.xlsx', data_only=False)
        sheet = wb['Valuation output']
        
        with open('excel_dump.txt', 'w', encoding='utf-8') as f:
            for row in sheet.iter_rows(max_row=100):
                values = [str(c.value) if c.value is not None else "" for c in row]
                f.write("\t".join(values) + "\n")
        
        print("Dumped to excel_dump.txt")

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    dump_full()
