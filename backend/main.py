from fastapi import FastAPI, Depends, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime
import time
import random
import requests
from urllib.parse import quote_plus, urlparse
from bs4 import BeautifulSoup

import models, schemas
from database import engine, get_db

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Sistem Pelacakan Alumni API")

# Configure CORS for frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # For dev, allow all. Change in prod.
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _fetch_text(url: str, timeout: int = 8) -> str:
    """
    Helper: ambil HTML teks dari sebuah URL dengan headers sederhana.
    Digunakan hanya untuk simulasi tugas, bukan scraping agresif.
    """
    headers = {
        "User-Agent": "Mozilla/5.0 (compatible; AlumniTracker/1.0; +https://example.com)"
    }
    try:
        resp = requests.get(url, headers=headers, timeout=timeout)
        if resp.status_code == 200 and resp.text:
            return resp.text.lower()
    except Exception:
        return ""
    return ""


def fetch_data_dari_internet(query: str, max_pages: int = 3) -> list[dict]:
    """
    Mengambil kandidat hasil pencarian dari Yahoo Search HTML.
    Mengembalikan list dict berisi sinyal teks dan link.
    """
    print(f"[Scraper] Menyelami Internet untuk: \"{query}\"")
    semua_hasil: list[dict] = []
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/120.0.0.0 Safari/537.36"
        )
    }

    for page in range(max_pages):
        b_code = page * 10 + 1  # 1, 11, 21, ...
        url_pencarian = f"https://search.yahoo.com/search?p={quote_plus(query)}&b={b_code}"
        try:
            resp = requests.get(url_pencarian, headers=headers, timeout=12)
            if resp.status_code != 200 or not resp.text:
                break

            soup = BeautifulSoup(resp.text, "html.parser")
            ada_hasil = False

            for comp in soup.select(".compTitle"):
                a = comp.find("a")
                if not a:
                    continue
                title = (a.get_text() or "").strip()
                url_asli = a.get("href") or ""

                parent = comp.parent
                snip_el = parent.select_one(".compText") if parent else None
                snip = (snip_el.get_text() if snip_el else parent.get_text() if parent else "").strip()

                import re
                from urllib.parse import unquote

                if url_asli and "RU=" in url_asli:
                    match = re.search(r"RU=([^/]+)", url_asli)
                    if match:
                        url_asli = unquote(match.group(1))

                if not title or "searches related" in title.lower():
                    continue

                semua_hasil.append(
                    {
                        "sinyal_nama": f"{title} {snip}",
                        "sinyal_pekerjaan": snip,
                        "sinyal_afiliasi": snip,
                        "sinyal_tahun": snip,
                        "sumber": title or "Yahoo Search Engine",
                        "link": url_asli or "",
                    }
                )
                ada_hasil = True

            if not ada_hasil:
                break

            time.sleep(1.0)
        except Exception as e:
            print(f"Gagal menarik halaman {page + 1}: {e}")
            break

    print(f"[Scraper] Ditemukan total {len(semua_hasil)} jejak publik.")
    return semua_hasil


def hitung_bobot_kecocokan(alumni: models.Alumni, kandidat: dict) -> tuple[int, int]:
    """
    Hitung skor kecocokan kandidat terhadap profil alumni.
    Mengembalikan (total_skor, match_nama).
    """
    total_skor = 0
    match_nama = 0

    nama_master = (alumni.name or "").strip().lower()
    if not nama_master:
        return 0, 0

    nama_pisah = [p for p in nama_master.split() if p]
    teks_terkumpul = (
        (kandidat.get("sinyal_nama") or "") + " " + (kandidat.get("sinyal_pekerjaan") or "")
    ).lower()

    if nama_master and nama_master in teks_terkumpul:
        match_nama = 60
    else:
        kata_cocok = 0
        for kata in nama_pisah:
            if len(kata) > 2 and kata in teks_terkumpul:
                kata_cocok += 1
        if kata_cocok > 0 and len(nama_pisah) > 0:
            match_nama = int((kata_cocok / len(nama_pisah)) * 40)

    total_skor += match_nama

    nama_kampus = (alumni.campus or "").strip().lower()
    if nama_kampus:
        import re
        pola_kampus = re.compile(
            rf"({re.escape(nama_kampus)}|umm|muhammadiyah malang|universitas muhammadiyah)",
            re.IGNORECASE,
        )
        if pola_kampus.search(teks_terkumpul):
            total_skor += 40

    import re
    prodi = (alumni.major or "").strip().lower()
    kata_prodi = prodi.split(" ")[0] if prodi else ""
    regex_prodi = re.compile(re.escape(kata_prodi), re.IGNORECASE) if kata_prodi else None
    regex_umum = re.compile(
        r"(engineer|developer|software|analyst|dokter|dosen|guru|student|mahasiswa|lulusan|alumni)",
        re.IGNORECASE,
    )

    if (regex_prodi and regex_prodi.search(teks_terkumpul)) or regex_umum.search(teks_terkumpul):
        total_skor += 20

    return total_skor, match_nama


