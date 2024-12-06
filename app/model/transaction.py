from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, Dict
import uuid
from app.model.pyobjectid import PyObjectId

# Define the Transaction model
class Transaction(BaseModel):
    id: PyObjectId = Field(default_factory=uuid.uuid4, alias="_id")
    category: str   # Mandatory field for category
    account: str  # Mandatory field for account
    amount: float  # Mandatory field for transaction amount
    date: datetime  # Default to today's date
    description: Optional[str] = None  # Optional description with default as an empty string
    price: Optional[float] = None  # Default to -1 if not provided
    quantity: Optional[float] = None
    ticker: Optional[str] = None  # Optional ticker with default as an empty string
    class Config:
        arbitrary_types_allowed = True    

class TransactionCreate(BaseModel):
    category: str = None  # Optional field for category
    account: str = None  # Optional field for account
    amount: float = None  # Optional field for amount
    date: datetime = Field(default_factory=datetime.today)  # Optional field for date
    description: Optional[str] = None  # Optional field for description
    price: Optional[float] = None  # Optional field for price
    quantity: Optional[float] = None
    ticker: Optional[str] = None  # Optional field for ticker

class TransactionUpdate(BaseModel):
    category: Optional[str] = None  # Optional field for category
    account: Optional[str] = None  # Optional field for account
    amount: Optional[float] = None  # Optional field for amount
    date: Optional[datetime] = None  # Optional field for date
    description: Optional[str] = None  # Optional field for description
    price: Optional[float] = None  # Optional field for price
    quantity: Optional[float] = None
    ticker: Optional[str] = None  # Optional field for ticker

class TransactionAggregate(BaseModel):
    group: str = Field(alias="_id")
    total: float
    quantity: Optional[float] = None
    total_wfee: Optional[float] = None

class OverviewGroup(BaseModel):
    month: int
    category: str

class TransactionOverview(BaseModel):
    group: OverviewGroup = Field(alias="_id")
    total: float