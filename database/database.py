# pyrefly: ignore [missing-import]
from sqlalchemy import create_engine
from sqlalchemy.engine import make_url
# pyrefly: ignore [missing-import]
from sqlalchemy.orm import DeclarativeBase, sessionmaker
import os
from urllib.parse import quote_plus


LOCAL_DATABASE_URL = "sqlite:///./sql_app.db"


def _running_on_railway() -> bool:
    return any(key.startswith("RAILWAY_") for key in os.environ)


def _postgres_url_from_pg_vars() -> str | None:
    user = os.getenv("PGUSER")
    password = os.getenv("PGPASSWORD")
    host = os.getenv("PGHOST")
    port = os.getenv("PGPORT", "5432")
    database = os.getenv("PGDATABASE")

    if not all([user, password, host, database]):
        return None

    return (
        f"postgresql://{quote_plus(user)}:{quote_plus(password)}"
        f"@{host}:{port}/{database}"
    )


def _normalize_database_url(url: str) -> str:
    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql://", 1)
    return url


def _resolve_database_url() -> str:
    url = (
        os.getenv("DATABASE_URL")
        or os.getenv("DATABASE_PRIVATE_URL")
        or os.getenv("DATABASE_PUBLIC_URL")
        or os.getenv("POSTGRES_URL")
        or _postgres_url_from_pg_vars()
    )

    if url:
        return _normalize_database_url(url)

    if _running_on_railway():
        raise RuntimeError(
            "Banco de dados não configurado na Railway. "
            "Adicione DATABASE_URL ou conecte as variáveis do serviço PostgreSQL ao serviço web."
        )

    return LOCAL_DATABASE_URL


SQLALCHEMY_DATABASE_URL = _resolve_database_url()
_url = make_url(SQLALCHEMY_DATABASE_URL)

engine_options = {}
if _url.get_backend_name().startswith("sqlite"):
    engine_options["connect_args"] = {"check_same_thread": False}
else:
    engine_options["pool_pre_ping"] = True

engine = create_engine(SQLALCHEMY_DATABASE_URL, **engine_options)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def database_public_info() -> dict:
    url = make_url(SQLALCHEMY_DATABASE_URL)
    return {
        "dialect": url.get_backend_name(),
        "database": url.database,
        "host": url.host,
        "is_local_sqlite": url.get_backend_name().startswith("sqlite"),
    }


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
