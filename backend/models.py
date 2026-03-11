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

VISIT_COLUMNS = [
    "visit_id",
    "patient_id",
    "doctor_name",
    "symptoms",
    "visit_date",
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


SELECT_VISITS_BY_PATIENT_ID = """
SELECT
    visit_id,
    patient_id,
    doctor_name,
    symptoms,
    visit_date
FROM visits
WHERE patient_id = %s
ORDER BY visit_date DESC, visit_id DESC;
"""


INSERT_VISIT = """
INSERT INTO visits (
    patient_id,
    doctor_name,
    symptoms,
    visit_date
)
VALUES (%s, %s, %s, %s);
"""
