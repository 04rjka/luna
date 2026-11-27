import jwt
from jwt import PyJWKClient
from fastapi import Depends, Header, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.config import settings
from app.db.db import get_db
from app.models.user import User

BASE = settings.better_auth_url.rstrip("/")
_jwks = PyJWKClient(f"{BASE}/api/auth/jwks", cache_keys=True, lifespan=300)

def _unauthorized(msg: str):
    return HTTPException(401, msg, headers={"WWW-Authenticate": "Bearer"})

def get_claims(authorization: str | None = Header(default=None)) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise _unauthorized("Not authenticated")
    token = authorization[7:]
    try:
        key = _jwks.get_signing_key_from_jwt(token)
        return jwt.decode(
            token, key.key,
            algorithms=["EdDSA"], issuer=BASE, audience=BASE,
            options={"require": ["exp", "iat", "sub"]},
        )
    except jwt.PyJWTError:
        raise _unauthorized("Invalid or expired token")

def get_current_user(claims: dict = Depends(get_claims), db: Session = Depends(get_db)) -> User:
    uid = claims["sub"]
    user = db.get(User, uid)
    if user:
        return user
    user = User(id=uid, email=claims.get("email"), name=claims.get("name"))
    db.add(user)
    try:
        db.commit()
    except IntegrityError:            # two first requests raced; the other one won
        db.rollback()
        user = db.get(User, uid)
    return user