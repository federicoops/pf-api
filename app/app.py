from typing import Union
import os
from fastapi.staticfiles import StaticFiles

from fastapi import FastAPI
from app.routes.transactions import router as tx_router
from app.routes.accounts import router as acc_router
from app.routes.tickers import router as tk_router
from app.routes.auth import router as auth_router
from dotenv import dotenv_values 
from pymongo import MongoClient

app = FastAPI()
app.mount("/app", StaticFiles(directory="static",html = True), name="static")

@app.on_event("startup")
def startup_db_client():
    config = dotenv_values("./env/.env")
    print(config["MONGO_URI"])
    app.mongodb_client = MongoClient(config["MONGO_URI"])
    app.db = app.mongodb_client[config["MONGO_DB"]]

@app.on_event("shutdown")
def shutdown_db_client():
    app.mongodb_client.close()


app.include_router(tx_router)
app.include_router(acc_router)
app.include_router(tk_router)
app.include_router(auth_router)
