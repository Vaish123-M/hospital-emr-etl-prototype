from collections import Counter
from datetime import date, timedelta
import json
import os
from pathlib import Path
import tempfile
from uuid import uuid4

from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from mysql.connector import Error
from pydantic import BaseModel

from .database import get_connection
from .models import (
    ALTER_VISITS_ADD_FOLLOW_UP_DATE,
    ALTER_VISITS_ADD_MEDICATIONS,
    CREATE_AUDIT_LOGS_TABLE,
    INSERT_VISIT,
    INSERT_AUDIT_LOG,
    INSERT_PATIENT,
    PATIENT_COLUMNS,
    SELECT_AUDIT_BY_PATIENT_ID,
    SELECT_DOCTOR_WORKLOAD,
    SELECT_FOLLOW_UP_REMINDERS,
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
from etl.excel_import import analyze_excel_upload, clean_and_import_excel, validate_and_get_invalid_rows

app = FastAPI(title="Hospital Patient Management API")

UPLOAD_CACHE: dict[str, Path] = {}


class CleanImportRequest(BaseModel):
    upload_id: str


def get_allowed_origins() -> list[str]:
    origins = os.getenv("CORS_ORIGINS")
    if origins:
        parsed = [origin.strip() for origin in origins.split(",") if origin.strip()]
        if parsed:
            return parsed
    return ["http://localhost:5173", "http://127.0.0.1:5173"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_allowed_origins(),
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


def build_follow_up_reminders(reminder_rows):
    overdue_follow_ups = []
    due_soon_follow_ups = []

    for row in reminder_rows:
        days_until_follow_up = int(row[5] or 0)
        reminder = {
            "visit_id": int(row[0]),
            "patient_id": int(row[1]),
            "patient_name": row[2] or "Unknown patient",
            "doctor_name": row[3] or "Unknown",
            "follow_up_date": row[4].isoformat() if hasattr(row[4], "isoformat") else str(row[4]),
            "days_until_follow_up": days_until_follow_up,
        }

        if days_until_follow_up < 0:
            overdue_follow_ups.append(reminder)
        elif days_until_follow_up <= 7:
            due_soon_follow_ups.append(reminder)

    return {
        "overdue_count": len(overdue_follow_ups),
        "due_soon_count": len(due_soon_follow_ups),
        "overdue_follow_ups": overdue_follow_ups[:5],
        "due_soon_follow_ups": due_soon_follow_ups[:5],
    }


def calculate_age(dob_value):
    if dob_value is None:
        return None
    today = date.today()
    return today.year - dob_value.year - ((today.month, today.day) < (dob_value.month, dob_value.day))


def compute_triage(patient: dict, visits: list[dict]) -> dict:
    age = calculate_age(patient.get("date_of_birth"))
    repeat_visits = len(visits)
    symptom_text = " ".join((visit.get("symptoms") or "") for visit in visits).lower()

    score = 0
    reasons = []

    if age is not None and age >= 60:
        score += 2
        reasons.append("Age 60+")

    high_risk_keywords = [
        "chest pain",
        "breathless",
        "breathing",
        "stroke",
        "severe",
        "unconscious",
        "high fever",
    ]
    if any(keyword in symptom_text for keyword in high_risk_keywords):
        score += 3
        reasons.append("Critical symptom keyword detected")

    if repeat_visits >= 3:
        score += 2
        reasons.append("Frequent repeat visits")
    elif repeat_visits >= 2:
        score += 1
        reasons.append("Multiple repeat visits")

    if score >= 4:
        risk = "red"
    elif score >= 2:
        risk = "amber"
    else:
        risk = "green"

    return {
        "risk": risk,
        "score": score,
        "age": age,
        "repeat_visits": repeat_visits,
        "reasons": reasons,
    }


def log_audit_event(connection, entity_type: str, entity_id: int | None, action: str, changed_by: str, details: dict):
    cursor = connection.cursor()
    try:
        cursor.execute(
            INSERT_AUDIT_LOG,
            (
                entity_type,
                entity_id,
                action,
                changed_by,
                json.dumps(details),
            ),
        )
    finally:
        cursor.close()


@app.on_event("startup")
def ensure_schema_extensions():
    connection = None
    cursor = None
    try:
        connection = get_connection()
        cursor = connection.cursor()
        cursor.execute(ALTER_VISITS_ADD_MEDICATIONS)
        cursor.execute(ALTER_VISITS_ADD_FOLLOW_UP_DATE)
        cursor.execute(CREATE_AUDIT_LOGS_TABLE)
        connection.commit()
    except Error:
        # Keep API booting even if DB is temporarily unavailable.
        pass
    finally:
        if cursor is not None:
            cursor.close()
        if connection is not None and connection.is_connected():
            connection.close()


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

        cursor.execute(SELECT_DOCTOR_WORKLOAD)
        doctor_workload = [
            {"doctor_name": row[0], "visit_count": int(row[1])}
            for row in cursor.fetchall()
        ]

        cursor.execute(SELECT_FOLLOW_UP_REMINDERS)
        follow_up_reminders = build_follow_up_reminders(cursor.fetchall())

        return {
            "summary": {
                "total_patients": total_patients,
                "new_today": new_today,
                "repeat_patients": repeat_patients,
                "repeat_visit_rate": repeat_visit_rate,
            },
            "visit_trend": visit_trend,
            "top_symptoms": top_symptoms,
            "doctor_workload": doctor_workload,
            "follow_up_reminders": follow_up_reminders,
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


@app.get("/patients/{patient_id}/risk")
def get_patient_risk(patient_id: int):
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
        visit_rows = cursor.fetchall()

        patient = row_to_patient_dict(patient_row)
        visits = [row_to_visit_dict(row) for row in visit_rows]
        return compute_triage(patient, visits)
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


@app.get("/patients/{patient_id}/timeline")
def get_patient_timeline(patient_id: int):
    connection = None
    cursor = None
    try:
        connection = get_connection()
        cursor = connection.cursor()

        cursor.execute(SELECT_PATIENT_BY_ID, (patient_id,))
        patient_row = cursor.fetchone()
        if patient_row is None:
            raise HTTPException(status_code=404, detail="Patient not found")

        patient = row_to_patient_dict(patient_row)
        events = [
            {
                "event_type": "registration",
                "event_date": patient.get("registration_date"),
                "title": "Patient Registered",
                "details": {
                    "name": f"{patient.get('first_name', '')} {patient.get('last_name', '')}".strip(),
                    "phone_number": patient.get("phone_number"),
                    "blood_group": patient.get("blood_group"),
                },
            }
        ]

        cursor.execute(SELECT_VISITS_BY_PATIENT_ID, (patient_id,))
        visit_rows = cursor.fetchall()
        for visit in [row_to_visit_dict(row) for row in visit_rows]:
            events.append(
                {
                    "event_type": "visit",
                    "event_date": visit.get("visit_date"),
                    "title": f"Visit with Dr. {visit.get('doctor_name') or 'Unknown'}",
                    "details": {
                        "symptoms": visit.get("symptoms"),
                        "medications": visit.get("medications"),
                        "follow_up_date": visit.get("follow_up_date"),
                    },
                }
            )

        cursor.execute(SELECT_AUDIT_BY_PATIENT_ID, (patient_id, patient_id))
        for audit_row in cursor.fetchall():
            events.append(
                {
                    "event_type": "audit",
                    "event_date": audit_row[5],
                    "title": f"{audit_row[1]}: {audit_row[3]}",
                    "details": {
                        "changed_by": audit_row[4],
                        "payload": audit_row[6],
                    },
                }
            )

        events.sort(
            key=lambda event: (
                event.get("event_date") is None,
                str(event.get("event_date") or ""),
            ),
            reverse=True,
        )
        return {"patient_id": patient_id, "timeline": events}
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
def create_patient(patient: PatientCreate, request: Request):
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

        changed_by = request.headers.get("X-User", "system")
        log_audit_event(
            connection,
            "patient",
            new_patient_id,
            "create",
            changed_by,
            {
                "first_name": patient.first_name,
                "last_name": patient.last_name,
                "phone_number": patient.phone_number,
            },
        )
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
def create_visit(visit: VisitCreate, request: Request):
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
            visit.medications,
            visit.follow_up_date,
            visit.visit_date,
        )

        cursor.execute(INSERT_VISIT, payload)
        visit_id = cursor.lastrowid

        changed_by = request.headers.get("X-User", "system")
        log_audit_event(
            connection,
            "visit",
            visit_id,
            "create",
            changed_by,
            {
                "patient_id": visit.patient_id,
                "doctor_name": visit.doctor_name,
                "visit_date": str(visit.visit_date),
            },
        )
        connection.commit()

        return {
            "visit_id": visit_id,
            "patient_id": visit.patient_id,
            "doctor_name": visit.doctor_name,
            "symptoms": visit.symptoms,
            "medications": visit.medications,
            "follow_up_date": visit.follow_up_date,
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
