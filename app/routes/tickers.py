from fastapi import APIRouter, HTTPException, status, WebSocket, WebSocketDisconnect, Depends
import yfinance as yf
import asyncio
import json
from typing import Annotated
from app.model.auth import User
from app.routes.auth import get_current_active_user

from datetime import datetime

router = APIRouter(prefix="/api/tickers")

@router.get("/{ticker}")
def get_price(ticker: str, current_user: Annotated[User, Depends(get_current_active_user)]):
    ticker_obj = yf.Ticker(ticker)

    try:
        return {'ticker':ticker, 'price': ticker_obj.fast_info['lastPrice'], 'currency': ticker_obj.fast_info['currency']}
    except:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Ticker with name {ticker} could not be retrieved")


@router.websocket("/{ticker}/subscribe")
async def subscribe_price(ws: WebSocket, ticker: str, current_user: Annotated[User, Depends(get_current_active_user)]):
    await ws.accept()
    try:
        while True:  
            ticker_obj = yf.Ticker(ticker)
            message = {'time': str(datetime.today()), 'ticker':ticker, 'price': str(ticker_obj.fast_info['lastPrice']), 'currency': str(ticker_obj.fast_info['currency'])}
            await ws.send_text(json.dumps(message))
            await asyncio.sleep(30)
    except:
        print('Connection closed')
