"""Hospital EMR ETL Prototype: ingest patient data from Excel into MySQL."""

import os
from pathlib import Path

import mysql.connector
import pandas as pd
from mysql.connector import Error


EXCEL_PATH = Path(__file__).resolve().parents[1] / "sample_data" / "patients.xlsx"


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


def main() -> None:
    connection = None
    cursor = None

    try:
        # Connect to MySQL using environment-based configuration.
        connection = mysql.connector.connect(**get_db_config())

        if not connection.is_connected():
            raise RuntimeError("Failed to connect to MySQL database.")
        print("Database connected: hospital_db")

        cursor = connection.cursor()

        # Load patient source data from Excel.
        df = pd.read_excel(EXCEL_PATH)

        # Clean and normalize column names.
        df.columns = (
            df.columns.str.strip().str.lower().str.replace(" ", "_", regex=False)
        )

        required_columns = [
            "first_name",
            "last_name",
            "phone_number",
            "date_of_birth",
        ]

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

        # Convert DD-MM-YYYY to YYYY-MM-DD for MySQL DATE fields.
        df["date_of_birth"] = pd.to_datetime(
            df["date_of_birth"], dayfirst=True, errors="raise"
        ).dt.strftime("%Y-%m-%d")
        df["registration_date"] = pd.to_datetime(
            df["registration_date"], dayfirst=True, errors="coerce"
        ).dt.strftime("%Y-%m-%d")

        # Fill invalid/empty registration_date with today's date so inserts remain valid.
        today_iso = pd.Timestamp.today().strftime("%Y-%m-%d")
        df["registration_date"] = df["registration_date"].fillna(today_iso)

        # Replace NaN values with None so mysql-connector sends proper SQL NULL values.
        df = df.where(pd.notnull(df), None)

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

        records_inserted = 0
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
        print(f"Records inserted: {records_inserted}")

    except (Error, ValueError, FileNotFoundError, RuntimeError) as exc:
        print(f"ETL error: {exc}")
    finally:
        if cursor is not None:
            cursor.close()
        if connection is not None and connection.is_connected():
            connection.close()
            print("MySQL connection closed.")


if __name__ == "__main__":
    main()
