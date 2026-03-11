from __future__ import annotations

import csv
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Mapping

import numpy as np
from sklearn.datasets import load_breast_cancer
from sklearn.ensemble import GradientBoostingClassifier, RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, f1_score, precision_score, recall_score, roc_auc_score
from sklearn.model_selection import StratifiedKFold
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler


def _round_metric(value: float) -> float:
    return round(float(value), 4)


def _build_models(random_state: int) -> dict[str, Pipeline]:
    return {
        "Logistic Regression": Pipeline(
            [
                ("scaler", StandardScaler()),
                ("classifier", LogisticRegression(max_iter=3000, random_state=random_state)),
            ]
        ),
        "Random Forest": Pipeline(
            [
                (
                    "classifier",
                    RandomForestClassifier(
                        n_estimators=400,
                        max_depth=10,
                        class_weight="balanced",
                        random_state=random_state,
                        n_jobs=1,
                    ),
                )
            ]
        ),
        "Gradient Boosting": Pipeline(
            [("classifier", GradientBoostingClassifier(random_state=random_state))]
        ),
    }


def _safe_roc_auc(y_true: np.ndarray, y_score: np.ndarray) -> float:
    try:
        return float(roc_auc_score(y_true, y_score))
    except ValueError:
        return 0.5


def _write_dataset_export(
    dataset_export_path: Path,
    x: np.ndarray,
    y: np.ndarray,
    feature_names: list[str],
    target_names: list[str],
) -> str:
    dataset_export_path.parent.mkdir(parents=True, exist_ok=True)
    with dataset_export_path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow([*feature_names, "target", "target_label"])
        for row, target in zip(x, y):
            target_value = int(target)
            target_label = target_names[target_value] if target_value < len(target_names) else str(target_value)
            writer.writerow([*row.tolist(), target_value, target_label])
    return str(dataset_export_path)


def run_real_dataset_benchmark(
    benchmark_path: str | Path,
    dataset_export_path: str | Path,
    random_state: int = 42,
) -> dict:
    benchmark_path = Path(benchmark_path)
    dataset_export_path = Path(dataset_export_path)

    dataset = load_breast_cancer(as_frame=False)
    x = dataset.data
    y = dataset.target
    feature_names = list(dataset.feature_names)
    dataset_target_names = list(dataset.target_names)

    export_path_value = str(dataset_export_path)
    try:
        export_path_value = _write_dataset_export(
            dataset_export_path,
            x,
            y,
            feature_names,
            dataset_target_names,
        )
    except OSError:
        export_path_value = "export skipped: filesystem is read-only"

    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=random_state)
    folds = [fold for fold in range(1, cv.get_n_splits() + 1)]

    model_summaries: list[dict] = []
    for model_name, model in _build_models(random_state).items():
        accuracy_by_fold: list[float] = []
        precision_by_fold: list[float] = []
        recall_by_fold: list[float] = []
        f1_by_fold: list[float] = []
        roc_auc_by_fold: list[float] = []

        for train_idx, test_idx in cv.split(x, y):
            x_train = x[train_idx]
            y_train = y[train_idx]
            x_test = x[test_idx]
            y_test = y[test_idx]

            model.fit(x_train, y_train)
            y_pred = model.predict(x_test)
            if hasattr(model, "predict_proba"):
                y_prob = model.predict_proba(x_test)[:, 1]
            else:
                y_prob = y_pred.astype(float)

            accuracy_by_fold.append(_round_metric(accuracy_score(y_test, y_pred)))
            precision_by_fold.append(
                _round_metric(precision_score(y_test, y_pred, zero_division=0))
            )
            recall_by_fold.append(_round_metric(recall_score(y_test, y_pred, zero_division=0)))
            f1_by_fold.append(_round_metric(f1_score(y_test, y_pred, zero_division=0)))
            roc_auc_by_fold.append(_round_metric(_safe_roc_auc(y_test, y_prob)))

        model_summaries.append(
            {
                "name": model_name,
                "accuracy_by_fold": accuracy_by_fold,
                "mean_metrics": {
                    "accuracy": _round_metric(np.mean(accuracy_by_fold)),
                    "precision": _round_metric(np.mean(precision_by_fold)),
                    "recall": _round_metric(np.mean(recall_by_fold)),
                    "f1_score": _round_metric(np.mean(f1_by_fold)),
                    "roc_auc": _round_metric(np.mean(roc_auc_by_fold)),
                },
            }
        )

    model_summaries.sort(
        key=lambda row: (
            row["mean_metrics"]["roc_auc"],
            row["mean_metrics"]["recall"],
            row["mean_metrics"]["accuracy"],
        ),
        reverse=True,
    )

    payload = {
        "dataset": {
            "name": "Breast Cancer Wisconsin (Diagnostic)",
            "source": "UCI ML Repository dataset via sklearn.datasets.load_breast_cancer",
            "rows": int(x.shape[0]),
            "features": int(x.shape[1]),
            "target_names": dataset_target_names,
            "export_path": export_path_value,
        },
        "folds": folds,
        "models": model_summaries,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }

    try:
        benchmark_path.parent.mkdir(parents=True, exist_ok=True)
        benchmark_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    except OSError:
        pass
    return payload


def load_or_run_benchmark(config: Mapping[str, object], force_refresh: bool = False) -> dict:
    benchmark_path = Path(
        str(config.get("BENCHMARK_PATH", Path("models") / "benchmark_metrics.json"))
    )
    dataset_export_path = Path(
        str(config.get("REAL_DATASET_EXPORT_PATH", Path("data") / "breast_cancer_dataset.csv"))
    )
    random_state = int(config.get("MODEL_RANDOM_STATE", 42))

    if benchmark_path.exists() and not force_refresh:
        try:
            return json.loads(benchmark_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            pass

    return run_real_dataset_benchmark(
        benchmark_path=benchmark_path,
        dataset_export_path=dataset_export_path,
        random_state=random_state,
    )
