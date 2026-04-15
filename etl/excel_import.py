"""Utilities to profile, clean, and import uploaded EMR Excel files."""

from __future__ import annotations

from datetime import date
from pathlib import Path
from difflib import SequenceMatcher
from typing import Any

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


def _log(logs: list[str], message: str) -> None:
    logs.append(f"[INFO] {message}")


def normalize_column_name(column_name: str) -> str:
    normalized = column_name.strip().lower().replace("_", " ")
    mapped = IMPORT_COLUMN_ALIASES.get(normalized, normalized)
    return mapped.replace(" ", "_")


def _to_json_records(df: pd.DataFrame, limit: int = 10) -> tuple[list[str], list[dict]]:
    preview_df = df.head(limit).copy()
    preview_df = preview_df.where(pd.notnull(preview_df), None)
    return list(preview_df.columns), preview_df.to_dict(orient="records")


def _name_similarity(a: str | None, b: str | None) -> float:
    left = (a or "").strip().lower()
    right = (b or "").strip().lower()
    if not left or not right:
        return 0.0
    return SequenceMatcher(None, left, right).ratio()


def drop_fuzzy_duplicates(df: pd.DataFrame) -> tuple[pd.DataFrame, int]:
    records = df.to_dict(orient="records")
    keep_indexes: list[int] = []
    fuzzy_removed = 0

    for idx, row in enumerate(records):
        is_duplicate = False
        for kept_idx in keep_indexes:
            kept = records[kept_idx]

            same_phone = (
                bool(row.get("phone_number"))
                and bool(kept.get("phone_number"))
                and str(row.get("phone_number")) == str(kept.get("phone_number"))
            )
            same_dob = (
                bool(row.get("date_of_birth"))
                and bool(kept.get("date_of_birth"))
                and str(row.get("date_of_birth")) == str(kept.get("date_of_birth"))
            )
            similar_first = _name_similarity(row.get("first_name"), kept.get("first_name")) >= 0.88
            similar_last = _name_similarity(row.get("last_name"), kept.get("last_name")) >= 0.88

            if same_phone and same_dob and similar_first and similar_last:
                is_duplicate = True
                break

        if is_duplicate:
            fuzzy_removed += 1
        else:
            keep_indexes.append(idx)

    filtered = pd.DataFrame([records[index] for index in keep_indexes], columns=df.columns)
    return filtered, fuzzy_removed


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


def clean_and_transform_dataframe(raw_df: pd.DataFrame) -> tuple[pd.DataFrame, dict[str, int]]:
    df = raw_df.copy()
    records_found = int(len(df))

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

    # Skip rows with invalid required values before deduplication.
    valid_required = (
        df["first_name"].notna()
        & df["last_name"].notna()
        & df["phone_number"].notna()
        & (df["phone_number"].astype(str).str.len() >= 5)
    )
    valid_dob = df["date_of_birth"].notna()

    filtered_df = df[valid_required & valid_dob].copy()
    invalid_rows_skipped = records_found - int(len(filtered_df))

    before_dedupe = int(len(filtered_df))
    filtered_df = filtered_df.drop_duplicates(subset=["phone_number"], keep="first")
    if "email" in filtered_df.columns:
        with_email = filtered_df[filtered_df["email"].notna()].drop_duplicates(
            subset=["email"], keep="first"
        )
        without_email = filtered_df[filtered_df["email"].isna()]
        filtered_df = pd.concat([with_email, without_email], ignore_index=True)

    filtered_df, fuzzy_removed = drop_fuzzy_duplicates(filtered_df)
    after_dedupe = int(len(filtered_df))

    duplicates_removed = (before_dedupe - after_dedupe) + fuzzy_removed
    cleaned = filtered_df[CANONICAL_COLUMNS].where(pd.notnull(filtered_df[CANONICAL_COLUMNS]), None)

    summary = {
        "records_found": records_found,
        "records_after_cleaning": int(len(cleaned)),
        "duplicates_removed": int(duplicates_removed),
        "invalid_rows_skipped": int(invalid_rows_skipped),
    }
    return cleaned, summary


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


def load_uploaded_excel(file_path: Path) -> tuple[pd.DataFrame, list[str], list[dict[str, Any]], dict]:
    raw_df = pd.read_excel(file_path)
    raw_df.columns = [normalize_column_name(column) for column in raw_df.columns]
    preview_columns, preview_rows = _to_json_records(raw_df, limit=10)
    quality_report = profile_dataframe(raw_df)
    return raw_df, preview_columns, preview_rows, quality_report


def analyze_excel_upload(file_path: Path) -> dict:
    logs: list[str] = []
    _log(logs, "Excel file uploaded")

    raw_df, preview_columns, preview_rows, quality_report = load_uploaded_excel(file_path)
    invalid_rows, _ = validate_and_get_invalid_rows(raw_df)
    _log(logs, "Data profiling and validation completed")

    return {
        "preview_columns": preview_columns,
        "preview_rows": preview_rows,
        "invalid_rows": invalid_rows,
        "data_quality_report": quality_report,
        "logs": logs,
    }


