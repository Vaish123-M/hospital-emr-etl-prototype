from collections import Counter
from datetime import date, timedelta
from pathlib import Path
import tempfile
from uuid import uuid4

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from mysql.connector import Error
from pydantic import BaseModel

from .database import get_connection
from .models import (
    INSERT_VISIT,
    INSERT_PATIENT,
    PATIENT_COLUMNS,
    SELECT_PATIENT_OVERVIEW_COUNTS,
    SELECT_ALL_PATIENTS,
    SELECT_PATIENT_BY_ID,
    SELECT_REPEAT_PATIENT_COUNT,
    SELECT_VISIT_SYMPTOMS,
    SELECT_VISIT_TREND_LAST_7_DAYS,
    SELECT_VISITS_BY_PATIENT_ID,
    VISIT_COLUMNS,
)
from .schemas import PatientCreate, PatientResponse, VisitCreate, VisitResponse
from etl.excel_import import analyze_excel_upload, clean_and_import_excel

app = FastAPI(title="Hospital Patient Management API")

UPLOAD_CACHE: dict[str, Path] = {}


class CleanImportRequest(BaseModel):
    upload_id: str

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def row_to_patient_dict(row):
    return dict(zip(PATIENT_COLUMNS, row))


def row_to_visit_dict(row):
    return dict(zip(VISIT_COLUMNS, row))


def normalize_symptom_token(token: str) -> str:
    normalized = token.strip().lower()
    if not normalized:
        return ""
    return " ".join(word.capitalize() for word in normalized.split())


def build_visit_trend(trend_rows):
    today = date.today()
    counts_by_day = {
        (row[0].isoformat() if hasattr(row[0], "isoformat") else str(row[0])): int(row[1])
        for row in trend_rows
    }

    trend = []
    for day_offset in range(6, -1, -1):
        trend_day = today - timedelta(days=day_offset)
        iso_day = trend_day.isoformat()
        trend.append(
            {
                "date": iso_day,
                "label": trend_day.strftime("%a"),
                "visits": counts_by_day.get(iso_day, 0),
            }
        )
    return trend


@app.get("/")
def health_check():
    return {"message": "Hospital API is running"}


@app.get("/analytics/overview")
def analytics_overview():
    connection = None
    cursor = None

    try:
        connection = get_connection()
        cursor = connection.cursor()

        cursor.execute(SELECT_PATIENT_OVERVIEW_COUNTS)
        counts_row = cursor.fetchone() or (0, 0)
        total_patients = int(counts_row[0] or 0)
        new_today = int(counts_row[1] or 0)

        cursor.execute(SELECT_REPEAT_PATIENT_COUNT)
        repeat_patient_row = cursor.fetchone() or (0,)
        repeat_patients = int(repeat_patient_row[0] or 0)

        repeat_visit_rate = round(
            (repeat_patients / total_patients * 100) if total_patients > 0 else 0,
            1,
        )

        cursor.execute(SELECT_VISIT_TREND_LAST_7_DAYS)
        trend_rows = cursor.fetchall()
        visit_trend = build_visit_trend(trend_rows)

        cursor.execute(SELECT_VISIT_SYMPTOMS)
        symptom_rows = cursor.fetchall()
        symptom_counter: Counter[str] = Counter()
        for (symptom_text,) in symptom_rows:
            if not symptom_text:
                continue
            for raw_token in str(symptom_text).replace("/", ",").replace(";", ",").split(","):
                token = normalize_symptom_token(raw_token)
                if token:
                    symptom_counter[token] += 1

        top_symptoms = [
            {"symptom": symptom, "count": count}
            for symptom, count in symptom_counter.most_common(5)
        ]

        return {
            "summary": {
                "total_patients": total_patients,
                "new_today": new_today,
                "repeat_patients": repeat_patients,
                "repeat_visit_rate": repeat_visit_rate,
            },
            "visit_trend": visit_trend,
            "top_symptoms": top_symptoms,
        }
    except Error as exc:
        if getattr(exc, "errno", None) == 2003:
            raise HTTPException(
                status_code=503,
                detail=(
                    "MySQL is not reachable at localhost:3306. "
                    "Start MySQL service and verify DB_* environment variables."
                ),
            )
        raise HTTPException(status_code=500, detail=f"Database error: {exc}")
    finally:
        if cursor is not None:
            cursor.close()
        if connection is not None and connection.is_connected():
            connection.close()


@app.get("/patients", response_model=list[PatientResponse])
def get_patients():
    connection = None
    cursor = None
    try:
        connection = get_connection()
        cursor = connection.cursor()
        cursor.execute(SELECT_ALL_PATIENTS)
        rows = cursor.fetchall()
        return [row_to_patient_dict(row) for row in rows]
    except Error as exc:
        if getattr(exc, "errno", None) == 2003:
            raise HTTPException(
                status_code=503,
                detail=(
                    "MySQL is not reachable at localhost:3306. "
                    "Start MySQL service and verify DB_* environment variables."
                ),
            )
        raise HTTPException(status_code=500, detail=f"Database error: {exc}")
    finally:
        if cursor is not None:
            cursor.close()
        if connection is not None and connection.is_connected():
            connection.close()


@app.get("/patients/{patient_id}", response_model=PatientResponse)
def get_patient_by_id(patient_id: int):
    connection = None
    cursor = None
    try:
        connection = get_connection()
        cursor = connection.cursor()
        cursor.execute(SELECT_PATIENT_BY_ID, (patient_id,))
        row = cursor.fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="Patient not found")
        return row_to_patient_dict(row)
    except Error as exc:
        if getattr(exc, "errno", None) == 2003:
            raise HTTPException(
                status_code=503,
                detail=(
                    "MySQL is not reachable at localhost:3306. "
                    "Start MySQL service and verify DB_* environment variables."
                ),
            )
        raise HTTPException(status_code=500, detail=f"Database error: {exc}")
    finally:
        if cursor is not None:
            cursor.close()
        if connection is not None and connection.is_connected():
            connection.close()


