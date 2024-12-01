from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional
import uuid
from app.model.pyobjectid import PyObjectId

# Define the Transaction model
class Transaction(BaseModel):
    id: PyObjectId = Field(default_factory=uuid.uuid4, alias="_id")
    category: str   # Mandatory field for category
    account: str  # Mandatory field for account
    amount: float  # Mandatory field for transaction amount
    date: datetime = Field(default_factory=datetime.today)  # Default to today's date
    description: Optional[str] = ""  # Optional description with default as an empty string
    price: float = -1  # Default to -1 if not provided
    ticker: Optional[str] = ""  # Optional ticker with default as an empty string
    class Config:
        arbitrary_types_allowed = True

class TransactionUpdate(BaseModel):
    category: Optional[str] = None  # Optional field for category
    account: Optional[str] = None  # Optional field for account
    amount: Optional[float] = None  # Optional field for amount
    date: Optional[datetime] = None  # Optional field for date
    description: Optional[str] = None  # Optional field for description
    price: Optional[float] = None  # Optional field for price
    ticker: Optional[str] = None  # Optional field for ticker
