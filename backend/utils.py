def normalize_to_crores(value: float) -> float:
    """
    Normalizes a financial value to Crores.
    
    Heuristic:
    - If value is > 1,000,000,000 (1 Billion), it is undeniably an Absolute INR value 
      (because 1 Billion Crores is physically impossible for any company).
      In this case, we FORCE scale it by 10^-7.
    - Otherwise, we return the value as is (assuming it might already be in Crores 
      or is just a small absolute value, though the caller should generally handle currency scaling first).
      
    This function is primarily a fail-safe against massive data inputs.
    
    Args:
        value (float): The input value (Revenue, EBIT, etc.)
        
    Returns:
        float: The value in Crores.
    """
    if value is None:
        return 0.0
        
    # Threshold: 1 Billion.
    # 1 Billion Absolute INR = 100 Crores. 
    # But 1 Billion Crores = 10^16 INR (Quadrillion). No company is that big.
    # So if we see > 1 Billion, it's definitely Absolute.
    
    # Let's be conservative. Even 100 Million Crores is impossible.
    # 10,000,000 (1 Crore in Absolute) = 1.0 in Crores.
    # If we get 10,000,000 passed here, implementation depends on context.
    # But usually this is called AFTER weak currency scaling.
    
    # If the number is > 1,000,000,000 (1 Billion), convert to Crores
    if abs(value) > 1_000_000_000:
        return value / 10_000_000.0
        
    return value