@app.post("/patients", response_model=PatientResponse, status_code=201)
def create_patient(patient: PatientCreate):
    connection = None
    cursor = None
    try:
        connection = get_connection()
        cursor = connection.cursor()

        registration_date = date.today()
        payload = (
            patient.first_name,
            patient.last_name,
            patient.gender,
            patient.date_of_birth,
            patient.phone_number,
            str(patient.email) if patient.email else None,
            patient.address,
            patient.blood_group,
            registration_date,
        )

        cursor.execute(INSERT_PATIENT, payload)
        new_patient_id = cursor.lastrowid
        connection.commit()

        cursor.execute(SELECT_PATIENT_BY_ID, (new_patient_id,))
        row = cursor.fetchone()
        if row is None:
            raise HTTPException(status_code=500, detail="Failed to fetch created patient")
        return row_to_patient_dict(row)
    except Error as exc:
        if connection is not None:
            connection.rollback()
        if getattr(exc, "errno", None) == 2003:
            raise HTTPException(
                status_code=503,
                detail=(
                    "MySQL is not reachable at localhost:3306. "
                    "Start MySQL service and verify DB_* environment variables."
                ),
            )
        if getattr(exc, "errno", None) == 1062:
            raise HTTPException(
                status_code=409,
                detail="Duplicate value detected. Phone number or email already exists.",
            )
        raise HTTPException(status_code=500, detail=f"Database error: {exc}")
    finally:
        if cursor is not None:
            cursor.close()
        if connection is not None and connection.is_connected():
            connection.close()


@app.get("/patients/{patient_id}/visits", response_model=list[VisitResponse])
def get_patient_visits(patient_id: int):
    connection = None
    cursor = None
    try:
        connection = get_connection()
        cursor = connection.cursor()

        cursor.execute(SELECT_PATIENT_BY_ID, (patient_id,))
        patient_row = cursor.fetchone()
        if patient_row is None:
            raise HTTPException(status_code=404, detail="Patient not found")

        cursor.execute(SELECT_VISITS_BY_PATIENT_ID, (patient_id,))
        rows = cursor.fetchall()
        return [row_to_visit_dict(row) for row in rows]
    except Error as exc:
        if getattr(exc, "errno", None) == 2003:
            raise HTTPException(
                status_code=503,
                detail=(
                    "MySQL is not reachable at localhost:3306. "
                    "Start MySQL service and verify DB_* environment variables."
                ),
            )
        raise HTTPException(status_code=500, detail=f"Database error: {exc}")
    finally:
        if cursor is not None:
            cursor.close()
        if connection is not None and connection.is_connected():
            connection.close()


@app.post("/visits", response_model=VisitResponse, status_code=201)
def create_visit(visit: VisitCreate):
    connection = None
    cursor = None
    try:
        connection = get_connection()
        cursor = connection.cursor()

        cursor.execute(SELECT_PATIENT_BY_ID, (visit.patient_id,))
        patient_row = cursor.fetchone()
        if patient_row is None:
            raise HTTPException(status_code=404, detail="Patient not found")

        payload = (
            visit.patient_id,
            visit.doctor_name,
            visit.symptoms,
            visit.visit_date,
        )

        cursor.execute(INSERT_VISIT, payload)
        visit_id = cursor.lastrowid
        connection.commit()

        return {
            "visit_id": visit_id,
            "patient_id": visit.patient_id,
            "doctor_name": visit.doctor_name,
            "symptoms": visit.symptoms,
            "visit_date": visit.visit_date,
        }
    except Error as exc:
        if connection is not None:
            connection.rollback()
        if getattr(exc, "errno", None) == 2003:
            raise HTTPException(
                status_code=503,
                detail=(
                    "MySQL is not reachable at localhost:3306. "
                    "Start MySQL service and verify DB_* environment variables."
                ),
            )
        raise HTTPException(status_code=500, detail=f"Database error: {exc}")
    finally:
        if cursor is not None:
            cursor.close()
        if connection is not None and connection.is_connected():
            connection.close()


@app.post("/upload-excel")
async def upload_excel(file: UploadFile = File(...)):
    extension = Path(file.filename or "").suffix.lower()
    if extension not in {".xlsx", ".xls"}:
        raise HTTPException(status_code=400, detail="Only .xlsx and .xls files are supported.")

    temp_file_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=extension) as temp_file:
            temp_file_path = Path(temp_file.name)
            temp_file.write(await file.read())

        upload_id = str(uuid4())
        UPLOAD_CACHE[upload_id] = temp_file_path

        result = analyze_excel_upload(temp_file_path)
        return {
            "upload_id": upload_id,
            "file_name": file.filename,
            **result,
        }
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to process Excel file: {exc}")


@app.post("/clean-import-data")
def clean_import_data(payload: CleanImportRequest):
    upload_id = payload.upload_id
    temp_file_path = UPLOAD_CACHE.get(upload_id)

    if temp_file_path is None:
        raise HTTPException(
            status_code=404,
            detail="Upload session not found. Please upload the Excel file again.",
        )

    if not temp_file_path.exists():
        UPLOAD_CACHE.pop(upload_id, None)
        raise HTTPException(
            status_code=404,
            detail="Temporary upload file is no longer available. Please upload again.",
        )

    try:
        result = clean_and_import_excel(temp_file_path)
        return result
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to import cleaned records: {exc}")
    finally:
        UPLOAD_CACHE.pop(upload_id, None)
        if temp_file_path.exists():
            temp_file_path.unlink(missing_ok=True)
