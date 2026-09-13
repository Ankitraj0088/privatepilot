import bcrypt
import os
import sqlite3
from datetime import datetime, timedelta, timezone
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from pydantic import BaseModel, EmailStr


# =========================================================
# CONFIGURATION
# =========================================================

BASE_DIR = Path(__file__).resolve().parent
DATABASE = BASE_DIR / "privatepilot.db"

SECRET_KEY = os.getenv(
    "PRIVATEPILOT_SECRET",
    "CHANGE_THIS_SECRET_BEFORE_PRODUCTION"
)

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24


# =========================================================
# APP
# =========================================================

app = FastAPI(
    title="PrivatePilot API",
    version="2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://privatepilot-e5r8ibpib-hear-me-out1.vercel.app"
    ],
    allow_origin_regex=r"https?://(localhost|127\\.0\\.0\\.1)(:\\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =========================================================
# SECURITY
security = HTTPBearer()

# =========================================================



# =========================================================
# DATABASE
# =========================================================

def get_db():
    connection = sqlite3.connect(DATABASE)
    connection.row_factory = sqlite3.Row

    try:
        yield connection
    finally:
        connection.close()


def initialize_database():

    connection = sqlite3.connect(DATABASE)

    cursor = connection.cursor()

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
        """
    )

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            task TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'queued',
            result TEXT,
            created_at TEXT NOT NULL,

            FOREIGN KEY(user_id)
            REFERENCES users(id)
        )
        """
    )

    connection.commit()
    connection.close()


initialize_database()


# =========================================================
# MODELS
# =========================================================

class AuthRequest(BaseModel):
    email: EmailStr
    password: str


class TaskRequest(BaseModel):
    task: str


# =========================================================
# PASSWORD FUNCTIONS
# =========================================================

def hash_password(password: str) -> str:
    password_bytes = password.encode("utf-8")

    if len(password_bytes) > 72:
        raise ValueError("Password must be 72 bytes or fewer.")

    return bcrypt.hashpw(
        password_bytes,
        bcrypt.gensalt()
    ).decode("utf-8")


def verify_password(
    password: str,
    password_hash: str
) -> bool:
    password_bytes = password.encode("utf-8")

    if len(password_bytes) > 72:
        return False

    try:
        return bcrypt.checkpw(
            password_bytes,
            password_hash.encode("utf-8")
        )
    except (ValueError, TypeError):
        return False


# =========================================================
# JWT FUNCTIONS
# =========================================================

def create_access_token(user_id: int):

    expires = datetime.now(timezone.utc) + timedelta(
        minutes=ACCESS_TOKEN_EXPIRE_MINUTES
    )

    payload = {
        "sub": str(user_id),
        "exp": expires
    }

    return jwt.encode(
        payload,
        SECRET_KEY,
        algorithm=ALGORITHM
    )


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):

    token = credentials.credentials

    try:

        payload = jwt.decode(
            token,
            SECRET_KEY,
            algorithms=[ALGORITHM]
        )

        user_id = payload.get("sub")

        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication token."
            )

        return int(user_id)

    except (JWTError, ValueError):

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token."
        )


# =========================================================
# HEALTH
# =========================================================

@app.get("/")
def root():

    return {
        "name": "PrivatePilot API",
        "version": "2.0.0",
        "status": "online"
    }


@app.get("/health")
def health():

    return {
        "status": "healthy",
        "database": "connected"
    }


# =========================================================
# SIGN UP
# =========================================================

@app.post("/signup")
def signup(data: AuthRequest):

    email = data.email.lower().strip()

    if len(data.password) < 8:

        raise HTTPException(
            status_code=400,
            detail="Password must contain at least 8 characters."
        )

    connection = sqlite3.connect(DATABASE)
    cursor = connection.cursor()

    existing = cursor.execute(
        "SELECT id FROM users WHERE email = ?",
        (email,)
    ).fetchone()

    if existing:

        connection.close()

        raise HTTPException(
            status_code=409,
            detail="An account with this email already exists."
        )

    password_hash = hash_password(
        data.password
    )

    created_at = datetime.now(
        timezone.utc
    ).isoformat()

    cursor.execute(
        """
        INSERT INTO users
        (email, password_hash, created_at)
        VALUES (?, ?, ?)
        """,
        (
            email,
            password_hash,
            created_at
        )
    )

    connection.commit()

    user_id = cursor.lastrowid

    connection.close()

    token = create_access_token(
        user_id
    )

    return {
        "message": "Account created.",
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user_id,
            "email": email
        }
    }


# =========================================================
# LOGIN
# =========================================================

@app.post("/login")
def login(data: AuthRequest):

    email = data.email.lower().strip()

    connection = sqlite3.connect(DATABASE)
    connection.row_factory = sqlite3.Row

    user = connection.execute(
        """
        SELECT id, email, password_hash
        FROM users
        WHERE email = ?
        """,
        (email,)
    ).fetchone()

    connection.close()

    if not user:

        raise HTTPException(
            status_code=401,
            detail="Invalid email or password."
        )

    if not verify_password(
        data.password,
        user["password_hash"]
    ):

        raise HTTPException(
            status_code=401,
            detail="Invalid email or password."
        )

    token = create_access_token(
        user["id"]
    )

    return {
        "message": "Login successful.",
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user["id"],
            "email": user["email"]
        }
    }


