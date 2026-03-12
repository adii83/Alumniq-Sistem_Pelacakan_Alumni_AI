from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class AlumniBase(BaseModel):
    name: str
    campus: Optional[str] = "Universitas Brawijaya"
    major: Optional[str] = "Informatika"
    graduation_year: Optional[str] = None
    source_platforms: Optional[str] = None

class AlumniCreate(AlumniBase):
    pass

class AlumniResponse(AlumniBase):
    id: int
    status: str
    job: Optional[str] = "Belum ada hasil"
    job_source: Optional[str] = None
    job_url: Optional[str] = None
    profile_pic_url: Optional[str] = None
    notes: Optional[str] = None
    last_tracked: Optional[datetime] = None

    class Config:
        from_attributes = True

class TrackingResultBase(BaseModel):
    alumni_id: int
    source: str
    url: str
    extracted_info: str
    confidence_score: str

class TrackingResultResponse(TrackingResultBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True
