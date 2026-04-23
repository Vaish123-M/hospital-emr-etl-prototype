import os
import mysql.connector


def get_db_config() -> dict:
    return {
        "host": os.getenv("DB_HOST", "localhost"),
        "port": int(os.getenv("DB_PORT", "3306")),
        "database": os.getenv("DB_NAME", "hospital_db"),
        "user": os.getenv("DB_USER", "root"),
        "password": os.getenv("DB_PASSWORD", ""),
    }


def get_connection():
    # ❗ Do NOT return None — let FastAPI handle errors
    return mysql.connector.connect(**get_db_config())


def check_connection() -> bool:
    try:
        connection = get_connection()
        connected = connection.is_connected()
        connection.close()
        return connected
    except Exception:
        return False
