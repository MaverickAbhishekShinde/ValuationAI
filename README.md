# ValuationAI - Indian Market DCF Model

A professional-grade DCF (Discounted Cash Flow) valuation tool built for the Indian market, featuring a modern React frontend and robust Python backend.

## 🚀 Features

- **Indian Market Focus**: Pre-configured with Indian Risk-Free Rate (7.2%), Equity Risk Premium (7%), and Terminal Growth (5%)
- **User-Friendly Inputs**: Values in Crores and Percentages for easier data entry
- **Interactive Tooltips**: Contextual help for complex financial terms
- **Real-Time Calculations**: Instant valuation results with detailed breakdowns
- **Modern UI**: Dark mode interface with smooth animations

## 📦 Tech Stack

- **Frontend**: React + Vite + Tailwind CSS
- **Backend**: Python + FastAPI
- **Calculations**: NumPy + Pandas

## 🏃 Running Locally

1. **Clone the repository**
   ```bash
   git clone https://github.com/YOUR_USERNAME/ValuationAI.git
   cd ValuationAI
   ```

2. **Install Python dependencies**
   ```bash
   pip install -r requirements.txt
   ```

3. **Install Node dependencies**
   ```bash
   cd frontend
   npm install
   cd ..
   ```

4. **Run the app**
   ```bash
   start_app.bat
   ```
   The app will open at `http://localhost:5173`

## 🌐 Deployment

### Backend (Render)

1. Push your code to GitHub
2. Go to [render.com](https://render.com)
3. Create a new **Web Service**
4. Connect your GitHub repository
5. Render will auto-detect the `render.yaml` and deploy
6. Copy your backend URL (e.g., `https://valuationai.onrender.com`)

### Frontend (Netlify)

1. Build the frontend:
   ```bash
   cd frontend
   npm run build
   ```

2. Go to [netlify.com](https://netlify.com)
3. Drag and drop the `frontend/dist` folder
4. In **Site Settings → Environment Variables**, add:
   ```
   VITE_API_URL=https://your-backend-url.onrender.com
   ```
5. Redeploy

## 📝 Usage

1. **Company Basics**: Enter Revenue, EBIT, and Shares Outstanding (in Crores for monetary values)
2. **Balance Sheet**: Add Cash and Debt (in Crores)
3. **Growth Assumptions**: Set expected growth rate and target margins (in %)
4. **Market Factors** (Optional): Customize WACC components (collapsed by default)
5. **Calculate**: Get the intrinsic share price and equity value

## 🧮 Model Inputs

- Revenue, EBIT, Cash, Debt: **In Crores (₹)**
- Growth rates, margins, percentages: **In %**
- Shares Outstanding: **Actual number**

## 📊 What You Get

- **Share Price**: Intrinsic value per share
- **Equity Value**: Total market cap implied
- **Enterprise Value**: Operating asset value
- **WACC**: Weighted average cost of capital
- **Projected Cash Flows**: 10-year FCFF projections

## 🤝 Contributing

This is a personal project, but suggestions are welcome!

## 📄 License

MIT License - Feel free to use for personal or educational purposes.
