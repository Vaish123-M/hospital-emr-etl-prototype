"""Load cleaned patient records from Excel into MySQL."""

import os
from pathlib import Path

import mysql.connector
import pandas as pd
from mysql.connector import Error

from data_profiling import load_and_normalize_excel, normalize_column_name
from logging_config import setup_logger


EXCEL_PATH = Path(__file__).resolve().parents[1] / "sample_data" / "patients.xlsx"
LOGGER = setup_logger("etl.ingest")


def get_db_config() -> dict:
    db_port = os.getenv("DB_PORT", "3306")
    if not db_port.isdigit():
        raise ValueError("DB_PORT must be a valid integer.")

    return {
        "host": os.getenv("DB_HOST", "localhost"),
        "port": int(db_port),
        "database": os.getenv("DB_NAME", "hospital_db"),
        "user": os.getenv("DB_USER", "root"),
        "password": os.getenv("DB_PASSWORD", ""),
    }


def load_patients_dataframe(excel_path: Path = EXCEL_PATH) -> pd.DataFrame:
    """Read and clean patient data from Excel into a canonical dataframe."""
    df = load_and_normalize_excel(excel_path)

    required_columns = ["first_name", "last_name", "phone_number", "date_of_birth"]
    optional_columns = [
        "patient_id",
        "gender",
        "email",
        "address",
        "blood_group",
        "registration_date",
    ]

    missing_columns = [column for column in required_columns if column not in df.columns]
    if missing_columns:
        raise ValueError(f"Missing required columns in Excel file: {missing_columns}")

    for column in optional_columns:
        if column not in df.columns:
            df[column] = None

    df["first_name"] = df["first_name"].astype(str).str.strip().str.title()
    df["last_name"] = df["last_name"].astype(str).str.strip().str.title()
    df["phone_number"] = df["phone_number"].astype(str).str.replace(r"\D", "", regex=True)
    df["email"] = df["email"].astype(str).str.strip().str.lower()
    df["gender"] = (
        df["gender"]
        .astype(str)
        .str.strip()
        .str.lower()
        .replace({"m": "male", "f": "female", "o": "other"})
        .str.title()
    )

    df["blood_group"] = df["blood_group"].astype(str).str.strip().str.upper()

    # Parse date fields and normalize to YYYY-MM-DD.
    df["date_of_birth"] = pd.to_datetime(
        df["date_of_birth"], dayfirst=True, errors="coerce"
    ).dt.strftime("%Y-%m-%d")
    df["registration_date"] = pd.to_datetime(
        df["registration_date"], dayfirst=True, errors="coerce"
    ).dt.strftime("%Y-%m-%d")

    today_iso = pd.Timestamp.today().strftime("%Y-%m-%d")
    df["registration_date"] = df["registration_date"].fillna(today_iso)

    # Turn obvious placeholders into null-like values before deduplication.
    df = df.replace(
        {
            "": None,
            "nan": None,
            "none": None,
            "NaN": None,
            "None": None,
        }
    )

    # Remove duplicates by strong identifiers to avoid redundant patient rows.
    if "phone_number" in df.columns:
        df = df.drop_duplicates(subset=["phone_number"], keep="first")
    if "email" in df.columns:
        df = df.drop_duplicates(subset=["email"], keep="first")

    return df.where(pd.notnull(df), None)


def run_patient_ingestion(df: pd.DataFrame) -> int:
    """Insert cleaned patient rows into MySQL and return inserted count."""
    connection = None
    cursor = None
    records_inserted = 0

    try:
        connection = mysql.connector.connect(**get_db_config())
        if not connection.is_connected():
            raise RuntimeError("Failed to connect to MySQL database.")

        cursor = connection.cursor()
        has_patient_id = "patient_id" in df.columns and df["patient_id"].notna().any()

        insert_query_with_id = """
            INSERT IGNORE INTO patients (
                patient_id,
                first_name,
                last_name,
                gender,
                date_of_birth,
                phone_number,
                email,
                address,
                blood_group,
                registration_date
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """

        insert_query_without_id = """
            INSERT IGNORE INTO patients (
                first_name,
                last_name,
                gender,
                date_of_birth,
                phone_number,
                email,
                address,
                blood_group,
                registration_date
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        """

        if has_patient_id:
            ordered_columns = [
                "patient_id",
                "first_name",
                "last_name",
                "gender",
                "date_of_birth",
                "phone_number",
                "email",
                "address",
                "blood_group",
                "registration_date",
            ]
            query = insert_query_with_id
        else:
            ordered_columns = [
                "first_name",
                "last_name",
                "gender",
                "date_of_birth",
                "phone_number",
                "email",
                "address",
                "blood_group",
                "registration_date",
            ]
            query = insert_query_without_id

        for row in df[ordered_columns].itertuples(index=False, name=None):
            cursor.execute(query, row)
            records_inserted += cursor.rowcount

        connection.commit()
        return records_inserted
    finally:
        if cursor is not None:
            cursor.close()
        if connection is not None and connection.is_connected():
            connection.close()


