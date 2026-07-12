import asyncio
import os
import random
import string
import json
import time
import hashlib
import secrets
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from dotenv import load_dotenv

from database import engine, get_db, SessionLocal
from models import (
    Asset, Telemetry, TechnicianCode, Notification, AuditLog,
    User, Department, AssetCategory, AssetItem, Booking, Transfer,
    AllocationHistory, MaintenanceRequest, AuditCycle, AuditAssignment,
    AuditRecord, Base,
)
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

# Lightweight SQLite migration: add new columns to existing tables if missing
def ensure_columns():
    from sqlalchemy import text
    new_columns = {
        "assets": [
            ("owner_user_id", "INTEGER"),
            ("asset_item_id", "INTEGER"),
        ],
        "asset_items": [
            ("is_bookable", "BOOLEAN DEFAULT 0"),
            ("overdue_flagged", "BOOLEAN DEFAULT 0"),
            ("custom_field_values", "TEXT"),
        ],
        "bookings": [
            ("reminder_sent", "BOOLEAN DEFAULT 0"),
        ],
        "transfers": [
            ("from_user_id", "INTEGER"),
            ("to_user_id", "INTEGER"),
            ("approved_by", "INTEGER"),
            ("note", "VARCHAR"),
            ("resolved_at", "DATETIME"),
        ],
    }
    with engine.connect() as conn:
        for table, cols in new_columns.items():
            existing = {row[1] for row in conn.execute(text(f"PRAGMA table_info({table})"))}
            for col_name, col_def in cols:
                if col_name not in existing:
                    conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col_name} {col_def}"))
        conn.commit()

ensure_columns()

app = FastAPI(title="IntelliAsset Central Backend")

# CORS: set ALLOWED_ORIGINS to a comma-separated list of frontend URLs in
# production (e.g. "https://intelliasset.vercel.app"). Defaults to "*" for
# local development.
_origins = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "*").split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials="*" not in _origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

dashboard_connections = []

# Throttle historical telemetry DB writes: live dashboard stays real-time via
# WebSockets, but we only persist one telemetry row per device per interval.
TELEMETRY_DB_WRITE_INTERVAL = 60  # seconds
last_db_write = {}

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

# ---------------------------------------------------------------------------
# Auth helpers
# ---------------------------------------------------------------------------

PBKDF2_ITERATIONS = 260_000

def hash_password(password: str, salt: str = None) -> str:
    """PBKDF2-HMAC-SHA256 with per-user salt (format: pbkdf2$salt$digest)."""
    if salt is None:
        salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256", password.encode(), salt.encode(), PBKDF2_ITERATIONS
    ).hex()
    return f"pbkdf2${salt}${digest}"

def _legacy_hash(password: str, salt: str) -> str:
    """Old single-round SHA-256 format (salt$digest) kept for existing users."""
    digest = hashlib.sha256((salt + password).encode()).hexdigest()
    return f"{salt}${digest}"

def verify_password(password: str, stored: str) -> bool:
    parts = stored.split("$")
    if len(parts) == 3 and parts[0] == "pbkdf2":
        return secrets.compare_digest(hash_password(password, parts[1]), stored)
    if len(parts) == 2:  # legacy sha256 hash
        return secrets.compare_digest(_legacy_hash(password, parts[0]), stored)
    return False

def serialize_user(u: User):
    return {
        "id": u.id,
        "name": u.name,
        "email": u.email,
        "role": u.role,
        "department_id": u.department_id,
        "status": u.status,
        "created_at": u.created_at.isoformat() if u.created_at else None,
    }

def get_current_user(authorization: str = Header(None), db: Session = Depends(get_db)) -> User:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = authorization.split(" ", 1)[1].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user = db.query(User).filter(User.session_token == token).first()
    if not user or user.status != "active":
        raise HTTPException(status_code=401, detail="Session invalid or expired")
    return user

def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

MANAGER_ROLES = ("admin", "department_head", "asset_manager")

def require_manager(user: User = Depends(get_current_user)) -> User:
    if user.role not in MANAGER_ROLES:
        raise HTTPException(status_code=403, detail="Only Managers or Admins can track devices")
    return user

def seed_org_data():
    """Seed admin user, departments, categories, asset items, bookings, transfers."""
    db = SessionLocal()
    try:
        if db.query(User).first() is not None:
            return

        now = datetime.utcnow()

        # Departments (Engineering has a child: Platform)
        depts = {}
        for name, parent in [("Engineering", None), ("Platform", "Engineering"), ("Operations", None), ("Finance", None), ("Marketing", None)]:
            d = Department(name=name, parent_id=depts[parent].id if parent else None, status="active")
            db.add(d)
            db.commit()
            db.refresh(d)
            depts[name] = d

        # Users
        def add_user(name, email, password, role, dept):
            u = User(
                name=name, email=email,
                password_hash=hash_password(password),
                role=role,
                department_id=depts[dept].id if dept else None,
                status="active",
            )
            db.add(u)
            db.commit()
            db.refresh(u)
            return u

        admin = add_user("System Admin", "admin@intelliasset.com", "admin123", "admin", None)
        priya = add_user("Priya Sharma", "priya.sharma@intelliasset.com", "demo1234", "department_head", "Engineering")
        raj = add_user("Raj Patel", "raj.patel@intelliasset.com", "demo1234", "asset_manager", "Operations")
        ananya = add_user("Ananya Iyer", "ananya.iyer@intelliasset.com", "demo1234", "employee", "Engineering")
        vikram = add_user("Vikram Rao", "vikram.rao@intelliasset.com", "demo1234", "employee", "Marketing")
        karan = add_user("Karan Mehta", "karan.mehta@intelliasset.com", "demo1234", "employee", "Finance")
        sneha = add_user("Sneha Kulkarni", "sneha.kulkarni@intelliasset.com", "demo1234", "department_head", "Operations")
        arjun = add_user("Arjun Nair", "arjun.nair@intelliasset.com", "demo1234", "employee", "Platform")
        meera = add_user("Meera Desai", "meera.desai@intelliasset.com", "demo1234", "employee", "Engineering")

        depts["Engineering"].head_user_id = priya.id
        depts["Operations"].head_user_id = sneha.id
        db.commit()

        # Categories
        cats = {}
        for name, desc, fields in [
            ("Electronics", "Laptops, monitors, peripherals", ["Warranty Period", "Serial Number"]),
            ("Furniture", "Desks, chairs, storage", ["Material"]),
            ("Vehicles", "Company cars and bikes", ["Registration No", "Insurance Expiry"]),
            ("AV Equipment", "Projectors, cameras, audio gear", ["Warranty Period"]),
            ("Software Licenses", "Seats and subscriptions", ["License Key", "Renewal Date"]),
        ]:
            c = AssetCategory(name=name, description=desc, custom_fields=fields, status="active")
            db.add(c)
            db.commit()
            db.refresh(c)
            cats[name] = c

        # Asset items
        def add_item(tag, name, cat, dept, status, assigned=None, ret_days=None):
            item = AssetItem(
                asset_tag=tag, name=name,
                category_id=cats[cat].id,
                department_id=depts[dept].id if dept else None,
                status=status,
                assigned_to_user_id=assigned.id if assigned else None,
                expected_return_date=(now + timedelta(days=ret_days)) if ret_days is not None else None,
            )
            db.add(item)
            return item

        items = [
            add_item("AF-0114", 'MacBook Pro 16"', "Electronics", "Engineering", "allocated", priya, 21),
            add_item("AF-0087", "Dell Latitude 7440", "Electronics", "Engineering", "maintenance"),
            add_item("AF-0102", "HP EliteBook 840", "Electronics", "Platform", "available"),
            add_item("AF-0156", 'iPad Pro 12.9"', "Electronics", "Finance", "allocated", karan, -3),   # overdue
            add_item("AF-0075", "Lenovo ThinkPad X1", "Electronics", "Operations", "in_transfer"),
            add_item("AF-0230", "Conference Projector", "AV Equipment", "Operations", "available"),
            add_item("AF-0198", "Canon DSLR Kit", "AV Equipment", "Marketing", "allocated", vikram, -1),  # overdue
            add_item("AF-0301", "Logitech MX Master", "Electronics", "Engineering", "allocated", meera, 4),
            add_item("AF-0310", "Standing Desk", "Furniture", "Engineering", "available"),
            add_item("AF-0311", "Ergonomic Chair", "Furniture", "Operations", "available"),
            add_item("AF-0402", "Company Van", "Vehicles", "Operations", "allocated", sneha, 2),
            add_item("AF-0510", "Figma Org Seat", "Software Licenses", "Engineering", "allocated", arjun, 30),
            add_item("AF-0231", "Portable PA System", "AV Equipment", "Marketing", "available"),
            add_item("AF-0103", 'Samsung Monitor 32"', "Electronics", "Platform", "available"),
            add_item("AF-0088", "MacBook Air 13", "Electronics", "Marketing", "maintenance"),
        ]
        db.commit()
        for it in items:
            db.refresh(it)

        # Bookings (active now + future)
        db.add(Booking(asset_item_id=items[5].id, user_id=ananya.id, start_time=now - timedelta(hours=1), end_time=now + timedelta(hours=2), status="confirmed"))
        db.add(Booking(asset_item_id=items[12].id, user_id=vikram.id, start_time=now + timedelta(days=1), end_time=now + timedelta(days=1, hours=4), status="confirmed"))
        db.add(Booking(asset_item_id=items[5].id, user_id=meera.id, start_time=now + timedelta(days=2), end_time=now + timedelta(days=2, hours=3), status="confirmed"))
        db.add(Booking(asset_item_id=items[6].id, user_id=vikram.id, start_time=now - timedelta(days=2), end_time=now - timedelta(days=1), status="cancelled"))

        # Transfers
        db.add(Transfer(asset_item_id=items[4].id, from_location="Mumbai HQ", to_location="Bengaluru Office", status="pending", requested_by=sneha.id))
        db.add(Transfer(asset_item_id=items[13].id, from_location="Bengaluru Office", to_location="Pune Office", status="pending", requested_by=arjun.id))

        db.commit()
        print("Seeded org data: users, departments, categories, assets, bookings, transfers.")
    finally:
        db.close()

seed_org_data()

