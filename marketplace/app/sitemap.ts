import { MetadataRoute } from 'next';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'http://localhost:3000'; // Replace with production URL when deploying
  
  try {
    // Fetch products to generate dynamic sitemap entries
    const res = await fetch('http://127.0.0.1:8787/api/products');
    const data = await res.json();
    
    const productEntries = Array.isArray(data) ? data.map((item: any) => ({
      url: `${baseUrl}/shop/${item.product.id}`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })) : [];

    return [
      {
        url: baseUrl,
        lastModified: new Date(),
        changeFrequency: 'daily',
        priority: 1,
      },
      ...productEntries,
    ];
  } catch (error) {
    console.error('Failed to generate sitemap:', error);
    // Fallback if API fails
    return [
      {
        url: baseUrl,
        lastModified: new Date(),
        changeFrequency: 'daily',
        priority: 1,
      }
    ];
  }
}
