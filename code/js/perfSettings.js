// ================== PERFORMANCE SETTINGS ==================
// Quality presets for weaker GPUs / laptops
// Inject ?perf=medium or ?perf=low on browser URL (default is high)
// main.js reads browser URL for perf setting and sets renderer settings accordingly
// ==========================================================

const PRESETS = {
    high: {
        maxPixelRatio: 1.5,
        physicallyCorrectLights: true,
        skySegments: 64,
        groundSegments: 64,
        moonSegments: 32,
        bonePiles: 50,
        crosses: 25,
        swords: 150,
        buildings: 400,
        doorRows: 19,
        doorCols: 36,
    },
    medium: {
        maxPixelRatio: 1.25,
        physicallyCorrectLights: true,
        skySegments: 48,
        groundSegments: 48,
        moonSegments: 24,
        bonePiles: 32,
        crosses: 16,
        swords: 80,
        buildings: 160,
        doorRows: 14,
        doorCols: 28,
    },
    low: {
        maxPixelRatio: 1,
        physicallyCorrectLights: false,
        skySegments: 32,
        groundSegments: 32,
        moonSegments: 16,
        bonePiles: 20,
        crosses: 10,
        swords: 45,
        buildings: 80,
        doorRows: 10,
        doorCols: 20,
    },
};

export function getPerf() {
    // Get ?perf=high or ?perf=medium or ?perf=low (default is high)
    const raw = new URLSearchParams(window.location.search).get('perf') || 'high';
    const tier = PRESETS[raw] ? raw : 'high'; // retrieve preset based on url ?perf=...
    return { tier, ...PRESETS[tier] };
}