def seed_booking_resources():
    """Ensure bookable resources exist (runs on both fresh and existing DBs)."""
    db = SessionLocal()
    try:
        if db.query(AssetItem).filter(AssetItem.asset_tag == "RM-B2").first() is not None:
            return

        now = datetime.utcnow()

        rooms_cat = db.query(AssetCategory).filter(AssetCategory.name == "Meeting Rooms").first()
        if not rooms_cat:
            rooms_cat = AssetCategory(name="Meeting Rooms", description="Bookable meeting and conference rooms", custom_fields=["Capacity", "Floor"], status="active")
            db.add(rooms_cat)
            db.commit()
            db.refresh(rooms_cat)

        # Mark existing AV equipment as bookable
        av_cat = db.query(AssetCategory).filter(AssetCategory.name == "AV Equipment").first()
        if av_cat:
            for item in db.query(AssetItem).filter(AssetItem.category_id == av_cat.id).all():
                item.is_bookable = True

        room_b2 = AssetItem(asset_tag="RM-B2", name="Room B2", category_id=rooms_cat.id, status="available", is_bookable=True)
        room_a1 = AssetItem(asset_tag="RM-A1", name="Room A1", category_id=rooms_cat.id, status="available", is_bookable=True)
        db.add(room_b2)
        db.add(room_a1)
        db.commit()
        db.refresh(room_b2)

        # Seed Room B2 with a 9:00-10:00 booking tomorrow (demo the overlap example)
        ananya = db.query(User).filter(User.email == "ananya.iyer@intelliasset.com").first()
        if ananya:
            tomorrow_9 = (now + timedelta(days=1)).replace(hour=9, minute=0, second=0, microsecond=0)
            db.add(Booking(asset_item_id=room_b2.id, user_id=ananya.id, start_time=tomorrow_9, end_time=tomorrow_9 + timedelta(hours=1), status="confirmed"))

        db.commit()
        print("Seeded bookable resources (Room B2, Room A1, AV equipment).")
    finally:
        db.close()

seed_booking_resources()

class AssignRequest(BaseModel):
    device_id: str

class LoginRequest(BaseModel):
    code: str

class ChatRequest(BaseModel):
    message: str

