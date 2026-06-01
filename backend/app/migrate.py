from __future__ import annotations

from pathlib import Path

from app.database import engine


def run_migrations() -> None:
    migration_dir = Path(__file__).resolve().parents[1] / "migrations"
    migration_files = sorted(migration_dir.glob("*.sql"))
    if not migration_files:
        raise RuntimeError(f"No migration files found in {migration_dir}")

    with engine.begin() as connection:
        for migration in migration_files:
            sql = migration.read_text(encoding="utf-8")
            connection.exec_driver_sql(sql)
            print(f"Applied {migration.name}")


if __name__ == "__main__":
    run_migrations()
