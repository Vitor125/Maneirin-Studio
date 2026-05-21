from datetime import date, time
from pathlib import Path
from typing import List, Optional
import os

import firebase_admin
from firebase_admin import auth as firebase_auth, credentials
from fastapi import Depends, FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

import database.models as models
from database.database import engine, get_db

BASE_DIR = Path(__file__).resolve().parent.parent

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Maneirin Studio API")

# ─── Firebase Admin Init ────────────────────────────────────────────────────
# O Railway deve ter a variável FIREBASE_PROJECT_ID configurada.
# Usamos credencial de aplicativo padrão (Application Default Credentials).
FIREBASE_PROJECT_ID = os.getenv("FIREBASE_PROJECT_ID")

if FIREBASE_PROJECT_ID and not firebase_admin._apps:
    firebase_admin.initialize_app(credentials.ApplicationDefault(), {
        "projectId": FIREBASE_PROJECT_ID,
    })

# ─── CORS ────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Static files ────────────────────────────────────────────────────────────
app.mount("/Fotos", StaticFiles(directory=BASE_DIR / "Fotos"), name="Fotos")
app.mount("/icons", StaticFiles(directory=BASE_DIR / "icons"), name="icons")


# ─── Auth helpers ────────────────────────────────────────────────────────────
def _verify_token(authorization: Optional[str]) -> dict:
    """Verifica o Firebase ID Token e retorna o payload."""
    if not FIREBASE_PROJECT_ID:
        # Firebase não configurado — retorna um usuário fictício (modo dev)
        return {"uid": "dev-user", "email": "dev@dev.com", "name": "Dev User"}
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Token não fornecido")
    token = authorization.split(" ", 1)[1]
    try:
        return firebase_auth.verify_id_token(token)
    except Exception:
        raise HTTPException(status_code=401, detail="Token inválido ou expirado")


def require_auth(authorization: Optional[str] = Header(default=None)) -> dict:
    return _verify_token(authorization)


def optional_auth(authorization: Optional[str] = Header(default=None)) -> Optional[dict]:
    if not authorization:
        return None
    try:
        return _verify_token(authorization)
    except HTTPException:
        return None


# ─── Pydantic schemas ─────────────────────────────────────────────────────────
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
    client_name: Optional[str] = None
    client_email: Optional[str] = None

    class Config:
        from_attributes = True


class BookRequest(BaseModel):
    client_name: str = Field(min_length=1)
    client_email: str = Field(min_length=1)


# ─── Health ───────────────────────────────────────────────────────────────────
@app.get("/api/health")
def health_check():
    return {"status": "ok"}


