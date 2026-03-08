from sqlalchemy import create_engine, Column, Integer, Float, String, Boolean, DateTime, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:yourpassword@localhost:5432/optimfg")

# engine = create_engine(DATABASE_URL)
engine = create_engine(
    DATABASE_URL, connect_args={"check_same_thread": False}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


# ── Tables ────────────────────────────────────────────────────────────────────

class GoldenSignature(Base):
    __tablename__ = "golden_signatures"

    id              = Column(Integer, primary_key=True, index=True)
    version         = Column(String, nullable=False)
    # Parameters
    granulation_time  = Column(Float)
    binder_amount     = Column(Float)
    drying_temp       = Column(Float)
    drying_time       = Column(Float)
    compression_force = Column(Float)
    machine_speed     = Column(Float)
    lubricant_conc    = Column(Float)
    moisture_content  = Column(Float)
    # Outcomes
    energy_batch    = Column(Float)
    carbon_batch    = Column(Float)
    quality_score   = Column(Float)
    reliability_idx = Column(Float)
    # Meta
    source          = Column(String, default="optimized")   # "optimized" | "historical"
    is_active       = Column(Boolean, default=False)
    created_at      = Column(DateTime, default=datetime.utcnow)


class Decision(Base):
    __tablename__ = "decisions"

    id            = Column(Integer, primary_key=True, index=True)
    batch_id      = Column(String)
    action        = Column(String)          # accepted | rejected | modified
    params_json   = Column(Text)            # JSON string of chosen parameters
    energy        = Column(Float)
    quality       = Column(Float)
    operator_id   = Column(String)
    comment       = Column(String)
    weights_json  = Column(Text)            # JSON string of objective weights at decision time
    created_at    = Column(DateTime, default=datetime.utcnow)


class BatchResult(Base):
    __tablename__ = "batch_results"

    id              = Column(Integer, primary_key=True, index=True)
    batch_id        = Column(String, unique=True)
    granulation_time  = Column(Float)
    binder_amount     = Column(Float)
    drying_temp       = Column(Float)
    drying_time       = Column(Float)
    compression_force = Column(Float)
    machine_speed     = Column(Float)
    lubricant_conc    = Column(Float)
    moisture_content  = Column(Float)
    energy_actual   = Column(Float, nullable=True)
    quality_actual  = Column(Float, nullable=True)
    carbon_actual   = Column(Float, nullable=True)
    reliability_actual = Column(Float, nullable=True)
    created_at      = Column(DateTime, default=datetime.utcnow)


def get_db():
    """Dependency — yields a DB session and closes it after the request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Create all tables if they don't exist yet."""
    Base.metadata.create_all(bind=engine)
