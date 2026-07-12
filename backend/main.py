import asyncio
import os
import random
import string
import json
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from dotenv import load_dotenv

from database import engine, get_db, SessionLocal
from models import Asset, Telemetry, TechnicianCode, Notification, AuditLog, Base
from pydantic import BaseModel

try:
    from google import genai
except ImportError:
    genai = None

load_dotenv()
# Fallback: also load shared project env if present (e.g. v0 sandbox)
load_dotenv("/vercel/share/.env.project")

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

# ---------------------------------------------------------------------------
# Notifications & Audit Log helpers
# ---------------------------------------------------------------------------

def log_action(db: Session, actor: str, actor_role: str, action: str, target: str = None, details: str = None):
    """Insert a row into the audit log."""
    entry = AuditLog(actor=actor, actor_role=actor_role, action=action, target=target, details=details)
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry

def serialize_notification(n: Notification):
    return {
        "id": n.id,
        "recipient_role": n.recipient_role,
        "type": n.type,
        "title": n.title,
        "message": n.message,
        "severity": n.severity,
        "is_read": n.is_read,
        "created_at": n.created_at.isoformat() if n.created_at else None,
    }

async def create_notification(db: Session, recipient_role: str, type: str, title: str, message: str, severity: str = "info"):
    """Insert a notification and broadcast it live to all dashboard WebSocket clients."""
    notif = Notification(
        recipient_role=recipient_role,
        type=type,
        title=title,
        message=message,
        severity=severity,
    )
    db.add(notif)
    db.commit()
    db.refresh(notif)

    payload = {"event": "notification", "notification": serialize_notification(notif)}
    for conn in list(dashboard_connections):
        try:
            await conn.send_json(payload)
        except Exception:
            pass
    return notif

def seed_activity_data():
    """Seed realistic demo notifications and audit logs if the tables are empty."""
    db = SessionLocal()
    try:
        if db.query(Notification).first() is not None:
            return

        now = datetime.utcnow()

        demo_notifications = [
            ("all", "asset_assigned", "Asset Assigned", 'MacBook Pro 16" (AF-0114) has been assigned to Priya Sharma (Engineering).', "info", True, now - timedelta(days=3, hours=4)),
            ("admin", "maintenance_approved", "Maintenance Approved", "Maintenance request MR-2041 for Dell Latitude 7440 (AF-0087) approved by Manager Raj Patel.", "success", True, now - timedelta(days=2, hours=9)),
            ("admin", "maintenance_rejected", "Maintenance Rejected", "Maintenance request MR-2043 for HP EliteBook (AF-0102) rejected: duplicate of MR-2041.", "warning", True, now - timedelta(days=2, hours=6)),
            ("all", "booking_confirmed", "Booking Confirmed", "Conference Projector (AF-0230) booked by Ananya Iyer for Jul 14, 10:00-12:00.", "success", False, now - timedelta(days=1, hours=20)),
            ("all", "booking_cancelled", "Booking Cancelled", "Booking BK-3312 for Canon DSLR Kit (AF-0198) cancelled by Vikram Rao.", "warning", True, now - timedelta(days=1, hours=12)),
            ("admin", "transfer_approved", "Transfer Approved", "Transfer TR-0561: Lenovo ThinkPad X1 (AF-0075) moved from Mumbai HQ to Bengaluru Office.", "success", False, now - timedelta(days=1, hours=3)),
            ("all", "booking_reminder", "Booking Reminder", "Reminder: Conference Projector (AF-0230) booking starts in 1 hour (Ananya Iyer).", "info", False, now - timedelta(hours=8)),
            ("admin", "overdue_return", "Overdue Return Alert", 'iPad Pro 12.9" (AF-0156) checked out to Karan Mehta is 3 days overdue for return.', "danger", False, now - timedelta(hours=5)),
            ("admin", "audit_discrepancy", "Audit Discrepancy Flagged", "Quarterly audit: Logitech MX Master (AF-0301) not found at recorded location (Desk 42, Floor 3).", "danger", False, now - timedelta(hours=2)),
            ("technician", "asset_assigned", "New Repair Ticket", "You have been assigned a repair ticket for Dell Latitude 7440 (AF-0087) — Priority: High.", "warning", False, now - timedelta(hours=1)),
        ]
        for role, ntype, title, message, severity, is_read, created in demo_notifications:
            db.add(Notification(recipient_role=role, type=ntype, title=title, message=message, severity=severity, is_read=is_read, created_at=created))

        demo_logs = [
            ("admin", "admin", "LOGIN", None, "Admin signed in to IntelliAsset Central.", now - timedelta(days=3, hours=5)),
            ("admin", "admin", "ASSET_REGISTERED", "AF-0114", 'Registered MacBook Pro 16" — Engineering pool.', now - timedelta(days=3, hours=4, minutes=30)),
            ("admin", "admin", "ASSET_ASSIGNED", "AF-0114", "Assigned to Priya Sharma (Engineering).", now - timedelta(days=3, hours=4)),
            ("priya.sharma", "employee", "MAINTENANCE_REQUESTED", "AF-0087", "Reported: Dell Latitude 7440 battery drains within 1 hour.", now - timedelta(days=2, hours=11)),
            ("raj.patel", "manager", "MAINTENANCE_APPROVED", "AF-0087", "Approved maintenance request MR-2041.", now - timedelta(days=2, hours=9)),
            ("raj.patel", "manager", "MAINTENANCE_REJECTED", "AF-0102", "Rejected MR-2043 — duplicate of MR-2041.", now - timedelta(days=2, hours=6)),
            ("ananya.iyer", "employee", "BOOKING_CREATED", "AF-0230", "Booked Conference Projector for Jul 14, 10:00-12:00.", now - timedelta(days=1, hours=20)),
            ("vikram.rao", "employee", "BOOKING_CANCELLED", "AF-0198", "Cancelled booking BK-3312 for Canon DSLR Kit.", now - timedelta(days=1, hours=12)),
            ("admin", "admin", "TRANSFER_APPROVED", "AF-0075", "Approved transfer TR-0561: Mumbai HQ → Bengaluru Office.", now - timedelta(days=1, hours=3)),
            ("system", "system", "BOOKING_REMINDER_SENT", "AF-0230", "Sent booking start reminder to Ananya Iyer.", now - timedelta(hours=8)),
            ("system", "system", "OVERDUE_FLAGGED", "AF-0156", 'iPad Pro 12.9" overdue by 3 days (Karan Mehta).', now - timedelta(hours=5)),
            ("admin", "admin", "AUDIT_STARTED", None, "Started Q3 physical asset audit — Floor 3.", now - timedelta(hours=3)),
            ("admin", "admin", "AUDIT_FLAGGED", "AF-0301", "Discrepancy: Logitech MX Master missing from Desk 42.", now - timedelta(hours=2)),
            ("TECH-9QX2", "technician", "LOGIN", None, "Technician signed in with access code.", now - timedelta(hours=1, minutes=15)),
            ("TECH-9QX2", "technician", "TICKET_VIEWED", "AF-0087", "Opened AI repair report for Dell Latitude 7440.", now - timedelta(hours=1)),
        ]
        for actor, role, action, target, details, created in demo_logs:
            db.add(AuditLog(actor=actor, actor_role=role, action=action, target=target, details=details, created_at=created))

        db.commit()
        print("Seeded demo notifications and audit logs.")
    finally:
        db.close()

