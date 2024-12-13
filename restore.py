from numpy import isnan
import pandas as pd
from app.model.transaction import TransactionUpdate
from datetime import datetime
import pymongo
from pymongo import MongoClient
from passlib.context import CryptContext
import argparse
from getpass import getpass

from fastapi.encoders import jsonable_encoder
from bson import ObjectId

from dotenv import dotenv_values
config = dotenv_values("./env/.env")
MONGO_URI=config["MONGO_URI"]
MONGO_DB=config["MONGO_DB"]

def populate_user():
    username=input("Insert username: ")
    password=getpass("Insert password: ")
    passwordAgain=getpass("Insert password again: ")
    if(password != passwordAgain):
        print("The passwords do not match, try again.")
        populate_user()

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

def populate(transaction_file):


    mongo_client = MongoClient(MONGO_URI)
    db = mongo_client[MONGO_DB]

    data = pd.read_csv(transaction_file)

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



def main():
    # Create the argument parser
    parser = argparse.ArgumentParser(description="Initialize or restore pf-db database")

    # Add arguments
    parser.add_argument(
        "-t", "--transactions", 
        type=str, 
        required=False,
        help="Path to the transactions file"
    )
    parser.add_argument(
        "-u", "--user", 
        action="store_true", 
        required=False,
        help="Recreate user collection with interactive user input"
    )

    # Parse the arguments
    args = parser.parse_args()

    # Handle transactions argument
    if args.transactions:
        populate(args.transactions)
    else:
        print("No transactions file provided, skipping.")

    # Handle user flag
    if args.user:
        populate_user()
    else:
        print("Not recreating users.")

if __name__ == "__main__":
    main()
