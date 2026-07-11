from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Base declarativa do SQLAlchemy. Todos os modelos em app/models herdam daqui."""

    pass
