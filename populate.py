import pandas as pd
from app.model.transaction import TransactionUpdate
from datetime import datetime
from pymongo import MongoClient
from fastapi.encoders import jsonable_encoder

MONGO_URI = "mongodb://root:example@localhost:27017"
MONGO_DB  = "pf-api"

mongo_client = MongoClient(MONGO_URI)
db = mongo_client[MONGO_DB]

data = pd.read_csv("demo_data.csv")
data.Importo = data.Importo.str.replace(".","").str.replace(",",".").astype(float)

account_cache = dict()

db.drop_collection("transactions")

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