# ─── Products ─────────────────────────────────────────────────────────────────
@app.get("/api/products", response_model=List[Product])
def read_products(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(models.Product).offset(skip).limit(limit).all()


@app.post("/api/products", response_model=Product)
def create_product(
    product: ProductCreate,
    db: Session = Depends(get_db),
    user: dict = Depends(require_auth),
):
    db_product = models.Product(**product.model_dump())
    db.add(db_product)
    db.commit()
    db.refresh(db_product)
    return db_product


@app.delete("/api/products/{product_id}")
def delete_product(
    product_id: int,
    db: Session = Depends(get_db),
    user: dict = Depends(require_auth),
):
    db_product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not db_product:
        raise HTTPException(status_code=404, detail="Produto não encontrado")
    db.delete(db_product)
    db.commit()
    return {"message": "Produto removido"}


# ─── Schedules ────────────────────────────────────────────────────────────────
@app.get("/api/schedules", response_model=List[Schedule])
def read_schedules(include_unavailable: bool = False, db: Session = Depends(get_db)):
    query = db.query(models.Schedule)
    if not include_unavailable:
        query = query.filter(models.Schedule.is_available == True)
    return query.order_by(models.Schedule.date, models.Schedule.time).all()


@app.post("/api/schedules", response_model=Schedule)
def create_schedule(
    schedule: ScheduleCreate,
    db: Session = Depends(get_db),
    user: dict = Depends(require_auth),
):
    db_schedule = models.Schedule(**schedule.model_dump())
    db.add(db_schedule)
    db.commit()
    db.refresh(db_schedule)
    return db_schedule


@app.post("/api/schedules/book/{schedule_id}")
def book_schedule(
    schedule_id: int,
    body: BookRequest,
    db: Session = Depends(get_db),
    user: dict = Depends(require_auth),
):
    db_schedule = db.query(models.Schedule).filter(models.Schedule.id == schedule_id).first()
    if not db_schedule:
        raise HTTPException(status_code=404, detail="Horário não encontrado")
    if not db_schedule.is_available:
        raise HTTPException(status_code=400, detail="Horário não está mais disponível")

    db_schedule.is_available = False
    db_schedule.client_uid = user["uid"]
    db_schedule.client_name = body.client_name
    db_schedule.client_email = body.client_email
    db.commit()

    # Monta link para o cliente adicionar ao Google Agenda
    from datetime import datetime, timedelta
    dt_start = datetime.combine(db_schedule.date, db_schedule.time)
    dt_end = dt_start + timedelta(hours=1)
    fmt = "%Y%m%dT%H%M%S"
    gcal_link = (
        "https://calendar.google.com/calendar/render?action=TEMPLATE"
        f"&text=Corte+na+Maneirin+Studio"
        f"&dates={dt_start.strftime(fmt)}/{dt_end.strftime(fmt)}"
        f"&details=Agendamento+com+{db_schedule.barber_name}+na+Maneirin+Studio"
        f"&location=R.+Nilópolis,+352+-+Éden,+São+João+de+Meriti+-+RJ"
    )

    return {"message": "Horário reservado", "google_calendar_link": gcal_link}


@app.delete("/api/schedules/{schedule_id}")
def delete_schedule(
    schedule_id: int,
    db: Session = Depends(get_db),
    user: dict = Depends(require_auth),
):
    db_schedule = db.query(models.Schedule).filter(models.Schedule.id == schedule_id).first()
    if not db_schedule:
        raise HTTPException(status_code=404, detail="Horário não encontrado")
    db.delete(db_schedule)
    db.commit()
    return {"message": "Horário removido"}


# ─── Client: My Appointments ─────────────────────────────────────────────────
@app.get("/api/my-appointments", response_model=List[Schedule])
def my_appointments(
    db: Session = Depends(get_db),
    user: dict = Depends(require_auth),
):
    return (
        db.query(models.Schedule)
        .filter(models.Schedule.client_uid == user["uid"])
        .order_by(models.Schedule.date, models.Schedule.time)
        .all()
    )


# ─── Static pages ─────────────────────────────────────────────────────────────
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
    return RedirectResponse(url="/dashboard")


@app.get("/barbeiro/", include_in_schema=False)
def barber_area():
    return RedirectResponse(url="/dashboard")


@app.get("/barbeiro/index.html", include_in_schema=False)
def barber_index_page():
    return FileResponse(BASE_DIR / "barbeiro" / "index.html")


@app.get("/dashboard", include_in_schema=False)
def dashboard_redirect():
    return RedirectResponse(url="/dashboard.html")


@app.get("/dashboard.html", include_in_schema=False)
def dashboard_page():
    return FileResponse(BASE_DIR / "dashboard.html")


@app.get("/minha-conta", include_in_schema=False)
def minha_conta_redirect():
    return RedirectResponse(url="/minha-conta/")


@app.get("/minha-conta/", include_in_schema=False)
def minha_conta_page():
    return FileResponse(BASE_DIR / "minha-conta" / "index.html")


@app.get("/index.html", include_in_schema=False)
def index_page():
    return FileResponse(BASE_DIR / "index.html")


@app.get("/{asset_name}", include_in_schema=False)
def root_asset(asset_name: str):
    allowed_assets = {
        "styles.css",
        "script.js",
        "dashboard.js",
        "client.js",
        "sw.js",
        "manifest.webmanifest",
        "offline.html",
    }
    if asset_name not in allowed_assets:
        raise HTTPException(status_code=404, detail="Arquivo não encontrado")
    return FileResponse(BASE_DIR / asset_name)
