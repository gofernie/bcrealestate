// crm-plans v1: once a day (~8am Pacific) send due plan emails / queue review ones
export default async () => {
  const base = process.env.URL || "https://bc.realestate";
  const r = await fetch(`${base}/api/drip-run`, { method: "POST", headers: { "x-drip-secret": process.env.DRIP_SECRET || "" } });
  console.log("drip-run", r.status, (await r.text()).slice(0, 3000));
  return new Response("ok");
};
export const config = { schedule: "7 16 * * *" };