# =========================================================
# CURRENT USER
# =========================================================

@app.get("/me")
def me(
    user_id: int = Depends(get_current_user)
):

    connection = sqlite3.connect(DATABASE)
    connection.row_factory = sqlite3.Row

    user = connection.execute(
        """
        SELECT id, email, created_at
        FROM users
        WHERE id = ?
        """,
        (user_id,)
    ).fetchone()

    connection.close()

    if not user:

        raise HTTPException(
            status_code=404,
            detail="User not found."
        )

    return {
        "user": dict(user)
    }


# =========================================================
# CREATE TASK
# =========================================================

@app.post("/tasks")
def create_task(
    data: TaskRequest,
    user_id: int = Depends(get_current_user)
):

    task_text = data.task.strip()

    if not task_text:

        raise HTTPException(
            status_code=400,
            detail="Task cannot be empty."
        )

    connection = sqlite3.connect(DATABASE)
    cursor = connection.cursor()

    created_at = datetime.now(
        timezone.utc
    ).isoformat()

    cursor.execute(
        """
        INSERT INTO tasks
        (user_id, task, status, created_at)
        VALUES (?, ?, ?, ?)
        """,
        (
            user_id,
            task_text,
            "queued",
            created_at
        )
    )

    connection.commit()

    task_id = cursor.lastrowid

    connection.close()

    return {
        "message": "Task created.",
        "task": {
            "id": task_id,
            "task": task_text,
            "status": "queued",
            "created_at": created_at
        }
    }


# =========================================================
# TASK HISTORY
# =========================================================

@app.get("/tasks")
def get_tasks(
    user_id: int = Depends(get_current_user)
):

    connection = sqlite3.connect(DATABASE)
    connection.row_factory = sqlite3.Row

    rows = connection.execute(
        """
        SELECT
            id,
            task,
            status,
            result,
            created_at
        FROM tasks
        WHERE user_id = ?
        ORDER BY id DESC
        """,
        (user_id,)
    ).fetchall()

    connection.close()

    return {
        "tasks": [
            dict(row)
            for row in rows
        ]
    }

# =========================================================
# GENERAL AI TASK PLANNER
# =========================================================

SUPPORTED_ACTIONS = {
    "navigate",
    "search",
    "click",
    "type",
    "scroll",
    "extract",
    "wait"
}


def build_task_plan(task: str) -> dict:
    """
    Convert a natural-language browser task into executable
    browser actions.

    V1 is deterministic and local.
    """

    text = task.strip()

    if not text:
        return {
            "goal": "",
            "actions": [],
            "status": "invalid"
        }

    lower = text.lower()
    actions = []

    # ---------------------------------------------------------
    # YouTube search
    # ---------------------------------------------------------

    if "youtube" in lower and (
        "search" in lower
        or "find" in lower
        or "look for" in lower
    ):
        query = text

        for phrase in [
            "search youtube for",
            "search youtube",
            "find on youtube",
            "find youtube",
            "look for on youtube"
        ]:
            if phrase in lower:
                index = lower.index(phrase) + len(phrase)
                query = text[index:].strip()
                break

        actions.extend([
            {
                "type": "navigate",
                "url": "https://www.youtube.com"
            },
            {
                "type": "wait",
                "seconds": 2
            },
            {
                "type": "type",
                "text": query
            },
            {
                "type": "click",
                "text": "Search"
            }
        ])

    # ---------------------------------------------------------
    # Google search
    # ---------------------------------------------------------

    elif "google" in lower and (
        "search" in lower
        or "find" in lower
    ):
        query = text

        for phrase in [
            "search google for",
            "search google",
            "find on google",
            "find google"
        ]:
            if phrase in lower:
                index = lower.index(phrase) + len(phrase)
                query = text[index:].strip()
                break

        actions.extend([
            {
                "type": "navigate",
                "url": "https://www.google.com"
            },
            {
                "type": "wait",
                "seconds": 2
            },
            {
                "type": "type",
                "text": query
            },
            {
                "type": "click",
                "text": "Google Search"
            }
        ])

    # ---------------------------------------------------------
    # Explicit URL
    # ---------------------------------------------------------

    else:
        for word in text.split():
            if word.startswith("http://") or word.startswith("https://"):
                actions.append({
                    "type": "navigate",
                    "url": word.rstrip(".,)")
                })
                break

        # Generic page extraction
        if any(x in lower for x in [
            "summarize",
            "summary",
            "extract",
            "find information",
            "information about"
        ]):
            actions.append({
                "type": "extract",
                "target": "relevant page information"
            })

    # ---------------------------------------------------------
    # Fallback
    # ---------------------------------------------------------

    if not actions:
        actions.append({
            "type": "extract",
            "target": text
        })

    return {
        "goal": text,
        "actions": actions,
        "status": "planned"
    }


@app.post("/plan")
def plan_task(
    request: TaskRequest,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """
    Create a structured browser execution plan.
    """

    user_id = get_current_user(credentials)

    plan = build_task_plan(request.task)

    return {
        "user_id": user_id,
        "plan": plan
    }

