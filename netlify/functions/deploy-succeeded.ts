// Runs automatically after every successful Netlify deploy.
// Hands off to the background warmer so the full city list can take as long as it needs.
export const handler = async () => {
  try {
    const res = await fetch("https://bc.realestate/.netlify/functions/cache-warm-background", { method: "POST" });
    console.log(`cache warm triggered: ${res.status}`);
  } catch (error) {
    console.log(`cache warm trigger failed: ${String(error)}`);
  }
  return { statusCode: 200, body: "ok" };
};