def load_visits_dataframe(excel_path: Path = EXCEL_PATH) -> pd.DataFrame:
    """Read and clean optional visits sheet from Excel workbook."""
    try:
        visits_df = pd.read_excel(excel_path, sheet_name="visits")
    except ValueError:
        # Sheet does not exist; returning empty dataframe keeps pipeline backward compatible.
        return pd.DataFrame(columns=["patient_id", "doctor_name", "symptoms", "visit_date"])

    visits_df.columns = [normalize_column_name(column) for column in visits_df.columns]

    required_columns = ["doctor_name", "visit_date"]
    missing_columns = [column for column in required_columns if column not in visits_df.columns]
    if missing_columns:
        raise ValueError(f"Missing required columns in visits sheet: {missing_columns}")

    if "patient_id" not in visits_df.columns:
        visits_df["patient_id"] = None
    if "phone_number" not in visits_df.columns:
        visits_df["phone_number"] = None
    if "email" not in visits_df.columns:
        visits_df["email"] = None
    if "symptoms" not in visits_df.columns:
        visits_df["symptoms"] = None

    visits_df["doctor_name"] = visits_df["doctor_name"].astype(str).str.strip().str.title()
    visits_df["symptoms"] = visits_df["symptoms"].astype(str).str.strip()
    visits_df["phone_number"] = (
        visits_df["phone_number"].astype(str).str.replace(r"\D", "", regex=True)
    )
    visits_df["email"] = visits_df["email"].astype(str).str.strip().str.lower()
    visits_df["visit_date"] = pd.to_datetime(
        visits_df["visit_date"], dayfirst=True, errors="coerce"
    ).dt.strftime("%Y-%m-%d")

    visits_df = visits_df.replace(
        {
            "": None,
            "nan": None,
            "none": None,
            "NaN": None,
            "None": None,
        }
    )

    # Visits without a valid date cannot be stored in the schema.
    visits_df = visits_df[visits_df["visit_date"].notna()].copy()
    return visits_df.where(pd.notnull(visits_df), None)


def run_visit_ingestion(df: pd.DataFrame) -> int:
    """Insert visit rows into MySQL and return inserted count."""
    if df.empty:
        return 0

    connection = None
    cursor = None
    inserted = 0

    try:
        connection = mysql.connector.connect(**get_db_config())
        if not connection.is_connected():
            raise RuntimeError("Failed to connect to MySQL database.")
        cursor = connection.cursor()

        select_patient_by_phone = "SELECT patient_id FROM patients WHERE phone_number = %s LIMIT 1"
        select_patient_by_email = "SELECT patient_id FROM patients WHERE email = %s LIMIT 1"
        insert_visit_query = """
            INSERT INTO visits (patient_id, doctor_name, symptoms, visit_date)
            VALUES (%s, %s, %s, %s)
        """

        for row in df.itertuples(index=False):
            patient_id = row.patient_id

            if patient_id is None and row.phone_number:
                cursor.execute(select_patient_by_phone, (row.phone_number,))
                result = cursor.fetchone()
                patient_id = result[0] if result else None

            if patient_id is None and row.email:
                cursor.execute(select_patient_by_email, (row.email,))
                result = cursor.fetchone()
                patient_id = result[0] if result else None

            if patient_id is None:
                continue

            payload = (patient_id, row.doctor_name, row.symptoms, row.visit_date)
            cursor.execute(insert_visit_query, payload)
            inserted += cursor.rowcount

        connection.commit()
        return inserted
    finally:
        if cursor is not None:
            cursor.close()
        if connection is not None and connection.is_connected():
            connection.close()


def main() -> None:
    try:
        LOGGER.info("Starting patient Excel ingestion: %s", EXCEL_PATH)
        patient_df = load_patients_dataframe(EXCEL_PATH)
        patient_inserted = run_patient_ingestion(patient_df)
        LOGGER.info("Patient ingestion completed. Records inserted: %s", patient_inserted)

        visit_df = load_visits_dataframe(EXCEL_PATH)
        visit_inserted = run_visit_ingestion(visit_df)
        LOGGER.info("Visit ingestion completed. Records inserted: %s", visit_inserted)
    except (Error, ValueError, FileNotFoundError, RuntimeError) as exc:
        LOGGER.exception("ETL ingestion failed: %s", exc)


if __name__ == "__main__":
    main()
