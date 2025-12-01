from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .dcf_engine import DCFEngine, DCFInputs, ValuationResult

app = FastAPI(title="ValuationAI - Indian Market DCF")

# Allow CORS for React Frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, replace with specific origin
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"message": "ValuationAI Backend is Running"}

@app.post("/calculate", response_model=ValuationResult)
def calculate_valuation(inputs: DCFInputs):
    result = DCFEngine.calculate(inputs)
    return result
