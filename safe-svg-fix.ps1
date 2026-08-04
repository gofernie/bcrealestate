$path = '.\src\pages\[city]\[slug].astro'

Copy-Item `
  -LiteralPath $path `
  -Destination "$path.before-safe-svg-icons.bak" `
  -Force

$content = Get-Content `
  -LiteralPath $path `
  -Raw `
  -Encoding UTF8

$replacements = [ordered]@{
  '?? Grocery <strong></strong>' = 'Grocery <strong></strong>'
  '? Food & CafÃ©s <strong></strong>' = 'Food & Caf&eacute;s <strong></strong>'
  '?? Medical <strong></strong>' = 'Medical <strong></strong>'
  '?? Schools <strong></strong>' = 'Schools <strong></strong>'
  '?? Childcare <strong></strong>' = 'Childcare <strong></strong>'
  '?? Playgrounds <strong></strong>' = 'Playgrounds <strong></strong>'
  '?? Parks <strong></strong>' = 'Parks <strong></strong>'
  '??? Recreation <strong></strong>' = 'Recreation <strong></strong>'
  '?? Trails <strong></strong>' = 'Trails <strong></strong>'
  '??? Beaches <strong></strong>' = 'Beaches <strong></strong>'
  '?? Transit <strong></strong>' = 'Transit <strong></strong>'
  '? EV Charging <strong></strong>' = 'EV Charging <strong></strong>'
  '?? Listings On' = 'Listings On'
  '?? Show listings' = 'Show listings'
  '?? Hide listings' = 'Hide listings'
}

foreach ($item in $replacements.GetEnumerator()) {
  $content = $content.Replace($item.Key, $item.Value)
}

$css = @"

/* SAFE COLOURED SVG AMENITY ICONS */

.amenity-chip,
.map-listing-toggle {
  display: inline-flex;
  align-items: center;
  gap: 7px;
}

.amenity-chip::before,
.map-listing-toggle::before {
  content: "";
  display: inline-block;
  width: 1.05em;
  height: 1.05em;
  flex: 0 0 auto;
  background-color: currentColor;
  -webkit-mask-image: var(--svg-icon);
  mask-image: var(--svg-icon);
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
  -webkit-mask-position: center;
  mask-position: center;
  -webkit-mask-size: contain;
  mask-size: contain;
}

[data-amenity="grocery"] {
  --svg-icon: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 8h12l1 13H5L6 8Z'/%3E%3Cpath d='M9 8a3 3 0 0 1 6 0'/%3E%3C/svg%3E");
}

[data-amenity="restaurants"] {
  --svg-icon: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M7 3v8M4 3v5a3 3 0 0 0 6 0V3M7 11v10M17 3v18M17 3c3 2 3 7 0 9'/%3E%3C/svg%3E");
}

[data-amenity="medical"] {
  --svg-icon: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2'%3E%3Crect x='3' y='3' width='18' height='18' rx='3'/%3E%3Cpath d='M12 7v10M7 12h10'/%3E%3C/svg%3E");
}

[data-amenity="schools"],
[data-amenity="childcare"],
[data-amenity="playgrounds"] {
  --svg-icon: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m3 10 9-5 9 5-9 5-9-5Z'/%3E%3Cpath d='M7 12v5c3 2 7 2 10 0v-5M21 10v6'/%3E%3C/svg%3E");
}

[data-amenity="parks"],
[data-amenity="recreation"],
[data-amenity="trails"] {
  --svg-icon: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m12 3-4 6h3l-4 6h4v6h2v-6h4l-4-6h3l-4-6Z'/%3E%3C/svg%3E");
}

[data-amenity="beaches"] {
  --svg-icon: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round'%3E%3Cpath d='M3 8c3 0 3-2 6-2s3 2 6 2 3-2 6-2M3 13c3 0 3-2 6-2s3 2 6 2 3-2 6-2M3 18c3 0 3-2 6-2s3 2 6 2 3-2 6-2'/%3E%3C/svg%3E");
}

[data-amenity="transit"] {
  --svg-icon: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='5' y='3' width='14' height='16' rx='3'/%3E%3Cpath d='M8 19v2M16 19v2M5 11h14M8 7h8'/%3E%3C/svg%3E");
}

[data-amenity="ev-charging"] {
  --svg-icon: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M7 2v5M11 2v5M5 7h8v3a4 4 0 0 1-8 0V7ZM9 14v7M16 8h3v5a3 3 0 0 1-3 3h-1'/%3E%3C/svg%3E");
}

.map-listing-toggle {
  --svg-icon: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m3 11 9-8 9 8'/%3E%3Cpath d='M5 10v11h14V10M9 21v-7h6v7'/%3E%3C/svg%3E");
}

.amenity-chip {
  color: var(--ink);
}

.amenity-chip[data-amenity="grocery"]::before {
  color: #4d8f2d;
}

.amenity-chip[data-amenity="restaurants"]::before {
  color: #e76f20;
}

.amenity-chip[data-amenity="medical"]::before {
  color: #d63b45;
}

.amenity-chip[data-amenity="schools"]::before,
.amenity-chip[data-amenity="childcare"]::before,
.amenity-chip[data-amenity="playgrounds"]::before {
  color: #3478d4;
}

.amenity-chip[data-amenity="parks"]::before,
.amenity-chip[data-amenity="recreation"]::before {
  color: #2f8f3a;
}

.amenity-chip[data-amenity="trails"]::before {
  color: #987325;
}

.amenity-chip[data-amenity="beaches"]::before {
  color: #168fbf;
}

.amenity-chip[data-amenity="transit"]::before {
  color: #7b4ab4;
}

.amenity-chip[data-amenity="ev-charging"]::before {
  color: #4c9a32;
}

.amenity-chip.active {
  color: #fff;
}

.amenity-chip.active::before {
  color: #fff !important;
}

.map-listing-toggle::before {
  color: #3d7f31;
}

"@

$lastStyleClose = $content.LastIndexOf('</style>')

if ($lastStyleClose -lt 0) {
  throw 'Could not find closing style tag.'
}

$content =
  $content.Substring(0, $lastStyleClose) +
  $css +
  "`r`n" +
  $content.Substring($lastStyleClose)

Set-Content `
  -LiteralPath $path `
  -Value $content `
  -Encoding UTF8

Write-Host 'Safe coloured SVG icons added.' -ForegroundColor Green
