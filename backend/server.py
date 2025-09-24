from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime
import sqlite3
import json

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# SQLite connection for airline sentiment data
DATABASE_PATH = ROOT_DIR.parent / 'database.sqlite'

def get_db_connection():
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    return conn

# Create the main app without a prefix
app = FastAPI(title="Airline Sentiment Analysis API", description="API for airline sentiment analysis dashboard")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Pydantic Models
class StatusCheck(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class StatusCheckCreate(BaseModel):
    client_name: str

class SentimentStats(BaseModel):
    total_tweets: int
    positive: int
    negative: int
    neutral: int
    positive_percentage: float
    negative_percentage: float
    neutral_percentage: float

class AirlineSentiment(BaseModel):
    airline: str
    total_tweets: int
    positive: int
    negative: int
    neutral: int
    sentiment_score: float

class NegativeReason(BaseModel):
    reason: str
    count: int
    percentage: float

class TweetData(BaseModel):
    tweet_id: int
    airline: str
    sentiment: str
    confidence: float
    text: str
    created: str
    location: Optional[str]
    negative_reason: Optional[str]

# Original routes
@api_router.get("/")
async def root():
    return {"message": "Airline Sentiment Analysis API"}

@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_dict = input.dict()
    status_obj = StatusCheck(**status_dict)
    _ = await db.status_checks.insert_one(status_obj.dict())
    return status_obj

@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    status_checks = await db.status_checks.find().to_list(1000)
    return [StatusCheck(**status_check) for status_check in status_checks]

# Airline Sentiment Analysis Routes
@api_router.get("/sentiment/overview", response_model=SentimentStats)
async def get_sentiment_overview():
    """Get overall sentiment statistics"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Get total counts
        cursor.execute("SELECT COUNT(*) as total FROM Tweets")
        total = cursor.fetchone()['total']
        
        cursor.execute("""
            SELECT airline_sentiment, COUNT(*) as count 
            FROM Tweets 
            GROUP BY airline_sentiment
        """)
        sentiment_data = cursor.fetchall()
        conn.close()
        
        positive = negative = neutral = 0
        for row in sentiment_data:
            if row['airline_sentiment'] == 'positive':
                positive = row['count']
            elif row['airline_sentiment'] == 'negative':
                negative = row['count']
            elif row['airline_sentiment'] == 'neutral':
                neutral = row['count']
        
        return SentimentStats(
            total_tweets=total,
            positive=positive,
            negative=negative,
            neutral=neutral,
            positive_percentage=round((positive / total) * 100, 2) if total > 0 else 0,
            negative_percentage=round((negative / total) * 100, 2) if total > 0 else 0,
            neutral_percentage=round((neutral / total) * 100, 2) if total > 0 else 0
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/sentiment/airlines", response_model=List[AirlineSentiment])
async def get_airlines_sentiment():
    """Get sentiment breakdown by airline"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT 
                airline,
                airline_sentiment,
                COUNT(*) as count
            FROM Tweets 
            GROUP BY airline, airline_sentiment
            ORDER BY airline
        """)
        
        results = cursor.fetchall()
        conn.close()
        
        # Process results to group by airline
        airlines_data = {}
        for row in results:
            airline = row['airline']
            sentiment = row['airline_sentiment']
            count = row['count']
            
            if airline not in airlines_data:
                airlines_data[airline] = {'positive': 0, 'negative': 0, 'neutral': 0}
            
            airlines_data[airline][sentiment] = count
        
        # Calculate sentiment scores and create response
        airline_sentiments = []
        for airline, sentiments in airlines_data.items():
            total = sum(sentiments.values())
            
            # Calculate sentiment score (positive weight: +1, neutral: 0, negative: -1)
            sentiment_score = ((sentiments['positive'] - sentiments['negative']) / total) if total > 0 else 0
            
            airline_sentiments.append(AirlineSentiment(
                airline=airline,
                total_tweets=total,
                positive=sentiments['positive'],
                negative=sentiments['negative'],
                neutral=sentiments['neutral'],
                sentiment_score=round(sentiment_score, 3)
            ))
        
        # Sort by total tweets descending
        airline_sentiments.sort(key=lambda x: x.total_tweets, reverse=True)
        return airline_sentiments
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/sentiment/negative-reasons", response_model=List[NegativeReason])
async def get_negative_reasons():
    """Get top negative reasons"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT 
                negativereason,
                COUNT(*) as count
            FROM Tweets 
            WHERE negativereason IS NOT NULL AND negativereason != ''
            GROUP BY negativereason
            ORDER BY count DESC
            LIMIT 10
        """)
        
        results = cursor.fetchall()
        
        # Get total negative tweets for percentage calculation
        cursor.execute("SELECT COUNT(*) as total FROM Tweets WHERE airline_sentiment = 'negative'")
        total_negative = cursor.fetchone()['total']
        
        conn.close()
        
        negative_reasons = []
        for row in results:
            percentage = (row['count'] / total_negative) * 100 if total_negative > 0 else 0
            negative_reasons.append(NegativeReason(
                reason=row['negativereason'],
                count=row['count'],
                percentage=round(percentage, 2)
            ))
        
        return negative_reasons
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/sentiment/tweets", response_model=List[TweetData])
async def get_tweets(
    airline: Optional[str] = None,
    sentiment: Optional[str] = None,
    limit: int = 50,
    offset: int = 0
):
    """Get tweets with optional filtering"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Build query with filters
        where_conditions = []
        params = []
        
        if airline:
            where_conditions.append("airline = ?")
            params.append(airline)
            
        if sentiment:
            where_conditions.append("airline_sentiment = ?")
            params.append(sentiment)
        
        where_clause = ""
        if where_conditions:
            where_clause = "WHERE " + " AND ".join(where_conditions)
        
        query = f"""
            SELECT 
                tweet_id,
                airline,
                airline_sentiment,
                airline_sentiment_confidence,
                text,
                tweet_created,
                tweet_location,
                negativereason
            FROM Tweets 
            {where_clause}
            ORDER BY tweet_id DESC
            LIMIT ? OFFSET ?
        """
        
        params.extend([limit, offset])
        cursor.execute(query, params)
        results = cursor.fetchall()
        conn.close()
        
        tweets = []
        for row in results:
            tweets.append(TweetData(
                tweet_id=row['tweet_id'],
                airline=row['airline'],
                sentiment=row['airline_sentiment'],
                confidence=row['airline_sentiment_confidence'] or 0,
                text=row['text'] or "",
                created=row['tweet_created'] or "",
                location=row['tweet_location'],
                negative_reason=row['negativereason']
            ))
        
        return tweets
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/sentiment/airlines/list")
async def get_airlines_list():
    """Get list of all airlines"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("SELECT DISTINCT airline FROM Tweets ORDER BY airline")
        results = cursor.fetchall()
        conn.close()
        
        airlines = [row['airline'] for row in results]
        return {"airlines": airlines}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()