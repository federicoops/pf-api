from fastapi import APIRouter, FastAPI, Request, Body, HTTPException, status, Response, Depends
from app.model.transaction import Transaction, TransactionUpdate, TransactionAggregate, TransactionCreate
from fastapi.encoders import jsonable_encoder
from typing import List
from datetime import datetime
from typing import Annotated
from app.model.auth import User
from app.routes.auth import get_current_active_user
from bson import ObjectId

router = APIRouter(prefix="/api/transactions")


@router.get("/", response_model=List[Transaction])
async def list_transactions(
    request: Request, current_user: Annotated[User, Depends(get_current_active_user)], 
    start_date: datetime = datetime.today().replace(day=1), 
    end_date: datetime = datetime.today()):

    pipeline = [
        {"$match": {"date": {"$gte": start_date, "$lte": end_date}}},  # Filter by date range
        {"$sort": {"date": -1}}
    ]

    transactions = list(request.app.db["transactions"].aggregate(pipeline))
    return transactions

@router.get("/aggregate", response_model=List[TransactionAggregate])
async def list_transactions(
    request: Request, 
    current_user: Annotated[User, Depends(get_current_active_user)], 
    start_date: datetime = datetime.today().replace(day=1), 
    end_date: datetime = datetime.today(),
    aggregate: str = None):

    pipeline = [
        {"$match": {"date": {"$gte": start_date, "$lte": end_date}, "price":{"$exists": False}}},  # Filter by date range, exclude etf/stocks buying
    ]
    
    if aggregate is not None:
        pipeline.append({"$group": {"_id": f"${aggregate}", "total": {"$sum": "$amount"}}})
    else:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Aggregation group not specified")

    transactions = list(request.app.db["transactions"].aggregate(pipeline))
    return transactions

@router.get("/{id}", response_model=Transaction)
async def find_transaction(id: str, request: Request, current_user: Annotated[User, Depends(get_current_active_user)]):
    if (Transaction := request.app.db["transactions"].find_one({"_id": ObjectId(id)})) is not None:
        return Transaction

    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Transaction with ID {id} not found")

@router.post("/", response_model=Transaction)
async def add_transactions(request: Request,current_user: Annotated[User, Depends(get_current_active_user)], transaction: TransactionCreate = Body(...)):
    transaction = transaction.model_dump()
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
