# pyrefly: ignore [missing-import]
from sqlalchemy import Boolean, Column, Date, Integer, String, Text, Time
from database.database import Base


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)
    description = Column(Text, default="", nullable=False)
    image_url = Column(Text, nullable=False)
    affiliate_link = Column(Text, nullable=False)


class Schedule(Base):
    __tablename__ = "schedules"

    id = Column(Integer, primary_key=True, index=True)
    barber_name = Column(String, index=True, nullable=False)
    date = Column(Date, index=True, nullable=False)
    time = Column(Time, nullable=False)
    is_available = Column(Boolean, default=True, nullable=False)
