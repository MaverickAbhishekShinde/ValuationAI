from pydantic import BaseModel, Field
from typing import List, Optional

class DCFInputs(BaseModel):
    # Company Basics
    current_revenue: float = Field(..., description="Current Year Revenue in INR")
    current_ebit: float = Field(..., description="Current Year EBIT in INR")
    current_ebit: float = Field(..., description="Current Year EBIT in INR")
    tax_rate: float = Field(0.25, description="Effective Tax Rate (Default 25% for India)")

    # Balance Sheet Items
    cash_and_equivalents: float = Field(0.0, description="Cash and Marketable Securities")
    total_debt: float = Field(0.0, description="Total Debt (Short + Long Term)")
    
    # Growth Assumptions
    growth_period_years: int = Field(10, description="Number of years for high growth period")
    revenue_growth_rate: float = Field(..., description="Expected annual revenue growth rate (decimal, e.g., 0.10 for 10%)")
    terminal_growth_rate: float = Field(0.05, description="Terminal growth rate (Default 5% for India)")
    
    # Margins & Reinvestment
    target_operating_margin: float = Field(..., description="Target Operating Margin (EBIT/Revenue) in stable period")
    sales_to_capital_ratio: float = Field(1.5, description="Sales to Capital Ratio (Efficiency)")
    
    # Discount Rate (WACC) Components
    risk_free_rate: float = Field(0.072, description="Risk Free Rate (Default 7.2% for India 10Y Bond)")
    beta: float = Field(1.0, description="Beta of the stock")
    equity_risk_premium: float = Field(0.07, description="Equity Risk Premium (Default 7% for India)")
    cost_of_debt: float = Field(0.09, description="Pre-tax Cost of Debt (Default 9%)")
    debt_to_capital_ratio: float = Field(0.20, description="Debt to Capital Ratio (Target)")
    
    # Share Count for Per Share Value
    shares_outstanding: float = Field(..., description="Number of shares outstanding")

class YearProjection(BaseModel):
    year: int
    revenue: float
    ebit: float
    nopat: float
    reinvestment: float
    fcff: float
    discount_factor: float
    present_value_fcff: float

class ValuationResult(BaseModel):
    projections: List[YearProjection]
    terminal_value: float
    present_value_terminal_value: float
    sum_pv_fcff: float
    enterprise_value: float
    equity_value: float
    share_price: float
    wacc: float

class DCFEngine:
    @staticmethod
    def calculate(inputs: DCFInputs) -> ValuationResult:
        # 1. Calculate WACC
        cost_of_equity = inputs.risk_free_rate + inputs.beta * inputs.equity_risk_premium
        after_tax_cost_of_debt = inputs.cost_of_debt * (1 - inputs.tax_rate)
        wacc = (cost_of_equity * (1 - inputs.debt_to_capital_ratio)) + \
               (after_tax_cost_of_debt * inputs.debt_to_capital_ratio)
        
        projections = []
        
        # Current values to start iteration
        revenue = inputs.current_revenue
        ebit = inputs.current_ebit
        
        # We need to interpolate margins if current margin != target margin
        # For simplicity in this version, we assume convergence to target margin over time or constant
        # Let's assume linear convergence of operating margin
        current_margin = inputs.current_ebit / inputs.current_revenue if inputs.current_revenue else 0
        
        cumulative_pv_fcff = 0.0
        
        for year in range(1, inputs.growth_period_years + 1):
            # Revenue Growth
            revenue = revenue * (1 + inputs.revenue_growth_rate)
            
            # Margin Convergence
            # Linearly interpolate margin towards target
            year_margin = current_margin + (inputs.target_operating_margin - current_margin) * (year / inputs.growth_period_years)
            ebit = revenue * year_margin
            
            # Tax
            nopat = ebit * (1 - inputs.tax_rate)
            
            # Reinvestment
            # Reinvestment = Change in Revenue / Sales to Capital Ratio
            # Change in Revenue = Revenue_this_year - Revenue_last_year
            # But we only have current year revenue. 
            # Change = Revenue - (Revenue / (1+g))
            prev_revenue = revenue / (1 + inputs.revenue_growth_rate)
            change_in_revenue = revenue - prev_revenue
            reinvestment = change_in_revenue / inputs.sales_to_capital_ratio
            
            # FCFF
            fcff = nopat - reinvestment
            
            # Discounting
            discount_factor = 1 / ((1 + wacc) ** year)
            pv_fcff = fcff * discount_factor
            
            cumulative_pv_fcff += pv_fcff
            
            projections.append(YearProjection(
                year=year,
                revenue=revenue,
                ebit=ebit,
                nopat=nopat,
                reinvestment=reinvestment,
                fcff=fcff,
                discount_factor=discount_factor,
                present_value_fcff=pv_fcff
            ))
            
        # Terminal Value
        # TV = FCFF_n+1 / (WACC - g_terminal)
        # FCFF_n+1
        next_revenue = revenue * (1 + inputs.terminal_growth_rate)
        next_ebit = next_revenue * inputs.target_operating_margin # Assume target margin reached
        next_nopat = next_ebit * (1 - inputs.tax_rate)
        
        # In stable growth, Reinvestment Rate = g / ROC
        # ROC = Return on Capital. Let's assume ROC = WACC for stable companies (conservative) 
        # or keep using sales to capital ratio?
        # Let's use the sales to capital ratio for consistency with user input model style usually
        next_change_in_revenue = next_revenue - revenue
        next_reinvestment = next_change_in_revenue / inputs.sales_to_capital_ratio
        
        next_fcff = next_nopat - next_reinvestment
        
        terminal_value = next_fcff / (wacc - inputs.terminal_growth_rate)
        pv_terminal_value = terminal_value * (1 / ((1 + wacc) ** inputs.growth_period_years))
        
        enterprise_value = cumulative_pv_fcff + pv_terminal_value
        
        # Equity Value = Enterprise Value + Cash - Debt
        equity_value = enterprise_value + inputs.cash_and_equivalents - inputs.total_debt
        share_price = equity_value / inputs.shares_outstanding
        
        return ValuationResult(
            projections=projections,
            terminal_value=terminal_value,
            present_value_terminal_value=pv_terminal_value,
            sum_pv_fcff=cumulative_pv_fcff,
            enterprise_value=enterprise_value,
            equity_value=equity_value,
            share_price=share_price,
            wacc=wacc
        )
