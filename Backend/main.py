from __future__ import annotations

from datetime import datetime, date
import os
from pathlib import Path
from zoneinfo import ZoneInfo

import psycopg2
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field


load_dotenv(override=True)

APP_TIMEZONE = ZoneInfo(os.getenv("APP_TIMEZONE", "America/Mazatlan"))
STATIC_DIR = Path(__file__).resolve().parent / "static"


def today_local() -> date:
    return datetime.now(APP_TIMEZONE).date()

app = FastAPI(title="Push-ups Challenge API", version="1.0.0")


class TodayResponse(BaseModel):
    day_number: int
    target_count: int
    current_count: int


class AddPushupsRequest(BaseModel):
    amount: int = Field(..., gt=0, description="Cantidad a sumar")
    day_number: int = Field(..., ge=1, le=366, description="Dia del reto")


def get_db_config() -> dict:
    return {
        "host": os.getenv("POSTGRES_HOST"),
        "port": int(os.getenv("POSTGRES_PORT")),
        "dbname": os.getenv("POSTGRES_DB"),
        "user": os.getenv("POSTGRES_USER"),
        "password": os.getenv("POSTGRES_PASSWORD"),
    }


def validate_config(config: dict) -> None:
    missing = [k for k in ("dbname", "user", "password") if not config.get(k)]
    if missing:
        raise RuntimeError(
            f"Faltan variables de entorno obligatorias: {', '.join(missing)}"
        )


def get_connection():
    config = get_db_config()
    validate_config(config)
    return psycopg2.connect(**config)


def get_today_record(conn, today: date) -> tuple[int, int]:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT day_number, current_count
            FROM personal."PushUpsChallenge"
            WHERE record_date = %s;
            """,
            (today,),
        )
        row = cur.fetchone()

    if not row:
        raise RuntimeError("No existe registro para la fecha actual.")

    return int(row[0]), int(row[1] or 0)


@app.get("/api/today", response_model=TodayResponse)
def load_today() -> TodayResponse:
    today = today_local()

    try:
        with get_connection() as conn:
            day_number, current_count = get_today_record(conn, today)
            conn.commit()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Error leyendo datos: {exc}") from exc

    return TodayResponse(
        day_number=day_number,
        target_count=day_number,
        current_count=current_count,
    )


@app.post("/api/add", response_model=TodayResponse)
def add_pushups(payload: AddPushupsRequest) -> TodayResponse:
    today = today_local()

    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE personal."PushUpsChallenge"
                    SET
                        current_count = LEAST(COALESCE(current_count, 0) + %s, day_number)
                    WHERE record_date = %s
                    RETURNING day_number, current_count;
                    """,
                    (payload.amount, today),
                )
                row = cur.fetchone()

            if not row:
                raise RuntimeError("No se pudo actualizar el conteo del dia actual.")

            conn.commit()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Error guardando datos: {exc}") from exc

    return TodayResponse(
        day_number=int(row[0]),
        target_count=int(row[0]),
        current_count=int(row[1] or 0),
    )


if STATIC_DIR.is_dir():
    app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")
else:
    print(f"[startup] WARN: static dir not found at {STATIC_DIR} — frontend no se servirá")
