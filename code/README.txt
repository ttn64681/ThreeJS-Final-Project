"Domain Expansion Exhibition" - how to run

  Open code/index.html in your browser. In WebStorm / VS Code you can
  right-click index.html and use “Open in Browser” (or equivalent). Many setups serve the
  page with a normal http(s) URL or otherwise run fine so you don’t have to start another 
  server yourself.

  If something still fails (blank page, import errors in the console, assets not loading),
  run a live server first (via Node or LiveServer extension or python) from this folder (the one that contains index.html), e.g.:

    python3 -m http.server 8080

  then visit http://localhost:8080/

What you should see
  - Full-screen WebGL, controls at the bottom (Play / Reverse / Dev).
  - lil-gui top-right (“Engine Settings”).
  - Optional: assets/music.mp3 for intro BGM (missing file may show a harmless 404).
