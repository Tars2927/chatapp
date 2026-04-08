from __future__ import annotations

import math
import os
import re
from dataclasses import dataclass
from functools import lru_cache
from typing import Any, Pattern


MODERATION_LABELS = (
    "toxic",
    "severe_toxic",
    "obscene",
    "threat",
    "insult",
    "identity_hate",
)
DEFAULT_THRESHOLD = 0.5
DEFAULT_EXPLANATION_LIMIT = 5
MODERATION_VERSION = "rules-v1"


@dataclass(frozen=True)
class WeightedPattern:
    label: str
    pattern: Pattern[str]
    weight: float


@dataclass(frozen=True)
class MatchEvidence:
    label: str
    phrase: str
    weight: float


PATTERN_SPECS: dict[str, tuple[tuple[str, float], ...]] = {
    "toxic": (
        (r"\bhate\s+you\b", 1.0),
        (r"\bshut\s+up\b", 0.7),
        (r"\bdisgusting\b", 0.75),
        (r"\bpathetic\b", 0.8),
        (r"\bpiece\s+of\s+trash\b", 1.1),
        (r"\byou(?:'re| are)\s+garbage\b", 1.0),
        (r"\byou(?:'re| are)\s+the\s+worst\b", 0.9),
    ),
    "severe_toxic": (
        (r"\bkill\s+yourself\b", 1.8),
        (r"\bgo\s+die\b", 1.5),
        (r"\bdrop\s+dead\b", 1.5),
        (r"\bburn\s+in\s+hell\b", 1.35),
        (r"\bpiece\s+of\s+shit\b", 1.25),
        (r"\bworthless\s+waste\b", 1.2),
    ),
    "obscene": (
        (r"\bfuck(?:ing|ed|er|s)?\b", 1.15),
        (r"\bshit(?:ty)?\b", 0.95),
        (r"\bbitch(?:es)?\b", 1.0),
        (r"\bbastard(?:s)?\b", 0.85),
        (r"\basshole(?:s)?\b", 1.0),
        (r"\bmotherfucker(?:s)?\b", 1.3),
        (r"\bdickhead(?:s)?\b", 1.05),
    ),
    "threat": (
        (r"\b(?:i[' ]?ll|i\s+will)\s+(?:kill|hurt|beat|destroy|hunt)\s+you\b", 1.65),
        (r"\bkill\s+you\b", 1.55),
        (r"\bhurt\s+you\b", 1.2),
        (r"\bbeat\s+you(?:\s+up)?\b", 1.25),
        (r"\bdestroy\s+you\b", 1.1),
        (r"\bmake\s+you\s+pay\b", 1.05),
        (r"\bfind\s+you\b", 0.9),
    ),
    "insult": (
        (r"\bidiot(?:ic)?\b", 1.0),
        (r"\bmoron(?:ic)?\b", 1.0),
        (r"\bstupid\b", 0.9),
        (r"\bdumb\b", 0.8),
        (r"\bloser\b", 0.9),
        (r"\bclown\b", 0.8),
        (r"\buseless\b", 0.9),
        (r"\btrash\b", 0.75),
        (r"\bjerk\b", 0.7),
        (r"\bfool\b", 0.65),
    ),
    "identity_hate": (
        (
            r"\b(?:hate|despise)\s+(?:gay|trans|muslim|hindu|christian|black|white|asian|immigrant)s?\b",
            1.5,
        ),
        (
            r"\b(?:gay|trans|muslim|hindu|christian|black|white|asian|immigrant)s?\b.{0,20}\b(?:dirty|stupid|inferior|disgusting|filthy|vermin|animals?)\b",
            1.45,
        ),
        (
            r"\b(?:all|these)\s+(?:gay|trans|muslim|hindu|christian|black|white|asian|immigrant)s?\s+are\s+(?:dirty|stupid|inferior|disgusting|filthy|vermin|animals?)\b",
            1.55,
        ),
    ),
}


def _parse_bool(value: str | None, default: bool) -> bool:
    if value is None:
        return default
    return value.strip().lower() not in {"0", "false", "no", "off"}


def _parse_float(value: str | None, default: float, minimum: float, maximum: float) -> float:
    try:
        parsed = float(value) if value is not None else default
    except (TypeError, ValueError):
        parsed = default
    return max(minimum, min(maximum, parsed))


def _parse_int(value: str | None, default: int, minimum: int, maximum: int) -> int:
    try:
        parsed = int(value) if value is not None else default
    except (TypeError, ValueError):
        parsed = default
    return max(minimum, min(maximum, parsed))


def _clean_phrase(value: str) -> str:
    return re.sub(r"\s+", " ", value.strip().lower())


