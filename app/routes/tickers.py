from fastapi import APIRouter, HTTPException, status, WebSocket, WebSocketDisconnect, Depends
import yfinance as yf
import asyncio
import json
from typing import Annotated
from app.model.auth import User
from app.routes.auth import get_current_active_user
import pandas as pd
from datetime import datetime

router = APIRouter(prefix="/api/tickers")

@router.get("/{ticker}")
def get_price(
    ticker: str,
    current_user: Annotated[User, Depends(get_current_active_user)], 
    year: int = None):
    
    ticker_obj = yf.Ticker(ticker)

    if year is None:
        try:
            prev_close = ticker_obj.fast_info["previousClose"]
            last_price = ticker_obj.fast_info['lastPrice']
            return {'ticker':ticker, 'price': last_price, 'currency': ticker_obj.fast_info['currency'], 'daily_yield': 100*(last_price-prev_close)/prev_close}
        except:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Ticker with name {ticker} could not be retrieved")
    else:
        # Parse the tickers into a list
        tickers = ticker.split(",")
        start_date = datetime(year, 1, 1)
        end_date = datetime(year, 12, 31)
        # Fetch historical data for the tickers
        data = {}
        for ticker in tickers:
            data[ticker] = yf.download(ticker, start=start_date, end=end_date, interval="1d")['Close']
        # Combine data into a single DataFrame
        combined_data = pd.concat(data, axis=1)
        # Resample the data to a uniform daily frequency, including weekends
        full_date_range = pd.date_range(start=combined_data.index.min(), end=combined_data.index.max(), freq='D')
        combined_data = combined_data.reindex(full_date_range)
        # Fill missing stock prices (for weekends) using the last available value
        combined_data = combined_data.fillna(method='ffill')
        # Resample to monthly frequency (end of the month)
        monthly_closing = combined_data.resample('M').last()
        # Display the harmonized monthly closing prices
        return monthly_closing.values.tolist()

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
