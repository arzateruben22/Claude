"""Lumevina Skin Intelligence worker.

Deterministic, explainable image measurements of how skin looks in
photographs: quality checks, region outlines from face landmarks,
pore-like features, texture, tone, pigmentation, redness, fine lines and
practitioner-outlined scars, registration between visits and difference
maps. No image ever leaves Lumevina's own Supabase project and this worker;
no external AI service is called.
"""

VERSION = "0.1.0"
ALGORITHM_VERSION = f"lumevina-skin-{VERSION}"
