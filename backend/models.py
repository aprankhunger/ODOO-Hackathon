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