seed_activity_data()

class AssignRequest(BaseModel):
    device_id: str

class LoginRequest(BaseModel):
    code: str

class ChatRequest(BaseModel):
    message: str

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
async def register_asset(data: dict, db: Session = Depends(get_db)):
    device_id = data.get("device_id")
    if not device_id:
        return {"error": "device_id is required"}
    
    existing_asset = db.query(Asset).filter(Asset.device_id == device_id).first()
    if existing_asset:
        return {"message": "Asset already registered", "device_id": device_id}
    
    hostname = data.get("hostname", "Unknown Device")
    new_asset = Asset(
        device_id=device_id,
        hostname=hostname,
        os_name=data.get("os_name", "Unknown OS")
    )
    db.add(new_asset)
    db.commit()

    log_action(db, actor="system", actor_role="system", action="ASSET_REGISTERED", target=device_id, details=f"Registered {hostname}.")
    await create_notification(
        db,
        recipient_role="admin",
        type="asset_registered",
        title="New Asset Registered",
        message=f"{hostname} ({device_id}) joined the fleet.",
        severity="info",
    )
    
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
async def assign_technician(req: AssignRequest, db: Session = Depends(get_db)):
    # 1. Fetch latest telemetry
    latest_telemetry = db.query(Telemetry).filter(Telemetry.device_id == req.device_id).order_by(Telemetry.timestamp.desc()).first()
    if not latest_telemetry:
        raise HTTPException(status_code=404, detail="No telemetry data found for this device")

    telemetry_data = latest_telemetry.detailed_metrics if latest_telemetry.detailed_metrics else {}
    
    # Trim down the telemetry data to avoid token limits
    trimmed_telemetry = {
        "cpu": telemetry_data.get("cpu", 0),
        "ram": telemetry_data.get("ram", 0),
        "disk": telemetry_data.get("disk", 0),
        "status": telemetry_data.get("status", "Unknown"),
        "top_processes": telemetry_data.get("top_processes", [])[:3], # Only top 3
        "recent_errors": telemetry_data.get("recent_errors", [])[:2] # Only top 2 errors
    }

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
            {json.dumps(trimmed_telemetry, indent=2)}
            """
            
            response = gemini_client.models.generate_content(
                model='gemini-flash-latest',
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

    asset = db.query(Asset).filter(Asset.device_id == req.device_id).first()
    hostname = asset.hostname if asset else req.device_id
    priority_label = {1: "High", 2: "Medium", 3: "Low"}.get(priority, "Low")
    severity = {1: "danger", 2: "warning", 3: "info"}.get(priority, "info")

    log_action(db, actor="admin", actor_role="admin", action="TECHNICIAN_ASSIGNED", target=req.device_id, details=f"Assigned code {code} for {hostname} — Priority: {priority_label}.")
    await create_notification(
        db,
        recipient_role="all",
        type="asset_assigned",
        title="Technician Assigned",
        message=f"Repair ticket created for {hostname} — Priority: {priority_label}. Access code: {code}.",
        severity=severity,
    )
    
    return {"message": "Technician assigned", "code": code, "priority": priority}

@app.post("/api/chat")
def chat(req: ChatRequest, db: Session = Depends(get_db)):
    if not gemini_client:
        raise HTTPException(
            status_code=503,
            detail="Gemini is not configured. Set the GEMINI_API_KEY environment variable and restart the backend."
        )

    # Build fleet context from the database
    assets = db.query(Asset).all()
    fleet_context = []
    for asset in assets:
        latest = (
            db.query(Telemetry)
            .filter(Telemetry.device_id == asset.device_id)
            .order_by(Telemetry.timestamp.desc())
            .first()
        )
        fleet_context.append({
            "device_id": asset.device_id,
            "hostname": asset.hostname,
            "os": asset.os_name,
            "status": latest.status if latest else "Unknown",
            "cpu_percent": latest.cpu_percent if latest else None,
            "ram_percent": latest.ram_percent if latest else None,
            "disk_percent": latest.disk_percent if latest else None,
            "last_seen": str(latest.timestamp) if latest else None,
        })

    prompt = f"""
    You are IntelliAsset AI, an expert IT fleet-monitoring assistant.
    Answer the user's question using the live fleet data below.
    Be concise, actionable, and reference specific devices by hostname when relevant.
    If the fleet data is empty, say that no devices are currently registered and answer generally.
    Respond in plain text only. Do not use markdown formatting such as ** or bullets with *.

    Fleet data:
    {json.dumps(fleet_context, indent=2)}

    User question: {req.message}
    """

    try:
        response = gemini_client.models.generate_content(
            model='gemini-flash-latest',
            contents=prompt
        )
        return {"reply": response.text}
    except Exception as e:
        print(f"Gemini API Error: {e}")
        raise HTTPException(status_code=502, detail=f"Gemini request failed: {str(e)}")

@app.post("/api/technician/login")
def technician_login(req: LoginRequest, db: Session = Depends(get_db)):
    tickets = db.query(TechnicianCode).filter(TechnicianCode.code == req.code).all()
    if not tickets:
        raise HTTPException(status_code=401, detail="Invalid Technician Code")

    log_action(db, actor=req.code, actor_role="technician", action="LOGIN", target=None, details="Technician signed in with access code.")
    
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
            # We trim down the data sent to the AI to prevent Free Tier token limit errors
            fleet_data.append({
                "host": asset.hostname,
                "cpu": latest.cpu_percent,
                "ram": latest.ram_percent,
                "disk": latest.disk_percent,
                "status": latest.status
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

# ---------------------------------------------------------------------------
# Notifications & Audit Log endpoints
# ---------------------------------------------------------------------------

@app.get("/api/notifications")
def get_notifications(role: str = None, unread_only: bool = False, limit: int = 50, db: Session = Depends(get_db)):
    query = db.query(Notification)
    if role:
        query = query.filter(Notification.recipient_role.in_([role, "all"]))
    if unread_only:
        query = query.filter(Notification.is_read == False)
    notifications = query.order_by(Notification.created_at.desc()).limit(limit).all()

    unread_query = db.query(Notification).filter(Notification.is_read == False)
    if role:
        unread_query = unread_query.filter(Notification.recipient_role.in_([role, "all"]))
    unread_count = unread_query.count()

    return {
        "notifications": [serialize_notification(n) for n in notifications],
        "unread_count": unread_count,
    }

@app.post("/api/notifications/{notification_id}/read")
def mark_notification_read(notification_id: int, db: Session = Depends(get_db)):
    notif = db.query(Notification).filter(Notification.id == notification_id).first()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")
    notif.is_read = True
    db.commit()
    return {"message": "Marked as read", "id": notification_id}

@app.post("/api/notifications/read-all")
def mark_all_notifications_read(db: Session = Depends(get_db)):
    db.query(Notification).filter(Notification.is_read == False).update({"is_read": True})
    db.commit()
    return {"message": "All notifications marked as read"}

@app.get("/api/audit-logs")
def get_audit_logs(actor: str = None, action: str = None, limit: int = 100, db: Session = Depends(get_db)):
    query = db.query(AuditLog)
    if actor:
        query = query.filter(AuditLog.actor.ilike(f"%{actor}%"))
    if action:
        query = query.filter(AuditLog.action == action)
    logs = query.order_by(AuditLog.created_at.desc()).limit(limit).all()

    action_types = [row[0] for row in db.query(AuditLog.action).distinct().all()]

    return {
        "logs": [
            {
                "id": l.id,
                "actor": l.actor,
                "actor_role": l.actor_role,
                "action": l.action,
                "target": l.target,
                "details": l.details,
                "created_at": l.created_at.isoformat() if l.created_at else None,
            }
            for l in logs
        ],
        "action_types": sorted(action_types),
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
