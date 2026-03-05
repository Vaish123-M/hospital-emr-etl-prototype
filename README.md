# Hospital Patient Management System (Prototype)

Minimal full-stack prototype:

Excel → Python ETL → MySQL → FastAPI → React + Tailwind

## Project structure

```
hospital-emr-etl-prototype/
├── backend/
│   ├── __init__.py
│   ├── main.py
│   ├── database.py
│   ├── models.py
│   └── schemas.py
├── etl/
│   ├── check_db.py
│   └── ingest.py
├── frontend/
│   ├── package.json
│   ├── index.html
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   └── src/
│       ├── App.jsx
│       ├── PatientDashboard.jsx
│       ├── main.jsx
│       └── index.css
├── sample_data/
│   └── patients.xlsx
├── schema.sql
├── requirements.txt
└── README.md
```

## 1) Database setup

1. Start MySQL server.
2. Run `schema.sql` in MySQL client/workbench.

This creates:
- Database: `hospital_db`
- Table: `patients`

## 2) Python dependencies

Install backend + ETL dependencies:

```bash
pip install -r requirements.txt
```

## 3) Environment variables (optional)

Defaults are used if these are not set:

- `DB_HOST` (default: `localhost`)
- `DB_PORT` (default: `3306`)
- `DB_NAME` (default: `hospital_db`)
- `DB_USER` (default: `root`)
- `DB_PASSWORD` (default: empty)

## 4) Import Excel data (ETL)

```bash
python etl/ingest.py
```

ETL behavior:
- Reads `sample_data/patients.xlsx`
- Cleans column names
- Converts date format to MySQL-compatible `YYYY-MM-DD`
- Inserts into MySQL
- Ignores duplicates through `INSERT IGNORE` + unique phone/email
- Prints inserted record count

## 5) Run FastAPI backend

```bash
uvicorn backend.main:app --reload
```

API endpoints:
- `GET /patients`
- `GET /patients/{id}`
- `POST /patients`

## 6) Run React frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend uses:
- `GET http://localhost:8000/patients`
- `POST http://localhost:8000/patients`

