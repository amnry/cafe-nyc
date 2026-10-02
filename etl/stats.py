from collections import Counter
from dataclasses import dataclass, field


@dataclass
class Stats:
    google: Counter = field(default_factory=Counter)
    anthropic_calls: int = 0
    input_tokens: int = 0
    output_tokens: int = 0
    web_fetches: int = 0
    cafes_processed: int = 0  # read by the abort path, which has no other handle on progress

    @property
    def google_total(self) -> int:
        return sum(self.google.values())
