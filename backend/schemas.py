from datetime import date
from typing import Optional

from pydantic import BaseModel, Field


class PatientBase(BaseModel):
    first_name: str = Field(min_length=1, max_length=50)
    last_name: str = Field(min_length=1, max_length=50)
    gender: Optional[str] = Field(default=None, max_length=10)
    date_of_birth: Optional[date] = None
    phone_number: str = Field(min_length=5, max_length=15)
    email: Optional[str] = Field(default=None, max_length=100)
    address: Optional[str] = Field(default=None, max_length=255)
    blood_group: Optional[str] = Field(default=None, max_length=5)


class PatientCreate(PatientBase):
    pass


class PatientResponse(PatientBase):
    patient_id: int
    registration_date: Optional[date] = None


class VisitBase(BaseModel):
    patient_id: int
    doctor_name: str = Field(min_length=1, max_length=100)
    symptoms: Optional[str] = None
    medications: Optional[str] = None
    follow_up_date: Optional[date] = None
    visit_date: date


class VisitCreate(VisitBase):
    pass


class VisitResponse(VisitBase):
    visit_id: int
