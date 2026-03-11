PATIENT_COLUMNS = [
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


SELECT_ALL_PATIENTS = """
SELECT
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
FROM patients
ORDER BY patient_id;
"""


SELECT_PATIENT_BY_ID = """
SELECT
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
FROM patients
WHERE patient_id = %s;
"""

INSERT_PATIENT = """
INSERT INTO patients (
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
VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s);
"""
