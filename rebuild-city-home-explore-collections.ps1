& {
  $ErrorActionPreference = "Stop"

  $relativePath = "src\pages\[city]\index.astro"
  $targetPath = Join-Path (Get-Location) $relativePath
  $originalBytes = $null
  $wroteTarget = $false

  function Normalize-Lf {
    param([string]$Text)
    return ($Text -replace "`r`n", "`n")
  }

  function Replace-Once {
    param(
      [string]$Text,
      [string]$Old,
      [string]$New,
      [string]$Label
    )

    $Old = Normalize-Lf $Old
    $New = Normalize-Lf $New
    $count = [regex]::Matches($Text, [regex]::Escape($Old)).Count

    if ($count -ne 1) {
      throw "Expected one $Label marker; found $count. No source changes were made."
    }

    return $Text.Replace($Old, $New)
  }

  try {
    if (-not (Test-Path -LiteralPath $targetPath)) {
      throw "Could not find $relativePath. Run this from the repository root."
    }

    $originalBytes = [System.IO.File]::ReadAllBytes($targetPath)
    $original = [System.IO.File]::ReadAllText($targetPath, [System.Text.Encoding]::UTF8)
    $source = Normalize-Lf $original

    if ($source.Contains("/* city-home-collections-v1 */")) {
      throw "This layout update is already present. No source changes were made."
    }

    $dataMarker = @'
intentCollections = intentCollections.slice(0, 8);
'@

    $dataReplacement = @'
intentCollections = intentCollections.slice(0, 8);

const featuredIntentCollections = allIntentCollections.slice(0, 4);
const featuredIntentHrefs = new Set(
  featuredIntentCollections.map((collection) => collection.href)
);
const remainingIntentPageRows = (intentPageRows || []).filter(
  (page: any) => !featuredIntentHrefs.has(`/${page.city}/${page.slug}`)
);
'@

    $source = Replace-Once $source $dataMarker $dataReplacement "intent collection"

    $oldIntro = @'
  <div class="locus-home-explore__intro">
    <span class="locus-home-section-kicker">{cityName.toUpperCase()} HOME SEARCH</span>
    <h2>Find your next home</h2>
    <p>
      Explore {cityName} by {isGreaterVictoriaMarket ? "district" : "neighbourhood"} or home type. See what is available now, then narrow in on the places that fit.
    </p>
    <a href={`/${city || "nanaimo"}`}>Explore all {cityName} listings &rarr;</a>
  </div>
'@

    $newIntro = @'
  <div class="locus-home-explore__intro">
    <span class="locus-home-section-kicker">{cityName.toUpperCase()} COLLECTIONS</span>
    <h2>Find a home that fits</h2>
    <p class="locus-home-explore__lede">
      Start with a curated search built around the way you want to live.
    </p>

    {featuredIntentCollections.length > 0 && (
      <div class="locus-home-collection-grid" aria-label={`Featured ${cityName} collections`}>
        {featuredIntentCollections.map((collection) => (
          <a href={collection.href} class="locus-home-collection-card">
            <span>Curated collection</span>
            <strong>{collection.title}</strong>
            <b aria-hidden="true">&rarr;</b>
          </a>
        ))}
      </div>
    )}

    <a class="locus-home-explore__all-listings" href={`/${city || "nanaimo"}`}>
      Explore all {cityName} listings &rarr;
    </a>
  </div>
'@

    $source = Replace-Once $source $oldIntro $newIntro "home-search introduction"
    $source = Replace-Once $source 'aria-label="Browse Nanaimo homes"' 'aria-label={`Browse ${cityName} homes`}' "browse label"
    $source = Replace-Once $source 'homepageAreaCards.slice(0, 7)' 'homepageAreaCards.slice(0, 4)' "area-card limit"
    $source = Replace-Once $source 'homepageTypeCards.slice(0, 7)' 'homepageTypeCards.slice(0, 4)' "home-type-card limit"

    $oldRelatedCards = @'
<RelatedIntentCards
          city={city}
          pages={intentPageRows || []}
          inventory={relatedIntentCardInventory || []}
          currentType={type}
          title="Search by what matters."
        />
'@

    $newRelatedCards = @'
<RelatedIntentCards
          city={city}
          pages={remainingIntentPageRows}
          inventory={relatedIntentCardInventory || []}
          currentType={type}
          title="More ways to explore."
        />
'@

    $source = Replace-Once $source $oldRelatedCards $newRelatedCards "lower collection section"

    $collectionStyles = @'
<style is:global>
/* city-home-collections-v1 */
.locus-home-explore {
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
}

.locus-home-explore__intro {
  display: flex;
  flex-direction: column;
  padding: 24px 26px;
}

.locus-home-explore__intro h2 {
  max-width: none;
  margin: 6px 0 7px;
}

.locus-home-explore__intro p.locus-home-explore__lede {
  max-width: 38ch;
  margin: 0 0 15px;
}

.locus-home-collection-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin: 0 0 15px;
}

.locus-home-collection-card {
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-height: 76px;
  padding: 11px 31px 11px 12px;
  border: 1px solid rgba(8, 36, 58, .16);
  border-radius: 7px;
  background: #f6fafb;
  color: var(--ink);
  text-decoration: none;
  transition: border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease;
}

.locus-home-collection-card:hover {
  border-color: rgba(8, 36, 58, .34);
  box-shadow: 0 8px 20px rgba(8, 36, 58, .09);
  color: var(--ink);
  transform: translateY(-1px);
}

.locus-home-collection-card span {
  color: var(--locus-muted, #687785);
  font-size: .61rem;
  font-weight: 800;
  letter-spacing: .08em;
  line-height: 1.2;
  text-transform: uppercase;
}

.locus-home-collection-card strong {
  max-width: 18ch;
  margin-top: 7px;
  font-size: .91rem;
  line-height: 1.15;
  letter-spacing: -.015em;
}

.locus-home-collection-card b {
  position: absolute;
  right: 11px;
  bottom: 12px;
  color: var(--accent);
  font-size: 1rem;
  line-height: 1;
}

.locus-home-explore__intro a.locus-home-explore__all-listings {
  display: inline-flex;
  align-items: center;
  margin-top: auto;
  color: var(--ink);
  font-size: .78rem;
  font-weight: 800;
  text-decoration: none;
}

.locus-home-explore__intro a.locus-home-explore__all-listings:hover {
  color: var(--accent);
}

.locus-home-explore__content .locus-home-neighbourhood-grid {
  grid-auto-rows: 72px;
}

.locus-home-explore__content .locus-home-neighbourhood-card {
  min-height: 0;
  padding: 12px 13px;
  gap: 8px;
}

.locus-home-explore__content .locus-home-neighbourhood-card strong {
  font-size: .9rem;
}

.locus-home-explore__content .locus-home-neighbourhood-card span {
  font-size: .68rem;
}

:global(html[data-theme="dark"]) .locus-home-collection-card {
  border-color: #394149;
  background: #1d2125;
  color: #f1f4f5;
}

:global(html[data-theme="dark"]) .locus-home-collection-card:hover {
  border-color: #5a6773;
  color: #f1f4f5;
}

:global(html[data-theme="dark"]) .locus-home-collection-card span {
  color: #aeb9c2;
}

@media (max-width: 760px) {
  .locus-home-explore {
    grid-template-columns: 1fr;
  }

  .locus-home-explore__intro {
    padding: 24px 22px 22px;
  }

  .locus-home-explore__intro a.locus-home-explore__all-listings {
    margin-top: 0;
  }
}

@media (max-width: 520px) {
  .locus-home-collection-grid {
    grid-template-columns: 1fr;
  }
}
</style>
'@

    $source = $source.TrimEnd() + "`n" + (Normalize-Lf $collectionStyles) + "`n"

    [System.IO.File]::WriteAllText(
      $targetPath,
      $source,
      [System.Text.UTF8Encoding]::new($false)
    )
    $wroteTarget = $true

    npm run build
    if ($LASTEXITCODE -ne 0) {
      throw "Build failed. The original source will be restored."
    }

    git diff --check -- ':(literal)src/pages/[city]/index.astro'
    if ($LASTEXITCODE -ne 0) {
      throw "git diff --check failed. The original source will be restored."
    }

    git diff --stat -- ':(literal)src/pages/[city]/index.astro'
    Write-Host "Done - rebuilt the city-home collections and compacted the area/type browser."
  }
  catch {
    if ($wroteTarget -and $null -ne $originalBytes) {
      [System.IO.File]::WriteAllBytes($targetPath, $originalBytes)
      Write-Host "Restored the original source after the failed check."
    }

    throw
  }
}
