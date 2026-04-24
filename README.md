# Hospital Patient Management System (Prototype)

A beginner-friendly full-stack prototype that replaces Excel-based patient storage with a structured relational system.

Architecture:

Excel Data -> Python ETL Pipeline -> MySQL Database -> FastAPI Backend -> React + Tailwind Frontend

## Solution Objective

This system is designed to help small hospitals and medical camps move away from spreadsheet-based EMR management and adopt a structured, scalable workflow.

Primary goals:

- Migrate legacy EMR records from Excel to a relational database
- Improve data quality through profiling, cleaning, and validation
- Prevent duplicate records through unique constraints and ETL deduplication
- Make patient and visit history retrieval easier through APIs and dashboard UI
- Provide a beginner-friendly prototype that can be extended into production

Core ETL modules now include:

- Data profiling and quality reporting
- Data mapping documentation
- Modular cleaning and validation
- Automated pipeline runner with logging

## Features

### Data Collection and Profiling

- Reads EMR data from Excel files
- Profiles missing values by column
- Detects duplicate phone numbers and emails
- Flags invalid date values and inconsistent gender formats
- Generates markdown quality report for audit and review

### Data Cleaning and Validation

- Standardizes column names and known aliases
- Normalizes patient names, gender values, blood group, and contact fields
- Converts date fields into database-compatible ISO format
- Handles null and placeholder values safely
- Removes duplicate patient rows before insertion
- Adds fuzzy duplicate detection for near-match name + phone + DOB combinations

### Database Design and Integrity

- Creates normalized MySQL schema with patients and visits tables
- Uses foreign key relationship from visits to patients
- Enforces unique phone and email constraints for patients
- Adds visit indexes for better query performance

### ETL and Automation

- Supports stepwise ETL execution and one-command automation
- Generates data quality report before loading data
- Loads cleaned patient data into MySQL
- Optionally ingests visit records from a visits sheet
- Writes structured ETL logs for troubleshooting

### Backend API (FastAPI)

- Patient registration endpoint
- Patient list endpoint
- Patient detail endpoint
- Visit creation endpoint
- Visit history endpoint by patient
- Consistent JSON responses and validation using Pydantic models
- Patient timeline endpoint (registration, visits, and audit events)
- Risk and triage endpoint (red/amber/green with scoring reasons)
- Analytics overview endpoint with doctor workload summary

### Frontend Web Interface (React + Tailwind)

- Landing page with problem, objective, and solution context
- Dashboard with patient registration form
- Patient list table with quick details
- Patient detail panel
- Add visit form and visit history table
- Analytics panel with patient summary cards
- Last-7-days visit trend visualization
- Top symptoms snapshot for quick clinical insight
- Doctor workload snapshot for hospital admins
- Patient timeline section with symptoms, medications, and follow-up tracking
- Triage risk flag card in patient details

### Audit and Compliance

- Tracks patient and visit create events in `audit_logs`
- Stores action type, actor (`changed_by`), timestamp, and JSON details

## Technologies Used

### Languages

- Python
- SQL
- JavaScript

### Data and ETL

- Excel (.xlsx)
- pandas
- openpyxl
- mysql-connector-python

### Backend

- FastAPI
- Uvicorn
- Pydantic

### Database

- MySQL / MariaDB

### Frontend

- React (Vite)
- Tailwind CSS
- Axios
- React Router

### Tooling and Ops

- Docker Compose (optional MySQL runtime)
- PowerShell helper scripts
- Git + GitHub

### ETL Automation Reference

- Airbyte can be used as a future enhancement for scheduled and connector-based ingestion, but this prototype currently implements a custom Python ETL pipeline.

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
│   ├── data_profiling.py
│   ├── check_db.py
│   └── ingest.py
│   ├── logging_config.py
│   └── run_pipeline.py
├── docs/
│   ├── data_mapping.md
│   └── data_quality_report.md
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
- Tables: `patients`, `visits`

