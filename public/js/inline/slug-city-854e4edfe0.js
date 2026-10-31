
(function() {
  const dashboard = document.getElementById("area-dashboard");
  if (!dashboard) return;

  const raw = JSON.parse(dashboard.dataset.listings || "[]");
  const accent = dashboard.dataset.accent || "#2f6f73";

  const prices = raw.map(l => l.price).filter(p => p > 0);
  if (!prices.length) return;

  const script = document.createElement("script");
  script.src = "https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js";
  script.onload = function() {
    // Price distribution
const sorted = [...prices].sort((a, b) => a - b);
const p95 = sorted[Math.floor(sorted.length * 0.95)];
const min = sorted[0];
const max = p95;
const bucketSize = Math.ceil((max - min) / 8 / 50000) * 50000 || 100000;
const filteredPrices = prices.filter(p => p <= max * 1.1);
    const buckets = {};
    filteredPrices.forEach(p => {
      const key = Math.floor(p / bucketSize) * bucketSize;
      buckets[key] = (buckets[key] || 0) + 1;
    });
    const bucketKeys = Object.keys(buckets).map(Number).sort((a,b)=>a-b);

    new Chart(document.getElementById("price-chart"), {
      type: "bar",
      data: {
        labels: bucketKeys.map(k => `$${Math.round(k/1000)}k`),
        datasets: [{
          data: bucketKeys.map(k => buckets[k]),
          backgroundColor: accent + "cc",
          borderColor: accent,
          borderWidth: 1,
          borderRadius: 4,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { font: { size: 10 }, maxRotation: 45 }, grid: { display: false } },
          y: { ticks: { font: { size: 10 }, stepSize: 1 }, grid: { color: "#f0efec" } }
        }
      }
    });

    // Property types
    const typeCounts = {};
    raw.forEach(l => {
      const t = l.type || "other";
      typeCounts[t] = (typeCounts[t] || 0) + 1;
    });
    const typeLabels = Object.keys(typeCounts).map(t => t.charAt(0).toUpperCase() + t.slice(1));
    const typeData = Object.values(typeCounts);

    const shades = [accent, accent + "bb", accent + "88", accent + "55", accent + "33"];

    new Chart(document.getElementById("type-chart"), {
      type: "doughnut",
      data: {
        labels: typeLabels,
        datasets: [{
          data: typeData,
          backgroundColor: shades.slice(0, typeLabels.length),
          borderWidth: 2,
          borderColor: "#fff"
        }]
      },
     options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: { left: 10, right: 10, top: 5, bottom: 5 } },
        plugins: {
          legend: {
            display: true,
            position: "bottom",
            labels: { font: { size: 10 }, boxWidth: 10, padding: 8 }
          }
        }
      }
    });
  };
  document.head.appendChild(script);
})();
