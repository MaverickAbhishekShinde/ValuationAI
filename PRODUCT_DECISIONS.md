# Product Decision Log

This document tracks key product decisions, the context behind them, and the rationale (the "Why"). It serves as a single source of truth for the product's direction and constraints.

## 1. Deployment Architecture
- **Decision**: Split deployment strategy.
  - **Backend**: Render (Free Tier)
  - **Frontend**: Netlify (Free Tier)
- **Context**: The application is a "Monorepo" with a Python FastAPI backend and a React Vite frontend. Netlify is excellent for static sites but cannot host Python servers.
- **Rationale**: 
  - **Cost**: Both services offer generous free tiers, adhering to the "Zero Cost" constraint.
  - **Scalability**: Decoupling frontend and backend allows them to scale independently.
  - **Simplicity**: Netlify's CI/CD for frontend is best-in-class; Render is the easiest free option for Python.

## 2. Product Vision: Comprehensive Personal Finance App
- **Decision**: Evolve from a "DCF Calculator" to a "Personal Finance Platform" for retail investors.
- **Context**: The MVP proves the core calculation works. To retain users, we need to reduce friction and offer broader value.
- **Rationale**: 
  - **Stickiness**: A simple calculator is a "use once" tool. A platform with saved portfolios and live data is a "daily use" tool.
  - **Target Audience**: Retail investors who want professional-grade tools without the Bloomberg Terminal price tag.

## 3. Constraint: 100% Free Resources
- **Decision**: All third-party integrations (Data, Hosting, Auth) must be free forever or have a substantial free tier.
- **Rationale**: The project is a portfolio piece and a tool for personal use. Recurring costs are not sustainable for this stage.

## 4. Feature Prioritization: "Smart" Auto-fill (Proposed)
- **Decision**: Prioritize "Ticker Search & Auto-fill" over complex visualizations.
- **Context**: Users currently must manually find and input 10+ financial figures.
- **Rationale**:
  - **Friction Reduction**: Reduces "Time to Value" from minutes to seconds.
  - **Data Accuracy**: Manual entry is prone to errors; automated data provides a reliable baseline.
  - **Feasibility**: Can be implemented using free libraries like `yfinance`.
