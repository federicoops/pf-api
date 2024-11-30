from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional
from typing import List
from app.model.transaction import Transaction
import uuid

# Define the Transaction model
class User(BaseModel):
    id: str = Field(default_factory=uuid.uuid4, alias="_id")
    username: str  # Mandatory field for username
    password: str # Mandatory hashed sha256 password


class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
    username: Optional[str] = None
