"Domain Expansion Exhibition" - how to run locally:

  1. Open code/index.html in your browser. In WebStorm / VS Code you can
  right-click index.html and use “Open in Browser” (or equivalent). Many setups serve the
  page with a normal http(s) URL or otherwise run fine so you don’t have to start another 
  server yourself.

    If something still fails (blank page, import errors in the console, assets not loading),
    run a live server first (via Node or LiveServer extension or python) from this folder (the one that contains index.html), e.g.:

      `python3 -m http.server 8080`

    then visit http://localhost:8080/
  
  2. Optionally, you can view the deployed version of this project at https://domain-expansion-exhibit.vercel.app/.

What you should see:
  - Full-screen WebGL, controls at the bottom (Dev / Play / Reverse).
  - GUI top-right (“Engine Settings” and etc).
