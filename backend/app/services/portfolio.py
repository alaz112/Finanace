"""
Portfolio Service — Weighted Average Cost (WAC) ve holding hesaplamaları
"""
from __future__ import annotations

from decimal import Decimal
from uuid import UUID

from sqlalchemy import select, func, case
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import Transaction, Asset, TransactionType, OrderStatus


# ---------------------------------------------------------------------------
# Weighted Average Cost
# ---------------------------------------------------------------------------

async def calculate_wac(
    db: AsyncSession,
    portfolio_id: UUID,
    asset_id: int,
) -> dict:
    """
    Belirli bir portföy + varlık çifti için WAC hesaplar.

    WAC = Σ(alım_miktarı × fiyat) / Σ(alım_miktarı)

    Returns:
        {
            "net_quantity": Decimal,
            "avg_cost_per_unit": Decimal | None,
            "total_cost_basis": Decimal,
            "total_proceeds": Decimal,
            "unrealized_pnl": None   # güncel fiyat ayrıca sağlanmalı
        }
    """
    result = await db.execute(
        select(
            func.sum(
                case(
                    (Transaction.transaction_type.in_([TransactionType.BUY, TransactionType.TRANSFER_IN]),
                     Transaction.quantity),
                    (Transaction.transaction_type.in_([TransactionType.SELL, TransactionType.TRANSFER_OUT]),
                     -Transaction.quantity),
                    else_=Decimal("0"),
                )
            ).label("net_quantity"),
            func.sum(
                case(
                    (Transaction.transaction_type.in_([TransactionType.BUY, TransactionType.TRANSFER_IN]),
                     Transaction.quantity * Transaction.price_per_unit),
                    else_=Decimal("0"),
                )
            ).label("total_cost_basis"),
            func.sum(
                case(
                    (Transaction.transaction_type.in_([TransactionType.BUY, TransactionType.TRANSFER_IN]),
                     Transaction.quantity),
                    else_=Decimal("0"),
                )
            ).label("total_bought_qty"),
            func.sum(
                case(
                    (Transaction.transaction_type.in_([TransactionType.SELL, TransactionType.TRANSFER_OUT]),
                     Transaction.quantity * Transaction.price_per_unit - Transaction.fee),
                    else_=Decimal("0"),
                )
            ).label("total_proceeds"),
        )
        .where(
            Transaction.portfolio_id == portfolio_id,
            Transaction.asset_id == asset_id,
            Transaction.status == OrderStatus.COMPLETED,
        )
    )
    row = result.one()

    net_qty     = row.net_quantity    or Decimal("0")
    cost_basis  = row.total_cost_basis or Decimal("0")
    bought_qty  = row.total_bought_qty or Decimal("0")
    proceeds    = row.total_proceeds   or Decimal("0")

    avg_cost = (cost_basis / bought_qty) if bought_qty > 0 else None

    return {
        "net_quantity":      net_qty,
        "avg_cost_per_unit": avg_cost,
        "total_cost_basis":  cost_basis,
        "total_proceeds":    proceeds,
        "unrealized_pnl":    None,   # güncel fiyat inject edilmeli
    }


def calculate_unrealized_pnl(
    net_quantity: Decimal,
    avg_cost_per_unit: Decimal,
    current_price: Decimal,
) -> dict:
    """
    Gerçekleşmemiş kar/zarar hesaplar.

    Returns:
        {
            "current_value": Decimal,
            "unrealized_pnl": Decimal,
            "unrealized_pnl_pct": Decimal
        }
    """
    current_value   = net_quantity * current_price
    cost_basis      = net_quantity * avg_cost_per_unit
    unrealized_pnl  = current_value - cost_basis
    pnl_pct = (unrealized_pnl / cost_basis * 100) if cost_basis != 0 else Decimal("0")

    return {
        "current_value":      current_value,
        "unrealized_pnl":     unrealized_pnl,
        "unrealized_pnl_pct": pnl_pct,
    }
