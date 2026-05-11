from fastapi import APIRouter, HTTPException
from app.services.price_fetcher import fetch_live_price, fetch_all_tracked_prices

router = APIRouter()


@router.get("/")
async def list_assets():
    """Takip edilen tüm varlıkların anlık fiyatını döner."""
    return await fetch_all_tracked_prices()


@router.get("/{symbol}")
async def get_asset_price(symbol: str):
    """Tek bir varlığın anlık fiyatını döner. Örn: XAU/USD, MRVL"""
    try:
        return await fetch_live_price(symbol.upper())
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Fiyat çekilemedi: {e}")
