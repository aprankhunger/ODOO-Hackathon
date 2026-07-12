from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, JSON, Boolean
from sqlalchemy.orm import declarative_base, relationship
from datetime import datetime

Base = declarative_base()

class Asset(Base):
    __tablename__ = "assets"
    
    device_id = Column(String, primary_key=True, index=True)
    hostname = Column(String, nullable=True)
    os_name = Column(String, nullable=True)
    registered_at = Column(DateTime, default=datetime.utcnow)
    
    telemetry = relationship("Telemetry", back_populates="asset")

class Telemetry(Base):
    __tablename__ = "telemetry"
    
    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(String, ForeignKey("assets.device_id"))
    timestamp = Column(DateTime, default=datetime.utcnow)
    
    cpu_percent = Column(Float)
    ram_percent = Column(Float)
    disk_percent = Column(Float)
    
    status = Column(String)
    
    detailed_metrics = Column(JSON, nullable=True) 
    
    asset = relationship("Asset", back_populates="telemetry")

class TechnicianCode(Base):
    __tablename__ = "technician_codes"
    
    code = Column(String, primary_key=True, index=True)
    device_id = Column(String, ForeignKey("assets.device_id"))
    ai_report = Column(String)
    priority = Column(Integer, default=3)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    asset = relationship("Asset")

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    recipient_role = Column(String, default="all")  # admin | technician | all
    type = Column(String, nullable=False)  # asset_assigned, maintenance_approved, booking_confirmed, etc.
    title = Column(String, nullable=False)
    message = Column(String, nullable=False)
    severity = Column(String, default="info")  # info | success | warning | danger
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    actor = Column(String, nullable=False)  # e.g. "admin", "TECH-XXXX", "system"
    actor_role = Column(String, default="system")  # admin | manager | employee | technician | system
    action = Column(String, nullable=False)  # e.g. ASSET_REGISTERED, TECHNICIAN_ASSIGNED, LOGIN
    target = Column(String, nullable=True)  # device_id / asset tag / booking id
    details = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    role = Column(String, default="employee")  # admin | department_head | asset_manager | employee
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=True)
    status = Column(String, default="active")  # active | inactive
    session_token = Column(String, nullable=True, index=True)
    reset_code = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    department = relationship("Department", foreign_keys=[department_id])

class Department(Base):
    __tablename__ = "departments"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    head_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    parent_id = Column(Integer, ForeignKey("departments.id"), nullable=True)
    status = Column(String, default="active")  # active | inactive
    created_at = Column(DateTime, default=datetime.utcnow)

class AssetCategory(Base):
    __tablename__ = "asset_categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    custom_fields = Column(JSON, nullable=True)  # list of field names, e.g. ["Warranty Period"]
    status = Column(String, default="active")  # active | inactive
    created_at = Column(DateTime, default=datetime.utcnow)

class AssetItem(Base):
    __tablename__ = "asset_items"

    id = Column(Integer, primary_key=True, index=True)
    asset_tag = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    category_id = Column(Integer, ForeignKey("asset_categories.id"), nullable=True)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=True)
    status = Column(String, default="available")  # available | allocated | maintenance | in_transfer
    assigned_to_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    expected_return_date = Column(DateTime, nullable=True)
    is_bookable = Column(Boolean, default=False)  # shared resources (rooms, projectors)
    overdue_flagged = Column(Boolean, default=False)  # overdue notification sent once
    custom_field_values = Column(JSON, nullable=True)  # {"Warranty Period": "2 years", ...}
    created_at = Column(DateTime, default=datetime.utcnow)

    category = relationship("AssetCategory")
    assigned_to = relationship("User", foreign_keys=[assigned_to_user_id])

class Booking(Base):
    __tablename__ = "bookings"

    id = Column(Integer, primary_key=True, index=True)
    asset_item_id = Column(Integer, ForeignKey("asset_items.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=False)
    status = Column(String, default="confirmed")  # confirmed | cancelled | completed
    reminder_sent = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    asset_item = relationship("AssetItem")
    user = relationship("User")

class Transfer(Base):
    __tablename__ = "transfers"

    id = Column(Integer, primary_key=True, index=True)
    asset_item_id = Column(Integer, ForeignKey("asset_items.id"))
    from_location = Column(String, nullable=False)
    to_location = Column(String, nullable=False)
    status = Column(String, default="pending")  # pending | approved | rejected
    requested_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    from_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    to_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    approved_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    note = Column(String, nullable=True)
    resolved_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    asset_item = relationship("AssetItem")

class AllocationHistory(Base):
    __tablename__ = "allocation_history"

    id = Column(Integer, primary_key=True, index=True)
    asset_item_id = Column(Integer, ForeignKey("asset_items.id"), index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    allocated_at = Column(DateTime, default=datetime.utcnow)
    returned_at = Column(DateTime, nullable=True)
    expected_return_date = Column(DateTime, nullable=True)
    condition_notes = Column(String, nullable=True)
    released_by = Column(String, nullable=True)  # "return" | "transfer" | actor email
    created_at = Column(DateTime, default=datetime.utcnow)

    asset_item = relationship("AssetItem")
    user = relationship("User")

class MaintenanceRequest(Base):
    __tablename__ = "maintenance_requests"

    id = Column(Integer, primary_key=True, index=True)
    asset_item_id = Column(Integer, ForeignKey("asset_items.id"), index=True)
    requested_by = Column(Integer, ForeignKey("users.id"))
    description = Column(String, nullable=False)
    priority = Column(String, default="medium")  # high | medium | low
    photo = Column(String, nullable=True)  # base64 data URL
    status = Column(String, default="pending")  # pending | approved | rejected | assigned | in_progress | resolved
    decision_note = Column(String, nullable=True)
    decided_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    technician_code = Column(String, nullable=True)
    resolution_note = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    decided_at = Column(DateTime, nullable=True)
    resolved_at = Column(DateTime, nullable=True)

    asset_item = relationship("AssetItem")

class AuditCycle(Base):
    __tablename__ = "audit_cycles"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    scope_department_id = Column(Integer, ForeignKey("departments.id"), nullable=True)  # null = all departments
    start_date = Column(DateTime, nullable=True)
    end_date = Column(DateTime, nullable=True)
    status = Column(String, default="open")  # open | closed
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    closed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class AuditAssignment(Base):
    __tablename__ = "audit_assignments"

    id = Column(Integer, primary_key=True, index=True)
    cycle_id = Column(Integer, ForeignKey("audit_cycles.id"), index=True)
    auditor_user_id = Column(Integer, ForeignKey("users.id"))

class AuditRecord(Base):
    __tablename__ = "audit_records"

    id = Column(Integer, primary_key=True, index=True)
    cycle_id = Column(Integer, ForeignKey("audit_cycles.id"), index=True)
    asset_item_id = Column(Integer, ForeignKey("asset_items.id"), index=True)
    result = Column(String, nullable=False)  # verified | missing | damaged
    note = Column(String, nullable=True)
    auditor_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
