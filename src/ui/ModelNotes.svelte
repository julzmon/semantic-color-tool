<script lang="ts">
</script>

<details class="model-notes">
  <summary>Model decisions & scope <span>Read the assumptions ↗</span></summary>
  <div class="notes-grid">
    <div>
      <h3>Semantic first</h3>
      <p>
        Generate surfaces → position muted states → solve shared family lightness → collect primitives. No
        manually designed lightness ramp. All color math lives in a pure TypeScript engine using Culori.
      </p>
    </div>
    <div>
      <h3>One palette, two modes</h3>
      <p>
        Corresponding roles across Neutral, Brand, Info, Positive, Negative, and Warning share lightness.
        Emphasis fills are shared across themes by default; adaptive emphasis remains available.
      </p>
    </div>
    <div>
      <h3>Exact Brand constraints</h3>
      <p>
        Brand anchors default to background emphasis base. An exact lock remains literal, even when it cannot
        satisfy a contrast relationship; failures stay visible.
      </p>
    </div>
    <div>
      <h3>Current boundary</h3>
      <p>
        Opaque sRGB colors, normal/large text, emphasis-fill text, decorative borders, CSS/DTCG exports, and
        configuration import are included. UI-boundary checks apply to emphasis borders. Transparent overlays
        and Figma Variables remain outside this builder.
      </p>
    </div>
  </div>
</details>
