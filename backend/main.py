from datetime import date

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from mysql.connector import Error

from .database import get_connection
from .models import (
    INSERT_PATIENT,
    PATIENT_COLUMNS,
    SELECT_ALL_PATIENTS,
    SELECT_NEXT_PATIENT_ID,
    SELECT_PATIENT_BY_ID,
)
from .schemas import PatientCreate, PatientResponse

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

        cursor.execute(SELECT_NEXT_PATIENT_ID)
        next_id = cursor.fetchone()[0]

        registration_date = date.today()
        payload = (
            next_id,
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
        connection.commit()

        return {
            "patient_id": next_id,
            "first_name": patient.first_name,
            "last_name": patient.last_name,
            "gender": patient.gender,
            "date_of_birth": patient.date_of_birth,
            "phone_number": patient.phone_number,
            "email": patient.email,
            "address": patient.address,
            "blood_group": patient.blood_group,
            "registration_date": registration_date,
        }
    except Error as exc:
        if connection is not None:
            connection.rollback()
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
