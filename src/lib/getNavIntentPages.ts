export async function getNavIntentPages(
  supabase: any,
  siteId?: string | null
) {
  if (!siteId) {
    return [];
  }

  const { data, error } = await supabase
    .from("intent_pages")
    .select(`
      slug,
      nav_label,
      hero_heading,
      seo_heading,
      lifestyle_angle,
      property_type,
      sort_order,
      show_in_nav
    `)
    .eq("site_id", siteId)
    .eq("is_published", true)
    .eq("show_in_nav", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Nav intent pages error:", error);
    return [];
  }

  return data || [];
}