def mock_scraping_task(alumni_id: int, db: Session):
    """
    Pelacakan berbasis Yahoo Search:
    - Membuat beberapa query (nama+kampus, nama kampus natural, nama+prodi)
    - Mengambil banyak kandidat
    - Menghitung skor kecocokan setiap kandidat
    - Menyimpan kandidat ke TrackingResult
    """
    alumni = db.query(models.Alumni).filter(models.Alumni.id == alumni_id).first()
    if not alumni:
        return

    # Hapus hasil pelacakan lama agar tidak menumpuk saat dilacak ulang
    db.query(models.TrackingResult).filter(models.TrackingResult.alumni_id == alumni_id).delete()
    db.commit()

    time.sleep(2)

    # Query tahap 1–3 mengikuti pola temanmu
    query1 = f"\"{alumni.name}\" {alumni.campus or ''}".strip()
    query2 = f"{alumni.name} {alumni.campus or ''}".strip()
    query3 = f"\"{alumni.name}\" {alumni.major or ''}".strip()

    kandidat1 = fetch_data_dari_internet(query1)
    kandidat2 = fetch_data_dari_internet(query2) if not kandidat1 else []
    kandidat3 = fetch_data_dari_internet(query3)

    semua_kandidat = kandidat1 + kandidat2 + kandidat3

    def map_domain_to_platform(link: str) -> str:
        domain = urlparse(link).netloc.lower()
        if "linkedin.com" in domain:
            return "LinkedIn"
        if "scholar.google." in domain:
            return "Google Scholar"
        if "researchgate.net" in domain:
            return "ResearchGate"
        if "orcid.org" in domain:
            return "ORCID"
        if "github.com" in domain:
            return "GitHub"
        if "kaggle.com" in domain:
            return "Kaggle"
        if domain:
            return domain
        return "Google Umum"

    kandidat_potensial: list[dict] = []
    kandidat_terbaik = None
    skor_tertinggi = 0

    for k in semua_kandidat:
        skor, match_nama = hitung_bobot_kecocokan(alumni, k)
        platform = map_domain_to_platform(k.get("link", ""))

        allowed_platforms = [s.strip() for s in (alumni.source_platforms or "").split(',')] if alumni.source_platforms else []
        
        # Jika platform (misal kompasiana.com) tidak ada di allowed_platforms, 
        # kita kategorikan sebagai "Google Umum" atau "Website Perusahaan", 
        # JANGAN DIBUANG jika memang informasinya sangat valid (skor tinggi).
        if allowed_platforms and platform not in allowed_platforms:
            if "Google Umum" in allowed_platforms:
                platform = "Google Umum"
            elif "Website Perusahaan" in allowed_platforms:
                platform = "Website Perusahaan"
            else:
                # Jika user tidak ceklis Google Umum/Situs Perusahaan, 
                # barulah kita buang hasil dari domain random ini
                continue

        # Log skor untuk mempermudah debugging
        print(f"[{platform}] M={match_nama} T={skor} | {k.get('sinyal_nama', '')[:50]}...")

        # Kriteria dilonggarkan sedikit agar hasil tidak gampang terbuang
        if match_nama >= 10 and skor >= 30:
            entry = {**k, "skor": skor, "platform": platform}
            kandidat_potensial.append(entry)

    print(f"[Scraper] Dari {len(semua_kandidat)} jejak, {len(kandidat_potensial)} masuk potensial.")

    # Filter unik berdasarkan link (menghindari duplikat dari multi query)
    unik_links = set()
    kandidat_unik = []
    
    for pot in kandidat_potensial:
        link = pot.get("link")
        if link not in unik_links:
            unik_links.add(link)
            kandidat_unik.append(pot)
            
    # Sort: Platform spesifik SELALU di atas Google Umum, lalu by skor, lalu urutan platform
    _platform_order = {
        'LinkedIn': 1, 'Google Scholar': 2, 'ResearchGate': 3,
        'ORCID': 4, 'GitHub': 5, 'Kaggle': 6, 'Website Perusahaan': 7, 'Google Umum': 99
    }
    kandidat_unik.sort(key=lambda x: (
        1 if x.get("platform", "") == "Google Umum" else 0,  # Google Umum selalu terakhir
        -x["skor"],                                           # Skor tertinggi dulu
        _platform_order.get(x.get("platform", ""), 50)        # Urutan platform
    ))
    
    # KANDIDAT TERBAIK ADALAH YANG PERTAMA SETELAH DISORTIR 
    # (Agar sinkron 100% dengan urutan Card di Frontend)
    kandidat_terbaik = kandidat_unik[0] if kandidat_unik else None

    # =====================================================
    # TAHAP PENENTUAN STATUS (Algoritma Kecocokan 70%)
    # Mengikuti logika referensi milik teman pengguna
    # =====================================================
    status_akhir = "Belum Ditemukan"

    if kandidat_terbaik:
        tahun_diperbarui = alumni.graduation_year
        
        # Ekstraksi Tahun
        if not tahun_diperbarui or tahun_diperbarui.strip() == "-" or tahun_diperbarui.strip() == "":
            import re
            teks_bukti = (kandidat_terbaik.get("sinyal_nama", "") + " " + kandidat_terbaik.get("sinyal_pekerjaan", ""))
            match_tahun = re.search(r"\b(19|20)\d{2}\b", teks_bukti)
            if match_tahun:
                tahun_diperbarui = match_tahun.group(0)
                
        # Hitung Persentase Kecocokan (Nama + Kampus)
        import re
        kampus = (alumni.campus or "").lower()
        regex_kampus = re.compile(rf"({re.escape(kampus)}|umm|muhammadiyah malang|universitas muhammadiyah)", re.IGNORECASE)
        
        jumlah_kokoh = 0
        for pot in kandidat_unik:
            teks_pot = (pot.get("sinyal_nama", "") + " " + pot.get("sinyal_pekerjaan", "")).lower()
            nama_cocok = (alumni.name or "").lower() in teks_pot if alumni.name else False
            kampus_cocok = bool(regex_kampus.search(teks_pot))
            
            if nama_cocok and kampus_cocok:
                jumlah_kokoh += 1
                
        total_kandidat = len(kandidat_unik)
        persen_kokoh = (jumlah_kokoh / total_kandidat * 100) if total_kandidat > 0 else 0
        
        # Keputusan berdasarkan persentase
        if persen_kokoh > 70 and jumlah_kokoh >= 1:
            status_akhir = "Teridentifikasi"
        elif persen_kokoh > 0 or skor_tertinggi >= 50:
            status_akhir = "Perlu Verifikasi Manual"
        else:
            status_akhir = "Belum Ditemukan"
            
        alumni.status = status_akhir
        alumni.graduation_year = tahun_diperbarui
        if status_akhir != "Belum Ditemukan":
            extracted = (kandidat_terbaik.get("sinyal_pekerjaan") or kandidat_terbaik.get("sinyal_nama") or "")
            # Bersihkan prefix [Skor XX%] jika ada
            import re as re_clean
            cleaned = re_clean.sub(r'^\[Skor \d+%\]\s*', '', extracted).strip()
            alumni.job = cleaned or "Informasi hasil pelacakan"
            alumni.job_source = kandidat_terbaik["platform"]
            alumni.job_url = kandidat_terbaik.get("link")
            
        # TAHAP 8: SIMPAN BUKTI AUDIT
        for pot in kandidat_unik[:10]: # Max 10 log per session
            if pot["skor"] >= 80:
                conf_label = "Tinggi"
            elif pot["skor"] >= 50:
                conf_label = "Sedang"
            else:
                conf_label = "Rendah"

            extracted = (pot.get("sinyal_pekerjaan") or pot.get("sinyal_nama") or "")[:300]
            tr = models.TrackingResult(
                alumni_id=alumni.id,
                source=pot["platform"],
                url=pot.get("link") or "",
                extracted_info=f"[Skor {pot['skor']}%] {extracted}",
                confidence_score=conf_label,
            )
            db.add(tr)
            
    else:
        alumni.status = "Belum Ditemukan"
        alumni.job = "Belum ada hasil"
        alumni.job_source = None
    
    alumni.last_tracked = datetime.now()
    db.commit()

