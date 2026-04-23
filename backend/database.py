import os

import mysql.connector
from mysql.connector import Error


def get_db_config() -> dict:
    return {
        "host": os.getenv("DB_HOST", "localhost"),
        "port": int(os.getenv("DB_PORT", "3306")),
        "database": os.getenv("DB_NAME", "hospital_db"),
        "user": os.getenv("DB_USER", "root"),
        "password": os.getenv("DB_PASSWORD", ""),
    }


def get_connection():
    try:
        return mysql.connector.connect(**get_db_config())
    except Error as e:
        print("Database connection failed:", e)
        return None


def check_connection() -> bool:
    try:
        connection = get_connection()
        connected = connection.is_connected()
        connection.close()
        return connected
    except Error:
        return False
