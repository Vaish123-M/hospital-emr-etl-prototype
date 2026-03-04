"""Hospital EMR ETL Prototype: ingest patient data from Excel into MySQL."""

from pathlib import Path

import mysql.connector
import pandas as pd
from mysql.connector import Error


EXCEL_PATH = Path(__file__).resolve().parents[1] / "sample_data" / "patients.xlsx"


def main() -> None:
    connection = None
    cursor = None

    try:
        connection = mysql.connector.connect(
            host="localhost",
            database="hospital_db",
            user="your_username",
            password="your_password",
        )

        if not connection.is_connected():
            raise RuntimeError("Failed to connect to MySQL database.")

        cursor = connection.cursor()

        df = pd.read_excel(EXCEL_PATH)

        required_columns = [
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

        missing_columns = [column for column in required_columns if column not in df.columns]
        if missing_columns:
            raise ValueError(f"Missing required columns in Excel file: {missing_columns}")

        df["date_of_birth"] = pd.to_datetime(
            df["date_of_birth"], format="%d-%m-%Y", errors="raise"
        ).dt.strftime("%Y-%m-%d")
        df["registration_date"] = pd.to_datetime(
            df["registration_date"], format="%d-%m-%Y", errors="raise"
        ).dt.strftime("%Y-%m-%d")

        insert_query = """
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

        records_inserted = 0
        for row in df[required_columns].itertuples(index=False, name=None):
            cursor.execute(insert_query, row)
            records_inserted += cursor.rowcount

        connection.commit()
        print(f"{records_inserted} records inserted successfully.")

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
