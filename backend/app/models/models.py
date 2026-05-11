import enum
import uuid
from decimal import Decimal

from sqlalchemy import (
    Boolean, Column, DateTime, Enum, ForeignKey,
    Integer, Numeric, SmallInteger, String, Text, func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.core.database import Base


# ---------------------------------------------------------------------------
# Enum mirrors (schema.sql ile uyumlu)
# ---------------------------------------------------------------------------

class AssetType(str, enum.Enum):
    PRECIOUS_METAL = "PRECIOUS_METAL"
    FOREX          = "FOREX"
    CRYPTO         = "CRYPTO"
    EQUITY         = "EQUITY"


class TransactionType(str, enum.Enum):
    BUY           = "BUY"
    SELL          = "SELL"
    TRANSFER_IN   = "TRANSFER_IN"
    TRANSFER_OUT  = "TRANSFER_OUT"


class OrderStatus(str, enum.Enum):
    PENDING   = "PENDING"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"
    FAILED    = "FAILED"


class PriceSource(str, enum.Enum):
    ALPHA_VANTAGE = "ALPHA_VANTAGE"
    TWELVE_DATA   = "TWELVE_DATA"
    MANUAL        = "MANUAL"
    WEBSOCKET     = "WEBSOCKET"


# ---------------------------------------------------------------------------
# User
# ---------------------------------------------------------------------------

class User(Base):
    __tablename__ = "users"

    id                 = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email              = Column(String(255), nullable=False, unique=True, index=True)
    password_hash      = Column(Text, nullable=False)
    full_name          = Column(String(150))
    preferred_currency = Column(String(3), nullable=False, default="USD")
    is_active          = Column(Boolean, nullable=False, default=True)
    is_verified        = Column(Boolean, nullable=False, default=False)
    created_at         = Column(DateTime(timezone=True), server_default=func.now())
    updated_at         = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    portfolios   = relationship("Portfolio", back_populates="user", cascade="all, delete-orphan")
    price_alerts = relationship("PriceAlert",  back_populates="user", cascade="all, delete-orphan")


# ---------------------------------------------------------------------------
# Asset
# ---------------------------------------------------------------------------

class Asset(Base):
    __tablename__ = "assets"

    id             = Column(Integer, primary_key=True, autoincrement=True)
    symbol         = Column(String(20), nullable=False, unique=True)
    name           = Column(String(100), nullable=False)
    asset_type     = Column(Enum(AssetType), nullable=False)
    base_currency  = Column(String(3), nullable=False)
    quote_currency = Column(String(3), nullable=False, default="USD")
    decimal_places = Column(SmallInteger, nullable=False, default=4)
    is_active      = Column(Boolean, nullable=False, default=True)
    description    = Column(Text)
    created_at     = Column(DateTime(timezone=True), server_default=func.now())

    transactions  = relationship("Transaction",  back_populates="asset")
    price_history = relationship("PriceHistory", back_populates="asset")
    price_alerts  = relationship("PriceAlert",   back_populates="asset")


# ---------------------------------------------------------------------------
# Portfolio
# ---------------------------------------------------------------------------

class Portfolio(Base):
    __tablename__ = "portfolios"

    id            = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id       = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name          = Column(String(100), nullable=False)
    description   = Column(Text)
    base_currency = Column(String(3), nullable=False, default="USD")
    is_default    = Column(Boolean, nullable=False, default=False)
    created_at    = Column(DateTime(timezone=True), server_default=func.now())
    updated_at    = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user         = relationship("User",        back_populates="portfolios")
    transactions = relationship("Transaction", back_populates="portfolio", cascade="all, delete-orphan")


# ---------------------------------------------------------------------------
# Transaction
# ---------------------------------------------------------------------------

class Transaction(Base):
    __tablename__ = "transactions"

    id               = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    portfolio_id     = Column(UUID(as_uuid=True), ForeignKey("portfolios.id", ondelete="CASCADE"), nullable=False)
    asset_id         = Column(Integer, ForeignKey("assets.id"), nullable=False)
    transaction_type = Column(Enum(TransactionType), nullable=False)
    status           = Column(Enum(OrderStatus), nullable=False, default=OrderStatus.COMPLETED)

    quantity          = Column(Numeric(20, 8), nullable=False)
    price_per_unit    = Column(Numeric(20, 8), nullable=False)
    fee               = Column(Numeric(20, 8), nullable=False, default=Decimal("0"))
    fee_currency      = Column(String(3), nullable=False, default="USD")
    exchange_rate_to_usd = Column(Numeric(20, 8))

    transaction_date = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    notes            = Column(Text)
    external_ref     = Column(String(100))
    created_at       = Column(DateTime(timezone=True), server_default=func.now())
    updated_at       = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    portfolio = relationship("Portfolio", back_populates="transactions")
    asset     = relationship("Asset",     back_populates="transactions")


# ---------------------------------------------------------------------------
# PriceHistory  (TimescaleDB hypertable)
# ---------------------------------------------------------------------------

class PriceHistory(Base):
    __tablename__ = "price_history"

    time     = Column(DateTime(timezone=True), primary_key=True, nullable=False)
    asset_id = Column(Integer, ForeignKey("assets.id"), primary_key=True, nullable=False)
    open     = Column(Numeric(20, 8), nullable=False)
    high     = Column(Numeric(20, 8), nullable=False)
    low      = Column(Numeric(20, 8), nullable=False)
    close    = Column(Numeric(20, 8), nullable=False)
    volume   = Column(Numeric(30, 8))
    source   = Column(Enum(PriceSource), nullable=False, default=PriceSource.ALPHA_VANTAGE)

    asset = relationship("Asset", back_populates="price_history")


# ---------------------------------------------------------------------------
# PriceAlert
# ---------------------------------------------------------------------------

class PriceAlert(Base):
    __tablename__ = "price_alerts"

    id           = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id      = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    asset_id     = Column(Integer, ForeignKey("assets.id"), nullable=False)
    target_price = Column(Numeric(20, 8), nullable=False)
    direction    = Column(String(10), nullable=False)  # 'ABOVE' | 'BELOW'
    is_triggered = Column(Boolean, nullable=False, default=False)
    is_active    = Column(Boolean, nullable=False, default=True)
    triggered_at = Column(DateTime(timezone=True))
    created_at   = Column(DateTime(timezone=True), server_default=func.now())

    user  = relationship("User",  back_populates="price_alerts")
    asset = relationship("Asset", back_populates="price_alerts")
