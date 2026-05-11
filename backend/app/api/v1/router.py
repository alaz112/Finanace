from fastapi import APIRouter

from app.api.v1.routes import assets, prices

api_router = APIRouter()
api_router.include_router(assets.router, prefix="/assets", tags=["assets"])
api_router.include_router(prices.router, prefix="/prices", tags=["prices"])