@app.websocket("/ws/dashboard")
async def websocket_dashboard(websocket: WebSocket, token: str = None, db: Session = Depends(get_db)):
    # Only Managers and Admins may watch the live tracking feed.
    user = db.query(User).filter(User.session_token == token).first() if token else None
    if not user or user.status != "active" or user.role not in MANAGER_ROLES:
        await websocket.close(code=4403)
        return
    await websocket.accept()
    dashboard_connections.append(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        if websocket in dashboard_connections:
            dashboard_connections.remove(websocket)

def _next_af_tag(db: Session) -> str:
    tags = [i.asset_tag for i in db.query(AssetItem).filter(AssetItem.asset_tag.like("AF-%")).all()]
    max_num = 0
    for t in tags:
        try:
            max_num = max(max_num, int(t.split("-")[1]))
        except (IndexError, ValueError):
            pass
    return f"AF-{max_num + 1:04d}"

@app.post("/api/assets/register")
async def register_asset(data: dict, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Enroll the machine running the monitoring agent as a tracked asset.

    Any signed-in user (employee, manager, or admin) can enroll their own
    device. The device is linked to their account and an AssetItem is
    created in the asset directory, allocated to them.
    """
    device_id = data.get("device_id")
    if not device_id:
        raise HTTPException(status_code=400, detail="device_id is required")

    hostname = data.get("hostname", "Unknown Device")
    os_name = data.get("os_name", "Unknown OS")

    existing_asset = db.query(Asset).filter(Asset.device_id == device_id).first()
    if existing_asset:
        # Keep hostname/OS fresh and (re)link ownership to the current user.
        existing_asset.hostname = hostname
        existing_asset.os_name = os_name
        if existing_asset.owner_user_id != user.id:
            existing_asset.owner_user_id = user.id
            item = db.query(AssetItem).filter(AssetItem.id == existing_asset.asset_item_id).first() if existing_asset.asset_item_id else None
            if item:
                item.assigned_to_user_id = user.id
                item.status = "allocated"
        db.commit()
        item = db.query(AssetItem).filter(AssetItem.id == existing_asset.asset_item_id).first() if existing_asset.asset_item_id else None
        return {
            "message": "Device already enrolled — ownership confirmed",
            "device_id": device_id,
            "owner": user.name,
            "asset_tag": item.asset_tag if item else None,
        }

    # Create the directory entry (AssetItem) for this device
    tag = _next_af_tag(db)
    item = AssetItem(
        asset_tag=tag,
        name=f"{hostname} (Monitored Device)",
        department_id=user.department_id,
        status="allocated",
        assigned_to_user_id=user.id,
        custom_field_values={"Device ID": device_id, "OS": os_name, "Enrolled via": "Monitoring Agent"},
    )
    db.add(item)
    db.commit()
    db.refresh(item)

    db.add(AllocationHistory(
        asset_item_id=item.id,
        user_id=user.id,
        condition_notes="Self-enrolled via monitoring agent",
    ))

    new_asset = Asset(
        device_id=device_id,
        hostname=hostname,
        os_name=os_name,
        owner_user_id=user.id,
        asset_item_id=item.id,
    )
    db.add(new_asset)
    db.commit()

    log_action(db, actor=user.email, actor_role=user.role, action="DEVICE_ENROLLED", target=tag,
               details=f"{user.name} enrolled {hostname} ({device_id}) via the monitoring agent.")
    await create_notification(
        db,
        recipient_role="admin",
        type="asset_registered",
        title="Device Enrolled",
        message=f"{user.name} enrolled {hostname} ({tag}) via the monitoring agent.",
        severity="info",
    )

    return {"message": "Device enrolled successfully", "device_id": device_id, "owner": user.name, "asset_tag": tag}

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
            
            # Persist to DB at most once per interval per device
            # (first ping always writes so new devices appear immediately)
            now = time.time()
            if now - last_db_write.get(device_id, 0) > TELEMETRY_DB_WRITE_INTERVAL:
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
                last_db_write[device_id] = now
            
    except WebSocketDisconnect:
        print(f"Agent {device_id} disconnected")

@app.get("/api/assets")
def get_all_assets(user: User = Depends(require_manager), db: Session = Depends(get_db)):
    assets = db.query(Asset).all()
    result = []
    for asset in assets:
        latest = db.query(Telemetry).filter(Telemetry.device_id == asset.device_id).order_by(Telemetry.timestamp.desc()).first()
        owner = db.query(User).filter(User.id == asset.owner_user_id).first() if asset.owner_user_id else None
        item = db.query(AssetItem).filter(AssetItem.id == asset.asset_item_id).first() if asset.asset_item_id else None
        result.append({
            "device_id": asset.device_id,
            "hostname": asset.hostname,
            "os_name": asset.os_name,
            "registered_at": asset.registered_at,
            "owner_name": owner.name if owner else None,
            "owner_role": owner.role if owner else None,
            "asset_tag": item.asset_tag if item else None,
            "latest_status": latest.status if latest else "Unknown",
            "last_seen": latest.timestamp if latest else None
        })
    return result

@app.get("/api/assets/{device_id}")
def get_asset_details(device_id: str, user: User = Depends(require_manager), db: Session = Depends(get_db)):
    asset = db.query(Asset).filter(Asset.device_id == device_id).first()
    if not asset:
        return {"error": "Asset not found"}
    
    history = db.query(Telemetry).filter(Telemetry.device_id == device_id).order_by(Telemetry.timestamp.desc()).limit(20).all()
    
    return {
        "asset": asset,
        "history": history
    }

@app.post("/api/admin/assign")
async def assign_technician(req: AssignRequest, user: User = Depends(require_manager), db: Session = Depends(get_db)):
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

# ---------------------------------------------------------------------------
# Auth endpoints
# ---------------------------------------------------------------------------

class SignupRequest(BaseModel):
    name: str
    email: str
    password: str

class EmailLoginRequest(BaseModel):
    email: str
    password: str

class ForgotPasswordRequest(BaseModel):
    email: str

class ResetPasswordRequest(BaseModel):
    email: str
    code: str
    new_password: str

@app.post("/api/auth/signup")
def signup(req: SignupRequest, db: Session = Depends(get_db)):
    email = req.email.strip().lower()
    if not email or "@" not in email:
        raise HTTPException(status_code=400, detail="A valid email is required")
    if len(req.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=409, detail="An account with this email already exists")

    # Signup ALWAYS creates an Employee account — roles are assigned only by Admin
    user = User(
        name=req.name.strip() or email.split("@")[0],
        email=email,
        password_hash=hash_password(req.password),
        role="employee",
        status="active",
        session_token=secrets.token_hex(24),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    log_action(db, actor=email, actor_role="employee", action="SIGNUP", target=None, details=f"{user.name} created an Employee account.")
    return {"token": user.session_token, "user": serialize_user(user)}

@app.post("/api/auth/login")
def email_login(req: EmailLoginRequest, db: Session = Depends(get_db)):
    email = req.email.strip().lower()
    user = db.query(User).filter(User.email == email).first()
    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if user.status != "active":
        raise HTTPException(status_code=403, detail="This account has been deactivated")

    user.session_token = secrets.token_hex(24)
    db.commit()

    log_action(db, actor=email, actor_role=user.role, action="LOGIN", target=None, details=f"{user.name} signed in.")
    return {"token": user.session_token, "user": serialize_user(user)}

@app.get("/api/auth/me")
def auth_me(user: User = Depends(get_current_user)):
    return {"user": serialize_user(user)}

@app.post("/api/auth/logout")
def logout(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    user.session_token = None
    db.commit()
    log_action(db, actor=user.email, actor_role=user.role, action="LOGOUT", target=None, details=f"{user.name} signed out.")
    return {"message": "Logged out"}

@app.post("/api/auth/forgot-password")
def forgot_password(req: ForgotPasswordRequest, db: Session = Depends(get_db)):
    email = req.email.strip().lower()
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=404, detail="No account found with this email")
    user.reset_code = "".join(random.choices(string.digits, k=6))
    db.commit()
    log_action(db, actor=email, actor_role=user.role, action="PASSWORD_RESET_REQUESTED", target=None, details="Requested a password reset code.")
    # DEMO_MODE=true returns the code in the response (no email service).
    # In production, leave DEMO_MODE unset and deliver codes via email instead.
    if os.getenv("DEMO_MODE", "true").lower() == "true":
        return {"message": "Reset code generated", "demo_reset_code": user.reset_code}
    return {"message": "Reset code generated. Check your email."}

@app.post("/api/auth/reset-password")
def reset_password(req: ResetPasswordRequest, db: Session = Depends(get_db)):
    email = req.email.strip().lower()
    user = db.query(User).filter(User.email == email).first()
    if not user or not user.reset_code or user.reset_code != req.code.strip():
        raise HTTPException(status_code=400, detail="Invalid reset code")
    if len(req.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    user.password_hash = hash_password(req.new_password)
    user.reset_code = None
    user.session_token = None
    db.commit()
    log_action(db, actor=email, actor_role=user.role, action="PASSWORD_RESET", target=None, details="Password was reset via reset code.")
    return {"message": "Password reset successfully. Please sign in."}

# ---------------------------------------------------------------------------
# Organization setup endpoints (admin only)
# ---------------------------------------------------------------------------

def serialize_department(d: Department, db: Session):
    head = db.query(User).filter(User.id == d.head_user_id).first() if d.head_user_id else None
    parent = db.query(Department).filter(Department.id == d.parent_id).first() if d.parent_id else None
    return {
        "id": d.id,
        "name": d.name,
        "head_user_id": d.head_user_id,
        "head_name": head.name if head else None,
        "parent_id": d.parent_id,
        "parent_name": parent.name if parent else None,
        "status": d.status,
    }

@app.get("/api/departments")
def list_departments(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    depts = db.query(Department).order_by(Department.name).all()
    return {"departments": [serialize_department(d, db) for d in depts]}

class DepartmentRequest(BaseModel):
    name: str
    head_user_id: int | None = None
    parent_id: int | None = None
    status: str = "active"

@app.post("/api/departments")
def create_department(req: DepartmentRequest, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    dept = Department(name=req.name.strip(), head_user_id=req.head_user_id, parent_id=req.parent_id, status=req.status)
    db.add(dept)
    db.commit()
    db.refresh(dept)
    log_action(db, actor=admin.email, actor_role="admin", action="DEPARTMENT_CREATED", target=dept.name, details=f"Created department {dept.name}.")
    return {"department": serialize_department(dept, db)}

@app.put("/api/departments/{dept_id}")
def update_department(dept_id: int, req: DepartmentRequest, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    dept = db.query(Department).filter(Department.id == dept_id).first()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")
    if req.parent_id == dept.id:
        raise HTTPException(status_code=400, detail="A department cannot be its own parent")
    dept.name = req.name.strip()
    dept.head_user_id = req.head_user_id
    dept.parent_id = req.parent_id
    dept.status = req.status
    db.commit()
    log_action(db, actor=admin.email, actor_role="admin", action="DEPARTMENT_UPDATED", target=dept.name, details=f"Updated department {dept.name} (status: {dept.status}).")
    return {"department": serialize_department(dept, db)}

def serialize_category(c: AssetCategory):
    return {
        "id": c.id,
        "name": c.name,
        "description": c.description,
        "custom_fields": c.custom_fields or [],
        "status": c.status,
    }

@app.get("/api/categories")
def list_categories(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    cats = db.query(AssetCategory).order_by(AssetCategory.name).all()
    return {"categories": [serialize_category(c) for c in cats]}

class CategoryRequest(BaseModel):
    name: str
    description: str | None = None
    custom_fields: list[str] = []
    status: str = "active"

@app.post("/api/categories")
def create_category(req: CategoryRequest, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    cat = AssetCategory(name=req.name.strip(), description=req.description, custom_fields=req.custom_fields, status=req.status)
    db.add(cat)
    db.commit()
    db.refresh(cat)
    log_action(db, actor=admin.email, actor_role="admin", action="CATEGORY_CREATED", target=cat.name, details=f"Created asset category {cat.name}.")
    return {"category": serialize_category(cat)}

@app.put("/api/categories/{cat_id}")
def update_category(cat_id: int, req: CategoryRequest, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    cat = db.query(AssetCategory).filter(AssetCategory.id == cat_id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    cat.name = req.name.strip()
    cat.description = req.description
    cat.custom_fields = req.custom_fields
    cat.status = req.status
    db.commit()
    log_action(db, actor=admin.email, actor_role="admin", action="CATEGORY_UPDATED", target=cat.name, details=f"Updated asset category {cat.name}.")
    return {"category": serialize_category(cat)}

ROLE_LABELS = {
    "admin": "Admin",
    "department_head": "Department Head",
    "asset_manager": "Asset Manager",
    "employee": "Employee",
}

@app.get("/api/users")
def list_users(admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    users = db.query(User).order_by(User.name).all()
    result = []
    for u in users:
        data = serialize_user(u)
        dept = db.query(Department).filter(Department.id == u.department_id).first() if u.department_id else None
        data["department_name"] = dept.name if dept else None
        result.append(data)
    return {"users": result}

class UserUpdateRequest(BaseModel):
    role: str | None = None
    department_id: int | None = None
    status: str | None = None

@app.put("/api/users/{user_id}")
async def update_user(user_id: int, req: UserUpdateRequest, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if target.role == "admin" and target.id != admin.id:
        raise HTTPException(status_code=403, detail="Cannot modify another admin account")
    if target.id == admin.id and req.role and req.role != "admin":
        raise HTTPException(status_code=400, detail="You cannot demote your own admin account")

    changes = []
    if req.role and req.role != target.role:
        if req.role not in ("employee", "department_head", "asset_manager"):
            raise HTTPException(status_code=400, detail="Invalid role")
        old_role = target.role
        target.role = req.role
        changes.append(f"role: {ROLE_LABELS.get(old_role, old_role)} → {ROLE_LABELS.get(req.role, req.role)}")
    if req.department_id is not None:
        target.department_id = req.department_id or None
        changes.append("department updated")
    if req.status and req.status != target.status:
        target.status = req.status
        if req.status == "inactive":
            target.session_token = None  # kill sessions of deactivated users
        changes.append(f"status: {req.status}")

    db.commit()

    if changes:
        detail = f"{target.name}: " + ", ".join(changes)
        log_action(db, actor=admin.email, actor_role="admin", action="USER_UPDATED", target=target.email, details=detail)
        if req.role:
            await create_notification(
                db,
                recipient_role="all",
                type="role_changed",
                title="Role Updated",
                message=f"{target.name} is now {ROLE_LABELS.get(target.role, target.role)}.",
                severity="info",
            )

    data = serialize_user(target)
    dept = db.query(Department).filter(Department.id == target.department_id).first() if target.department_id else None
    data["department_name"] = dept.name if dept else None
    return {"user": data}

# ---------------------------------------------------------------------------
# Dashboard summary endpoint
# ---------------------------------------------------------------------------

@app.get("/api/dashboard/summary")
def dashboard_summary(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    now = datetime.utcnow()
    week_out = now + timedelta(days=7)

    available = db.query(AssetItem).filter(AssetItem.status == "available").count()
    allocated = db.query(AssetItem).filter(AssetItem.status == "allocated").count()
    maintenance_today = db.query(AssetItem).filter(AssetItem.status == "maintenance").count()
    active_bookings = db.query(Booking).filter(
        Booking.status == "confirmed",
        Booking.end_time >= now,
    ).count()
    pending_transfers = db.query(Transfer).filter(Transfer.status == "pending").count()

    def serialize_item(item: AssetItem):
        assignee = db.query(User).filter(User.id == item.assigned_to_user_id).first() if item.assigned_to_user_id else None
        return {
            "id": item.id,
            "asset_tag": item.asset_tag,
            "name": item.name,
            "assigned_to": assignee.name if assignee else None,
            "expected_return_date": item.expected_return_date.isoformat() if item.expected_return_date else None,
            "days_delta": (item.expected_return_date - now).days if item.expected_return_date else None,
        }

    overdue_items = db.query(AssetItem).filter(
        AssetItem.status == "allocated",
        AssetItem.expected_return_date != None,
        AssetItem.expected_return_date < now,
    ).order_by(AssetItem.expected_return_date).all()

    upcoming_items = db.query(AssetItem).filter(
        AssetItem.status == "allocated",
        AssetItem.expected_return_date != None,
        AssetItem.expected_return_date >= now,
        AssetItem.expected_return_date <= week_out,
    ).order_by(AssetItem.expected_return_date).all()

    return {
        "kpis": {
            "assets_available": available,
            "assets_allocated": allocated,
            "maintenance_today": maintenance_today,
            "active_bookings": active_bookings,
            "pending_transfers": pending_transfers,
            "upcoming_returns": len(upcoming_items),
        },
        "overdue_returns": [serialize_item(i) for i in overdue_items],
        "upcoming_returns": [serialize_item(i) for i in upcoming_items],
    }

# ---------------------------------------------------------------------------
# Asset Allocation & Transfer endpoints (Screen 5)
# ---------------------------------------------------------------------------

def serialize_asset_item(item: AssetItem, db: Session, now: datetime = None):
    now = now or datetime.utcnow()
    holder = db.query(User).filter(User.id == item.assigned_to_user_id).first() if item.assigned_to_user_id else None
    cat = db.query(AssetCategory).filter(AssetCategory.id == item.category_id).first() if item.category_id else None
    dept = db.query(Department).filter(Department.id == item.department_id).first() if item.department_id else None
    is_overdue = bool(item.status == "allocated" and item.expected_return_date and item.expected_return_date < now)
    return {
        "id": item.id,
        "asset_tag": item.asset_tag,
        "name": item.name,
        "category": cat.name if cat else None,
        "department": dept.name if dept else None,
        "status": item.status,
        "held_by": holder.name if holder else None,
        "held_by_id": holder.id if holder else None,
        "expected_return_date": item.expected_return_date.isoformat() if item.expected_return_date else None,
        "is_overdue": is_overdue,
        "is_bookable": bool(item.is_bookable),
    }

@app.get("/api/users/basic")
def list_users_basic(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Minimal user list (id + name) for allocation/transfer target pickers — any authenticated user."""
    users = db.query(User).filter(User.status == "active", User.role != "admin").order_by(User.name).all()
    return {"users": [{"id": u.id, "name": u.name} for u in users]}

@app.get("/api/asset-items")
def list_asset_items(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    items = db.query(AssetItem).order_by(AssetItem.asset_tag).all()
    now = datetime.utcnow()
    return {"items": [serialize_asset_item(i, db, now) for i in items]}

class AllocateRequest(BaseModel):
    user_id: int
    expected_return_date: str | None = None  # ISO date

@app.post("/api/asset-items/{item_id}/allocate")
async def allocate_asset(item_id: int, req: AllocateRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    item = db.query(AssetItem).filter(AssetItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Asset not found")

    # Conflict rule: can't allocate an asset that's already taken
    if item.status == "allocated":
        holder = db.query(User).filter(User.id == item.assigned_to_user_id).first()
        raise HTTPException(status_code=409, detail={
            "code": "already_allocated",
            "message": f"{item.name} ({item.asset_tag}) is currently held by {holder.name if holder else 'another user'}.",
            "held_by": holder.name if holder else None,
            "held_by_id": holder.id if holder else None,
        })
    if item.status in ("maintenance", "in_transfer"):
        raise HTTPException(status_code=409, detail={
            "code": "unavailable",
            "message": f"{item.name} ({item.asset_tag}) is currently in {item.status.replace('_', ' ')} and cannot be allocated.",
        })

    target = db.query(User).filter(User.id == req.user_id, User.status == "active").first()
    if not target:
        raise HTTPException(status_code=404, detail="Employee not found or inactive")

    ret_date = None
    if req.expected_return_date:
        try:
            ret_date = datetime.fromisoformat(req.expected_return_date)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid expected return date")

    item.status = "allocated"
    item.assigned_to_user_id = target.id
    item.expected_return_date = ret_date
    item.overdue_flagged = False
    db.add(AllocationHistory(asset_item_id=item.id, user_id=target.id, allocated_at=datetime.utcnow(), expected_return_date=ret_date))
    db.commit()

    log_action(db, actor=user.email, actor_role=user.role, action="ASSET_ALLOCATED", target=item.asset_tag,
               details=f"Allocated {item.name} to {target.name}" + (f" (return by {ret_date.date()})" if ret_date else "") + ".")
    await create_notification(db, recipient_role="all", type="asset_assigned", title="Asset Assigned",
                              message=f"{item.name} ({item.asset_tag}) has been assigned to {target.name}.", severity="info")

    return {"item": serialize_asset_item(item, db)}

class ReturnRequest(BaseModel):
    condition_notes: str | None = None

@app.post("/api/asset-items/{item_id}/return")
async def return_asset(item_id: int, req: ReturnRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    item = db.query(AssetItem).filter(AssetItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Asset not found")
    if item.status != "allocated":
        raise HTTPException(status_code=400, detail="Asset is not currently allocated")

    holder = db.query(User).filter(User.id == item.assigned_to_user_id).first()
    open_hist = db.query(AllocationHistory).filter(
        AllocationHistory.asset_item_id == item.id,
        AllocationHistory.returned_at == None,
    ).order_by(AllocationHistory.allocated_at.desc()).first()
    if open_hist:
        open_hist.returned_at = datetime.utcnow()
        open_hist.condition_notes = req.condition_notes
        open_hist.released_by = "return"

    item.status = "available"
    item.assigned_to_user_id = None
    item.expected_return_date = None
    item.overdue_flagged = False
    db.commit()

    log_action(db, actor=user.email, actor_role=user.role, action="ASSET_RETURNED", target=item.asset_tag,
               details=f"{item.name} returned by {holder.name if holder else 'unknown'}." + (f" Condition: {req.condition_notes}" if req.condition_notes else ""))
    await create_notification(db, recipient_role="all", type="asset_returned", title="Asset Returned",
                              message=f"{item.name} ({item.asset_tag}) was returned and is now available.", severity="success")

    return {"item": serialize_asset_item(item, db)}

@app.get("/api/asset-items/{item_id}/history")
def asset_history(item_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.query(AllocationHistory).filter(AllocationHistory.asset_item_id == item_id).order_by(AllocationHistory.allocated_at.desc()).all()
    result = []
    for h in rows:
        holder = db.query(User).filter(User.id == h.user_id).first()
        result.append({
            "id": h.id,
            "user_name": holder.name if holder else "Unknown",
            "allocated_at": h.allocated_at.isoformat() if h.allocated_at else None,
            "returned_at": h.returned_at.isoformat() if h.returned_at else None,
            "expected_return_date": h.expected_return_date.isoformat() if h.expected_return_date else None,
            "condition_notes": h.condition_notes,
            "released_by": h.released_by,
        })
    return {"history": result}

class TransferRequest(BaseModel):
    asset_item_id: int
    to_user_id: int
    note: str | None = None

def serialize_transfer(t: Transfer, db: Session):
    item = db.query(AssetItem).filter(AssetItem.id == t.asset_item_id).first()
    from_user = db.query(User).filter(User.id == t.from_user_id).first() if t.from_user_id else None
    to_user = db.query(User).filter(User.id == t.to_user_id).first() if t.to_user_id else None
    requester = db.query(User).filter(User.id == t.requested_by).first() if t.requested_by else None
    approver = db.query(User).filter(User.id == t.approved_by).first() if t.approved_by else None
    return {
        "id": t.id,
        "asset_tag": item.asset_tag if item else None,
        "asset_name": item.name if item else None,
        "from_user": from_user.name if from_user else (t.from_location or None),
        "to_user": to_user.name if to_user else (t.to_location or None),
        "requested_by": requester.name if requester else None,
        "approved_by": approver.name if approver else None,
        "note": t.note,
        "status": t.status,
        "created_at": t.created_at.isoformat() if t.created_at else None,
        "resolved_at": t.resolved_at.isoformat() if t.resolved_at else None,
    }

@app.get("/api/transfers")
def list_transfers(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    transfers = db.query(Transfer).order_by(Transfer.created_at.desc()).limit(50).all()
    return {"transfers": [serialize_transfer(t, db) for t in transfers], "can_approve": user.role in MANAGER_ROLES}

@app.post("/api/transfers")
async def request_transfer(req: TransferRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    item = db.query(AssetItem).filter(AssetItem.id == req.asset_item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Asset not found")
    if item.status != "allocated":
        raise HTTPException(status_code=400, detail="Only allocated assets can be transferred")

    existing = db.query(Transfer).filter(Transfer.asset_item_id == item.id, Transfer.status == "pending").first()
    if existing:
        raise HTTPException(status_code=409, detail="A transfer request for this asset is already pending")

    to_user = db.query(User).filter(User.id == req.to_user_id, User.status == "active").first()
    if not to_user:
        raise HTTPException(status_code=404, detail="Target employee not found or inactive")
    if to_user.id == item.assigned_to_user_id:
        raise HTTPException(status_code=400, detail="Asset is already held by this employee")

    holder = db.query(User).filter(User.id == item.assigned_to_user_id).first()
    transfer = Transfer(
        asset_item_id=item.id,
        from_location=holder.name if holder else "",
        to_location=to_user.name,
        from_user_id=item.assigned_to_user_id,
        to_user_id=to_user.id,
        requested_by=user.id,
        note=req.note,
        status="pending",
    )
    db.add(transfer)
    db.commit()
    db.refresh(transfer)

    log_action(db, actor=user.email, actor_role=user.role, action="TRANSFER_REQUESTED", target=item.asset_tag,
               details=f"Requested transfer of {item.name} from {holder.name if holder else 'unknown'} to {to_user.name}.")
    await create_notification(db, recipient_role="admin", type="transfer_requested", title="Transfer Requested",
                              message=f"{user.name} requested transfer of {item.name} ({item.asset_tag}) to {to_user.name}. Awaiting approval.", severity="warning")

    return {"transfer": serialize_transfer(transfer, db)}

@app.post("/api/transfers/{transfer_id}/approve")
async def approve_transfer(transfer_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role not in MANAGER_ROLES:
        raise HTTPException(status_code=403, detail="Only Asset Managers, Department Heads, or Admins can approve transfers")
    transfer = db.query(Transfer).filter(Transfer.id == transfer_id).first()
    if not transfer or transfer.status != "pending":
        raise HTTPException(status_code=404, detail="Pending transfer not found")

    item = db.query(AssetItem).filter(AssetItem.id == transfer.asset_item_id).first()
    to_user = db.query(User).filter(User.id == transfer.to_user_id).first()
    if not item or not to_user:
        raise HTTPException(status_code=404, detail="Asset or target user no longer exists")

    now = datetime.utcnow()

    # Close current holder's history row
    open_hist = db.query(AllocationHistory).filter(
        AllocationHistory.asset_item_id == item.id,
        AllocationHistory.returned_at == None,
    ).order_by(AllocationHistory.allocated_at.desc()).first()
    if open_hist:
        open_hist.returned_at = now
        open_hist.released_by = "transfer"

    # Re-allocate to the new holder
    item.status = "allocated"
    item.assigned_to_user_id = to_user.id
    item.overdue_flagged = False
    db.add(AllocationHistory(asset_item_id=item.id, user_id=to_user.id, allocated_at=now, expected_return_date=item.expected_return_date))

    transfer.status = "approved"
    transfer.approved_by = user.id
    transfer.resolved_at = now
    db.commit()

    log_action(db, actor=user.email, actor_role=user.role, action="TRANSFER_APPROVED", target=item.asset_tag,
               details=f"Approved transfer of {item.name} to {to_user.name}. History updated.")
    await create_notification(db, recipient_role="all", type="transfer_approved", title="Transfer Approved",
                              message=f"{item.name} ({item.asset_tag}) has been re-allocated to {to_user.name}.", severity="success")

    return {"transfer": serialize_transfer(transfer, db)}

@app.post("/api/transfers/{transfer_id}/reject")
async def reject_transfer(transfer_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role not in MANAGER_ROLES:
        raise HTTPException(status_code=403, detail="Only Asset Managers, Department Heads, or Admins can reject transfers")
    transfer = db.query(Transfer).filter(Transfer.id == transfer_id).first()
    if not transfer or transfer.status != "pending":
        raise HTTPException(status_code=404, detail="Pending transfer not found")

    item = db.query(AssetItem).filter(AssetItem.id == transfer.asset_item_id).first()
    transfer.status = "rejected"
    transfer.approved_by = user.id
    transfer.resolved_at = datetime.utcnow()
    db.commit()

    log_action(db, actor=user.email, actor_role=user.role, action="TRANSFER_REJECTED", target=item.asset_tag if item else None,
               details=f"Rejected transfer request for {item.name if item else 'asset'}.")
    await create_notification(db, recipient_role="all", type="transfer_rejected", title="Transfer Rejected",
                              message=f"Transfer request for {item.name if item else 'asset'} ({item.asset_tag if item else ''}) was rejected.", severity="warning")

    return {"transfer": serialize_transfer(transfer, db)}

# ---------------------------------------------------------------------------
# Resource Booking endpoints (Screen 6)
# ---------------------------------------------------------------------------

def booking_status(b: Booking, now: datetime) -> str:
    if b.status == "cancelled":
        return "cancelled"
    if b.end_time < now:
        return "completed"
    if b.start_time <= now <= b.end_time:
        return "ongoing"
    return "upcoming"

def serialize_booking(b: Booking, db: Session, now: datetime = None):
    now = now or datetime.utcnow()
    item = db.query(AssetItem).filter(AssetItem.id == b.asset_item_id).first()
    booker = db.query(User).filter(User.id == b.user_id).first()
    return {
        "id": b.id,
        "asset_item_id": b.asset_item_id,
        "resource_name": item.name if item else None,
        "asset_tag": item.asset_tag if item else None,
        "user_name": booker.name if booker else None,
        "user_id": b.user_id,
        "start_time": b.start_time.isoformat(),
        "end_time": b.end_time.isoformat(),
        "status": booking_status(b, now),
    }

@app.get("/api/resources")
def list_resources(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    items = db.query(AssetItem).filter(AssetItem.is_bookable == True).order_by(AssetItem.name).all()
    now = datetime.utcnow()
    return {"resources": [serialize_asset_item(i, db, now) for i in items]}

@app.get("/api/resources/{item_id}/bookings")
def resource_bookings(item_id: int, week_start: str = None, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    query = db.query(Booking).filter(Booking.asset_item_id == item_id, Booking.status != "cancelled")
    if week_start:
        try:
            start = datetime.fromisoformat(week_start)
            query = query.filter(Booking.end_time >= start, Booking.start_time < start + timedelta(days=7))
        except ValueError:
            pass
    now = datetime.utcnow()
    return {"bookings": [serialize_booking(b, db, now) for b in query.order_by(Booking.start_time).all()]}

class BookingCreateRequest(BaseModel):
    asset_item_id: int
    start_time: str
    end_time: str

def find_booking_conflict(db: Session, item_id: int, start: datetime, end: datetime, exclude_id: int = None):
    """Overlap rule: existing.start < new.end AND new.start < existing.end (back-to-back is OK)."""
    query = db.query(Booking).filter(
        Booking.asset_item_id == item_id,
        Booking.status == "confirmed",
        Booking.start_time < end,
        Booking.end_time > start,
    )
    if exclude_id:
        query = query.filter(Booking.id != exclude_id)
    return query.first()

def parse_booking_times(start_time: str, end_time: str):
    try:
        start = datetime.fromisoformat(start_time)
        end = datetime.fromisoformat(end_time)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid start or end time")
    if end <= start:
        raise HTTPException(status_code=400, detail="End time must be after start time")
    return start, end

@app.post("/api/bookings")
async def create_booking(req: BookingCreateRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    item = db.query(AssetItem).filter(AssetItem.id == req.asset_item_id, AssetItem.is_bookable == True).first()
    if not item:
        raise HTTPException(status_code=404, detail="Bookable resource not found")

    start, end = parse_booking_times(req.start_time, req.end_time)
    conflict = find_booking_conflict(db, item.id, start, end)
    if conflict:
        holder = db.query(User).filter(User.id == conflict.user_id).first()
        raise HTTPException(status_code=409, detail={
            "code": "overlap",
            "message": f"{item.name} is already booked {conflict.start_time.strftime('%H:%M')}\u2013{conflict.end_time.strftime('%H:%M')} on {conflict.start_time.strftime('%b %d')} by {holder.name if holder else 'another user'}.",
            "conflict_start": conflict.start_time.isoformat(),
            "conflict_end": conflict.end_time.isoformat(),
        })

    booking = Booking(asset_item_id=item.id, user_id=user.id, start_time=start, end_time=end, status="confirmed")
    db.add(booking)
    db.commit()
    db.refresh(booking)

    log_action(db, actor=user.email, actor_role=user.role, action="BOOKING_CREATED", target=item.asset_tag,
               details=f"Booked {item.name} {start.strftime('%b %d %H:%M')}\u2013{end.strftime('%H:%M')}.")
    await create_notification(db, recipient_role="all", type="booking_confirmed", title="Booking Confirmed",
                              message=f"{item.name} ({item.asset_tag}) booked by {user.name} for {start.strftime('%b %d, %H:%M')}\u2013{end.strftime('%H:%M')}.", severity="success")

    return {"booking": serialize_booking(booking, db)}

@app.put("/api/bookings/{booking_id}")
async def reschedule_booking(booking_id: int, req: BookingCreateRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking or booking.status != "confirmed":
        raise HTTPException(status_code=404, detail="Active booking not found")
    if booking.user_id != user.id and user.role not in MANAGER_ROLES:
        raise HTTPException(status_code=403, detail="You can only reschedule your own bookings")

    item = db.query(AssetItem).filter(AssetItem.id == booking.asset_item_id).first()
    start, end = parse_booking_times(req.start_time, req.end_time)
    conflict = find_booking_conflict(db, booking.asset_item_id, start, end, exclude_id=booking.id)
    if conflict:
        holder = db.query(User).filter(User.id == conflict.user_id).first()
        raise HTTPException(status_code=409, detail={
            "code": "overlap",
            "message": f"{item.name if item else 'Resource'} is already booked {conflict.start_time.strftime('%H:%M')}\u2013{conflict.end_time.strftime('%H:%M')} on {conflict.start_time.strftime('%b %d')} by {holder.name if holder else 'another user'}.",
        })

    booking.start_time = start
    booking.end_time = end
    booking.reminder_sent = False
    db.commit()

    log_action(db, actor=user.email, actor_role=user.role, action="BOOKING_RESCHEDULED", target=item.asset_tag if item else None,
               details=f"Rescheduled {item.name if item else 'booking'} to {start.strftime('%b %d %H:%M')}\u2013{end.strftime('%H:%M')}.")

    return {"booking": serialize_booking(booking, db)}

@app.post("/api/bookings/{booking_id}/cancel")
async def cancel_booking(booking_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking or booking.status != "confirmed":
        raise HTTPException(status_code=404, detail="Active booking not found")
    if booking.user_id != user.id and user.role not in MANAGER_ROLES:
        raise HTTPException(status_code=403, detail="You can only cancel your own bookings")

    item = db.query(AssetItem).filter(AssetItem.id == booking.asset_item_id).first()
    booking.status = "cancelled"
    db.commit()

    log_action(db, actor=user.email, actor_role=user.role, action="BOOKING_CANCELLED", target=item.asset_tag if item else None,
               details=f"Cancelled booking for {item.name if item else 'resource'} ({booking.start_time.strftime('%b %d %H:%M')}).")
    await create_notification(db, recipient_role="all", type="booking_cancelled", title="Booking Cancelled",
                              message=f"Booking for {item.name if item else 'resource'} on {booking.start_time.strftime('%b %d, %H:%M')} was cancelled by {user.name}.", severity="warning")

    return {"booking": serialize_booking(booking, db)}

@app.get("/api/my-bookings")
def my_bookings(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    bookings = db.query(Booking).filter(Booking.user_id == user.id).order_by(Booking.start_time.desc()).limit(50).all()
    now = datetime.utcnow()
    return {"bookings": [serialize_booking(b, db, now) for b in bookings]}

# ---------------------------------------------------------------------------
# Maintenance Management endpoints (Screen 7)
# ---------------------------------------------------------------------------

OPEN_MAINTENANCE_STATUSES = ("pending", "approved", "assigned", "in_progress")
PRIORITY_TO_INT = {"high": 1, "medium": 2, "low": 3}

def serialize_maintenance(m: MaintenanceRequest, db: Session, include_photo: bool = False):
    item = db.query(AssetItem).filter(AssetItem.id == m.asset_item_id).first()
    requester = db.query(User).filter(User.id == m.requested_by).first()
    decider = db.query(User).filter(User.id == m.decided_by).first() if m.decided_by else None
    data = {
        "id": m.id,
        "asset_item_id": m.asset_item_id,
        "asset_tag": item.asset_tag if item else None,
        "asset_name": item.name if item else None,
        "requested_by": requester.name if requester else "Unknown",
        "requested_by_id": m.requested_by,
        "description": m.description,
        "priority": m.priority,
        "has_photo": bool(m.photo),
        "status": m.status,
        "decision_note": m.decision_note,
        "decided_by": decider.name if decider else None,
        "technician_code": m.technician_code,
        "resolution_note": m.resolution_note,
        "created_at": m.created_at.isoformat() if m.created_at else None,
        "decided_at": m.decided_at.isoformat() if m.decided_at else None,
        "resolved_at": m.resolved_at.isoformat() if m.resolved_at else None,
    }
    if include_photo:
        data["photo"] = m.photo
    return data

class MaintenanceCreateRequest(BaseModel):
    asset_item_id: int
    description: str
    priority: str = "medium"
    photo: str | None = None  # base64 data URL

@app.post("/api/maintenance")
async def raise_maintenance(req: MaintenanceCreateRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    item = db.query(AssetItem).filter(AssetItem.id == req.asset_item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Asset not found")
    if not req.description.strip():
        raise HTTPException(status_code=400, detail="Please describe the issue")
    if req.priority not in PRIORITY_TO_INT:
        raise HTTPException(status_code=400, detail="Invalid priority")
    if req.photo and len(req.photo) > 2_000_000:
        raise HTTPException(status_code=400, detail="Photo too large (max ~1.5 MB)")

    existing = db.query(MaintenanceRequest).filter(
        MaintenanceRequest.asset_item_id == item.id,
        MaintenanceRequest.status.in_(OPEN_MAINTENANCE_STATUSES),
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail=f"An open maintenance request (#{existing.id}, {existing.status}) already exists for this asset")

    m = MaintenanceRequest(
        asset_item_id=item.id,
        requested_by=user.id,
        description=req.description.strip(),
        priority=req.priority,
        photo=req.photo,
        status="pending",
    )
    db.add(m)
    db.commit()
    db.refresh(m)

    log_action(db, actor=user.email, actor_role=user.role, action="MAINTENANCE_REQUESTED", target=item.asset_tag,
               details=f"Reported: {req.description.strip()[:120]} (priority: {req.priority}).")
    await create_notification(db, recipient_role="admin", type="maintenance_requested", title="Maintenance Requested",
                              message=f"{user.name} reported an issue with {item.name} ({item.asset_tag}) — priority {req.priority}. Awaiting approval.",
                              severity="warning" if req.priority == "high" else "info")

    return {"request": serialize_maintenance(m, db)}

@app.get("/api/maintenance")
def list_maintenance(asset_item_id: int = None, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    query = db.query(MaintenanceRequest)
    if asset_item_id:
        query = query.filter(MaintenanceRequest.asset_item_id == asset_item_id)
    if user.role not in MANAGER_ROLES:
        query = query.filter(MaintenanceRequest.requested_by == user.id)
    requests = query.order_by(MaintenanceRequest.created_at.desc()).limit(100).all()
    return {"requests": [serialize_maintenance(m, db) for m in requests], "can_manage": user.role in MANAGER_ROLES}

@app.get("/api/maintenance/{req_id}/photo")
def maintenance_photo(req_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    m = db.query(MaintenanceRequest).filter(MaintenanceRequest.id == req_id).first()
    if not m or not m.photo:
        raise HTTPException(status_code=404, detail="Photo not found")
    return {"photo": m.photo}

class DecisionRequest(BaseModel):
    note: str | None = None

@app.post("/api/maintenance/{req_id}/approve")
async def approve_maintenance(req_id: int, body: DecisionRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role not in MANAGER_ROLES:
        raise HTTPException(status_code=403, detail="Only Asset Managers, Department Heads, or Admins can approve")
    m = db.query(MaintenanceRequest).filter(MaintenanceRequest.id == req_id).first()
    if not m or m.status != "pending":
        raise HTTPException(status_code=404, detail="Pending request not found")

    item = db.query(AssetItem).filter(AssetItem.id == m.asset_item_id).first()
    m.status = "approved"
    m.decided_by = user.id
    m.decision_note = body.note
    m.decided_at = datetime.utcnow()
    if item:
        item.status = "maintenance"  # asset auto-updates to Under Maintenance
    db.commit()

    log_action(db, actor=user.email, actor_role=user.role, action="MAINTENANCE_APPROVED", target=item.asset_tag if item else None,
               details=f"Approved maintenance request MR-{m.id} for {item.name if item else 'asset'}.")
    await create_notification(db, recipient_role="all", type="maintenance_approved", title="Maintenance Approved",
                              message=f"Maintenance request MR-{m.id} for {item.name if item else 'asset'} ({item.asset_tag if item else ''}) approved by {user.name}. Asset is now Under Maintenance.",
                              severity="success")

    return {"request": serialize_maintenance(m, db)}

@app.post("/api/maintenance/{req_id}/reject")
async def reject_maintenance(req_id: int, body: DecisionRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role not in MANAGER_ROLES:
        raise HTTPException(status_code=403, detail="Only Asset Managers, Department Heads, or Admins can reject")
    if not body.note or not body.note.strip():
        raise HTTPException(status_code=400, detail="A rejection note is required")
    m = db.query(MaintenanceRequest).filter(MaintenanceRequest.id == req_id).first()
    if not m or m.status != "pending":
        raise HTTPException(status_code=404, detail="Pending request not found")

    item = db.query(AssetItem).filter(AssetItem.id == m.asset_item_id).first()
    m.status = "rejected"
    m.decided_by = user.id
    m.decision_note = body.note.strip()
    m.decided_at = datetime.utcnow()
    db.commit()

    log_action(db, actor=user.email, actor_role=user.role, action="MAINTENANCE_REJECTED", target=item.asset_tag if item else None,
               details=f"Rejected MR-{m.id}: {body.note.strip()[:120]}")
    await create_notification(db, recipient_role="all", type="maintenance_rejected", title="Maintenance Rejected",
                              message=f"Maintenance request MR-{m.id} for {item.name if item else 'asset'} ({item.asset_tag if item else ''}) rejected: {body.note.strip()[:80]}",
                              severity="warning")

    return {"request": serialize_maintenance(m, db)}

@app.post("/api/maintenance/{req_id}/assign")
async def assign_maintenance_technician(req_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role not in MANAGER_ROLES:
        raise HTTPException(status_code=403, detail="Only Asset Managers, Department Heads, or Admins can assign technicians")
    m = db.query(MaintenanceRequest).filter(MaintenanceRequest.id == req_id).first()
    if not m or m.status != "approved":
        raise HTTPException(status_code=404, detail="Approved request not found (approve it first)")

    item = db.query(AssetItem).filter(AssetItem.id == m.asset_item_id).first()

    # Reuse the TECH-code system: ensure a device row exists for the asset tag
    device_id = item.asset_tag if item else f"MR-{m.id}"
    if not db.query(Asset).filter(Asset.device_id == device_id).first():
        db.add(Asset(device_id=device_id, hostname=item.name if item else f"Maintenance MR-{m.id}", os_name="N/A"))
        db.commit()

    code = "TECH-" + ''.join(random.choices(string.ascii_uppercase + string.digits, k=4))
    report = (
        f"MAINTENANCE TICKET MR-{m.id}\n"
        f"Asset: {item.name if item else 'Unknown'} ({device_id})\n"
        f"Priority: {m.priority.upper()}\n\n"
        f"Reported issue:\n{m.description}\n\n"
        + (f"Manager note: {m.decision_note}\n" if m.decision_note else "")
    )
    db.add(TechnicianCode(code=code, device_id=device_id, ai_report=report, priority=PRIORITY_TO_INT.get(m.priority, 3)))
    m.status = "assigned"
    m.technician_code = code
    db.commit()

    log_action(db, actor=user.email, actor_role=user.role, action="TECHNICIAN_ASSIGNED", target=device_id,
               details=f"Assigned technician to MR-{m.id} with access code {code}.")
    await create_notification(db, recipient_role="technician", type="asset_assigned", title="New Repair Ticket",
                              message=f"Repair ticket MR-{m.id} for {item.name if item else 'asset'} ({device_id}) — Priority: {m.priority.capitalize()}. Access code: {code}.",
                              severity="danger" if m.priority == "high" else "warning")

    return {"request": serialize_maintenance(m, db)}

@app.post("/api/maintenance/{req_id}/start")
async def start_maintenance(req_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role not in MANAGER_ROLES:
        raise HTTPException(status_code=403, detail="Not authorized")
    m = db.query(MaintenanceRequest).filter(MaintenanceRequest.id == req_id).first()
    if not m or m.status != "assigned":
        raise HTTPException(status_code=404, detail="Assigned request not found")
    m.status = "in_progress"
    db.commit()
    item = db.query(AssetItem).filter(AssetItem.id == m.asset_item_id).first()
    log_action(db, actor=user.email, actor_role=user.role, action="MAINTENANCE_STARTED", target=item.asset_tag if item else None,
               details=f"Work started on MR-{m.id}.")
    return {"request": serialize_maintenance(m, db)}

class ResolveRequest(BaseModel):
    note: str | None = None

@app.post("/api/maintenance/{req_id}/resolve")
async def resolve_maintenance(req_id: int, body: ResolveRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role not in MANAGER_ROLES:
        raise HTTPException(status_code=403, detail="Not authorized")
    m = db.query(MaintenanceRequest).filter(MaintenanceRequest.id == req_id).first()
    if not m or m.status not in ("assigned", "in_progress"):
        raise HTTPException(status_code=404, detail="Active request not found")

    item = db.query(AssetItem).filter(AssetItem.id == m.asset_item_id).first()
    m.status = "resolved"
    m.resolution_note = body.note
    m.resolved_at = datetime.utcnow()
    if item and item.status == "maintenance":
        # Back to Available, or Allocated if still assigned to someone
        item.status = "allocated" if item.assigned_to_user_id else "available"
    db.commit()

    log_action(db, actor=user.email, actor_role=user.role, action="MAINTENANCE_RESOLVED", target=item.asset_tag if item else None,
               details=f"Resolved MR-{m.id}." + (f" Note: {body.note[:100]}" if body.note else ""))
    await create_notification(db, recipient_role="all", type="maintenance_resolved", title="Maintenance Resolved",
                              message=f"MR-{m.id}: {item.name if item else 'asset'} ({item.asset_tag if item else ''}) has been repaired and is back in service.",
                              severity="success")

    return {"request": serialize_maintenance(m, db)}

# ---------------------------------------------------------------------------
# Asset Registration & Directory endpoints (Screen 4)
# ---------------------------------------------------------------------------

class AssetRegisterRequest(BaseModel):
    asset_tag: str
    name: str
    category_id: int | None = None
    department_id: int | None = None
    is_bookable: bool = False
    custom_field_values: dict | None = None

@app.get("/api/asset-items/next-tag")
def next_asset_tag(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    tags = [i.asset_tag for i in db.query(AssetItem).filter(AssetItem.asset_tag.like("AF-%")).all()]
    max_num = 0
    for t in tags:
        try:
            max_num = max(max_num, int(t.split("-")[1]))
        except (IndexError, ValueError):
            pass
    return {"next_tag": f"AF-{max_num + 1:04d}"}

@app.post("/api/asset-items")
async def register_asset_item(req: AssetRegisterRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role not in MANAGER_ROLES:
        raise HTTPException(status_code=403, detail="Only Asset Managers, Department Heads, or Admins can register assets")
    tag = req.asset_tag.strip().upper()
    if not tag or not req.name.strip():
        raise HTTPException(status_code=400, detail="Asset tag and name are required")
    if db.query(AssetItem).filter(AssetItem.asset_tag == tag).first():
        raise HTTPException(status_code=409, detail=f"Asset tag {tag} is already in use")

    item = AssetItem(
        asset_tag=tag,
        name=req.name.strip(),
        category_id=req.category_id,
        department_id=req.department_id,
        is_bookable=req.is_bookable,
        custom_field_values=req.custom_field_values or {},
        status="available",
    )
    db.add(item)
    db.commit()
    db.refresh(item)

    log_action(db, actor=user.email, actor_role=user.role, action="ASSET_REGISTERED", target=tag,
               details=f"Registered {item.name}.")
    await create_notification(db, recipient_role="admin", type="asset_registered", title="New Asset Registered",
                              message=f"{item.name} ({tag}) was registered by {user.name}.", severity="info")

    return {"item": serialize_asset_item(item, db)}

@app.get("/api/asset-items/{item_id}/detail")
def asset_item_detail(item_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    item = db.query(AssetItem).filter(AssetItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Asset not found")

    data = serialize_asset_item(item, db)
    data["custom_field_values"] = item.custom_field_values or {}

    alloc_rows = db.query(AllocationHistory).filter(AllocationHistory.asset_item_id == item.id).order_by(AllocationHistory.allocated_at.desc()).all()
    allocation_history = []
    for h in alloc_rows:
        holder = db.query(User).filter(User.id == h.user_id).first()
        allocation_history.append({
            "user_name": holder.name if holder else "Unknown",
            "allocated_at": h.allocated_at.isoformat() if h.allocated_at else None,
            "returned_at": h.returned_at.isoformat() if h.returned_at else None,
            "condition_notes": h.condition_notes,
            "released_by": h.released_by,
        })

    maint_rows = db.query(MaintenanceRequest).filter(MaintenanceRequest.asset_item_id == item.id).order_by(MaintenanceRequest.created_at.desc()).all()
    maintenance_history = [serialize_maintenance(m, db) for m in maint_rows]

    audit_rows = db.query(AuditRecord).filter(AuditRecord.asset_item_id == item.id).order_by(AuditRecord.created_at.desc()).all()
    audit_history = []
    for r in audit_rows:
        cycle = db.query(AuditCycle).filter(AuditCycle.id == r.cycle_id).first()
        auditor = db.query(User).filter(User.id == r.auditor_user_id).first() if r.auditor_user_id else None
        audit_history.append({
            "cycle_name": cycle.name if cycle else f"Cycle {r.cycle_id}",
            "result": r.result,
            "note": r.note,
            "auditor": auditor.name if auditor else None,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        })

    return {
        "item": data,
        "allocation_history": allocation_history,
        "maintenance_history": maintenance_history,
        "audit_history": audit_history,
    }

# ---------------------------------------------------------------------------
# Asset Audit endpoints (Screen 8)
# ---------------------------------------------------------------------------

def cycle_scope_assets(cycle: AuditCycle, db: Session):
    query = db.query(AssetItem).filter(AssetItem.is_bookable == False)
    if cycle.scope_department_id:
        query = query.filter(AssetItem.department_id == cycle.scope_department_id)
    return query.order_by(AssetItem.asset_tag).all()

def serialize_cycle(cycle: AuditCycle, db: Session):
    dept = db.query(Department).filter(Department.id == cycle.scope_department_id).first() if cycle.scope_department_id else None
    creator = db.query(User).filter(User.id == cycle.created_by).first() if cycle.created_by else None
    auditor_ids = [a.auditor_user_id for a in db.query(AuditAssignment).filter(AuditAssignment.cycle_id == cycle.id).all()]
    auditors = db.query(User).filter(User.id.in_(auditor_ids)).all() if auditor_ids else []
    scope_assets = cycle_scope_assets(cycle, db)
    records = db.query(AuditRecord).filter(AuditRecord.cycle_id == cycle.id).all()
    counts = {"verified": 0, "missing": 0, "damaged": 0}
    for r in records:
        if r.result in counts:
            counts[r.result] += 1
    return {
        "id": cycle.id,
        "name": cycle.name,
        "scope_department": dept.name if dept else "All departments",
        "scope_department_id": cycle.scope_department_id,
        "start_date": cycle.start_date.isoformat() if cycle.start_date else None,
        "end_date": cycle.end_date.isoformat() if cycle.end_date else None,
        "status": cycle.status,
        "created_by": creator.name if creator else None,
        "closed_at": cycle.closed_at.isoformat() if cycle.closed_at else None,
        "auditors": [{"id": u.id, "name": u.name} for u in auditors],
        "auditor_ids": auditor_ids,
        "total_assets": len(scope_assets),
        "counts": counts,
        "unchecked": len(scope_assets) - sum(counts.values()),
    }

class AuditCycleCreateRequest(BaseModel):
    name: str
    scope_department_id: int | None = None
    start_date: str | None = None
    end_date: str | None = None
    auditor_ids: list[int] = []

@app.post("/api/audit-cycles")
async def create_audit_cycle(req: AuditCycleCreateRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role not in MANAGER_ROLES:
        raise HTTPException(status_code=403, detail="Only Asset Managers, Department Heads, or Admins can create audit cycles")
    if not req.name.strip():
        raise HTTPException(status_code=400, detail="Cycle name is required")
    if not req.auditor_ids:
        raise HTTPException(status_code=400, detail="Assign at least one auditor")

    def parse_date(s):
        if not s:
            return None
        try:
            return datetime.fromisoformat(s)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date")

    cycle = AuditCycle(
        name=req.name.strip(),
        scope_department_id=req.scope_department_id,
        start_date=parse_date(req.start_date),
        end_date=parse_date(req.end_date),
        status="open",
        created_by=user.id,
    )
    db.add(cycle)
    db.commit()
    db.refresh(cycle)
    for uid in set(req.auditor_ids):
        db.add(AuditAssignment(cycle_id=cycle.id, auditor_user_id=uid))
    db.commit()

    dept = db.query(Department).filter(Department.id == req.scope_department_id).first() if req.scope_department_id else None
    log_action(db, actor=user.email, actor_role=user.role, action="AUDIT_STARTED", target=cycle.name,
               details=f"Created audit cycle '{cycle.name}' (scope: {dept.name if dept else 'all departments'}).")
    await create_notification(db, recipient_role="all", type="audit_started", title="Audit Cycle Started",
                              message=f"Audit cycle '{cycle.name}' created — scope: {dept.name if dept else 'all departments'}.", severity="info")

    return {"cycle": serialize_cycle(cycle, db)}

@app.get("/api/audit-cycles")
def list_audit_cycles(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    cycles = db.query(AuditCycle).order_by(AuditCycle.created_at.desc()).all()
    return {"cycles": [serialize_cycle(c, db) for c in cycles], "can_manage": user.role in MANAGER_ROLES}

@app.get("/api/audit-cycles/{cycle_id}")
def audit_cycle_detail(cycle_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    cycle = db.query(AuditCycle).filter(AuditCycle.id == cycle_id).first()
    if not cycle:
        raise HTTPException(status_code=404, detail="Audit cycle not found")

    records = {r.asset_item_id: r for r in db.query(AuditRecord).filter(AuditRecord.cycle_id == cycle.id).all()}
    assets = []
    for item in cycle_scope_assets(cycle, db):
        rec = records.get(item.id)
        auditor = db.query(User).filter(User.id == rec.auditor_user_id).first() if rec and rec.auditor_user_id else None
        assets.append({
            **serialize_asset_item(item, db),
            "audit_result": rec.result if rec else None,
            "audit_note": rec.note if rec else None,
            "audited_by": auditor.name if auditor else None,
        })

    data = serialize_cycle(cycle, db)
    is_auditor = user.id in data["auditor_ids"]
    return {"cycle": data, "assets": assets, "can_record": (is_auditor or user.role == "admin") and cycle.status == "open", "can_manage": user.role in MANAGER_ROLES}

class AuditRecordRequest(BaseModel):
    asset_item_id: int
    result: str  # verified | missing | damaged
    note: str | None = None

@app.post("/api/audit-cycles/{cycle_id}/record")
async def record_audit(cycle_id: int, req: AuditRecordRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    cycle = db.query(AuditCycle).filter(AuditCycle.id == cycle_id).first()
    if not cycle:
        raise HTTPException(status_code=404, detail="Audit cycle not found")
    if cycle.status != "open":
        raise HTTPException(status_code=409, detail="This audit cycle is closed and locked")
    assigned = db.query(AuditAssignment).filter(AuditAssignment.cycle_id == cycle.id, AuditAssignment.auditor_user_id == user.id).first()
    if not assigned and user.role != "admin":
        raise HTTPException(status_code=403, detail="You are not an assigned auditor for this cycle")
    if req.result not in ("verified", "missing", "damaged"):
        raise HTTPException(status_code=400, detail="Result must be verified, missing, or damaged")

    item = db.query(AssetItem).filter(AssetItem.id == req.asset_item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Asset not found")

    rec = db.query(AuditRecord).filter(AuditRecord.cycle_id == cycle.id, AuditRecord.asset_item_id == item.id).first()
    if rec:
        rec.result = req.result
        rec.note = req.note
        rec.auditor_user_id = user.id
        rec.created_at = datetime.utcnow()
    else:
        rec = AuditRecord(cycle_id=cycle.id, asset_item_id=item.id, result=req.result, note=req.note, auditor_user_id=user.id)
        db.add(rec)
    db.commit()

    if req.result in ("missing", "damaged"):
        log_action(db, actor=user.email, actor_role=user.role, action="AUDIT_FLAGGED", target=item.asset_tag,
                   details=f"[{cycle.name}] {item.name} marked {req.result.upper()}." + (f" Note: {req.note[:80]}" if req.note else ""))
        await create_notification(db, recipient_role="admin", type="audit_discrepancy", title="Audit Discrepancy Flagged",
                                  message=f"[{cycle.name}] {item.name} ({item.asset_tag}) marked {req.result.upper()} by {user.name}.",
                                  severity="danger")

    return {"message": "Recorded", "result": req.result}

@app.get("/api/audit-cycles/{cycle_id}/report")
def audit_discrepancy_report(cycle_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    cycle = db.query(AuditCycle).filter(AuditCycle.id == cycle_id).first()
    if not cycle:
        raise HTTPException(status_code=404, detail="Audit cycle not found")
    flagged = db.query(AuditRecord).filter(AuditRecord.cycle_id == cycle.id, AuditRecord.result.in_(["missing", "damaged"])).all()
    report = []
    for r in flagged:
        item = db.query(AssetItem).filter(AssetItem.id == r.asset_item_id).first()
        auditor = db.query(User).filter(User.id == r.auditor_user_id).first() if r.auditor_user_id else None
        report.append({
            "asset_tag": item.asset_tag if item else None,
            "asset_name": item.name if item else None,
            "result": r.result,
            "note": r.note,
            "auditor": auditor.name if auditor else None,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        })
    return {"cycle_name": cycle.name, "status": cycle.status, "discrepancies": report}

@app.post("/api/audit-cycles/{cycle_id}/close")
async def close_audit_cycle(cycle_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role not in MANAGER_ROLES:
        raise HTTPException(status_code=403, detail="Only Asset Managers, Department Heads, or Admins can close audit cycles")
    cycle = db.query(AuditCycle).filter(AuditCycle.id == cycle_id).first()
    if not cycle or cycle.status != "open":
        raise HTTPException(status_code=404, detail="Open audit cycle not found")

    now = datetime.utcnow()
    flagged = db.query(AuditRecord).filter(AuditRecord.cycle_id == cycle.id, AuditRecord.result.in_(["missing", "damaged"])).all()
    lost_count = 0
    damaged_count = 0
    for r in flagged:
        item = db.query(AssetItem).filter(AssetItem.id == r.asset_item_id).first()
        if not item:
            continue
        if r.result == "missing":
            item.status = "lost"
            item.assigned_to_user_id = None
            item.expected_return_date = None
            lost_count += 1
        elif r.result == "damaged" and item.status not in ("maintenance",):
            item.status = "maintenance"
            damaged_count += 1

    cycle.status = "closed"
    cycle.closed_at = now
    db.commit()

    log_action(db, actor=user.email, actor_role=user.role, action="AUDIT_CLOSED", target=cycle.name,
               details=f"Closed audit cycle '{cycle.name}': {lost_count} asset(s) marked LOST, {damaged_count} sent to maintenance.")
    await create_notification(db, recipient_role="all", type="audit_closed", title="Audit Cycle Closed",
                              message=f"Audit cycle '{cycle.name}' closed — {lost_count} asset(s) marked Lost, {damaged_count} sent to maintenance.",
                              severity="warning" if (lost_count or damaged_count) else "success")

    return {"cycle": serialize_cycle(cycle, db)}

# ---------------------------------------------------------------------------
# Reports & Analytics endpoint (Screen 9)
# ---------------------------------------------------------------------------

@app.get("/api/reports")
def reports(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role not in MANAGER_ROLES:
        raise HTTPException(status_code=403, detail="Reports are available to Asset Managers, Department Heads, and Admins only")

    now = datetime.utcnow()
    window_start = now - timedelta(days=90)
    items = db.query(AssetItem).all()
    users_by_id = {u.id: u.name for u in db.query(User).all()}
    cats_by_id = {c.id: c.name for c in db.query(AssetCategory).all()}
    depts_by_id = {d.id: d.name for d in db.query(Department).all()}

    # --- 1. Utilization (last 90 days) ---
    alloc_rows = db.query(AllocationHistory).filter(
        (AllocationHistory.returned_at == None) | (AllocationHistory.returned_at >= window_start)
    ).all()
    booking_rows = db.query(Booking).filter(Booking.status != "cancelled", Booking.end_time >= window_start).all()

    alloc_days = {}
    for h in alloc_rows:
        start = max(h.allocated_at or window_start, window_start)
        end = min(h.returned_at or now, now)
        if end > start:
            alloc_days[h.asset_item_id] = alloc_days.get(h.asset_item_id, 0) + (end - start).total_seconds() / 86400

    # Seeded allocations predate the history table: treat currently-allocated
    # assets without any history rows as allocated since the window start.
    tracked_ids = {h.asset_item_id for h in db.query(AllocationHistory.asset_item_id).all()}
    for item in items:
        if item.status == "allocated" and item.id not in tracked_ids:
            alloc_days[item.id] = 90.0
    booking_hours = {}
    for b in booking_rows:
        start = max(b.start_time, window_start)
        end = min(b.end_time, now)
        if end > start:
            booking_hours[b.asset_item_id] = booking_hours.get(b.asset_item_id, 0) + (end - start).total_seconds() / 3600

    utilization = []
    for item in items:
        if item.is_bookable:
            hours = booking_hours.get(item.id, 0)
            pct = min(round(hours / (90 * 12) * 100, 1), 100)  # 12 usable hours/day
            measure = f"{round(hours, 1)} hrs booked"
        else:
            days = alloc_days.get(item.id, 0)
            pct = min(round(days / 90 * 100, 1), 100)
            measure = f"{round(days, 1)} days allocated"
        utilization.append({
            "asset_tag": item.asset_tag, "name": item.name, "is_bookable": bool(item.is_bookable),
            "utilization_pct": pct, "measure": measure, "status": item.status,
        })
    utilization.sort(key=lambda x: x["utilization_pct"], reverse=True)
    most_used = utilization[:5]
    idle = [u for u in utilization if u["utilization_pct"] == 0 and u["status"] not in ("lost",)]

    # --- 2. Maintenance frequency ---
    maint_rows = db.query(MaintenanceRequest).all()
    by_asset, by_category = {}, {}
    resolution_times = []
    for m in maint_rows:
        by_asset[m.asset_item_id] = by_asset.get(m.asset_item_id, 0) + 1
        item = next((i for i in items if i.id == m.asset_item_id), None)
        cat = cats_by_id.get(item.category_id, "Uncategorized") if item else "Uncategorized"
        by_category[cat] = by_category.get(cat, 0) + 1
        if m.resolved_at and m.created_at:
            resolution_times.append((m.resolved_at - m.created_at).total_seconds() / 3600)
    maint_by_asset = []
    for item_id, count in sorted(by_asset.items(), key=lambda x: -x[1])[:8]:
        item = next((i for i in items if i.id == item_id), None)
        if item:
            maint_by_asset.append({"asset_tag": item.asset_tag, "name": item.name, "requests": count})
    maint_by_category = [{"category": k, "requests": v} for k, v in sorted(by_category.items(), key=lambda x: -x[1])]
    avg_resolution_hours = round(sum(resolution_times) / len(resolution_times), 1) if resolution_times else None

    # --- 3. Attention list (due for maintenance / nearing retirement / overdue / lost) ---
    attention = []
    for item in items:
        reasons = []
        if item.status == "allocated" and item.expected_return_date and item.expected_return_date < now:
            days_over = max((now - item.expected_return_date).days, 1)
            reasons.append(("overdue_return", f"Return overdue by {days_over} day(s) — held by {users_by_id.get(item.assigned_to_user_id, 'unknown')}"))
        if item.status == "maintenance":
            reasons.append(("under_maintenance", "Currently under maintenance"))
        if by_asset.get(item.id, 0) >= 3:
            reasons.append(("nearing_retirement", f"{by_asset[item.id]} maintenance requests — consider retirement"))
        if item.status == "lost":
            reasons.append(("lost", "Confirmed missing in audit"))
        for code, detail in reasons:
            attention.append({"asset_tag": item.asset_tag, "name": item.name, "type": code, "detail": detail})
    type_order = {"overdue_return": 0, "lost": 1, "under_maintenance": 2, "nearing_retirement": 3}
    attention.sort(key=lambda a: type_order.get(a["type"], 9))

    # --- 4. Department summary ---
    open_maint_by_dept = {}
    for m in maint_rows:
        if m.status in OPEN_MAINTENANCE_STATUSES:
            item = next((i for i in items if i.id == m.asset_item_id), None)
            if item and item.department_id:
                open_maint_by_dept[item.department_id] = open_maint_by_dept.get(item.department_id, 0) + 1
    dept_summary = []
    for dept_id, dept_name in depts_by_id.items():
        dept_items = [i for i in items if i.department_id == dept_id]
        if not dept_items:
            continue
        dept_summary.append({
            "department": dept_name,
            "total": len(dept_items),
            "allocated": sum(1 for i in dept_items if i.status == "allocated"),
            "available": sum(1 for i in dept_items if i.status == "available"),
            "maintenance": sum(1 for i in dept_items if i.status == "maintenance"),
            "lost": sum(1 for i in dept_items if i.status == "lost"),
            "open_maintenance": open_maint_by_dept.get(dept_id, 0),
        })
    unassigned = [i for i in items if not i.department_id]
    if unassigned:
        dept_summary.append({
            "department": "Unassigned",
            "total": len(unassigned),
            "allocated": sum(1 for i in unassigned if i.status == "allocated"),
            "available": sum(1 for i in unassigned if i.status == "available"),
            "maintenance": sum(1 for i in unassigned if i.status == "maintenance"),
            "lost": sum(1 for i in unassigned if i.status == "lost"),
            "open_maintenance": 0,
        })

    # --- 5. Booking heatmap (last 60 days + upcoming, day x hour counts) ---
    heat_window = now - timedelta(days=60)
    heat_bookings = db.query(Booking).filter(Booking.status != "cancelled", Booking.end_time >= heat_window).all()
    heatmap = [[0] * 24 for _ in range(7)]  # [weekday][hour]
    for b in heat_bookings:
        cur = b.start_time.replace(minute=0, second=0, microsecond=0)
        while cur < b.end_time:
            heatmap[cur.weekday()][cur.hour] += 1
            cur += timedelta(hours=1)

    # --- 6. Status distribution ---
    status_counts = {}
    for item in items:
        status_counts[item.status] = status_counts.get(item.status, 0) + 1

    bookings_this_week = db.query(Booking).filter(
        Booking.status != "cancelled",
        Booking.start_time >= now - timedelta(days=now.weekday(), hours=now.hour, minutes=now.minute),
        Booking.start_time < now + timedelta(days=7),
    ).count()
    avg_utilization = round(sum(u["utilization_pct"] for u in utilization) / len(utilization), 1) if utilization else 0

    return {
        "generated_at": now.isoformat(),
        "kpis": {
            "total_assets": len(items),
            "avg_utilization_pct": avg_utilization,
            "open_maintenance": sum(1 for m in maint_rows if m.status in OPEN_MAINTENANCE_STATUSES),
            "bookings_this_week": bookings_this_week,
        },
        "utilization": {"most_used": most_used, "idle": idle, "all": utilization},
        "maintenance": {"by_asset": maint_by_asset, "by_category": maint_by_category, "avg_resolution_hours": avg_resolution_hours, "total_requests": len(maint_rows)},
        "attention": attention,
        "department_summary": dept_summary,
        "booking_heatmap": heatmap,
        "status_distribution": status_counts,
    }

# ---------------------------------------------------------------------------
# Background loop: overdue auto-flag + booking reminders
# ---------------------------------------------------------------------------

async def activity_monitor_loop():
    while True:
        try:
            db = SessionLocal()
            try:
                now = datetime.utcnow()

                # Auto-flag overdue allocations (notify once per allocation)
                overdue_items = db.query(AssetItem).filter(
                    AssetItem.status == "allocated",
                    AssetItem.expected_return_date != None,
                    AssetItem.expected_return_date < now,
                    AssetItem.overdue_flagged == False,
                ).all()
                for item in overdue_items:
                    holder = db.query(User).filter(User.id == item.assigned_to_user_id).first()
                    days = (now - item.expected_return_date).days
                    item.overdue_flagged = True
                    db.commit()
                    log_action(db, actor="system", actor_role="system", action="OVERDUE_FLAGGED", target=item.asset_tag,
                               details=f"{item.name} overdue by {max(days, 1)} day(s) ({holder.name if holder else 'unknown'}).")
                    await create_notification(db, recipient_role="admin", type="overdue_return", title="Overdue Return Alert",
                                              message=f"{item.name} ({item.asset_tag}) checked out to {holder.name if holder else 'unknown'} is {max(days, 1)} day(s) overdue for return.", severity="danger")

                # Booking reminders (30 min before start)
                upcoming = db.query(Booking).filter(
                    Booking.status == "confirmed",
                    Booking.reminder_sent == False,
                    Booking.start_time > now,
                    Booking.start_time <= now + timedelta(minutes=30),
                ).all()
                for b in upcoming:
                    item = db.query(AssetItem).filter(AssetItem.id == b.asset_item_id).first()
                    booker = db.query(User).filter(User.id == b.user_id).first()
                    b.reminder_sent = True
                    db.commit()
                    minutes = max(int((b.start_time - now).total_seconds() // 60), 1)
                    await create_notification(db, recipient_role="all", type="booking_reminder", title="Booking Reminder",
                                              message=f"Reminder: {item.name if item else 'Resource'} booking starts in {minutes} min ({booker.name if booker else 'unknown'}).", severity="info")
            finally:
                db.close()
        except Exception as e:
            print(f"activity_monitor_loop error: {e}")
        await asyncio.sleep(60)

@app.on_event("startup")
async def start_background_tasks():
    asyncio.create_task(activity_monitor_loop())

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
