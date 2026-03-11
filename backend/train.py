from __future__ import annotations

import json
from pathlib import Path

from app.config import Settings
from app.services.benchmark import load_or_run_benchmark
from app.services.training import train_and_save_model


def main() -> None:
    settings = Settings.as_dict()
    artifact = train_and_save_model(
        model_path=Path(str(settings["MODEL_PATH"])),
        random_state=int(settings["MODEL_RANDOM_STATE"]),
        low_threshold=float(settings["RISK_LOW_THRESHOLD"]),
        high_threshold=float(settings["RISK_HIGH_THRESHOLD"]),
        dataset_size=int(settings["SYNTHETIC_DATASET_SIZE"]),
    )
    benchmark = load_or_run_benchmark(
        {
            "BENCHMARK_PATH": settings["BENCHMARK_PATH"],
            "REAL_DATASET_EXPORT_PATH": settings["REAL_DATASET_EXPORT_PATH"],
            "MODEL_RANDOM_STATE": settings["MODEL_RANDOM_STATE"],
        },
        force_refresh=True,
    )
    print("Model training complete.")
    print(json.dumps(artifact["metrics"], indent=2))
    print("Real dataset benchmark complete.")
    print(json.dumps({"dataset": benchmark["dataset"], "models": benchmark["models"]}, indent=2))


if __name__ == "__main__":
    main()
