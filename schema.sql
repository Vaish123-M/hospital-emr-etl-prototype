CREATE DATABASE hospital_db;
USE hospital_db;

CREATE TABLE patients (
    patient_id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    age INT,
    gender VARCHAR(10),
    phone VARCHAR(15) UNIQUE,
    address TEXT
);

CREATE TABLE visits (
    visit_id INT PRIMARY KEY AUTO_INCREMENT,
    patient_id INT,
    doctor_name VARCHAR(100),
    symptoms TEXT,
    visit_date DATE,
    FOREIGN KEY (patient_id) REFERENCES patients(patient_id)
);