def clean_and_import_excel(file_path: Path) -> dict:
    logs: list[str] = []
    _log(logs, "Starting ETL clean and import pipeline")

    raw_df, _, _, _ = load_uploaded_excel(file_path)
    clean_df, import_summary = clean_and_transform_dataframe(raw_df)
    _log(logs, "Cleaning completed")

    inserted = import_patients(clean_df)
    import_summary["records_inserted"] = int(inserted)
    _log(logs, f"{inserted} records inserted into database")

    # Records that remained after cleaning but were not inserted were duplicates in DB.
    import_summary["duplicates_removed"] = int(
        import_summary["duplicates_removed"]
        + (import_summary["records_after_cleaning"] - inserted)
    )

    return {
        "import_summary": import_summary,
        "logs": logs,
    }


def validate_and_get_invalid_rows(raw_df: pd.DataFrame) -> tuple[list[dict], pd.DataFrame]:
    """Validate rows and return invalid rows with detailed error messages."""
    invalid_rows: list[dict] = []
    valid_indexes: list[int] = []

    df = raw_df.copy()

    for column in CANONICAL_COLUMNS:
        if column not in df.columns:
            df[column] = None

    def normalize_phone(value: Any) -> str:
        return "" if value is None else str(value).replace("nan", "").replace("None", "")

    def normalize_email(value: Any) -> str:
        return "" if value is None else str(value).strip().lower()

    phone_counts: dict[str, int] = {}
    email_counts: dict[str, int] = {}

    for raw_phone in df["phone_number"]:
        phone = normalize_phone(raw_phone)
        phone = "".join(character for character in phone if character.isdigit())
        if phone:
            phone_counts[phone] = phone_counts.get(phone, 0) + 1

    for raw_email in df["email"]:
        email = normalize_email(raw_email)
        if email:
            email_counts[email] = email_counts.get(email, 0) + 1

    # Normalize and clean values
    df["first_name"] = df["first_name"].astype(str).str.strip()
    df["last_name"] = df["last_name"].astype(str).str.strip()

    full_name_parts = df["first_name"].str.split(n=1, expand=True)
    df["first_name"] = full_name_parts[0]
    if 1 in full_name_parts.columns:
        missing_last_name = df["last_name"].isna() | (df["last_name"] == "")
        df.loc[missing_last_name, "last_name"] = full_name_parts[1]

    df["first_name"] = df["first_name"].replace({"": None, "nan": None, "None": None})
    df["last_name"] = df["last_name"].replace({"": None, "nan": None, "None": None})
    df["last_name"] = df["last_name"].fillna("Unknown")

    df["phone_number"] = df["phone_number"].astype(str).str.replace(r"\D", "", regex=True)
    df["email"] = df["email"].astype(str).str.strip().str.lower()
    df["date_of_birth"] = pd.to_datetime(df["date_of_birth"], dayfirst=True, errors="coerce")

    for idx, row in df.iterrows():
        errors = []

        # Required field validation
        if not row.get("first_name") or str(row.get("first_name")).strip() in ["", "nan", "None"]:
            errors.append("Missing first name")
        if not row.get("last_name") or str(row.get("last_name")).strip() in ["", "nan", "None"]:
            errors.append("Missing last name")

        # Phone number validation
        phone = str(row.get("phone_number", "")).strip()
        if not phone or len(phone) < 5:
            errors.append("Invalid or missing phone number (min 5 digits)")
        elif phone_counts.get(phone, 0) > 1:
            errors.append("Duplicate phone number")

        # Email validation
        email = str(row.get("email", "")).strip().lower()
        if email and email_counts.get(email, 0) > 1:
            errors.append("Duplicate email address")

        if email and ("@" not in email or email.startswith("@") or email.endswith("@")):
            errors.append("Invalid email format")
        
        # Date of birth validation
        dob = row.get("date_of_birth")
        if pd.isna(dob):
            errors.append("Invalid or missing date of birth")

        if errors:
            invalid_rows.append({
                "row_number": idx + 2,  # Excel row number (header is row 1)
                "data": row.to_dict(),
                "errors": errors,
            })
        else:
            valid_indexes.append(idx)

    valid_df = df.iloc[valid_indexes].copy() if valid_indexes else df.iloc[0:0].copy()
    return invalid_rows, valid_df


def process_excel_upload(file_path: Path) -> dict:
    """Backward-compatible helper: analyze and then clean/import in one call."""
    analysis = analyze_excel_upload(file_path)
    etl_result = clean_and_import_excel(file_path)
    return {
        **analysis,
        **etl_result,
        "logs": analysis["logs"] + etl_result["logs"],
    }