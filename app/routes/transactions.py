from fastapi import APIRouter, FastAPI, Request, Body, HTTPException, status, Response, Depends
from app.model.transaction import Transaction, TransactionUpdate, TransactionAggregate, TransactionCreate, TransactionOverview
from fastapi.encoders import jsonable_encoder
from typing import List
from datetime import datetime
from typing import Annotated
from app.model.auth import User
from app.routes.auth import get_current_active_user
from bson import ObjectId
from fastapi.responses import StreamingResponse
import csv
from io import StringIO
import yfinance as yf


router = APIRouter(prefix="/api/transactions")


@router.get("/", response_model=List[Transaction])
async def list_transactions(
    request: Request, current_user: Annotated[User, Depends(get_current_active_user)],
    start_date: datetime = datetime.today().replace(day=1),
    end_date: datetime = datetime.today(),
    category: str = "", investment: bool = False):

    match = {"$match": {"date": {"$gte": start_date, "$lte": end_date}}}

    if category != "":
        match["$match"]["category"] = category
    if investment:
        match["$match"]["ticker"] = {"$exists": True}
    pipeline = [
        match, 
        {"$sort": {"date": -1}}   
    ]
    transactions = list(request.app.db["transactions"].aggregate(pipeline))
    return transactions



@router.get("/aggregate", response_model=List[TransactionAggregate])
async def aggregate_transactions(
    request: Request,
    current_user: Annotated[User, Depends(get_current_active_user)],
    start_date: datetime = datetime.today().replace(day=1),
    end_date: datetime = datetime.today(),
    aggregate: str = ""):

    if aggregate is None or aggregate not in ["ticker", "category", "account"]:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Aggregation group not specified or invalid")

    if aggregate != "ticker":

        pipeline = [
            {"$match": {"date": {"$gte": start_date, "$lte": end_date}, "price":{"$exists": False}}},  # Filter by date range, exclude etf/stocks buying
            {"$group": {"_id": f"${aggregate}", "total": {"$sum": "$amount"}}}
        ]
    else:
        pipeline = [
            {"$match": {"ticker":{"$exists": True}, "quantity":{"$exists": True} }},
            {"$group": {"_id": "$ticker",
                        "quantity": {"$sum": "$quantity"},
                        "total_wfee": {"$sum": "$amount"} ,
                        "total":{ "$sum": { "$multiply": [ "$price", "$quantity" ] }}
                    }
            }
        ]

    transactions = list(request.app.db["transactions"].aggregate(pipeline))
    return transactions

@router.get("/overview", response_model=List[TransactionOverview])
async def overview_transactions(
    request: Request,
    current_user: Annotated[User, Depends(get_current_active_user)],
    year: int = datetime.today().year
):
    pipeline = [
        {
            "$match": {
                "date": {
                    "$gte": datetime(year, 1, 1),
                    "$lt": datetime(year + 1, 1, 1),
                },
                #"amount": {"$lt": 0}

            }
        },
        {
            "$group": {
                "_id": {
                    "month": {"$month": "$date"},
                    "category": "$category"
                },
                "total": {"$sum": "$amount"}
            }
        },
        {
            "$sort": {
                "_id.month": 1,
                "_id.category": 1
            }
        }
    ]

    result = list(request.app.db["transactions"].aggregate(pipeline))
    return result

@router.get("/dump")
async def dump_transactions(
    request: Request,
    current_user: Annotated[User, Depends(get_current_active_user)]
):
    # Fetch accounts to create an account map
    accounts = list(request.app.db["accounts"].find())
    account_map = {}
    for account in accounts:
        account_map[str(account["_id"])] = account

    # Fetch all transactions, do not project transaction._id
    transactions = list(request.app.db["transactions"].find({},{"_id":0}))

    # Use transactions[0] keys to build CSV header
    csv_buffer = StringIO()
    tk = TransactionUpdate()
    csv_writer = csv.DictWriter(csv_buffer, fieldnames=tk.dict().keys())
    csv_writer.writeheader()
    # Iterate transactions, substitute account id with account name using the account map and write to csv
    for transaction in transactions:
        if transaction["account"] not in account_map:
            transaction["account"] = "deleted"
        else:
            transaction["account"] = account_map[transaction["account"]]["name"]
        csv_writer.writerow(transaction)

    # Serve file
    csv_buffer.seek(0)
    return StreamingResponse(
        csv_buffer,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=transactions.csv"}
    )

@router.get("/{id}", response_model=Transaction)
async def find_transaction(id: str, request: Request, current_user: Annotated[User, Depends(get_current_active_user)]):
    if (Transaction := request.app.db["transactions"].find_one({"_id": ObjectId(id)})) is not None:
        return Transaction

    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Transaction with ID {id} not found")

@router.post("/", response_model=Transaction)
async def add_transactions(request: Request,current_user: Annotated[User, Depends(get_current_active_user)], transaction: TransactionCreate = Body(...)):
    transaction = {k: v for k, v in transaction.dict().items() if v is not None}


    new_tr = request.app.db["transactions"].insert_one(transaction)
    inserted_tr = request.app.db["transactions"].find_one({"_id": new_tr.inserted_id})
    return inserted_tr

@router.delete("/{id}")
async def delete_transaction(id: str, request: Request, response: Response, current_user: Annotated[User, Depends(get_current_active_user)]):
    delete_result = request.app.db["transactions"].delete_one({"_id": ObjectId(id)})

    if delete_result.deleted_count == 1:
        response.status_code = status.HTTP_204_NO_CONTENT
        return response

    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Book with ID {id} not found")

@router.put("/{id}", response_model=Transaction)
async def update_transaction(id: str, request: Request,current_user: Annotated[User, Depends(get_current_active_user)], transaction: TransactionUpdate = Body(...)):
    transaction = {k: v for k, v in transaction.dict().items() if v is not None}

    if len(transaction) >= 1:
        update_result = request.app.db["transactions"].update_one(
            {"_id": ObjectId(id)}, {"$set": transaction}
        )

        if update_result.modified_count == 0:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Transaction with ID {id} not found")

    if (
        existing_transaction := request.app.db["transactions"].find_one({"_id": ObjectId(id)})
    ) is not None:
        return existing_transaction

    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Transaction with ID {id} not found")
