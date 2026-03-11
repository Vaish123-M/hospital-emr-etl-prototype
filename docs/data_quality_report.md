# Data Quality Report

## File Summary

- Total rows: 20
- Total columns: 10
- Columns: patient_id, first_name, last_name, gender, date_of_birth, phone_number, email, address, blood_group, registration_date

## Missing Values By Column

| Column | Missing Count |
| --- | ---: |
| patient_id | 0 |
| first_name | 0 |
| last_name | 0 |
| gender | 0 |
| date_of_birth | 0 |
| phone_number | 0 |
| email | 0 |
| address | 0 |
| blood_group | 0 |
| registration_date | 0 |

## Data Quality Issues

- Duplicate phone numbers: 0
- Duplicate emails: 0
- Invalid date_of_birth values: 0
- Inconsistent gender values: 0

## Column Format Notes

- Date fields should follow DD-MM-YYYY or YYYY-MM-DD before conversion.
- Phone and email should be unique to avoid duplicate patient records.

## Summary Statistics (Top-Level)

| Column | Distinct |
| --- | ---: |
| patient_id | 20 |
| first_name | 20 |
| last_name | 20 |
| gender | 2 |
| date_of_birth | 20 |
| phone_number | 20 |
| email | 20 |
| address | 14 |
| blood_group | 8 |
| registration_date | 9 |