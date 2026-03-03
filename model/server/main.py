from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import os
import shutil
import uuid
from inference import SoundAnalyzer

app = FastAPI(title="PERA-SAM ML Backend")

# Enable CORS for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, replace with your frontend URL
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ensure assets directory exists
os.makedirs(os.path.join(os.path.dirname(__file__), "assets"), exist_ok=True)

# Initialize analyzer
analyzer = SoundAnalyzer()

@app.get("/")
async def root():
    return {
        "message": "PERA-SAM ML Sound Analysis API is running",
        "loaded_models": list(analyzer.models.keys())
    }

@app.post("/analyze")
async def analyze_sound(
    file: UploadFile = File(...),
    category: str = Form(None),
    machine_id: str = Form(None)
):
    # 1. Save file temporarily with a unique name to prevent collisions
    temp_id = str(uuid.uuid4())[:8]
    temp_path = f"temp_{temp_id}_{file.filename}"
    
    try:
        with open(temp_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # 2. Run inference
        result = analyzer.predict(temp_path, category=category, machine_id=machine_id)
        
        return {
            "filename": file.filename,
            "category_requested": category,
            "machine_id_requested": machine_id,
            "analysis": result
        }
    except Exception as e:
        return {
            "status": "Error",
            "message": str(e)
        }
    finally:
        # 3. Cleanup
        if os.path.exists(temp_path):
            os.remove(temp_path)

if __name__ == "__main__":
    # Get port from environment variable for deployment flexibility
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
