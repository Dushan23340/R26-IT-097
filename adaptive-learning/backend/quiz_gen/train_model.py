"""Run once (and any time templates.py's registry changes) to train and
save quiz_gen/template_selector.pt. Prints the loss curve summary and final
train accuracy so the training is verifiable, not just asserted.

Usage: .venv/bin/python3 -m quiz_gen.train_model   (from adaptive-learning/backend)
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from quiz_gen import model as M  # noqa: E402


def main() -> None:
    result = M.train(epochs=300, lr=0.05, seed=0)
    losses = result["losses"]
    print(f"training examples: {result['n_examples']}")
    print(f"loss  epoch 1: {losses[0]:.4f}")
    print(f"loss  epoch {len(losses)//2}: {losses[len(losses)//2]:.4f}")
    print(f"loss  epoch {len(losses)}: {result['final_loss']:.4f}")
    print(f"train accuracy: {result['train_accuracy']*100:.1f}%")
    print(f"weights saved to: {M.WEIGHTS_PATH}")


if __name__ == "__main__":
    main()
