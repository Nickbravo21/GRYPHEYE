import logging
import torch
from transformers import (
    AutoProcessor,
    AutoModelForZeroShotObjectDetection,
    SamProcessor,
    SamModel,
)

logger = logging.getLogger(__name__)

GDINO_MODEL_ID = "IDEA-Research/grounding-dino-tiny"
SAM_MODEL_ID = "facebook/sam-vit-base"


class ModelRegistry:
    """Singleton holding all loaded models and processors."""

    _instance: "ModelRegistry | None" = None

    def __init__(self) -> None:
        self.device: str = "cpu"
        self.gdino_processor = None
        self.gdino_model = None
        self.sam_processor = None
        self.sam_model = None

    @classmethod
    def get(cls) -> "ModelRegistry":
        if cls._instance is None:
            cls._instance = ModelRegistry()
        return cls._instance


def load_models() -> ModelRegistry:
    """Load all models once at startup."""
    registry = ModelRegistry.get()
    registry.device = "cuda" if torch.cuda.is_available() else "cpu"
    logger.info(f"Inference device: {registry.device.upper()}")

    # ── Grounding DINO ────────────────────────────────────────────────────────
    logger.info(f"Loading Grounding DINO  ({GDINO_MODEL_ID}) …")
    registry.gdino_processor = AutoProcessor.from_pretrained(GDINO_MODEL_ID)
    registry.gdino_model = (
        AutoModelForZeroShotObjectDetection.from_pretrained(GDINO_MODEL_ID)
        .to(registry.device)
        .eval()
    )
    logger.info("✓ Grounding DINO ready")

    # ── Segment Anything ──────────────────────────────────────────────────────
    logger.info(f"Loading SAM  ({SAM_MODEL_ID}) …")
    registry.sam_processor = SamProcessor.from_pretrained(SAM_MODEL_ID)
    registry.sam_model = (
        SamModel.from_pretrained(SAM_MODEL_ID)
        .to(registry.device)
        .eval()
    )
    logger.info("✓ SAM ready")

    return registry
