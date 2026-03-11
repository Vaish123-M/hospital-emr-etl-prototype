# Hospital Patient Management System (Prototype)

A beginner-friendly full-stack prototype that replaces Excel-based patient storage with a structured relational system.

Architecture:

Excel Data -> Python ETL Pipeline -> MySQL Database -> FastAPI Backend -> React + Tailwind Frontend

## Problem Statement

Small hospitals often store patient records in Excel files. This causes:

- Duplicate entries
- Unstructured storage
- Difficulty retrieving patient details
- Poor scalability as data grows

## Objective

Build a simple local system to:

- Import old patient records from Excel
- Store records in MySQL (`hospital_db`)
- Register new patients from a web form
- View patient list and individual patient details

## Project Structure

```
hospital-emr-etl-prototype/
├── backend/
│   ├── __init__.py
│   ├── database.py
│   ├── main.py
│   ├── models.py
│   └── schemas.py
├── etl/
│   ├── check_db.py
│   └── ingest.py
├── frontend/
│   ├── package.json
│   ├── postcss.config.js
│   ├── tailwind.config.js
│   ├── vite.config.js
│   └── src/
├── sample_data/
│   └── patients.xlsx
├── schema.sql
├── requirements.txt
└── README.md
```

## 1) Database Setup

1. Start your MySQL server.
2. Run `schema.sql`.

This creates:

- Database: `hospital_db`
- Table: `patients`

Key constraints:

- `patient_id` primary key (auto increment)
- `first_name`, `last_name`, `phone_number`, `registration_date` are NOT NULL
- `phone_number` UNIQUE
- `email` UNIQUE

### Option A: Local MySQL Service

Use your locally installed MySQL server and run `schema.sql` manually.

### Option B: Docker MySQL (No local MySQL install)

If Docker Desktop is installed, start MySQL with:

```bash
docker compose up -d
```

This project includes `docker-compose.yml` that:

- Starts MySQL 8.4 on port `3306`
- Creates database `hospital_db`
- Runs `schema.sql` automatically on first container start

To stop:

```bash
docker compose down
```

To stop and remove data volume:

```bash
docker compose down -v
```

## 2) Install Python Dependencies

```bash
pip install -r requirements.txt
```

## 3) Configure Database Connection

Set environment variables (optional, defaults are provided):

- `DB_HOST` (default: `localhost`)
- `DB_PORT` (default: `3306`)
- `DB_NAME` (default: `hospital_db`)
- `DB_USER` (default: `root`)
- `DB_PASSWORD` (default: empty)

## 4) Run ETL to Import Excel Data

```bash
python etl/ingest.py
```

If using Docker MySQL, you can run with preconfigured environment variables:

```powershell
powershell -ExecutionPolicy Bypass -File etl/run_etl_with_docker_db.ps1
```

What ETL does:

- Reads `sample_data/patients.xlsx`
- Cleans column names (lowercase + underscore style)
- Converts dates from `DD-MM-YYYY` to `YYYY-MM-DD`
- Inserts rows into MySQL
- Avoids duplicates using `INSERT IGNORE` with unique `phone_number`/`email`

Optional data quality check:

```bash
python etl/check_db.py
```

## 5) Run FastAPI Backend

```bash
uvicorn backend.main:app --reload
```

If using Docker MySQL, you can run with preconfigured environment variables:

```powershell
powershell -ExecutionPolicy Bypass -File backend/run_backend_with_docker_db.ps1
```

APIs:

- `POST /patients` -> register a new patient
- `GET /patients` -> list all patients
- `GET /patients/{id}` -> get one patient

Docs:

- Swagger UI: `http://localhost:8000/docs`

## 6) Run Frontend (React + Tailwind)

```bash
cd frontend
npm install
npm run dev
```

Default frontend URL: `http://localhost:5173`

Optional frontend environment variable:

- `VITE_API_BASE_URL` (default: `http://localhost:8000`)

## Application Flow Demonstration

1. Import old Excel records with ETL (`python etl/ingest.py`).
2. Start FastAPI backend (`uvicorn backend.main:app --reload`).
3. Start frontend (`npm run dev` in `frontend/`).
4. Open dashboard and register a new patient using the form.
5. View all patients in the table.
6. Click `View` on a row to fetch and display full patient details.

This completes the end-to-end flow from Excel ingestion to patient management UI.

