"""Run once before starting the updated API. Safe to repeat; preserves rows."""
from sqlalchemy import text
from app.database import engine


def main():
    with engine.begin() as connection:
        connection.execute(text("SET LOCAL lock_timeout = '10s'"))
        connection.execute(text("ALTER TABLE candidates ALTER COLUMN position DROP NOT NULL"))
        connection.execute(text("ALTER TABLE candidates ALTER COLUMN branch_id DROP NOT NULL"))
        connection.execute(text("ALTER TABLE candidates ADD COLUMN IF NOT EXISTS cv_validation_error VARCHAR(255)"))
    print("Migracja zakończona. Zachowano istniejące aplikacje.")


if __name__ == "__main__":
    main()
