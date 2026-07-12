from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, JSON
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
