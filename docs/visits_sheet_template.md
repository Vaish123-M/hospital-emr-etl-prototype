# Visits Sheet Template

Use a sheet named visits inside your Excel workbook (`sample_data/patients.xlsx`) to ingest patient visit history.

## Required Columns

- `doctor_name`
- `visit_date`

## Patient Link Columns

At least one of these should be provided per row so the ETL can map visit to patient:

- `patient_id` (preferred)
- `phone_number`
- `email`

## Optional Columns

- `symptoms`

## Example Table

| patient_id | phone_number | email | doctor_name | symptoms | visit_date |
| ---: | --- | --- | --- | --- | --- |
| 2 | 09699836744 | vaishmamulkar@gmail.com | Dr Sharma | Fever, headache | 11-03-2026 |
| 3 | 9988776655 | meera.iyer@email.com | Dr Iyer | Routine checkup | 2026-03-10 |

## Supported Date Formats

- `DD-MM-YYYY`
- `YYYY-MM-DD`

The ETL converts visit dates into `YYYY-MM-DD` before database insertion.
