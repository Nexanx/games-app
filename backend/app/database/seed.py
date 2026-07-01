from sqlalchemy import select

from app.database.session import SessionLocal
from app.models import Setting


def seed() -> None:
    db = SessionLocal()
    try:
        if not db.scalar(select(Setting.id).where(Setting.key == "theme")):
            db.add(Setting(key="theme", value={"mode": "dark"}))
            db.commit()
    finally:
        db.close()


if __name__ == "__main__":
    seed()
