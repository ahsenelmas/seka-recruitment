from sqlalchemy import select

from app.database import Base, SessionLocal, engine
from app.models import Branch, Candidate


DEMO_CITIES = ["Warszawa", "Kraków", "Wrocław", "Gdańsk", "Poznań"]

DEMO_CANDIDATES = [
    {
        "first_name": "Anna",
        "last_name": "Kowalska",
        "email": "anna.kowalska@example.com",
        "position": "Specjalista ds. BHP",
        "city": "Warszawa",
        "status": "new",
    },
    {
        "first_name": "Piotr",
        "last_name": "Nowak",
        "email": "piotr.nowak@example.com",
        "position": "Koordynator szkoleń",
        "city": "Kraków",
        "status": "review",
    },
    {
        "first_name": "Maria",
        "last_name": "Wiśniewska",
        "email": "maria.wisniewska@example.com",
        "position": "Specjalista ds. administracji",
        "city": "Wrocław",
        "status": "interview",
    },
    {
        "first_name": "Tomasz",
        "last_name": "Zieliński",
        "email": "tomasz.zielinski@example.com",
        "position": "Specjalista ds. BHP",
        "city": "Gdańsk",
        "status": "hired",
    },
    {
        "first_name": "Karolina",
        "last_name": "Wójcik",
        "email": "karolina.wojcik@example.com",
        "position": "Koordynator szkoleń",
        "city": "Poznań",
        "status": "rejected",
    },
]


def main():
    Base.metadata.create_all(bind=engine)

    with SessionLocal() as db:
        branches = {}

        for city in DEMO_CITIES:
            branch = db.scalar(
                select(Branch).where(Branch.city == city)
            )
            if branch is None:
                branch = Branch(
                    city=city,
                    name=f"Oddział demonstracyjny — {city}",
                )
                db.add(branch)
                db.flush()

            branches[city] = branch

        added = 0

        for sample in DEMO_CANDIDATES:
            existing = db.scalar(
                select(Candidate).where(
                    Candidate.email == sample["email"]
                )
            )
            if existing is not None:
                continue

            fields = dict(sample)
            city = fields.pop("city")

            db.add(
                Candidate(
                    **fields,
                    branch_id=branches[city].id,
                    source="demo",
                    hr_notes="Fikcyjny kandydat — dane demonstracyjne.",
                )
            )
            added += 1

        db.commit()

        branch_count = len(db.scalars(select(Branch)).all())
        candidate_count = len(db.scalars(select(Candidate)).all())

        print("Baza danych została przygotowana.")
        print(f"Oddziały: {branch_count}")
        print(f"Kandydaci: {candidate_count}")
        print(f"Dodano kandydatów: {added}")


if __name__ == "__main__":
    main()
