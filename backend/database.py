import os
import mysql.connector
from mysql.connector import Error


def get_db_config() -> dict:
    return {
        "host": os.getenv("DB_HOST"),
        "port": int(os.getenv("DB_PORT", "3306")),
        "database": os.getenv("DB_NAME"),
        "user": os.getenv("DB_USER"),
        "password": os.getenv("DB_PASSWORD"),
    }


def get_connection():
    try:
        config = get_db_config()

        # 🚨 IMPORTANT: Prevent crash if env vars missing
        if not all([config["host"], config["database"], config["user"]]):
            print("❌ Missing DB environment variables")
            return None

        connection = mysql.connector.connect(**config)

        if connection.is_connected():
            print("✅ Connected to MySQL")
            return connection

        return None

    except Error as e:
        print("❌ Database connection failed:", e)
        return None


def check_connection() -> bool:
    connection = get_connection()
    if connection:
        connection.close()
        return True
    return False
