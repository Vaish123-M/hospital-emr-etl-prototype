"""Utilities to profile, clean, and import uploaded EMR Excel files."""

from __future__ import annotations

from datetime import date
from pathlib import Path

import mysql.connector
import pandas as pd
from mysql.connector import Error

from backend.database import get_db_config
from etl.data_profiling import COLUMN_ALIASES


IMPORT_COLUMN_ALIASES = {
    **COLUMN_ALIASES,
    "name": "first_name",
    "blood group": "blood_group",
}

CANONICAL_COLUMNS = [
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


def normalize_column_name(column_name: str) -> str:
    normalized = column_name.strip().lower().replace("_", " ")
    mapped = IMPORT_COLUMN_ALIASES.get(normalized, normalized)
    return mapped.replace(" ", "_")


def _to_json_records(df: pd.DataFrame, limit: int = 10) -> tuple[list[str], list[dict]]:
    preview_df = df.head(limit).copy()
    preview_df = preview_df.where(pd.notnull(preview_df), None)
    return list(preview_df.columns), preview_df.to_dict(orient="records")


def profile_dataframe(raw_df: pd.DataFrame) -> dict:
    missing_values = {column: int(count) for column, count in raw_df.isna().sum().items()}

    duplicate_phone_entries = 0
    if "phone_number" in raw_df.columns:
        phone = raw_df["phone_number"].astype(str).str.replace(r"\D", "", regex=True)
        phone = phone.replace("", pd.NA).dropna()
        duplicate_phone_entries = int(phone.duplicated().sum())

    duplicate_email_entries = 0
    if "email" in raw_df.columns:
        email = raw_df["email"].astype(str).str.strip().str.lower()
        email = email.replace("", pd.NA).dropna()
        duplicate_email_entries = int(email.duplicated().sum())

    invalid_date_formats = 0
    if "date_of_birth" in raw_df.columns:
        dob = raw_df["date_of_birth"]
        parsed = pd.to_datetime(dob, dayfirst=True, errors="coerce")
        invalid_date_formats = int((dob.notna() & parsed.isna()).sum())

    return {
        "total_records": int(len(raw_df)),
        "missing_values": missing_values,
        "duplicate_phone_entries": duplicate_phone_entries,
        "duplicate_email_entries": duplicate_email_entries,
        "invalid_date_formats": invalid_date_formats,
    }


def clean_and_transform_dataframe(raw_df: pd.DataFrame) -> pd.DataFrame:
    df = raw_df.copy()

    for column in CANONICAL_COLUMNS:
        if column not in df.columns:
            df[column] = None

    df["first_name"] = df["first_name"].astype(str).str.strip()
    df["last_name"] = df["last_name"].astype(str).str.strip()

    # If source has a single full name column mapped to first_name, split it.
    full_name_parts = df["first_name"].str.split(n=1, expand=True)
    df["first_name"] = full_name_parts[0]
    if 1 in full_name_parts.columns:
        missing_last_name = df["last_name"].isna() | (df["last_name"] == "")
        df.loc[missing_last_name, "last_name"] = full_name_parts[1]

    df["first_name"] = df["first_name"].replace({"": None, "nan": None, "None": None})
    df["last_name"] = df["last_name"].replace({"": None, "nan": None, "None": None})
    df["last_name"] = df["last_name"].fillna("Unknown")

    df["first_name"] = df["first_name"].astype(str).str.strip().str.title()
    df["last_name"] = df["last_name"].astype(str).str.strip().str.title()

    df["gender"] = (
        df["gender"]
        .astype(str)
        .str.strip()
        .str.lower()
        .replace({"m": "male", "f": "female", "o": "other"})
        .str.title()
    )

    df["phone_number"] = df["phone_number"].astype(str).str.replace(r"\D", "", regex=True)
    df["email"] = df["email"].astype(str).str.strip().str.lower()
    df["address"] = df["address"].astype(str).str.strip()
    df["blood_group"] = df["blood_group"].astype(str).str.strip().str.upper()

    df["date_of_birth"] = pd.to_datetime(df["date_of_birth"], dayfirst=True, errors="coerce").dt.strftime(
        "%Y-%m-%d"
    )

    df["registration_date"] = pd.to_datetime(
        df["registration_date"], dayfirst=True, errors="coerce"
    ).dt.strftime("%Y-%m-%d")
    df["registration_date"] = df["registration_date"].fillna(date.today().isoformat())

    df = df.replace(
        {
            "": None,
            "nan": None,
            "none": None,
            "NaN": None,
            "None": None,
        }
    )

    # Keep only rows that can satisfy table required fields.
    df = df[df["first_name"].notna() & df["last_name"].notna() & df["phone_number"].notna()]

    df = df.drop_duplicates(subset=["phone_number"], keep="first")
    df = df.drop_duplicates(subset=["email"], keep="first")

    return df[CANONICAL_COLUMNS].where(pd.notnull(df[CANONICAL_COLUMNS]), None)


def import_patients(clean_df: pd.DataFrame) -> int:
    if clean_df.empty:
        return 0

    insert_query = """
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

    connection = None
    cursor = None
    try:
        connection = mysql.connector.connect(**get_db_config())
        cursor = connection.cursor()

        rows = [tuple(row) for row in clean_df[CANONICAL_COLUMNS].itertuples(index=False, name=None)]
        cursor.executemany(insert_query, rows)
        connection.commit()
        return int(cursor.rowcount)
    except Error as exc:
        if connection is not None:
            connection.rollback()
        raise RuntimeError(f"Failed to import cleaned records into MySQL: {exc}") from exc
    finally:
        if cursor is not None:
            cursor.close()
        if connection is not None and connection.is_connected():
            connection.close()


def process_excel_upload(file_path: Path) -> dict:
    raw_df = pd.read_excel(file_path)
    raw_df.columns = [normalize_column_name(column) for column in raw_df.columns]

    preview_columns, preview_rows = _to_json_records(raw_df, limit=10)
    quality_report = profile_dataframe(raw_df)

    clean_df = clean_and_transform_dataframe(raw_df)
    inserted = import_patients(clean_df)

    return {
        "preview_columns": preview_columns,
        "preview_rows": preview_rows,
        "data_quality_report": quality_report,
        "import_summary": {
            "records_after_cleaning": int(len(clean_df)),
            "records_inserted": inserted,
        },
    }