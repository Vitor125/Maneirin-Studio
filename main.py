from datetime import date, time
from pathlib import Path
from typing import List

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

import models
from database import engine, get_db

BASE_DIR = Path(__file__).resolve().parent

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Maneirin Studio API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/Fotos", StaticFiles(directory=BASE_DIR / "Fotos"), name="Fotos")
app.mount("/icons", StaticFiles(directory=BASE_DIR / "icons"), name="icons")


class ProductBase(BaseModel):
    name: str = Field(min_length=1)
    description: str = ""
    image_url: str = Field(min_length=1)
    affiliate_link: str = Field(min_length=1)


class ProductCreate(ProductBase):
    pass


class Product(ProductBase):
    id: int

    class Config:
        from_attributes = True


class ScheduleBase(BaseModel):
    barber_name: str = Field(min_length=1)
    date: date
    time: time
    is_available: bool = True


class ScheduleCreate(ScheduleBase):
    pass


class Schedule(ScheduleBase):
    id: int

    class Config:
        from_attributes = True


@app.get("/api/health")
def health_check():
    return {"status": "ok"}


@app.get("/api/products", response_model=List[Product])
def read_products(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(models.Product).offset(skip).limit(limit).all()


@app.post("/api/products", response_model=Product)
def create_product(product: ProductCreate, db: Session = Depends(get_db)):
    db_product = models.Product(**product.model_dump())
    db.add(db_product)
    db.commit()
    db.refresh(db_product)
    return db_product


@app.delete("/api/products/{product_id}")
def delete_product(product_id: int, db: Session = Depends(get_db)):
    db_product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not db_product:
        raise HTTPException(status_code=404, detail="Produto não encontrado")

    db.delete(db_product)
    db.commit()
    return {"message": "Produto removido"}


@app.get("/api/schedules", response_model=List[Schedule])
def read_schedules(include_unavailable: bool = False, db: Session = Depends(get_db)):
    query = db.query(models.Schedule)
    if not include_unavailable:
        query = query.filter(models.Schedule.is_available == True)

    return query.order_by(models.Schedule.date, models.Schedule.time).all()


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
    return {"message": "Horário reservado"}


@app.delete("/api/schedules/{schedule_id}")
def delete_schedule(schedule_id: int, db: Session = Depends(get_db)):
    db_schedule = db.query(models.Schedule).filter(models.Schedule.id == schedule_id).first()
    if not db_schedule:
        raise HTTPException(status_code=404, detail="Horário não encontrado")

    db.delete(db_schedule)
    db.commit()
    return {"message": "Horário removido"}


@app.get("/", include_in_schema=False)
def site_home():
    return FileResponse(BASE_DIR / "index.html")


@app.get("/agenda", include_in_schema=False)
def agenda_redirect():
    return RedirectResponse(url="/agenda/")


@app.get("/agenda/", include_in_schema=False)
def agenda_page():
    return FileResponse(BASE_DIR / "agenda" / "index.html")


@app.get("/agenda/index.html", include_in_schema=False)
def agenda_index_page():
    return FileResponse(BASE_DIR / "agenda" / "index.html")


@app.get("/agenda.html", include_in_schema=False)
def legacy_agenda_page():
    return RedirectResponse(url="/agenda/")


@app.get("/produtos", include_in_schema=False)
def products_redirect():
    return RedirectResponse(url="/produtos/")


@app.get("/produtos/", include_in_schema=False)
def products_page():
    return FileResponse(BASE_DIR / "produtos" / "index.html")


@app.get("/produtos/index.html", include_in_schema=False)
def products_index_page():
    return FileResponse(BASE_DIR / "produtos" / "index.html")


@app.get("/barbeiro", include_in_schema=False)
def barber_redirect():
    return RedirectResponse(url="/barbeiro/")


@app.get("/barbeiro/", include_in_schema=False)
def barber_area():
    return RedirectResponse(url="/dashboard.html")


@app.get("/barbeiro/index.html", include_in_schema=False)
def barber_index_page():
    return FileResponse(BASE_DIR / "barbeiro" / "index.html")


@app.get("/dashboard", include_in_schema=False)
def dashboard_redirect():
    return RedirectResponse(url="/dashboard.html")


@app.get("/dashboard.html", include_in_schema=False)
def dashboard_page():
    return FileResponse(BASE_DIR / "dashboard.html")


@app.get("/index.html", include_in_schema=False)
def index_page():
    return FileResponse(BASE_DIR / "index.html")


@app.get("/{asset_name}", include_in_schema=False)
def root_asset(asset_name: str):
    allowed_assets = {
        "styles.css",
        "script.js",
        "dashboard.js",
        "sw.js",
        "manifest.webmanifest",
        "offline.html",
    }
    if asset_name not in allowed_assets:
        raise HTTPException(status_code=404, detail="Arquivo não encontrado")

    return FileResponse(BASE_DIR / asset_name)