Key constraints:

- `patient_id` primary key (auto increment)
- `first_name`, `last_name`, `phone_number`, `registration_date` are NOT NULL
- `phone_number` UNIQUE
- `email` UNIQUE
- `visits.patient_id` foreign key references `patients.patient_id`

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

### 4.1 Generate Data Profiling Report

```bash
python etl/data_profiling.py
```

This updates [docs/data_quality_report.md](docs/data_quality_report.md) with:

- Missing values by column
- Duplicate phone/email checks
- Invalid date counts
- Inconsistent format indicators

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

### 4.2 Run End-to-End Automated Pipeline

```bash
python etl/run_pipeline.py
```

Pipeline flow:

Excel file -> profiling -> cleaning/validation -> mapping -> MySQL insert

Logs are written to:

- `etl/etl.log`

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
- `GET /patients/{id}/visits` -> list patient visit history
- `POST /visits` -> add a patient visit

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

## 7) Local One-Click Quickstart (Windows)

If you have MySQL and Node.js installed locally, you can start MySQL, backend, and frontend together:

```powershell
powershell -ExecutionPolicy Bypass -File .\run_full_stack.ps1
```

What this script does:

- Starts MySQL on `127.0.0.1:3306` (local dev process)
- Applies `schema.sql`
- Starts FastAPI backend at `http://localhost:8000`
- Starts Vite frontend at `http://localhost:5173`

To stop all processes started by the script:

```powershell
powershell -ExecutionPolicy Bypass -File .\stop_full_stack.ps1
```

Notes:

- The helper creates local runtime files under `.runtime/` (git-ignored).
- If MySQL is already running on port `3306`, the script reuses it.

## Application Flow Demonstration

1. Import old Excel records with ETL (`python etl/ingest.py`).
2. Start FastAPI backend (`uvicorn backend.main:app --reload`).
3. Start frontend (`npm run dev` in `frontend/`).
4. Open dashboard and register a new patient using the form.
5. View all patients in the table.
6. Click `View` on a row to fetch and display full patient details.
7. Add a visit and view visit history for the selected patient.

This completes the end-to-end flow from Excel ingestion to patient management UI.

## Data Mapping Reference

See [docs/data_mapping.md](docs/data_mapping.md) for the full Excel column to database field mapping.

For visit-history ingestion sheet format, see [docs/visits_sheet_template.md](docs/visits_sheet_template.md) and sample file [sample_data/visits_template.csv](sample_data/visits_template.csv).

## 8) Deployment Readiness Checklist

Before deploying to cloud:

- Set backend DB env vars (`DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`)
- Set backend CORS env var (`CORS_ORIGINS`) with your deployed frontend URL
- Prefer frontend API base as `/api` and use reverse proxy in the frontend host
- Ensure your frontend host supports SPA rewrite to `index.html`

Reference templates:

- Backend env template: `backend/.env.example`
- Frontend env template: `frontend/.env.example`

## 9) Full Stack with Docker (MySQL + FastAPI + Frontend)

This repository now includes:

- `backend/Dockerfile`
- `frontend/Dockerfile`
- `frontend/nginx.conf`
- `docker-compose.full.yml`

Run everything together:

```bash
docker compose -f docker-compose.full.yml up --build -d
```

Open:

- Frontend: `http://localhost:5173`
- Backend API docs: `http://localhost:8000/docs`
- MySQL: `localhost:3306`

The frontend container proxies `/api/*` to backend, so app API calls work from the frontend URL without exposing backend URL to the browser.

Stop stack:

```bash
docker compose -f docker-compose.full.yml down
```

Stop and remove DB volume:

```bash
docker compose -f docker-compose.full.yml down -v
```

Notes:

- The existing `docker-compose.yml` is still a DB-only setup.
- The new `docker-compose.full.yml` is for complete app deployment/testing.

