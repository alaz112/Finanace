from datetime import datetime
from fastapi import APIRouter, Query, HTTPException
from app.core.database import AsyncSessionLocal
from app.models.models import PriceHistory, Asset
from sqlalchemy import select

router = APIRouter()


@router.get("/history/{symbol}")
async def get_price_history(
    symbol: str,
    interval: str = Query("1day", description="1min | 5min | 15min | 1h | 1day"),
    outputsize: int = Query(90, ge=1, le=500),
):
    """
    Belirli bir sembol için geçmiş OHLCV verisi döner.
    Önce TimescaleDB'de arar, yoksa Twelve Data'dan çekip kaydeder.
    """
    from app.services.price_fetcher import fetch_historical

    try:
        data = await fetch_historical(symbol.upper(), interval, outputsize)
        return {"symbol": symbol.upper(), "interval": interval, "data": data}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Veri çekilemedi: {e}")
