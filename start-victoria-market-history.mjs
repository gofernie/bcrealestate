import "dotenv/config";

const secret = process.env.CRON_SECRET;

if (!secret) {
  throw new Error("CRON_SECRET is missing from .env");
}

const response = await fetch(
  "https://bc.realestate/.netlify/functions/market-history-background?city=victoria",
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ city: "victoria" }),
  }
);

console.log("Status:", response.status);
console.log(await response.text());
