# Three.js: Domain Expansion Exhibit
- Demo: https://domain-expansion-exhibit.vercel.app/
- Architected an infinite-zoom Three.js runtime using exponent-based domain scaling + cyclic domain queue rotation for seamless nested-world traversal.
- Built a procedural generation pipeline (domain factories/generators + shader modules) so each domain is parameter-driven instead of manually authored.
- Implemented graphics optimization controls with high/medium/low quality tiers, runtime diagnostics (lil-gui), and render-order/material tuning for translucent geometry.
- Developed the core render orchestrator (loop, mode switching, camera/control flow) and integrated custom GLSL effects via onBeforeCompile shader injection.