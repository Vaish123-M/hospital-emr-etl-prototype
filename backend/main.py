from datetime import date
from pathlib import Path
import tempfile

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from mysql.connector import Error

from .database import get_connection
from .models import (
    INSERT_VISIT,
    INSERT_PATIENT,
    PATIENT_COLUMNS,
    SELECT_ALL_PATIENTS,
    SELECT_PATIENT_BY_ID,
    SELECT_VISITS_BY_PATIENT_ID,
    VISIT_COLUMNS,
)
from .schemas import PatientCreate, PatientResponse, VisitCreate, VisitResponse
from etl.excel_import import process_excel_upload

app = FastAPI(title="Hospital Patient Management API")

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


@app.get("/")
def health_check():
    return {"message": "Hospital API is running"}


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

        result = process_excel_upload(temp_file_path)
        return {
            "file_name": file.filename,
            **result,
        }
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to process Excel file: {exc}")
    finally:
        if temp_file_path is not None and temp_file_path.exists():
            temp_file_path.unlink(missing_ok=True)
