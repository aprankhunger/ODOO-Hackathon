import asyncio
import psutil
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_system_telemetry():
    cpu_percent = psutil.cpu_percent(interval=None)
    ram = psutil.virtual_memory()
    disk = psutil.disk_usage('/')
    
    # Simple risk calculation
    risk_score = 0
    if cpu_percent > 85: risk_score += 40
    elif cpu_percent > 70: risk_score += 20
    if ram.percent > 90: risk_score += 40
    elif ram.percent > 80: risk_score += 20
    if disk.percent > 95: risk_score += 20
    
    status = "Healthy"
    if risk_score > 70:
        status = "Critical"
    elif risk_score > 30:
        status = "Warning"

    return {
        "timestamp": datetime.now().isoformat(),
        "device_id": "DEV-LOCAL-001",
        "cpu": cpu_percent,
        "ram": ram.percent,
        "disk": disk.percent,
        "status": status,
        "risk_score": risk_score
    }

@app.websocket("/ws/telemetry")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    
    # Initial read to prevent 0.0 cpu return on first call
    psutil.cpu_percent(interval=None)
    
    try:
        while True:
            data = get_system_telemetry()
            await websocket.send_json(data)
            await asyncio.sleep(2)
    except WebSocketDisconnect:
        print("Client disconnected")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
