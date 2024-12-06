from numpy import isnan
import pandas as pd
from app.model.transaction import TransactionUpdate
from datetime import datetime
import pymongo
from pymongo import MongoClient
from passlib.context import CryptContext

from fastapi.encoders import jsonable_encoder
from bson import ObjectId

from dotenv import dotenv_values
config = dotenv_values("./env/.env")
MONGO_URI=config["MONGO_URI"]
MONGO_DB=config["MONGO_DB"]

def populate_user():
    username="federico"
    password="federico"
    mongo_client = MongoClient(MONGO_URI)
    db = mongo_client[MONGO_DB]
    db.drop_collection("users")

    def get_password_hash(password):
        return pwd_context.hash(password)

    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    hashed_password = get_password_hash(password)

    print(username, hashed_password)

    new_user = db['users'].insert_one({'username':username, 'password': hashed_password})
    print(f"Inserted user {new_user.inserted_id}")

def populate():


    mongo_client = MongoClient(MONGO_URI)
    db = mongo_client[MONGO_DB]

    data = pd.read_csv("transactions.csv")

    account_cache = dict()

    db.drop_collection("transactions")
    db.drop_collection("accounts")

    # Retrieve account id from account_name using cached or stored accounts
    def retrieve_account(account_name):
        if account_name in account_cache:
            print(f"Using cached account {account_name}")
            return account_cache[account_name]

        account = db["accounts"].find_one({"name": account_name})
        if account is not None:
            print(f"Using stored account {account_name}")
            account_cache["account_name"] = account["_id"]
            return  account["_id"]

        account = {'name': account_name}
        inserted = db["accounts"].insert_one(account)
        print(f"Created stored account {account_name}")
        account_cache[account_name] = inserted.inserted_id
        return inserted.inserted_id


    for idx,row in data.iterrows():

        account_id = retrieve_account(row.account)

        try:
            datetime_object = datetime.strptime(row.date, '%Y-%m-%d %H:%M:%S')
        except:
            datetime_object = datetime.strptime(row.date, '%Y-%m-%d')

        tx = {
            "amount":row.amount,
            "category":row.category,
            "date":datetime_object,
            "account":str(account_id),
            "description":str(row.description)
        }

        # Investment transaction needs additional fields
        if ~isnan(row.price):
            tx["price"] = row.price
            tx["quantity"] = row.quantity
            tx["ticker"] = row.ticker

        inserted = db["transactions"].insert_one(tx)
        print(f"Inserted transaction {inserted.inserted_id}")

populate_user()
populate()