@app.post("/alumni/", response_model=schemas.AlumniResponse)
def create_alumni(alumni: schemas.AlumniCreate, db: Session = Depends(get_db)):
    # We no longer check for unique NIM based on user request. 
    # Just insert the new target directly.
    new_alumni = models.Alumni(
        name=alumni.name, 
        campus=alumni.campus,
        major=alumni.major,
        graduation_year=alumni.graduation_year,
        source_platforms=alumni.source_platforms
    )
    db.add(new_alumni)
    db.commit()
    db.refresh(new_alumni)
    return new_alumni

@app.get("/alumni/", response_model=List[schemas.AlumniResponse])
def get_all_alumni(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(models.Alumni).offset(skip).limit(limit).all()

@app.post("/alumni/{alumni_id}/track")
def trigger_tracking(alumni_id: int, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    alumni = db.query(models.Alumni).filter(models.Alumni.id == alumni_id).first()
    if not alumni:
        raise HTTPException(status_code=404, detail="Alumni not found")
    
    # Change status to Tracking
    alumni.status = "Sedang Dilacak..."
    db.commit()

    # Add the scraping job to background tasks
    background_tasks.add_task(mock_scraping_task, alumni_id, db)
    
    return {"message": f"Tracking job started for {alumni.name}"}

@app.get("/alumni/{alumni_id}/results", response_model=List[schemas.TrackingResultResponse])
def get_tracking_results(alumni_id: int, db: Session = Depends(get_db)):
    return db.query(models.TrackingResult).filter(models.TrackingResult.alumni_id == alumni_id).all()

@app.put("/alumni/{alumni_id}/verify")
def manual_verify(alumni_id: int, status: str, notes: str = None, job: str = None, job_source: str = None, job_url: str = None, db: Session = Depends(get_db)):
    alumni = db.query(models.Alumni).filter(models.Alumni.id == alumni_id).first()
    if not alumni:
        raise HTTPException(status_code=404, detail="Alumni not found")
    
    alumni.status = status
    if notes is not None:
        alumni.notes = notes
    if job is not None:
        alumni.job = job
    if job_source is not None:
        alumni.job_source = job_source
    if job_url is not None:
        alumni.job_url = job_url

    if status == "Belum Dilacak":
        alumni.job = "Belum ada hasil"
        alumni.job_source = None
        alumni.job_url = None
        alumni.notes = None
    
    db.commit()
    return {"message": "Status updated via manual verification"}

@app.delete("/alumni/{alumni_id}")
def delete_alumni(alumni_id: int, db: Session = Depends(get_db)):
    alumni = db.query(models.Alumni).filter(models.Alumni.id == alumni_id).first()
    if not alumni:
        raise HTTPException(status_code=404, detail="Alumni not found")
    
    # Delete related tracking results first
    db.query(models.TrackingResult).filter(models.TrackingResult.alumni_id == alumni_id).delete()
    db.delete(alumni)
    db.commit()
    return {"message": f"Alumni {alumni.name} and related data deleted"}
