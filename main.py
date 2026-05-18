
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from sqlalchemy.orm import Session
from typing import List
from datetime import date, time
from pydantic import BaseModel

import models
from database import engine, get_db

# Cria as tabelas se não existirem
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Maneirin Studio API")

# Permite requisições do frontend local
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Schemas Pydantic para validação ---
class ProductBase(BaseModel):
    name: str
    description: str
    image_url: str
    affiliate_link: str

class ProductCreate(ProductBase):
    pass

class Product(ProductBase):
    id: int
    class Config:
        from_attributes = True

class ScheduleBase(BaseModel):
    barber_name: str
    date: date
    time: time
    is_available: bool = True

class ScheduleCreate(ScheduleBase):
    pass

class Schedule(ScheduleBase):
    id: int
    class Config:
        from_attributes = True

# --- Rotas para Produtos ---
@app.get("/api/products", response_model=List[Product])
def read_products(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    products = db.query(models.Product).offset(skip).limit(limit).all()
    return products

@app.post("/api/products", response_model=Product)
def create_product(product: ProductCreate, db: Session = Depends(get_db)):
    db_product = models.Product(**product.model_dump())
    db.add(db_product)
    db.commit()
    db.refresh(db_product)
    return db_product

# --- Rotas para Agenda ---
@app.get("/api/schedules", response_model=List[Schedule])
def read_schedules(db: Session = Depends(get_db)):
    schedules = db.query(models.Schedule).filter(models.Schedule.is_available == True).order_by(models.Schedule.date, models.Schedule.time).all()
    return schedules

@app.post("/api/schedules", response_model=Schedule)
def create_schedule(schedule: ScheduleCreate, db: Session = Depends(get_db)):
    db_schedule = models.Schedule(**schedule.model_dump())
    db.add(db_schedule)
    db.commit()
    db.refresh(db_schedule)
    return db_schedule

@app.post("/api/schedules/book/{schedule_id}")
def book_schedule(schedule_id: int, db: Session = Depends(get_db)):
    db_schedule = db.query(models.Schedule).filter(models.Schedule.id == schedule_id).first()
    if not db_schedule:
        raise HTTPException(status_code=404, detail="Horário não encontrado")
    if not db_schedule.is_available:
        raise HTTPException(status_code=400, detail="Horário não está mais disponível")
    
    db_schedule.is_available = False
    db.commit()
    return {"message": "Agendado com sucesso"}
