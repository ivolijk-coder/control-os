from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Configuração central da API do CONTROL OS.

    Lida a partir de variáveis de ambiente / .env (ver .env.example). Fase 1:
    a aplicação sobe com esta configuração, mas nenhuma rota ainda depende de
    conexão real com PostgreSQL ou de uma chave de IA válida.
    """

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    PROJECT_NAME: str = "CONTROL OS API"
    API_V1_PREFIX: str = "/api/v1"
    ENVIRONMENT: str = "development"

    # PostgreSQL
    POSTGRES_USER: str = "control_os"
    POSTGRES_PASSWORD: str = "control_os_dev"
    POSTGRES_DB: str = "control_os"
    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: str = "5432"
    DATABASE_URL: str = "postgresql+psycopg2://control_os:control_os_dev@localhost:5432/control_os"

    # Autenticação
    SECRET_KEY: str = "change-me-in-production"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    ALGORITHM: str = "HS256"

    # CORS
    CORS_ORIGINS: str = "http://localhost:3000"

    # IA — reservado para fases futuras (Control AI Router™)
    OPENAI_API_KEY: str = ""

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
