from fastapi import APIRouter, FastAPI, Request, Body, HTTPException, status, Response, Depends
from app.model.transaction import Transaction, TransactionUpdate
from app.model.account import Account, AccountUpdate
from app.routes.auth import get_current_active_user
from fastapi.encoders import jsonable_encoder
from typing import List
from typing import Annotated
from app.model.auth import User
from bson import ObjectId

router = APIRouter(prefix="/api/accounts")


@router.get("/", response_model=List[Account])
async def list_accounts(request: Request, current_user: Annotated[User, Depends(get_current_active_user)]):
    accounts = list(request.app.db["accounts"].find())
    return accounts

@router.get("/{id}", response_model=Account)
async def find_account(id: str, request: Request, current_user: Annotated[User, Depends(get_current_active_user)]):
    if (account := request.app.db["accounts"].find_one({"_id": ObjectId(id)})) is not None:
        return account

    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Account with ID {id} not found")


@router.get("/{id}/transactions", response_model=List[Transaction])
async def find_account_transactions(id: str, request: Request, current_user: Annotated[User, Depends(get_current_active_user)]):
    if (account := request.app.db["accounts"].find_one({"_id": ObjectId(id)})) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Account with ID {id} not found")

    transactions = list(request.app.db["transactions"].find({"account":ObjectId(id)}))
    return transactions

@router.post("/", response_model=Account)
async def add_accounts(request: Request, current_user: Annotated[User, Depends(get_current_active_user)] ,account: AccountUpdate = Body(...)):
    print(account)
    account = jsonable_encoder(account)
    print(account)
    new_acc = request.app.db["accounts"].insert_one(account)
    
    inserted_acc = request.app.db["accounts"].find_one({"_id": new_acc.inserted_id})
    return inserted_acc

@router.delete("/{id}")
async def delete_account(id: str, request: Request, response: Response, current_user: Annotated[User, Depends(get_current_active_user)]):
    delete_result = request.app.db["accounts"].delete_one({"_id": ObjectId(id)})

    if delete_result.deleted_count == 1:
        response.status_code = status.HTTP_204_NO_CONTENT
        return response

    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Account with ID {id} not found")

@router.put("/{id}", response_model=Account)
async def update_account(id: str, request: Request, current_user: Annotated[User, Depends(get_current_active_user)], account: AccountUpdate = Body(...)):
    account = {k: v for k, v in account.dict().items() if v is not None}

    if len(account) >= 1:
        print(account)
        update_result = request.app.db["accounts"].update_one(
            {"_id": ObjectId(id)}, {"$set": account}
        )

        if update_result.modified_count == 0:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Account with ID {id} not updated")

    if (
        existing_account := request.app.db["accounts"].find_one({"_id": ObjectId(id)})
    ) is not None:
        return existing_account

    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Account with ID {id} not found")