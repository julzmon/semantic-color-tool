# Shared emphasis mixing implementation

1. Add failing engine tests comparing generated emphasis states against independent Culori OKLCH interpolation, including reversed dark states and exact anchors.
2. Implement a shared emphasis recipe module and optional validated configuration weights. Update joint base solving, shared themes, and gray reuse while preserving the legacy engine path.
3. Teach coordinate shortening to validate derived colors, emit shared CSS settings/recipes, and materialize matching DTCG semantic states. Extend the independent CSS test resolver to evaluate mixes.
4. Migrate stored/imported configurations, replace emphasis spacing with shared strength controls, and update contrast limiting, feedback, and control tracks.
5. Update semantic/precision/direction/reuse tests and legacy parity fixtures. Run focused tests, then the full suite and build checks.
6. Update documentation, regenerate exports, verify all painted states and nested themes in a browser, and request an independent code review.

Continue in the current checkout containing the user's existing updates. No publication or commit is part of this request.
