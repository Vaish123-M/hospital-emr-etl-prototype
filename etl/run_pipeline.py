"""Automation runner for profiling + cleaning + loading Excel EMR data."""

from __future__ import annotations

from pathlib import Path

from data_profiling import (
    EXCEL_PATH,
    REPORT_PATH,
    load_and_normalize_excel,
    profile_dataframe,
    write_markdown_report,
)
from ingest import (
    load_patients_dataframe,
    load_visits_dataframe,
    run_patient_ingestion,
    run_visit_ingestion,
)
from logging_config import setup_logger


def main() -> None:
    logger = setup_logger("etl.pipeline")
    logger.info("ETL automation started")

    excel_path = EXCEL_PATH
    if not Path(excel_path).exists():
        logger.error("Excel file not found: %s", excel_path)
        return

    try:
        raw_df = load_and_normalize_excel(excel_path)
        profile = profile_dataframe(raw_df)
        write_markdown_report(profile, REPORT_PATH)
        logger.info("Data profile report generated at %s", REPORT_PATH)

        cleaned_df = load_patients_dataframe(excel_path)
        inserted = run_patient_ingestion(cleaned_df)
        logger.info("Patient ingestion completed. Records inserted: %s", inserted)

        cleaned_visits_df = load_visits_dataframe(excel_path)
        visit_inserted = run_visit_ingestion(cleaned_visits_df)
        logger.info("Visit ingestion completed. Records inserted: %s", visit_inserted)
        logger.info("ETL automation finished successfully")
    except Exception as exc:  # pragma: no cover - defensive logging
        logger.exception("ETL automation failed: %s", exc)


if __name__ == "__main__":
    main()
