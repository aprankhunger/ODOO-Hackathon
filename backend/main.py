import asyncio
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from datetime import datetime

from database import engine, get_db
from models import Asset, Telemetry, Base
import models

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

# In-memory store for connected dashboards to broadcast live data
dashboard_connections = []

@app.websocket("/ws/dashboard")
async def websocket_dashboard(websocket: WebSocket):
    await websocket.accept()
    dashboard_connections.append(websocket)
    try:
        while True:
            # Keep connection open
            await websocket.receive_text()
    except WebSocketDisconnect:
        dashboard_connections.remove(websocket)

@app.post("/api/assets/register")
def register_asset(data: dict, db: Session = Depends(get_db)):
    device_id = data.get("device_id")
    if not device_id:
        return {"error": "device_id is required"}
    
    # Check if already exists
    existing_asset = db.query(Asset).filter(Asset.device_id == device_id).first()
    if existing_asset:
        # Ignore registration if it exists
        return {"message": "Asset already registered", "device_id": device_id}
    
    # Create new asset
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
            
            # Broadcast to all connected dashboards
            broadcast_payload = {
                "device_id": device_id,
                "telemetry": data
            }
            
            for conn in dashboard_connections:
                try:
                    await conn.send_json(broadcast_payload)
                except:
                    pass
            
            # Save telemetry to database
            # Extract basic metrics
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
                detailed_metrics=data # Store full payload
            )
            
            db.add(new_telemetry)
            db.commit()
            
    except WebSocketDisconnect:
        print(f"Agent {device_id} disconnected")

@app.get("/api/assets")
def get_all_assets(db: Session = Depends(get_db)):
    assets = db.query(Asset).all()
    # Fetch latest telemetry for each asset
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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
