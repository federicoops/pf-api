from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional
from typing import List
from app.model.transaction import Transaction
import uuid

# Define the Transaction model
class Account(BaseModel):
    id: str = Field(default_factory=uuid.uuid4, alias="_id")
    name: str   # Mandatory field for name
    asset_type: str # Mandatory asset type (e.g. cash, stocks/etf, crypto, house, car etc etc)

class AccountUpdate(BaseModel):
    name: Optional[str] = None  # Optional field for name
