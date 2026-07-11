from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings

# echo=False por padrão; ativar via settings quando for depurar queries.
engine = create_engine(settings.DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Generator[Session, None, None]:
    """
    Dependency do FastAPI para obter uma sessão de banco por request.

    Fase 1: esta dependency existe e está pronta, mas nenhum endpoint ativo
    a utiliza ainda — os endpoints de auth/dashboard respondem com dados
    estáticos até a Fase 2 conectar o PostgreSQL de fato.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
