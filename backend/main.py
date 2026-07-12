import asyncio
import os
import random
import string
import json
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from datetime import datetime
from dotenv import load_dotenv

from database import engine, get_db
from models import Asset, Telemetry, TechnicianCode, Base
from pydantic import BaseModel

try:
    from google import genai
except ImportError:
    genai = None

load_dotenv()

# Initialize Gemini Client if API key is present
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
gemini_client = None
if GEMINI_API_KEY and GEMINI_API_KEY != "put_your_key_here" and genai:
    gemini_client = genai.Client(api_key=GEMINI_API_KEY)

# Create tables if they don't exist
Base.metadata.create_all(bind=engine)

app = FastAPI(title="IntelliAsset Central Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

dashboard_connections = []

class AssignRequest(BaseModel):
    device_id: str

class LoginRequest(BaseModel):
    code: str

@app.websocket("/ws/dashboard")
async def websocket_dashboard(websocket: WebSocket):
    await websocket.accept()
    dashboard_connections.append(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        dashboard_connections.remove(websocket)

@app.post("/api/assets/register")
def register_asset(data: dict, db: Session = Depends(get_db)):
    device_id = data.get("device_id")
    if not device_id:
        return {"error": "device_id is required"}
    
    existing_asset = db.query(Asset).filter(Asset.device_id == device_id).first()
    if existing_asset:
        return {"message": "Asset already registered", "device_id": device_id}
    
    new_asset = Asset(
        device_id=device_id,
        hostname=data.get("hostname", "Unknown Device"),
        os_name=data.get("os_name", "Unknown OS")
    )
    db.add(new_asset)
    db.commit()
    
    return {"message": "Asset registered successfully", "device_id": device_id}

@app.websocket("/ws/ingest/{device_id}")
async def websocket_ingest(websocket: WebSocket, device_id: str, db: Session = Depends(get_db)):
    await websocket.accept()
    
    try:
        while True:
            data = await websocket.receive_json()
            
            broadcast_payload = {
                "device_id": device_id,
                "telemetry": data
            }
            
            for conn in dashboard_connections:
                try:
                    await conn.send_json(broadcast_payload)
                except:
                    pass
            
            cpu = data.get("cpu", 0)
            ram = data.get("ram", 0)
            disk = data.get("disk", 0)
            status = data.get("status", "Unknown")
            
            new_telemetry = Telemetry(
                device_id=device_id,
                cpu_percent=cpu,
                ram_percent=ram,
                disk_percent=disk,
                status=status,
                detailed_metrics=data 
            )
            
            db.add(new_telemetry)
            db.commit()
            
    except WebSocketDisconnect:
        print(f"Agent {device_id} disconnected")

@app.get("/api/assets")
def get_all_assets(db: Session = Depends(get_db)):
    assets = db.query(Asset).all()
    result = []
    for asset in assets:
        latest = db.query(Telemetry).filter(Telemetry.device_id == asset.device_id).order_by(Telemetry.timestamp.desc()).first()
        result.append({
            "device_id": asset.device_id,
            "hostname": asset.hostname,
            "os_name": asset.os_name,
            "registered_at": asset.registered_at,
            "latest_status": latest.status if latest else "Unknown",
            "last_seen": latest.timestamp if latest else None
        })
    return result

@app.get("/api/assets/{device_id}")
def get_asset_details(device_id: str, db: Session = Depends(get_db)):
    asset = db.query(Asset).filter(Asset.device_id == device_id).first()
    if not asset:
        return {"error": "Asset not found"}
    
    history = db.query(Telemetry).filter(Telemetry.device_id == device_id).order_by(Telemetry.timestamp.desc()).limit(20).all()
    
    return {
        "asset": asset,
        "history": history
    }

@app.post("/api/admin/assign")
def assign_technician(req: AssignRequest, db: Session = Depends(get_db)):
    # 1. Fetch latest telemetry
    latest_telemetry = db.query(Telemetry).filter(Telemetry.device_id == req.device_id).order_by(Telemetry.timestamp.desc()).first()
    if not latest_telemetry:
        raise HTTPException(status_code=404, detail="No telemetry data found for this device")

    telemetry_data = latest_telemetry.detailed_metrics

    # 2. Call Gemini AI to generate a report
    ai_report = "AI Report currently unavailable. (Please set GEMINI_API_KEY)"
    priority = 3 # Default Low
    
    if gemini_client:
        try:
            prompt = f"""
            You are an expert IT technician. Analyze this real-time device telemetry data and generate a short, actionable repair report.
            Include:
            1. A clear diagnosis of the most pressing issue (CPU, RAM, Disk, Event Logs, or Security).
            2. Step-by-step fix instructions.
            3. A strict priority score: 1 (High/Critical), 2 (Medium), or 3 (Low/Healthy). Return this score exactly on the first line as "Priority: X".
            
            Telemetry:
            {json.dumps(telemetry_data, indent=2)}
            """
            
            response = gemini_client.models.generate_content(
                model='gemini-2.5-flash',
                contents=prompt
            )
            ai_report = response.text
            
            # Parse priority
            if "Priority: 1" in ai_report: priority = 1
            elif "Priority: 2" in ai_report: priority = 2
            
        except Exception as e:
            print(f"Gemini API Error: {e}")
            ai_report = f"AI Generation Failed: {str(e)}"
            
    # 3. Generate Code
    code = "TECH-" + ''.join(random.choices(string.ascii_uppercase + string.digits, k=4))
    
    # 4. Save to DB
    tech_ticket = TechnicianCode(
        code=code,
        device_id=req.device_id,
        ai_report=ai_report,
        priority=priority
    )
    db.add(tech_ticket)
    db.commit()
    
    return {"message": "Technician assigned", "code": code, "priority": priority}

@app.post("/api/technician/login")
def technician_login(req: LoginRequest, db: Session = Depends(get_db)):
    tickets = db.query(TechnicianCode).filter(TechnicianCode.code == req.code).all()
    if not tickets:
        raise HTTPException(status_code=401, detail="Invalid Technician Code")
    
    # Map tickets with asset info
    assigned_devices = []
    for t in tickets:
        asset = db.query(Asset).filter(Asset.device_id == t.device_id).first()
        assigned_devices.append({
            "device_id": t.device_id,
            "hostname": asset.hostname if asset else "Unknown",
            "priority": t.priority,
            "ai_report": t.ai_report,
            "assigned_at": t.created_at
        })
    
    # Sort by priority (1 is highest)
    assigned_devices.sort(key=lambda x: x["priority"])
    
    return {"message": "Login successful", "assigned_devices": assigned_devices}

class ChatRequest(BaseModel):
    message: str

@app.post("/api/chat")
def chatbot_interaction(req: ChatRequest, db: Session = Depends(get_db)):
    assets = db.query(Asset).all()
    fleet_data = []
    for asset in assets:
        latest = db.query(Telemetry).filter(Telemetry.device_id == asset.device_id).order_by(Telemetry.timestamp.desc()).first()
        if latest:
            fleet_data.append({
                "hostname": asset.hostname,
                "os": asset.os_name,
                "cpu": latest.cpu_percent,
                "ram": latest.ram_percent,
                "disk": latest.disk_percent,
                "status": latest.status,
                "recent_errors": latest.detailed_metrics.get("recent_errors", []) if latest.detailed_metrics else []
            })
            
    reply = "AI Chatbot is currently unavailable. (Please set GEMINI_API_KEY in backend/.env)"
    
    if gemini_client:
        try:
            prompt = f"""
            You are IntelliAsset AI, an expert IT fleet management assistant. 
            The user is an IT Admin asking a question about their fleet of devices.
            
            Here is the current real-time data for all active devices in the fleet:
            {json.dumps(fleet_data, indent=2)}
            
            User's Question: "{req.message}"
            
            Provide a helpful, concise, and professional answer. If they ask about specific metrics (like RAM, CPU, or crashes), refer to the data provided. Use markdown for formatting if needed.
            """
            
            response = gemini_client.models.generate_content(
                model='gemini-2.5-flash',
                contents=prompt
            )
            reply = response.text
        except Exception as e:
            print(f"Gemini Chat Error: {e}")
            reply = f"AI Error: {str(e)}"
            
    return {"reply": reply}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
