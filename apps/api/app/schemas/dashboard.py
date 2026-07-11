from typing import Literal

from pydantic import BaseModel


class DashboardStat(BaseModel):
    """Espelha `packages/types/src/index.ts::DashboardStat`."""

    id: str
    label: str
    value: str
    delta: str | None = None
    trend: Literal["up", "down", "neutral"] | None = None
    accent: Literal["green", "blue", "purple", "red"]


class DashboardSummary(BaseModel):
    stats: list[DashboardStat]