class ModerationService:
    def __init__(self) -> None:
        self.enabled = _parse_bool(os.getenv("MODERATION_ENABLED"), True)
        self.threshold = _parse_float(
            os.getenv("TOXICITY_THRESHOLD"),
            default=DEFAULT_THRESHOLD,
            minimum=0.05,
            maximum=0.99,
        )
        self.explanation_limit = _parse_int(
            os.getenv("MODERATION_EXPLANATION_LIMIT"),
            default=DEFAULT_EXPLANATION_LIMIT,
            minimum=1,
            maximum=10,
        )
        self.patterns = self._compile_patterns()

    def _compile_patterns(self) -> tuple[WeightedPattern, ...]:
        compiled: list[WeightedPattern] = []
        for label, specs in PATTERN_SPECS.items():
            for expression, weight in specs:
                compiled.append(
                    WeightedPattern(
                        label=label,
                        pattern=re.compile(expression, re.IGNORECASE),
                        weight=weight,
                    )
                )
        return tuple(compiled)

    def _collect_matches(self, text: str) -> dict[str, list[MatchEvidence]]:
        matches_by_label = {label: [] for label in MODERATION_LABELS}
        seen_keys: set[tuple[str, str]] = set()

        for weighted_pattern in self.patterns:
            for match in weighted_pattern.pattern.finditer(text):
                phrase = _clean_phrase(match.group(0))
                if not phrase:
                    continue

                key = (weighted_pattern.label, phrase)
                if key in seen_keys:
                    continue

                seen_keys.add(key)
                matches_by_label[weighted_pattern.label].append(
                    MatchEvidence(
                        label=weighted_pattern.label,
                        phrase=phrase,
                        weight=weighted_pattern.weight,
                    )
                )

        return matches_by_label

    @staticmethod
    def _score_matches(matches: list[MatchEvidence]) -> float:
        if not matches:
            return 0.0
        total_weight = sum(match.weight for match in matches)
        return round(min(0.999, 1.0 - math.exp(-total_weight)), 4)

    def moderate(self, text: str | None) -> dict[str, Any]:
        cleaned_text = (text or "").strip()
        base_result = {
            "is_toxic": False,
            "confidence": 0.0,
            "labels": {label: 0.0 for label in MODERATION_LABELS},
            "explanation": {"method": "rules", "top_words": []},
            "flagged_categories": [],
            "threshold": self.threshold,
            "moderation_version": MODERATION_VERSION,
        }

        if not self.enabled:
            base_result["explanation"]["method"] = "disabled"
            return base_result

        if not cleaned_text:
            return base_result

        matches_by_label = self._collect_matches(cleaned_text)
        scores = {
            label: self._score_matches(matches)
            for label, matches in matches_by_label.items()
        }

        downstream_scores = [
            scores["severe_toxic"],
            scores["obscene"],
            scores["threat"],
            scores["insult"],
            scores["identity_hate"],
        ]
        scores["toxic"] = round(max(scores["toxic"], max(downstream_scores, default=0.0)), 4)

        flagged_categories = [
            label
            for label in MODERATION_LABELS
            if scores[label] >= self.threshold
        ]

        contribution_map: dict[str, float] = {}
        for label in MODERATION_LABELS:
            for match in matches_by_label[label]:
                contribution_map[match.phrase] = round(
                    max(contribution_map.get(match.phrase, 0.0), match.weight),
                    4,
                )

        top_words = [
            {"word": phrase, "score": score}
            for phrase, score in sorted(
                contribution_map.items(),
                key=lambda item: (-item[1], item[0]),
            )[: self.explanation_limit]
        ]

        confidence = round(max(scores.values(), default=0.0), 4)

        return {
            "is_toxic": bool(flagged_categories),
            "confidence": confidence,
            "labels": scores,
            "explanation": {"method": "rules", "top_words": top_words},
            "flagged_categories": flagged_categories,
            "threshold": self.threshold,
            "moderation_version": MODERATION_VERSION,
        }

    def build_storage_payload(self, text: str | None) -> dict[str, Any]:
        result = self.moderate(text)
        return {
            "is_toxic": result["is_toxic"],
            "toxicity_confidence": result["confidence"],
            "toxic_labels": {
                "labels": result["labels"],
                "flagged_categories": result["flagged_categories"],
                "explanation": result["explanation"],
                "threshold": result["threshold"],
                "moderation_version": result["moderation_version"],
            },
        }

    def health_payload(self) -> dict[str, Any]:
        return {
            "enabled": self.enabled,
            "method": "rules",
            "threshold": self.threshold,
            "label_count": len(MODERATION_LABELS),
            "version": MODERATION_VERSION,
        }


@lru_cache(maxsize=1)
def get_moderation_service() -> ModerationService:
    return ModerationService()


def apply_message_moderation(target: Any, text: str | None) -> dict[str, Any]:
    payload = get_moderation_service().build_storage_payload(text)
    target.is_toxic = payload["is_toxic"]
    target.toxicity_confidence = payload["toxicity_confidence"]
    target.toxic_labels = payload["toxic_labels"]
    return payload
