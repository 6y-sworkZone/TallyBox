from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

from passlib.context import CryptContext

SQLALCHEMY_DATABASE_URL = "sqlite:///./tallybox.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    from backend.app import models
    Base.metadata.create_all(bind=engine)


def create_default_admin():
    from backend.app.models import Admin
    db = SessionLocal()
    try:
        existing = db.query(Admin).filter(Admin.username == "admin").first()
        if not existing:
            hashed_password = pwd_context.hash("admin123")
            admin = Admin(
                username="admin",
                password_hash=hashed_password,
                name="系统管理员"
            )
            db.add(admin)
            db.commit()
            print("默认管理员创建成功: admin / admin123")
    finally:
        db.close()
