"""Profile Excel EMR data and write a markdown quality report."""

from __future__ import annotations

from pathlib import Path

import pandas as pd

EXCEL_PATH = Path(__file__).resolve().parents[1] / "sample_data" / "patients.xlsx"
REPORT_PATH = Path(__file__).resolve().parents[1] / "docs" / "data_quality_report.md"

COLUMN_ALIASES = {
    "patient id": "patient_id",
    "id": "patient_id",
    "first name": "first_name",
    "fname": "first_name",
    "last name": "last_name",
    "lname": "last_name",
    "sex": "gender",
    "dob": "date_of_birth",
    "date of birth": "date_of_birth",
    "birth date": "date_of_birth",
    "phone": "phone_number",
    "phone number": "phone_number",
    "mobile": "phone_number",
    "contact number": "phone_number",
    "email address": "email",
    "mail": "email",
    "home address": "address",
    "location": "address",
    "blood type": "blood_group",
    "registration date": "registration_date",
    "registered on": "registration_date",
}

EXPECTED_PATIENT_COLUMNS = [
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


def normalize_column_name(column_name: str) -> str:
    normalized = column_name.strip().lower().replace("_", " ")
    mapped = COLUMN_ALIASES.get(normalized, normalized)
    return mapped.replace(" ", "_")


def load_and_normalize_excel(excel_path: Path = EXCEL_PATH) -> pd.DataFrame:
    df = pd.read_excel(excel_path)
    df.columns = [normalize_column_name(column) for column in df.columns]
    return df


def profile_dataframe(df: pd.DataFrame) -> dict:
    missing_counts = df.isna().sum().to_dict()

    duplicate_phone_count = 0
    duplicate_email_count = 0

    if "phone_number" in df.columns:
        duplicate_phone_count = int(df["phone_number"].dropna().duplicated().sum())

    if "email" in df.columns:
        lowered_email = df["email"].dropna().astype(str).str.lower().str.strip()
        duplicate_email_count = int(lowered_email.duplicated().sum())

    invalid_date_rows = 0
    if "date_of_birth" in df.columns:
        parsed = pd.to_datetime(df["date_of_birth"], dayfirst=True, errors="coerce")
        invalid_date_rows = int(parsed.isna().sum())

    inconsistent_gender_rows = 0
    if "gender" in df.columns:
        allowed = {"male", "female", "other", "m", "f", "o"}
        normalized_gender = (
            df["gender"].dropna().astype(str).str.strip().str.lower()
        )
        inconsistent_gender_rows = int((~normalized_gender.isin(allowed)).sum())

    unknown_columns = [
        column for column in df.columns if column not in EXPECTED_PATIENT_COLUMNS
    ]

    return {
        "row_count": int(len(df)),
        "column_count": int(df.shape[1]),
        "columns": list(df.columns),
        "missing_counts": missing_counts,
        "duplicate_phone_count": duplicate_phone_count,
        "duplicate_email_count": duplicate_email_count,
        "invalid_date_rows": invalid_date_rows,
        "inconsistent_gender_rows": inconsistent_gender_rows,
        "unknown_columns": unknown_columns,
        "distinct_counts": df.nunique(dropna=True).to_dict(),
    }


def write_markdown_report(profile: dict, report_path: Path = REPORT_PATH) -> None:
    report_path.parent.mkdir(parents=True, exist_ok=True)

    lines = [
        "# Data Quality Report",
        "",
        "## File Summary",
        "",
        f"- Total rows: {profile['row_count']}",
        f"- Total columns: {profile['column_count']}",
        f"- Columns: {', '.join(profile['columns'])}",
        "",
        "## Missing Values By Column",
        "",
        "| Column | Missing Count |",
        "| --- | ---: |",
    ]

    for column, missing in profile["missing_counts"].items():
        lines.append(f"| {column} | {missing} |")

    lines.extend(
        [
            "",
            "## Data Quality Issues",
            "",
            f"- Duplicate phone numbers: {profile['duplicate_phone_count']}",
            f"- Duplicate emails: {profile['duplicate_email_count']}",
            f"- Invalid date_of_birth values: {profile['invalid_date_rows']}",
            f"- Inconsistent gender values: {profile['inconsistent_gender_rows']}",
            "",
            "## Column Format Notes",
            "",
            "- Date fields should follow DD-MM-YYYY or YYYY-MM-DD before conversion.",
            "- Phone and email should be unique to avoid duplicate patient records.",
        ]
    )

    if profile["unknown_columns"]:
        lines.extend(
            [
                "",
                "## Unknown/Unmapped Columns",
                "",
                ", ".join(profile["unknown_columns"]),
            ]
        )

    lines.extend(["", "## Summary Statistics (Top-Level)", "", "| Column | Distinct |", "| --- | ---: |"])

    for column, distinct in profile["distinct_counts"].items():
        lines.append(f"| {column} | {distinct} |")

    report_path.write_text("\n".join(lines), encoding="utf-8")


def main() -> None:
    dataframe = load_and_normalize_excel(EXCEL_PATH)
    profile = profile_dataframe(dataframe)
    write_markdown_report(profile, REPORT_PATH)
    print(f"Data profiling complete. Report written to: {REPORT_PATH}")


if __name__ == "__main__":
    main()
