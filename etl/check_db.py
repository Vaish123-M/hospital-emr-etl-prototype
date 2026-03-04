"""Validation script for Hospital EMR ETL data quality checks."""

import os

import mysql.connector
from mysql.connector import Error


def get_db_config() -> dict:
    db_port = os.getenv("DB_PORT", "3306")
    if not db_port.isdigit():
        raise ValueError("DB_PORT must be a valid integer.")

    return {
        "host": os.getenv("DB_HOST", "localhost"),
        "port": int(db_port),
        "database": os.getenv("DB_NAME", "hospital_db"),
        "user": os.getenv("DB_USER", "your_username"),
        "password": os.getenv("DB_PASSWORD", "your_password"),
    }


def main() -> None:
    connection = None
    cursor = None

    try:
        connection = mysql.connector.connect(**get_db_config())

        if not connection.is_connected():
            raise RuntimeError("Failed to connect to MySQL database.")

        print("Database connected: hospital_db")
        cursor = connection.cursor(dictionary=True)

        # Total row count in patients table.
        cursor.execute("SELECT COUNT(*) AS total FROM patients")
        total_records = cursor.fetchone()["total"]
        print(f"Total records in patients: {total_records}")

        # Preview first 5 patient records.
        cursor.execute(
            """
            SELECT patient_id, first_name, last_name, phone_number, email
            FROM patients
            ORDER BY patient_id
            LIMIT 5
            """
        )
        sample_rows = cursor.fetchall()

        print("First 5 rows:")
        if not sample_rows:
            print("- No records found.")
        else:
            for row in sample_rows:
                print(
                    f"- {row['patient_id']}: {row['first_name']} {row['last_name']}, "
                    f"phone={row['phone_number']}, email={row['email']}"
                )

        # Duplicate phone_number check.
        cursor.execute(
            """
            SELECT phone_number, COUNT(*) AS count_value
            FROM patients
            WHERE phone_number IS NOT NULL
            GROUP BY phone_number
            HAVING COUNT(*) > 1
            """
        )
        duplicate_phones = cursor.fetchall()

        # Duplicate email check.
        cursor.execute(
            """
            SELECT email, COUNT(*) AS count_value
            FROM patients
            WHERE email IS NOT NULL
            GROUP BY email
            HAVING COUNT(*) > 1
            """
        )
        duplicate_emails = cursor.fetchall()

        print(
            "Duplicate phone_number check: "
            + ("No duplicates found" if not duplicate_phones else f"Found {len(duplicate_phones)} duplicates")
        )
        print(
            "Duplicate email check: "
            + ("No duplicates found" if not duplicate_emails else f"Found {len(duplicate_emails)} duplicates")
        )

    except (Error, ValueError, RuntimeError) as exc:
        print(f"Validation error: {exc}")
    finally:
        if cursor is not None:
            cursor.close()
        if connection is not None and connection.is_connected():
            connection.close()
            print("MySQL connection closed.")


if __name__ == "__main__":
    main()
