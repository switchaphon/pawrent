// Community post types

export interface Post {
  id: string;
  pet_id: string | null;
  owner_id: string;
  image_url: string;
  caption: string | null;
  likes_count: number;
  created_at: string;
}
