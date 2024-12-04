import pandas as pd
from app.model.transaction import TransactionUpdate
from datetime import datetime
import pymongo
from pymongo import MongoClient
from passlib.context import CryptContext

from fastapi.encoders import jsonable_encoder
from bson import ObjectId
MONGO_URI = "mongodb://root:example@localhost:27017"
MONGO_DB  = "pf-api"

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

    data = pd.read_csv("new_demo_data.csv")
    data.Importo = data.Importo.str.replace(".","").str.replace(",",".").astype(float)

    account_cache = dict()

    db.drop_collection("transactions")
    db.drop_collection("accounts")
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

        account_id = retrieve_account(row.Conto)

        try:
            datetime_object = datetime.strptime(row["Informazioni cronologiche"], '%d/%m/%Y %H.%M.%S')
        except:
            datetime_object = datetime.strptime(row["Informazioni cronologiche"], '%d/%m/%Y')
        tx = {
            "amount":row.Importo,
            "category":row.Categoria,
            "date":datetime_object,
            "account":str(account_id),
            "description":str(row.Descrizione)
        }
        inserted = db["transactions"].insert_one(tx)
        print(f"Inserted transaction {inserted.inserted_id}")

    data = pd.read_csv("demo_inv.csv")
    data.Importo = data.Importo.str.replace(".","").str.replace(",",".").astype(float)
    data.Prezzo = data.Prezzo.str.replace(".","").str.replace(",",".").astype(float)
    data.Quantita = data.Quantita.str.replace(".","").str.replace(",",".").astype(float)

    for idx, row in data.iterrows():
        account_id = retrieve_account(row.Conto)
        try:
            datetime_object = datetime.strptime(row["Informazioni cronologiche"], '%d/%m/%Y %H.%M.%S')
        except:
            datetime_object = datetime.strptime(row["Informazioni cronologiche"], '%d/%m/%Y')

        tx = {
            "amount":row.Importo,
            "category":row.Categoria,
            "date":datetime_object,
            "account":str(account_id),
            "description":str(row.Descrizione),
            "price": row.Prezzo, 
            "quantity": row.Quantita,
            "ticker": row.Ticker
        }       
        inserted = db["transactions"].insert_one(tx)
        print(f"Inserted investment {inserted.inserted_id}")

populate_user()
populate()


mongo_client = MongoClient(MONGO_URI)
db = mongo_client[MONGO_DB]

pipeline = [
    {"$match": {"ticker":{"$exists": True}, "quantity":{"$exists": True} }},
    {"$group": {"_id": "$ticker",
                "quantity": {"$sum": "$quantity"},
                "total_wfee": {"$sum": "$amount"} ,
                "total_net":{ "$sum": { "$multiply": [ "$price", "$quantity" ] }} 
            }
    }
]

transactions = list(db["transactions"].aggregate(pipeline))

for t in transactions:
    print(t)