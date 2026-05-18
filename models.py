# pyrefly: ignore [missing-import]
from sqlalchemy import Column, Integer, String, Boolean, Date, Time
from database import Base

class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    description = Column(String)
    image_url = Column(String)
    affiliate_link = Column(String)

class Schedule(Base):
    __tablename__ = "schedules"

    id = Column(Integer, primary_key=True, index=True)
    barber_name = Column(String, index=True)
    date = Column(Date, index=True)
    time = Column(Time)
    is_available = Column(Boolean, default=True)
