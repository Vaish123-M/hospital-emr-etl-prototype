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
    "medications",
    "follow_up_date",
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
    medications,
    follow_up_date,
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
    medications,
    follow_up_date,
    visit_date
)
VALUES (%s, %s, %s, %s, %s, %s);
"""


SELECT_PATIENT_OVERVIEW_COUNTS = """
SELECT
    COUNT(*) AS total_patients,
    SUM(CASE WHEN registration_date = CURDATE() THEN 1 ELSE 0 END) AS new_today
FROM patients;
"""


SELECT_REPEAT_PATIENT_COUNT = """
SELECT COUNT(*)
FROM (
    SELECT patient_id
    FROM visits
    GROUP BY patient_id
    HAVING COUNT(*) >= 2
) AS repeat_patients;
"""


SELECT_VISIT_TREND_LAST_7_DAYS = """
SELECT
    DATE(visit_date) AS visit_day,
    COUNT(*) AS visit_count
FROM visits
WHERE visit_date >= (CURDATE() - INTERVAL 6 DAY)
GROUP BY DATE(visit_date)
ORDER BY visit_day;
"""


SELECT_VISIT_SYMPTOMS = """
SELECT symptoms
FROM visits
WHERE symptoms IS NOT NULL AND TRIM(symptoms) != '';
"""


SELECT_DOCTOR_WORKLOAD = """
SELECT doctor_name, COUNT(*) AS visit_count
FROM visits
WHERE doctor_name IS NOT NULL AND TRIM(doctor_name) != ''
GROUP BY doctor_name
ORDER BY visit_count DESC, doctor_name ASC
LIMIT 5;
"""


SELECT_FOLLOW_UP_REMINDERS = """
SELECT
    v.visit_id,
    v.patient_id,
    CONCAT(p.first_name, ' ', p.last_name) AS patient_name,
    v.doctor_name,
    v.follow_up_date,
    DATEDIFF(v.follow_up_date, CURDATE()) AS days_until_follow_up
FROM visits v
LEFT JOIN patients p ON p.patient_id = v.patient_id
WHERE v.follow_up_date IS NOT NULL
ORDER BY v.follow_up_date ASC, v.visit_id DESC;
"""


CREATE_AUDIT_LOGS_TABLE = """
CREATE TABLE IF NOT EXISTS audit_logs (
    audit_id INT AUTO_INCREMENT PRIMARY KEY,
    entity_type VARCHAR(50) NOT NULL,
    entity_id INT NULL,
    action VARCHAR(50) NOT NULL,
    changed_by VARCHAR(100) NOT NULL DEFAULT 'system',
    changed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    details JSON NULL
);
"""


ALTER_VISITS_ADD_MEDICATIONS = """
ALTER TABLE visits ADD COLUMN IF NOT EXISTS medications TEXT NULL;
"""


ALTER_VISITS_ADD_FOLLOW_UP_DATE = """
ALTER TABLE visits ADD COLUMN IF NOT EXISTS follow_up_date DATE NULL;
"""


INSERT_AUDIT_LOG = """
INSERT INTO audit_logs (entity_type, entity_id, action, changed_by, details)
VALUES (%s, %s, %s, %s, %s);
"""


SELECT_AUDIT_BY_PATIENT_ID = """
SELECT
    audit_id,
    entity_type,
    entity_id,
    action,
    changed_by,
    changed_at,
    details
FROM audit_logs
WHERE
    (entity_type = 'patient' AND entity_id = %s)
    OR (
        entity_type = 'visit'
        AND JSON_UNQUOTE(JSON_EXTRACT(details, '$.patient_id')) = CAST(%s AS CHAR)
    )
ORDER BY changed_at DESC, audit_id DESC;
"""
